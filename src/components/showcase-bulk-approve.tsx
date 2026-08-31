"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

/** Approves every showcase on this profile that is not already approved. */
export function ShowcaseBulkApprove({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (ids.length === 0) return null;

  const approveAll = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/showcases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, reviewState: "APPROVED", reason: "" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not approve those.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve those.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="sc-bulk">
      <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={approveAll}>
        <CheckCheck size={14} strokeWidth={2.2} />
        {busy ? "Approving…" : `Approve all ${ids.length}`}
      </button>
      {error && <span className="sc-review-error">{error}</span>}
    </span>
  );
}
