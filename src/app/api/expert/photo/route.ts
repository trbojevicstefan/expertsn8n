import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({
  storagePath: z.string().min(1).max(500),
  contentType: z.string().regex(/^image\/(jpeg|png|webp)$/),
});

/**
 * The browser uploads to the expert's private photo folder. Only the server
 * publishes a copy under `public/`, so an unreviewed private upload can never
 * be reachable by guessing a URL.
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
  if (!(await source.exists())[0]) {
    return NextResponse.json({ error: "The uploaded file could not be found." }, { status: 404 });
  }

  const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
  const publicPath = `public/experts/${expertId}/photo.${ext}`;
  const token = randomUUID();

  await source.copy(bucket.file(publicPath));
  await bucket.file(publicPath).setMetadata({
    contentType: input.contentType,
    metadata: { firebaseStorageDownloadTokens: token },
  });

  const photoUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(publicPath)}?alt=media&token=${token}`;

  const nowIso = new Date().toISOString();
  const profileRef = db.collection("expertProfiles").doc(expertId);
  const profileSnap = await profileRef.get();
  const missing = ((profileSnap.data() || {}).missingFields || []) as string[];

  await profileRef.set(
    {
      photoUrl,
      // Live immediately so the profile is not blank, but flagged so staff can
      // still review what was published.
      photoStatus: "PENDING_REVIEW",
      missingFields: missing.filter((f) => f !== "photo"),
      updatedAt: nowIso,
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, photoUrl });
}
