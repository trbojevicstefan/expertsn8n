"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { StatusBadge } from "./status-badge";

export interface ExpertInviteItem {
  id: string;
  jobId: string;
  clientName?: string;
  jobTitle?: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  status?: string;
  expiresAt?: string;
  note?: string;
}

export function ExpertInvitesList({ invites }: { invites: ExpertInviteItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const respond = async (id: string, action: "accept" | "decline") => {
    setBusy(`${id}:${action}`);
    setError("");
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(id)}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the invitation.");
      router.refresh();
      if (action === "accept" && data.jobId) router.push(`/jobs/${data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the invitation.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      {error && <div className="error-box">{error}</div>}
      <div className="data-card card">
        <table className="data-table">
          <thead>
            <tr><th>Client</th><th>Project</th><th>Budget</th><th>Status</th><th>Expires</th><th /></tr>
          </thead>
          <tbody>
            {invites.map((invite) => {
              const status = invite.status || "SENT";
              const actionable = status === "SENT";
              return (
                <tr key={invite.id}>
                  <td><strong>{invite.clientName || "—"}</strong></td>
                  <td>
                    <strong>{invite.jobTitle || "—"}</strong>
                    {invite.note && <><br /><span className="muted">{invite.note}</span></>}
                  </td>
                  <td>
                    {invite.budgetMin != null && invite.budgetMax != null
                      ? `${invite.currency || "EUR"} ${invite.budgetMin.toLocaleString()}–${invite.budgetMax.toLocaleString()}`
                      : "—"}
                  </td>
                  <td><StatusBadge tone={status === "ACCEPTED" ? "success" : status === "DECLINED" ? "neutral" : "info"}>{status}</StatusBadge></td>
                  <td className="muted">{invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "—"}</td>
                  <td className="text-right">
                    <div className="job-row-actions">
                      {invite.jobId && !["DECLINED", "EXPIRED"].includes(status) && (
                        <Link className="button button-secondary button-sm" href={`/jobs/${invite.jobId}`}>View brief</Link>
                      )}
                      {actionable && (
                        <>
                          <button className="button button-primary button-sm" disabled={busy !== ""} onClick={() => respond(invite.id, "accept")}>
                            <Check size={13} />{busy === `${invite.id}:accept` ? "Accepting…" : "Accept"}
                          </button>
                          <button className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => respond(invite.id, "decline")}>
                            <X size={13} />{busy === `${invite.id}:decline` ? "Declining…" : "Decline"}
                          </button>
                        </>
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
