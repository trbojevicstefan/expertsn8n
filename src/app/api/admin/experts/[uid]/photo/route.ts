import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/audit";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor } from "@/lib/expert-messages";

const schema = z.object({ photoStatus: z.enum(["APPROVED", "MISSING"]) });

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
  const bucket = adminStorage().bucket();
  const pendingPath = typeof profile.pendingPhotoStoragePath === "string" ? profile.pendingPhotoStoragePath : "";
  const pendingType = typeof profile.pendingPhotoContentType === "string" ? profile.pendingPhotoContentType : "";
  const hasApprovedPhoto = profile.photoStatus === "APPROVED" && Boolean(profile.photoUrl);
  const nowIso = new Date().toISOString();
  const missing = new Set((profile.missingFields || []) as string[]);

  if (input.photoStatus === "APPROVED") {
    let photoUrl = typeof profile.photoUrl === "string" ? profile.photoUrl : "";

    if (pendingPath) {
      const source = bucket.file(pendingPath);
      const [exists] = await source.exists();
      if (!exists) return NextResponse.json({ error: "Pending private photo could not be found." }, { status: 404 });
      const [metadata] = await source.getMetadata();
      const actualType = String(metadata.contentType || "");
      if (!/^image\/(jpeg|png|webp)$/.test(actualType) || (pendingType && pendingType !== actualType)) {
        return NextResponse.json({ error: "Pending photo metadata is invalid." }, { status: 400 });
      }

      const ext = actualType === "image/png" ? "png" : actualType === "image/webp" ? "webp" : "jpg";
      const publicPrefix = `public/experts/${expertId}/`;
      const publicPath = `${publicPrefix}photo.${ext}`;
      const token = randomUUID();

      // Keep the previous approved image until this decision, then atomically
      // switch the profile URL after the new public object exists.
      try {
        await bucket.deleteFiles({ prefix: publicPrefix });
      } catch {
        /* first approved photo */
      }
      await source.copy(bucket.file(publicPath));
      await bucket.file(publicPath).setMetadata({
        contentType: actualType,
        metadata: { firebaseStorageDownloadTokens: token },
      });
      photoUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
        `${encodeURIComponent(publicPath)}?alt=media&token=${token}`;
      try {
        await source.delete({ ignoreNotFound: true });
      } catch {
        /* approved public copy is already durable */
      }
    } else if (!photoUrl) {
      return NextResponse.json({ error: "There is no pending photo to approve." }, { status: 409 });
    }

    missing.delete("photo");
    await ref.set(
      {
        photoUrl,
        photoStatus: "APPROVED",
        pendingPhotoStatus: null,
        pendingPhotoStoragePath: null,
        pendingPhotoContentType: null,
        pendingPhotoSizeBytes: null,
        pendingPhotoUploadedAt: null,
        missingFields: [...missing],
        updatedAt: nowIso,
      },
      { merge: true },
    );
  } else {
    if (pendingPath) {
      try {
        await bucket.file(pendingPath).delete({ ignoreNotFound: true });
      } catch {
        /* metadata cleanup still proceeds */
      }
    }

    const patch: Record<string, unknown> = {
      pendingPhotoStatus: null,
      pendingPhotoStoragePath: null,
      pendingPhotoContentType: null,
      pendingPhotoSizeBytes: null,
      pendingPhotoUploadedAt: null,
      updatedAt: nowIso,
    };

    if (hasApprovedPhoto) {
      patch.photoStatus = "APPROVED";
      missing.delete("photo");
    } else {
      patch.photoStatus = "MISSING";
      patch.photoUrl = "";
      missing.add("photo");
      // Also cleans up legacy behavior where a PENDING_REVIEW photo had already
      // been copied under public/ before this hardened review flow existed.
      try {
        await bucket.deleteFiles({ prefix: `public/experts/${expertId}/` });
      } catch {
        /* nothing public */
      }
    }
    patch.missingFields = [...missing];
    await ref.set(patch, { merge: true });
  }

  await recordAuditEvent({
    actor: session,
    action: input.photoStatus === "APPROVED" ? "EXPERT_PHOTO_APPROVED" : "EXPERT_PHOTO_REJECTED",
    targetType: "expertProfile",
    targetId: expertId,
    metadata: { hadPendingPrivatePhoto: Boolean(pendingPath), keptPreviousApprovedPhoto: input.photoStatus === "MISSING" && hasApprovedPhoto },
  });

  const ownerUid = await ownerUidFor(expertId);
  if (ownerUid) {
    await notifyUser(ownerUid, {
      type: "REVIEW_DECISION",
      title: input.photoStatus === "APPROVED" ? "Your profile photo was approved" : "Your new profile photo was not approved",
      body:
        input.photoStatus === "APPROVED"
          ? "The reviewed photo is now the public profile image."
          : hasApprovedPhoto
            ? "Your previous approved photo remains live. You can upload another replacement."
            : "The pending photo stayed private and was removed. Please upload another one.",
      href: "/dashboard/expert/profile",
      expertId,
    });
  }

  return NextResponse.json({ ok: true, photoStatus: input.photoStatus });
}
