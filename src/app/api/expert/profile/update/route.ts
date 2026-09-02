import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { syncMarketplaceUser } from "@/lib/customerio";
import { describeZodIssues, issueFields } from "@/lib/validation";

export const N8N_EXPERIENCE_OPTIONS = [
  "n8n Cloud",
  "Self-hosted n8n",
  "Queue mode / scaling",
  "Custom nodes",
  "AI agents in n8n",
  "Migrations from Zapier or Make",
];

export const SKILL_LIMIT = 50;

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  companyName: "Company name",
  title: "Headline",
  bio: "About your work",
  location: "Location",
  country: "Country",
  timezone: "Timezone",
  hourlyRate: "Reference hourly rate",
  availability: "Availability",
  skills: "Skills",
  integrations: "Integrations",
  languages: "Languages",
  yearsExperience: "Years of experience",
  hoursPerWeek: "Hours per week",
  minEngagement: "Minimum engagement",
  n8nExperience: "n8n experience",
  links: "Links",
  "links.url": "Link address",
  "links.label": "Link label",
};

const schema = z.object({
  // Editable, unlike the slug: public profile URLs are already circulating in
  // the claim emails, so changing a name must not change the link.
  name: z.string().min(2).max(80),
  companyName: z.string().max(80).default(""),
  title: z.string().min(3).max(120),
  bio: z.string().min(20).max(3000),
  location: z.string().max(120),
  country: z.string().max(80),
  timezone: z.string().max(40),
  hourlyRate: z.number().int().min(0).max(1000),
  availability: z.string().max(80),
  // Sized for what the importer actually wrote, not for hand typing. Seeded
  // profiles arrived with 36 skills and names as long as "Continuous
  // Integration and Continuous Delivery (CI/CD)", which the old caps of 20 and
  // 48 rejected -- leaving two people unable to save their own profile at all,
  // however they edited it.
  skills: z.array(z.string().min(1).max(80)).max(SKILL_LIMIT),
  integrations: z.array(z.string().min(1).max(80)).max(SKILL_LIMIT),
  languages: z.array(z.string().min(1).max(60)).max(20).default([]),
  yearsExperience: z.number().int().min(0).max(60).default(0),
  hoursPerWeek: z.number().int().min(0).max(80).default(0),
  minEngagement: z.number().int().min(0).max(1000000).default(0),
  n8nExperience: z.array(z.enum(N8N_EXPERIENCE_OPTIONS as [string, ...string[]])).max(10).default([]),
  links: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        // Only http(s): a javascript: or data: URL here would be rendered as an
        // anchor on the public profile.
        url: z.string().url().max(300).refine((u) => /^https?:\/\//i.test(u), "Links must start with http:// or https://"),
      }),
    )
    .max(8)
    .default([]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Profiles are not editable in this environment." }, { status: 503 });
  }

  // Naming the fields turns a dead end into something fixable, and puts the
  // reason in the logs. Only the field paths are recorded -- never the values.
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    console.error("Expert profile update rejected", issueFields(parsed.error));
    return NextResponse.json(
      { error: describeZodIssues(parsed.error, FIELD_LABELS) || "Check the fields and try again." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    assertNoOffPlatformContact(input.bio);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid bio.";
    console.error("Expert profile update blocked by the contact guard");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const db = adminDb();
  const userSnap = await db.collection("users").doc(session.uid).get();
  const expertId = (userSnap.data() || {}).expertId;
  if (typeof expertId !== "string" || !expertId) {
    return NextResponse.json({ error: "No expert profile is linked to this account." }, { status: 404 });
  }

  const profileRef = db.collection("expertProfiles").doc(expertId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const existing = profileSnap.data() || {};
  if (existing.claimedByUid !== session.uid) {
    return NextResponse.json({ error: "This profile belongs to another account." }, { status: 403 });
  }

  const stillMissing = ((existing.missingFields || []) as string[]).filter((f) => {
    if (f === "bio") return input.bio.length <= 80;
    if (f === "location") return !input.location;
    if (f === "hourlyRate") return input.hourlyRate <= 0;
    if (f === "availability") return !input.availability;
    if (f === "skills") return input.skills.length === 0;
    return true; // `photo` is cleared by the photo endpoint, not here.
  });

  await profileRef.set(
    { ...input, missingFields: stillMissing, updatedAt: new Date().toISOString() },
    { merge: true },
  );

  // The account's display name follows the profile so the portal header and any
  // future notification address them the same way.
  await db.collection("users").doc(session.uid).set({ name: input.name }, { merge: true });
  await syncMarketplaceUser(session.uid, "expert_profile_updated");

  return NextResponse.json({ ok: true, missingFields: stillMissing });
}
