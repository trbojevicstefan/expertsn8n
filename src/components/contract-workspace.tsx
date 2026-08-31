"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, CircleDollarSign, LockKeyhole, Send, ShieldCheck, Upload,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";
import type { Contract, ContractMessage } from "@/lib/types";

const money = (n: number) => `€${(n || 0).toLocaleString()}`;

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  RELEASED: "success", FUNDED: "info", SUBMITTED: "warning",
  DISPUTED: "danger", REFUNDED: "danger", AWAITING_FUNDING: "warning", DRAFT: "neutral",
};

export function ContractWorkspace({
  contract,
  messages: initialMessages,
  viewerUid,
  role,
}: {
  contract: Contract;
  messages: ContractMessage[];
  viewerUid: string;
  role: "client" | "expert" | "admin";
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [dispute, setDispute] = useState({ subject: "", body: "" });

  const unlocked = Boolean(contract.messagingUnlockedAt);

  const act = async (milestoneId: string, action: "fund" | "submit" | "release", note = "") => {
    setBusy(`${action}-${milestoneId}`);
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not do that.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not do that.");
    } finally {
      setBusy("");
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy("msg");
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send that.");
      setMessages((m) => [...m, data.message]);
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that.");
    } finally {
      setBusy("");
    }
  };

  const raiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("dispute");
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: dispute.subject,
          body: dispute.body,
          contractId: contract.id,
          milestoneId: disputeFor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open the dispute.");
      setDisputeFor(null);
      setDispute({ subject: "", body: "" });
      router.push(`/support/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the dispute.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      {unlocked ? (
        <div className="funding-banner">
          <ShieldCheck size={22} strokeWidth={2} />
          <div>
            <strong>Funds are held against this contract</strong>
            <span>Messaging and file exchange are open. Release happens only when you approve a submission.</span>
          </div>
        </div>
      ) : (
        <div className="notice">
          <strong>Not funded yet</strong>
          Messaging opens the moment the first milestone is funded. Until then contact details and external
          links are blocked.
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <div className="contract-layout">
        <section className="panel card">
          <div className="panel-head">
            <h2>Messages</h2>
            <span className={`status ${unlocked ? "status-success" : "status-neutral"}`}>
              {unlocked ? "Unlocked" : "Guarded until funding"}
            </span>
          </div>

          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              body={unlocked
                ? "Everything said here stays on the contract record."
                : "You can talk before funding, but contact details and links are blocked until a milestone is funded."}
            />
          ) : (
            <ol className="thread">
              {messages.map((m) => (
                <li key={m.id} className={m.authorUid === viewerUid ? "thread-item mine" : "thread-item"}>
                  <span className={`thread-avatar${m.authorRole === "admin" ? " is-staff" : ""}`}>
                    {m.authorName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="thread-meta">
                      <strong>{m.authorName}</strong>
                      <span className="thread-tag">{m.authorRole}</span>
                      <time suppressHydrationWarning>{when(m.createdAt)}</time>
                    </div>
                    <p>{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <form className="thread-composer" onSubmit={send}>
            <textarea
              className="textarea"
              style={{ minHeight: 80 }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={unlocked ? "Message the other side…" : "No contact details or links until funding…"}
              aria-label="Contract message"
            />
            <button className="button button-primary" disabled={busy === "msg" || !body.trim()} type="submit">
              <Send size={15} strokeWidth={2.2} />{busy === "msg" ? "Sending…" : "Send"}
            </button>
          </form>
        </section>

        <aside className="panel card">
          <div className="panel-head"><h2>Milestones</h2></div>

          {(contract.milestones || []).map((m) => (
            <div className="milestone" key={m.id}>
              <div className="milestone-head">
                <div>
                  <strong>{m.title}</strong>
                  <span>{money(m.amount)}</span>
                </div>
                <StatusBadge tone={TONE[m.status] || "neutral"}>{m.status.replace(/_/g, " ")}</StatusBadge>
              </div>

              {m.submissionNote && <p className="milestone-note">{m.submissionNote}</p>}

              <div className="milestone-actions">
                {(role === "client" || role === "admin") && ["DRAFT", "AWAITING_FUNDING"].includes(m.status) && (
                  <button className="button button-primary button-sm" disabled={busy !== ""} onClick={() => act(m.id, "fund")}>
                    <CircleDollarSign size={13} strokeWidth={2.2} />
                    {busy === `fund-${m.id}` ? "Funding…" : `Fund ${money(m.amount)}`}
                  </button>
                )}
                {(role === "expert" || role === "admin") && ["FUNDED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(m.status) && (
                  <button className="button button-primary button-sm" disabled={busy !== ""} onClick={() => act(m.id, "submit", "Work submitted for review.")}>
                    <Upload size={13} strokeWidth={2.2} />
                    {busy === `submit-${m.id}` ? "Submitting…" : "Submit work"}
                  </button>
                )}
                {(role === "client" || role === "admin") && m.status === "SUBMITTED" && (
                  <button className="button button-primary button-sm" disabled={busy !== ""} onClick={() => act(m.id, "release")}>
                    <Check size={13} strokeWidth={2.4} />
                    {busy === `release-${m.id}` ? "Releasing…" : "Approve and release"}
                  </button>
                )}
                {["FUNDED", "SUBMITTED", "IN_PROGRESS"].includes(m.status) && role !== "admin" && (
                  <button className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => setDisputeFor(m.id)}>
                    <AlertTriangle size={13} strokeWidth={2.2} />Raise a problem
                  </button>
                )}
              </div>

              {disputeFor === m.id && (
                <form className="dispute-form" onSubmit={raiseDispute}>
                  <div className="field">
                    <label htmlFor={`d-sub-${m.id}`}>What is wrong?</label>
                    <input
                      id={`d-sub-${m.id}`} className="input" required minLength={5}
                      placeholder="Short summary"
                      value={dispute.subject}
                      onChange={(e) => setDispute({ ...dispute, subject: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`d-body-${m.id}`}>Detail</label>
                    <textarea
                      id={`d-body-${m.id}`} className="textarea" required minLength={20} style={{ minHeight: 80 }}
                      placeholder="What was agreed, what happened, and what you want done."
                      value={dispute.body}
                      onChange={(e) => setDispute({ ...dispute, body: e.target.value })}
                    />
                  </div>
                  <span className="field-hint">
                    This freezes {money(m.amount)} until a reviewer decides. Both sides keep access to the record.
                  </span>
                  <div className="invite-actions">
                    <button className="button button-primary button-sm" disabled={busy === "dispute"} type="submit">
                      {busy === "dispute" ? "Opening…" : "Open dispute"}
                    </button>
                    <button type="button" className="button button-secondary button-sm" onClick={() => setDisputeFor(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}

          <div className="verified-box" style={{ marginTop: 16 }}>
            <LockKeyhole size={18} />
            <div>
              <strong>Funds-first</strong>
              <br />
              Money is held against a milestone and released only on your approval.
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
