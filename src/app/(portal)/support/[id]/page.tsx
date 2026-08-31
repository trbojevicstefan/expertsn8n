import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { TicketThread } from "@/components/ticket-thread";
import { canSeeTicket, loadTicket, ticketMessages } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const ticket = await loadTicket(id);
  if (!ticket || !canSeeTicket(ticket, session)) notFound();

  const messages = await ticketMessages(id);

  return (
    <>
      <div className="portal-head">
        <div>
          <Link href={session.admin ? "/admin/tickets" : "/support"} className="back-link">
            <ArrowLeft size={14} strokeWidth={2.2} />
            {session.admin ? "All tickets" : "Support"}
          </Link>
          <h1>{ticket.subject}</h1>
          <p>Opened by {ticket.raisedByName}</p>
        </div>
      </div>

      <TicketThread
        ticket={ticket}
        messages={messages}
        viewerUid={session.uid}
        isAdmin={Boolean(session.admin)}
      />
    </>
  );
}
