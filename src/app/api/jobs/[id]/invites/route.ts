import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";

const schema = z.object({ expertId: z.string().min(3), note: z.string().max(1200).default("") });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "client") return NextResponse.json({ error: "Client account required." }, { status: 401 });
  try {
    const { id } = await params;
    const input = schema.parse(await req.json());
    assertNoOffPlatformContact(input.note);
    if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured.");
    const db = adminDb();
    const job = await db.collection("jobs").doc(id).get();
    const data = job.data();
    if (!data || data.clientId !== session.uid) throw new Error("You do not own this job.");
    if (!["DRAFT", "OPEN", "MATCHING"].includes(data.status)) throw new Error("This job is not accepting invites.");
    const ref = db.collection("jobInvites").doc();
    await ref.set({ jobId: id, clientId: session.uid, expertId: input.expertId, note: input.note, status: "SENT", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
    return NextResponse.json({ id: ref.id, status: "SENT" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invite failed" }, { status: 400 });
  }
}
