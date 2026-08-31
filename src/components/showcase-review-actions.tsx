"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2, X } from "lucide-react";

export function ShowcaseReviewActions({
  showcaseId,
  reviewState,
}: {
  showcaseId: string;
  reviewState: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const decide = async (next: "APPROVED" | "REJECTED" | "PENDING") => {
    setBusy(next);
    setError("");
    try {
      const res = await fetch(`/api/admin/showcases/${encodeURIComponent(showcaseId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewState: next, reason: "" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not record that.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="sc-review">
      {reviewState !== "APPROVED" && (
        <button type="button" className="button button-primary button-sm" disabled={busy !== ""} onClick={() => decide("APPROVED")}>
          <Check size={13} strokeWidth={2.4} />
          {busy === "APPROVED" ? "Approving…" : "Approve"}
        </button>
      )}
      {reviewState !== "REJECTED" && (
        <button type="button" className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => decide("REJECTED")}>
          <X size={13} strokeWidth={2.4} />
          {busy === "REJECTED" ? "Working…" : "Needs changes"}
        </button>
      )}
      {reviewState !== "PENDING" && (
        <button type="button" className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => decide("PENDING")}>
          <Undo2 size={13} strokeWidth={2.4} />
          Reset
        </button>
      )}
      {error && <span className="sc-review-error">{error}</span>}
    </div>
  );
}
