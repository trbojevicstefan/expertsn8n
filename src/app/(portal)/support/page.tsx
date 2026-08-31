import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { NewTicketForm } from "@/components/new-ticket-form";
import { ticketsFor } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await requireSession();
  const tickets = await ticketsFor(session);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Support</h1>
          <p>Anything that is not working, or a problem with a contract you are on.</p>
        </div>
        <NewTicketForm />
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={22} strokeWidth={1.9} />}
          title="Nothing open"
          body="If something goes wrong — with the platform or with someone you are working with — open a ticket and a person will read it."
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Subject</th><th>Type</th><th>State</th><th>Frozen</th><th /></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.subject}</strong><br />
                    <span className="muted">{t.body.slice(0, 90)}{t.body.length > 90 ? "…" : ""}</span>
                  </td>
                  <td><StatusBadge tone={t.kind === "DISPUTE" ? "warning" : "neutral"}>{t.kind}</StatusBadge></td>
                  <td>
                    <StatusBadge tone={t.state === "RESOLVED" ? "success" : t.state === "IN_REVIEW" ? "warning" : "info"}>
                      {t.state.replace("_", " ")}
                    </StatusBadge>
                  </td>
                  <td>{t.amountAtRisk != null ? `€${t.amountAtRisk.toLocaleString()}` : "—"}</td>
                  <td className="text-right">
                    <Link className="button button-secondary button-sm" href={`/support/${t.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
