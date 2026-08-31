"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, Ban, EyeOff, RotateCcw } from "lucide-react";

type Decision = "VERIFIED" | "PUBLISHED" | "NEEDS_CHANGES" | "REJECTED" | "SUSPENDED";

const ACTIONS: { decision: Decision; label: string; hint: string; tone: string; icon: React.ReactNode }[] = [
  {
    decision: "VERIFIED",
    label: "Verify",
    hint: "Adds the reviewed badge and keeps the profile listed.",
    tone: "button-primary",
    icon: <BadgeCheck size={16} strokeWidth={2.2} />,
  },
  {
    decision: "PUBLISHED",
    label: "List without verifying",
    hint: "Back in the directory, still marked as not yet vetted.",
    tone: "button-secondary",
    icon: <RotateCcw size={16} strokeWidth={2.2} />,
  },
  {
    decision: "NEEDS_CHANGES",
    label: "Request changes",
    hint: "Removes it from the directory until the expert responds.",
    tone: "button-secondary",
    icon: <AlertTriangle size={16} strokeWidth={2.2} />,
  },
  {
    decision: "SUSPENDED",
    label: "Suspend",
    hint: "Hides the profile pending investigation.",
    tone: "button-secondary",
    icon: <EyeOff size={16} strokeWidth={2.2} />,
  },
  {
    decision: "REJECTED",
    label: "Reject",
    hint: "Hides the profile and closes the application.",
    tone: "button-secondary",
    icon: <Ban size={16} strokeWidth={2.2} />,
  },
];

export function AdminReviewActions({ expertId, currentStatus, verified }: {
  expertId: string;
  currentStatus: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Decision | "">("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const decide = async (decision: Decision) => {
    if (reason.trim().length < 3) {
      setMsg({ tone: "err", text: "Write a short reason first — it goes on the audit log." });
      return;
    }
    setBusy(decision);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/experts/${encodeURIComponent(expertId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record the decision.");
      setMsg({ tone: "ok", text: `Recorded: ${decision.replace("_", " ").toLowerCase()}.` });
      setReason("");
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not record the decision." });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="review-actions card">
      <h2>Decision</h2>
      <p className="muted">
        Currently <strong>{currentStatus}</strong>
        {verified ? " and verified" : " and not verified"}. Every decision is written to the audit log
        against your account.
      </p>

      <div className="field">
        <label htmlFor="review-reason">Reason</label>
        <textarea
          id="review-reason"
          className="textarea"
          style={{ minHeight: 90 }}
          placeholder="What did you check, and what decided it?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="review-buttons">
        {ACTIONS.map((a) => (
          <div key={a.decision}>
            <button
              type="button"
              className={`button ${a.tone} button-wide`}
              disabled={busy !== ""}
              onClick={() => decide(a.decision)}
            >
              {a.icon}
              {busy === a.decision ? "Working…" : a.label}
            </button>
            <span className="review-hint">{a.hint}</span>
          </div>
        ))}
      </div>

      {msg && <div className={msg.tone === "ok" ? "info-box" : "error-box"}>{msg.text}</div>}
    </div>
  );
}
