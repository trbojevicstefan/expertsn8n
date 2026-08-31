import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";

const KINDS = ["cv", "portfolio", "certificate", "id", "other"] as const;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const schema = z.object({
  kind: z.enum(KINDS),
  fileName: z.string().min(1).max(200),
  storagePath: z.string().min(1).max(500),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
});

async function expertIdFor(uid: string): Promise<string | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const expertId = (snap.data() || {}).expertId;
  return typeof expertId === "string" && expertId ? expertId : null;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) return NextResponse.json({ documents: [] });

  const snap = await adminDb()
    .collection("expertDocuments")
    .where("ownerUid", "==", session.uid)
    .get();

  const documents = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String((b as { uploadedAt?: string }).uploadedAt).localeCompare(String((a as { uploadedAt?: string }).uploadedAt)));

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Document storage is not configured." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid document details." }, { status: 400 });
  }

  const prefix = `private/experts/${session.uid}/documents/${input.kind}/`;
  if (!input.storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: "Uploads must belong to the signed-in expert and document kind." }, { status: 403 });
  }

  const bucket = adminStorage().bucket();
  const object = bucket.file(input.storagePath);
  const [exists] = await object.exists();
  if (!exists) {
    return NextResponse.json({ error: "The uploaded file could not be found." }, { status: 404 });
  }

  const [metadata] = await object.getMetadata();
  const actualContentType = String(metadata.contentType || "");
  const actualSize = Number(metadata.size || 0);
  if (!ALLOWED_CONTENT_TYPES.has(actualContentType)) {
    return NextResponse.json({ error: "Unsupported document type." }, { status: 400 });
  }
  if (!Number.isFinite(actualSize) || actualSize <= 0 || actualSize > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Document size is invalid." }, { status: 400 });
  }
  if (actualContentType !== input.contentType || actualSize !== input.sizeBytes) {
    return NextResponse.json({ error: "Uploaded file metadata does not match the submitted document details." }, { status: 409 });
  }

  const db = adminDb();
  const expertId = await expertIdFor(session.uid);
  const nowIso = new Date().toISOString();

  const ref = db.collection("expertDocuments").doc();
  await ref.set({
    ownerUid: session.uid,
    expertId,
    kind: input.kind,
    fileName: input.fileName,
    storagePath: input.storagePath,
    contentType: actualContentType,
    sizeBytes: actualSize,
    uploadedAt: nowIso,
    reviewState: "PENDING",
  });

  if (expertId && input.kind === "cv") {
    await db.collection("expertProfiles").doc(expertId).set(
      { hasCv: true, updatedAt: nowIso },
      { merge: true },
    );
  }

  return NextResponse.json({ id: ref.id, ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Document storage is not configured." }, { status: 503 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing document id." }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("expertDocuments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const data = snap.data() || {};
  if (data.ownerUid !== session.uid) {
    return NextResponse.json({ error: "Not your document." }, { status: 403 });
  }

  const storagePath = typeof data.storagePath === "string" ? data.storagePath : "";
  const expectedPrefix = `private/experts/${session.uid}/documents/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Stored document path is invalid." }, { status: 409 });
  }

  const object = adminStorage().bucket().file(storagePath);
  try {
    await object.delete({ ignoreNotFound: true });
  } catch {
    return NextResponse.json({ error: "Could not delete the private file. The document record was kept." }, { status: 502 });
  }

  await ref.delete();

  if (data.kind === "cv" && data.expertId) {
    const remainingCv = await db
      .collection("expertDocuments")
      .where("ownerUid", "==", session.uid)
      .where("kind", "==", "cv")
      .limit(1)
      .get();
    if (remainingCv.empty) {
      await db.collection("expertProfiles").doc(String(data.expertId)).set(
        { hasCv: false, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
