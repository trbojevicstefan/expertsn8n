"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Ban, EyeOff, RotateCcw, X } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { Avatar } from "./avatar";
import type { ExpertProfile } from "@/lib/types";

type Decision = "VERIFIED" | "PUBLISHED" | "NEEDS_CHANGES" | "SUSPENDED" | "REJECTED";

const ACTIONS: { decision: Decision; label: string; icon: React.ReactNode; primary?: boolean }[] = [
  { decision: "VERIFIED", label: "Verify", icon: <BadgeCheck size={14} strokeWidth={2.2} />, primary: true },
  { decision: "PUBLISHED", label: "List", icon: <RotateCcw size={14} strokeWidth={2.2} /> },
  { decision: "NEEDS_CHANGES", label: "Request changes", icon: <X size={14} strokeWidth={2.2} /> },
  { decision: "SUSPENDED", label: "Suspend", icon: <EyeOff size={14} strokeWidth={2.2} /> },
  { decision: "REJECTED", label: "Reject", icon: <Ban size={14} strokeWidth={2.2} /> },
];

export function AdminExpertsTable({ experts }: { experts: ExpertProfile[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Decision | "">("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const allOnPage = experts.map((e) => e.id);
  const allSelected = selected.length > 0 && selected.length === allOnPage.length;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const apply = async (decision: Decision) => {
    if (reason.trim().length < 3) {
      setMsg({ tone: "err", text: "Write a short reason — it goes on the audit log and to each expert." });
      return;
    }
    setBusy(decision);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/experts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, decision, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not apply that.");
      setMsg({ tone: "ok", text: `${data.updated} profile${data.updated === 1 ? "" : "s"} updated.` });
      setSelected([]);
      setReason("");
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not apply that." });
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      {selected.length > 0 && (
        <div className="bulk-bar card">
          <div className="bulk-head">
            <strong>{selected.length} selected</strong>
            <button type="button" className="bulk-clear" onClick={() => setSelected([])}>Clear</button>
          </div>
          <input
            className="input"
            placeholder="Reason — sent to each expert and written to the audit log"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Bulk decision reason"
          />
          <div className="bulk-actions">
            {ACTIONS.map((a) => (
              <button
                key={a.decision}
                type="button"
                className={`button button-sm ${a.primary ? "button-primary" : "button-secondary"}`}
                disabled={busy !== ""}
                onClick={() => apply(a.decision)}
              >
                {a.icon}
                {busy === a.decision ? "Working…" : a.label}
              </button>
            ))}
          </div>
          {msg && <div className={msg.tone === "ok" ? "info-box" : "error-box"}>{msg.text}</div>}
        </div>
      )}

      {msg && selected.length === 0 && (
        <div className={msg.tone === "ok" ? "info-box" : "error-box"}>{msg.text}</div>
      )}

      <div className="data-card card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="cb-col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? allOnPage : [])}
                  aria-label="Select all shown"
                />
              </th>
              <th>Expert</th><th>Source</th><th>Claim</th><th>Photo</th><th>Outstanding</th><th>State</th><th />
            </tr>
          </thead>
          <tbody>
            {experts.map((e) => (
              <tr key={e.id} className={selected.includes(e.id) ? "is-selected" : ""}>
                <td className="cb-col">
                  <input
                    type="checkbox"
                    checked={selected.includes(e.id)}
                    onChange={() => toggle(e.id)}
                    aria-label={`Select ${e.name}`}
                  />
                </td>
                <td>
                  <div className="table-person">
                    <Avatar name={e.name} src={e.photoUrl} size="sm" />
                    <div>
                      <strong>{e.name}</strong><br />
                      <span className="muted">{e.location || e.country || "Location not stated"}</span>
                    </div>
                  </div>
                </td>
                <td className="muted">{e.source === "application" ? "Application" : "Self signup"}</td>
                <td>
                  <StatusBadge tone={e.claimState === "CLAIMED" ? "success" : "neutral"}>
                    {e.claimState || "UNCLAIMED"}
                  </StatusBadge>
                </td>
                <td>
                  <StatusBadge tone={e.photoStatus === "APPROVED" ? "success" : e.photoStatus === "PENDING_REVIEW" ? "warning" : "danger"}>
                    {e.photoStatus || "MISSING"}
                  </StatusBadge>
                </td>
                <td className="muted">
                  {e.missingFields?.length ? `${e.missingFields.length} field${e.missingFields.length === 1 ? "" : "s"}` : "None"}
                </td>
                <td>
                  <StatusBadge tone={e.verified ? "success" : e.status === "PUBLISHED" ? "info" : "warning"}>
                    {e.verified ? "VERIFIED" : e.status}
                  </StatusBadge>
                </td>
                <td className="text-right">
                  <Link className="button button-secondary button-sm" href={`/admin/experts/${e.id}`}>Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
