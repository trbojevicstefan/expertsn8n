import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyAdmins, notifyUser } from "@/lib/notifications";
import type { SupportTicket } from "@/lib/types";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Support is not available right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }

  const db = adminDb();
  const snap = await db.collection("supportTickets").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const ticket = { id: snap.id, ...snap.data() } as SupportTicket;
  const isOwner = ticket.raisedByUid === session.uid;
  if (!isOwner && !session.admin) {
    return NextResponse.json({ error: "This ticket is not yours." }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const body = input.body.trim();

  const ref = await db.collection("ticketMessages").add({
    ticketId: id,
    authorUid: session.uid,
    authorRole: session.role,
    authorName: session.admin && !isOwner ? "Marketplace support" : session.name || session.email,
    body,
    createdAt: nowIso,
  });

  await snap.ref.set(
    { updatedAt: nowIso, state: ticket.state === "OPEN" && session.admin ? "IN_REVIEW" : ticket.state },
    { merge: true },
  );

  if (session.admin && !isOwner) {
    await notifyUser(ticket.raisedByUid, {
      type: "MESSAGE",
      title: `Support replied: ${ticket.subject}`,
      body: body.slice(0, 160),
      href: `/support/${id}`,
    });
  } else {
    await notifyAdmins({
      type: "MESSAGE",
      title: `Reply on ticket: ${ticket.subject}`,
      body: body.slice(0, 160),
      href: `/admin/tickets/${id}`,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: ref.id, ticketId: id, authorUid: session.uid, authorRole: session.role,
        authorName: session.admin && !isOwner ? "Marketplace support" : session.name || session.email,
        body, createdAt: nowIso,
      },
    },
    { status: 201 },
  );
}
