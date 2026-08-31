import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { SessionUser, SupportTicket, TicketMessage } from "@/lib/types";

export async function ticketsFor(session: SessionUser): Promise<SupportTicket[]> {
  if (!firebaseAdminConfigured) return [];
  const db = adminDb();
  const snap = session.admin
    ? await db.collection("supportTickets").limit(300).get()
    : await db.collection("supportTickets").where("raisedByUid", "==", session.uid).limit(100).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as SupportTicket)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function loadTicket(id: string): Promise<SupportTicket | null> {
  if (!firebaseAdminConfigured) return null;
  const snap = await adminDb().collection("supportTickets").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as SupportTicket;
}

/** The person who raised it, and staff. Nobody else. */
export function canSeeTicket(ticket: SupportTicket, session: SessionUser): boolean {
  return ticket.raisedByUid === session.uid || Boolean(session.admin);
}

export async function ticketMessages(ticketId: string): Promise<TicketMessage[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb()
    .collection("ticketMessages")
    .where("ticketId", "==", ticketId)
    .limit(300)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TicketMessage)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
