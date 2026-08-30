import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";

const schema = z.object({
  title: z.string().min(3).max(120),
  bio: z.string().min(20).max(3000),
  location: z.string().max(120),
  country: z.string().max(80),
  timezone: z.string().max(40),
  hourlyRate: z.number().int().min(0).max(1000),
  availability: z.string().max(80),
  skills: z.array(z.string().min(1).max(48)).max(20),
  integrations: z.array(z.string().min(1).max(48)).max(20),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Profiles are not editable in this environment." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  }

  try {
    assertNoOffPlatformContact(input.bio);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid bio." }, { status: 400 });
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

  return NextResponse.json({ ok: true, missingFields: stillMissing });
}
