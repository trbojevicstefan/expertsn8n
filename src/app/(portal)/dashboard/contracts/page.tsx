import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { contractsFor, fundedTotal, releasedTotal } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const session = await requireSession();
  const contracts = await contractsFor(session);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Contracts</h1>
          <p>Funded work, submissions and releases.</p>
        </div>
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 size={22} strokeWidth={1.9} />}
          title="No contracts yet"
          body="A contract is created when a proposal is accepted. Until then there is nothing to fund or deliver against."
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Contract</th><th>Counterparty</th><th>Total</th><th>Funded</th><th>Released</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.jobTitle}</strong></td>
                  <td className="muted">{c.clientId === session.uid ? c.expertName : c.clientName}</td>
                  <td>€{(c.totalAmount || 0).toLocaleString()}</td>
                  <td>€{fundedTotal(c).toLocaleString()}</td>
                  <td>€{releasedTotal(c).toLocaleString()}</td>
                  <td><StatusBadge tone={c.status === "COMPLETED" ? "success" : "info"}>{c.status}</StatusBadge></td>
                  <td className="text-right">
                    <Link className="button button-secondary button-sm" href={`/contracts/${c.id}`}>Open</Link>
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
