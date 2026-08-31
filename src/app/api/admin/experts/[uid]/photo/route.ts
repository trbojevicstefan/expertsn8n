import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor } from "@/lib/expert-messages";

const schema = z.object({ photoStatus: z.enum(["APPROVED", "MISSING", "PENDING_REVIEW"]) });

/**
 * Approving a photo is the only thing that clears the review flag. Rejecting it
 * (MISSING) also removes the published copy, otherwise a rejected photo would
 * stay visible on the public profile.
 */
export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Reviews are not available right now." }, { status: 503 });
  }

  const { uid: expertId } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("expertProfiles").doc(expertId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const profile = snap.data() || {};
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { photoStatus: input.photoStatus, updatedAt: nowIso };

  if (input.photoStatus === "MISSING") {
    patch.photoUrl = "";
    const missing = new Set(((profile.missingFields || []) as string[]).concat("photo"));
    patch.missingFields = [...missing];

    // Take the published copy down with it.
    const publicPrefix = `public/experts/${expertId}/`;
    try {
      await adminStorage().bucket().deleteFiles({ prefix: publicPrefix });
    } catch {
      /* nothing published yet */
    }
  }

  await ref.set(patch, { merge: true });

  const ownerUid = await ownerUidFor(expertId);
  if (ownerUid) {
    await notifyUser(ownerUid, {
      type: "REVIEW_DECISION",
      title: input.photoStatus === "APPROVED" ? "Your profile photo was approved" : "Your profile photo needs replacing",
      body:
        input.photoStatus === "APPROVED"
          ? "It is live on your public profile."
          : "It has been removed from your public profile. Please upload another one.",
      href: "/dashboard/expert/profile",
      expertId,
    });
  }

  return NextResponse.json({ ok: true, photoStatus: input.photoStatus });
}
