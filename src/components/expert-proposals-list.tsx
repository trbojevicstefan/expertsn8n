"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { StatusBadge } from "./status-badge";

export interface ExpertProposalItem {
  id: string;
  jobId?: string;
  jobTitle?: string;
  price?: number;
  currency?: string;
  delivery?: string;
  status?: string;
  contractId?: string | null;
}

export function ExpertProposalsList({ proposals }: { proposals: ExpertProposalItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const withdraw = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not withdraw proposal.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not withdraw proposal.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      {error && <div className="error-box">{error}</div>}
      <div className="data-card card">
        <table className="data-table">
          <thead><tr><th>Project</th><th>Price</th><th>Delivery</th><th>Status</th><th /></tr></thead>
          <tbody>
            {proposals.map((proposal) => {
              const status = proposal.status || "SUBMITTED";
              const actionable = ["SUBMITTED", "SHORTLISTED", "OFFERED"].includes(status);
              return (
                <tr key={proposal.id}>
                  <td><strong>{proposal.jobTitle || "—"}</strong></td>
                  <td>{proposal.price != null ? `${proposal.currency || "EUR"} ${proposal.price.toLocaleString()}` : "—"}</td>
                  <td>{proposal.delivery || "—"}</td>
                  <td><StatusBadge tone={status === "ACCEPTED" ? "success" : status === "DECLINED" || status === "WITHDRAWN" ? "neutral" : "info"}>{status}</StatusBadge></td>
                  <td className="text-right">
                    <div className="job-row-actions">
                      {proposal.contractId && status === "ACCEPTED" && (
                        <Link className="button button-primary button-sm" href={`/contracts/${proposal.contractId}`}>Open contract</Link>
                      )}
                      {actionable && (
                        <button className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => withdraw(proposal.id)}>
                          <Undo2 size={13} />{busy === proposal.id ? "Withdrawing…" : "Withdraw"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
