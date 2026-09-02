import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { syncMarketplaceUser } from "@/lib/customerio";
import { describeZodIssues } from "@/lib/validation";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const LABELS: Record<string, string> = {
  companyName: "Company name",
  website: "Company website",
  billingCountry: "Billing country",
  description: "What you automate",
};

const schema = z.object({
  companyName: z.string().min(2).max(160),
  website: z.union([z.literal(""), z.string().url().max(300)]),
  billingCountry: z.string().min(2).max(120),
  description: z.string().min(20).max(2000),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Client account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Client profiles are not available right now." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: describeZodIssues(parsed.error, LABELS) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const nowIso = new Date().toISOString();
  const profileRef = adminDb().collection("clientProfiles").doc(session.uid);
  const existing = await profileRef.get();
  await profileRef.set(
    {
      ...input,
      ownerUid: session.uid,
      onboardingComplete: true,
      updatedAt: nowIso,
      createdAt: existing.data()?.createdAt || nowIso,
    },
    { merge: true },
  );

  // First completion and later edits are different moments for a campaign: one
  // ends the onboarding chase, the other should not re-trigger it.
  await syncMarketplaceUser(
    session.uid,
    existing.exists ? "client_profile_updated" : "client_onboarding_completed",
  );
  return NextResponse.json({ ok: true });
}
