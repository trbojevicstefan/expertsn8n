import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const KINDS = ["cv", "portfolio", "certificate", "id", "other"] as const;

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

  // The client uploads straight to Storage, so the server must confirm the path
  // it is being asked to record actually belongs to this user.
  const prefix = `private/experts/${session.uid}/documents/`;
  if (!input.storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: "Uploads must belong to the signed-in expert." }, { status: 403 });
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
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
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

  const ref = adminDb().collection("expertDocuments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if ((snap.data() || {}).ownerUid !== session.uid) {
    return NextResponse.json({ error: "Not your document." }, { status: 403 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
