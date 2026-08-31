"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { StatusBadge } from "./status-badge";

export interface ReceivedProposal {
  id: string;
  jobId: string;
  jobTitle: string;
  expertId: string;
  expertName: string;
  scope: string;
  price: number;
  delivery: string;
  status: string;
  contractId?: string | null;
  createdAt: string;
}

export function ProposalsReceived({ proposals }: { proposals: ReceivedProposal[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const accept = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(id)}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not accept that proposal.");
      router.push(`/contracts/${data.contractId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept that proposal.");
      setBusy("");
    }
  };

  return (
    <>
      {error && <div className="error-box">{error}</div>}
      <div className="proposal-list">
        {proposals.map((p) => (
          <article className="proposal-card card" key={p.id}>
            <div className="proposal-head">
              <div>
                <span className="eyebrow">{p.jobTitle}</span>
                <h3>{p.expertName}</h3>
              </div>
              <div className="proposal-price">
                <strong>€{(p.price || 0).toLocaleString()}</strong>
                <span>{p.delivery}</span>
              </div>
            </div>

            <p>{p.scope}</p>

            <div className="proposal-foot">
              <StatusBadge tone={p.status === "ACCEPTED" ? "success" : "info"}>{p.status}</StatusBadge>
              <div className="job-row-actions">
                <a className="button button-secondary button-sm" href={`/experts/${p.expertId}`} target="_blank" rel="noopener noreferrer">
                  View profile
                </a>
                {p.status === "ACCEPTED" && p.contractId ? (
                  <a className="button button-primary button-sm" href={`/contracts/${p.contractId}`}>Open contract</a>
                ) : (
                  <button
                    type="button"
                    className="button button-primary button-sm"
                    disabled={busy !== ""}
                    onClick={() => accept(p.id)}
                  >
                    <Check size={13} strokeWidth={2.4} />
                    {busy === p.id ? "Creating contract…" : "Accept and create contract"}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
