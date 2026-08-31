"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2, X } from "lucide-react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Could not record that.");
}

function useDecision() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that.");
    } finally {
      setBusy("");
    }
  };

  return { busy, error, run };
}

export function DocumentReviewActions({ documentId, reviewState }: { documentId: string; reviewState: string }) {
  const { busy, error, run } = useDecision();
  const decide = (next: "APPROVED" | "REJECTED" | "PENDING") =>
    run(next, () => post(`/api/admin/documents/${encodeURIComponent(documentId)}/decision`, { reviewState: next }));

  return (
    <span className="asset-actions">
      {reviewState !== "APPROVED" && (
        <button type="button" className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => decide("APPROVED")}>
          <Check size={12} strokeWidth={2.4} />{busy === "APPROVED" ? "…" : "Approve"}
        </button>
      )}
      {reviewState !== "REJECTED" && (
        <button type="button" className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => decide("REJECTED")}>
          <X size={12} strokeWidth={2.4} />{busy === "REJECTED" ? "…" : "Reject"}
        </button>
      )}
      {reviewState !== "PENDING" && (
        <button type="button" className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => decide("PENDING")}>
          <Undo2 size={12} strokeWidth={2.4} />
        </button>
      )}
      {error && <span className="sc-review-error">{error}</span>}
    </span>
  );
}

export function PhotoReviewActions({ expertId, photoStatus, hasPhoto }: {
  expertId: string;
  photoStatus: string;
  hasPhoto: boolean;
}) {
  const { busy, error, run } = useDecision();
  if (!hasPhoto) return null;

  const decide = (next: "APPROVED" | "MISSING") =>
    run(next, () => post(`/api/admin/experts/${encodeURIComponent(expertId)}/photo`, { photoStatus: next }));

  return (
    <div className="asset-actions" style={{ marginTop: 10 }}>
      {photoStatus !== "APPROVED" && (
        <button type="button" className="button button-primary button-sm" disabled={busy !== ""} onClick={() => decide("APPROVED")}>
          <Check size={12} strokeWidth={2.4} />{busy === "APPROVED" ? "Approving…" : "Approve photo"}
        </button>
      )}
      <button type="button" className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => decide("MISSING")}>
        <X size={12} strokeWidth={2.4} />{busy === "MISSING" ? "Removing…" : "Reject and remove"}
      </button>
      {error && <span className="sc-review-error">{error}</span>}
    </div>
  );
}
