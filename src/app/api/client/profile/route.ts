import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { syncMarketplaceUser } from "@/lib/customerio";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

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

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Check the company profile fields and try again." }, { status: 400 });
  }

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
