"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { postedLabel } from "@/lib/format";
import type { MarketplaceJob } from "@/lib/types";

export function AdminJobsTable({ jobs }: { jobs: MarketplaceJob[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const setStatus = async (id: string, status: "OPEN" | "CLOSED" | "FILLED") => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not update the job.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the job.");
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
            <tr>
              <th>Job</th><th>Client</th><th>Visibility</th><th>Status</th><th>Proposals</th><th>Budget</th><th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <strong>{j.title}</strong><br />
                  <span className="muted">{postedLabel(j.postedAt)}</span>
                </td>
                <td className="muted">{j.clientName || "—"}</td>
                <td><StatusBadge tone={j.visibility === "PRIVATE" ? "neutral" : "info"}>{j.visibility}</StatusBadge></td>
                <td><StatusBadge tone={j.status === "OPEN" ? "success" : "neutral"}>{j.status}</StatusBadge></td>
                <td>{j.proposalCount ?? 0}</td>
                <td>€{(j.budgetMin ?? 0).toLocaleString()}–€{(j.budgetMax ?? 0).toLocaleString()}</td>
                <td className="text-right">
                  <div className="job-row-actions">
                    {j.visibility === "PUBLIC" && j.status === "OPEN" && (
                      <Link className="button button-secondary button-sm" href={`/jobs/${j.id}`} target="_blank">
                        View <ExternalLink size={12} strokeWidth={2.2} />
                      </Link>
                    )}
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      disabled={busy === j.id}
                      onClick={() => setStatus(j.id, j.status === "OPEN" ? "CLOSED" : "OPEN")}
                    >
                      {busy === j.id ? "Working…" : j.status === "OPEN" ? "Close" : "Reopen"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
