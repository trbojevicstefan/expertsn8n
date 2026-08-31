import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({
  storagePath: z.string().min(1).max(500),
  contentType: z.string().regex(/^image\/(jpeg|png|webp)$/),
});

/**
 * Expert photos stay private until an admin explicitly approves them. Replacing
 * an already-approved photo keeps the old public image live while the new
 * private upload is pending review.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Photo storage is not configured." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "A JPG, PNG or WebP image is required." }, { status: 400 });
  }

  const prefix = `private/experts/${session.uid}/photo/`;
  if (!input.storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: "Uploads must belong to the signed-in expert." }, { status: 403 });
  }

  const db = adminDb();
  const userSnap = await db.collection("users").doc(session.uid).get();
  const expertId = (userSnap.data() || {}).expertId;
  if (typeof expertId !== "string" || !expertId) {
    return NextResponse.json({ error: "No expert profile is linked to this account." }, { status: 404 });
  }

  const bucket = adminStorage().bucket();
  const source = bucket.file(input.storagePath);
  const [exists] = await source.exists();
  if (!exists) return NextResponse.json({ error: "The uploaded file could not be found." }, { status: 404 });

  const [metadata] = await source.getMetadata();
  const actualType = String(metadata.contentType || "");
  const actualSize = Number(metadata.size || 0);
  if (actualType !== input.contentType || !/^image\/(jpeg|png|webp)$/.test(actualType)) {
    return NextResponse.json({ error: "Uploaded photo type does not match the submitted metadata." }, { status: 400 });
  }
  if (!Number.isFinite(actualSize) || actualSize <= 0 || actualSize > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Profile photos must be between 1 byte and 8 MB." }, { status: 400 });
  }

  const profileRef = db.collection("expertProfiles").doc(expertId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) return NextResponse.json({ error: "Expert profile not found." }, { status: 404 });
  const profile = profileSnap.data() || {};
  const previousPending = typeof profile.pendingPhotoStoragePath === "string" ? profile.pendingPhotoStoragePath : "";
  const hasApprovedPhoto = profile.photoStatus === "APPROVED" && Boolean(profile.photoUrl);
  const nowIso = new Date().toISOString();

  await profileRef.set(
    {
      // photoUrl remains the last approved public image (or empty). The new
      // object is referenced only by its private Storage path until review.
      photoStatus: hasApprovedPhoto ? "APPROVED" : "PENDING_REVIEW",
      pendingPhotoStatus: "PENDING_REVIEW",
      pendingPhotoStoragePath: input.storagePath,
      pendingPhotoContentType: actualType,
      pendingPhotoSizeBytes: actualSize,
      pendingPhotoUploadedAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true },
  );

  if (previousPending && previousPending !== input.storagePath && previousPending.startsWith(prefix)) {
    try {
      await bucket.file(previousPending).delete({ ignoreNotFound: true });
    } catch {
      // The new pending record is already valid; stale-file cleanup may be retried later.
    }
  }

  return NextResponse.json({ ok: true, photoStatus: "PENDING_REVIEW" }, { status: 202 });
}
