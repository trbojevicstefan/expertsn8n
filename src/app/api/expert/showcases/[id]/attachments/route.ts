import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({
  name: z.string().min(1).max(200),
  storagePath: z.string().min(1).max(600),
  contentType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
});

async function ownedShowcase(id: string, uid: string) {
  const ref = adminDb().collection("expertShowcases").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.ownerUid !== uid) return null;
  return { ref, data };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Uploads are not available right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid attachment details." }, { status: 400 });
  }

  // The browser uploads straight to Storage, so confirm the path it asks us to
  // record belongs to this user and this showcase.
  const prefix = `private/experts/${session.uid}/showcases/${id}/`;
  if (!input.storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: "Uploads must belong to the signed-in expert." }, { status: 403 });
  }

  const owned = await ownedShowcase(id, session.uid);
  if (!owned) return NextResponse.json({ error: "Showcase not found." }, { status: 404 });

  const existing = (owned.data.attachments || []) as { id: string }[];
  if (existing.length >= 10) {
    return NextResponse.json({ error: "A showcase can hold up to 10 attachments." }, { status: 400 });
  }

  const attachment = {
    id: randomUUID(),
    name: input.name,
    storagePath: input.storagePath,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    uploadedAt: new Date().toISOString(),
  };

  await owned.ref.set(
    { attachments: [...existing, attachment], updatedAt: attachment.uploadedAt },
    { merge: true },
  );

  return NextResponse.json({ ok: true, attachment }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Uploads are not available right now." }, { status: 503 });
  }

  const { id } = await params;
  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) return NextResponse.json({ error: "Missing attachment id." }, { status: 400 });

  const owned = await ownedShowcase(id, session.uid);
  if (!owned) return NextResponse.json({ error: "Showcase not found." }, { status: 404 });

  const existing = (owned.data.attachments || []) as { id: string; storagePath: string }[];
  const target = existing.find((a) => a.id === attachmentId);
  if (!target) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  await owned.ref.set(
    { attachments: existing.filter((a) => a.id !== attachmentId), updatedAt: new Date().toISOString() },
    { merge: true },
  );

  // Best effort: the record is gone either way, so a storage hiccup must not
  // leave a dangling row in the UI.
  try {
    await adminStorage().bucket().file(target.storagePath).delete();
  } catch {
    /* file already removed or never landed */
  }

  return NextResponse.json({ ok: true });
}
