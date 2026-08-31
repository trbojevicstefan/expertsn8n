import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ticketsFor } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTickets() {
  const session = await requireAdmin();
  const tickets = await ticketsFor(session);

  const open = tickets.filter((t) => t.state === "OPEN").length;
  const frozen = tickets
    .filter((t) => t.state !== "RESOLVED" && t.state !== "CLOSED")
    .reduce((sum, t) => sum + (t.amountAtRisk || 0), 0);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Support and disputes</h1>
          <p>
            {open} awaiting a first response
            {frozen > 0 ? ` · €${frozen.toLocaleString()} frozen across open disputes` : ""}
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={22} strokeWidth={1.9} />}
          title="Nothing raised"
          body="Support tickets and contract disputes arrive here. A dispute freezes the milestone it is about until you resolve it."
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Subject</th><th>Raised by</th><th>Type</th><th>State</th><th>Frozen</th><th /></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.subject}</strong><br />
                    <span className="muted">{t.body.slice(0, 90)}{t.body.length > 90 ? "…" : ""}</span>
                  </td>
                  <td className="muted">{t.raisedByName}<br /><span className="muted">{t.raisedByRole}</span></td>
                  <td><StatusBadge tone={t.kind === "DISPUTE" ? "warning" : "neutral"}>{t.kind}</StatusBadge></td>
                  <td>
                    <StatusBadge tone={t.state === "RESOLVED" ? "success" : t.state === "IN_REVIEW" ? "warning" : "danger"}>
                      {t.state.replace("_", " ")}
                    </StatusBadge>
                  </td>
                  <td>{t.amountAtRisk != null ? `€${t.amountAtRisk.toLocaleString()}` : "—"}</td>
                  <td className="text-right">
                    <Link className="button button-secondary button-sm" href={`/support/${t.id}`}>Review</Link>
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
