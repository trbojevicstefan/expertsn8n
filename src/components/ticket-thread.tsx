"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, ShieldCheck } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { SupportTicket, TicketMessage } from "@/lib/types";

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const OUTCOMES = [
  { value: "none", label: "No money movement" },
  { value: "release", label: "Release the held funds to the expert" },
  { value: "refund", label: "Refund the held funds to the client" },
  { value: "reopen", label: "Unfreeze and let the contract continue" },
];

export function TicketThread({
  ticket,
  messages: initial,
  viewerUid,
  isAdmin,
}: {
  ticket: SupportTicket;
  messages: TicketMessage[];
  viewerUid: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [resolution, setResolution] = useState("");
  const [outcome, setOutcome] = useState("none");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const closed = ticket.state === "RESOLVED" || ticket.state === "CLOSED";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy("msg");
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
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

  const resolve = async (state: "IN_REVIEW" | "RESOLVED" | "CLOSED") => {
    setBusy(state);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, resolution, outcome }),
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
    <div className="contract-layout">
      <section className="panel card">
        <div className="panel-head">
          <h2>{ticket.subject}</h2>
          <StatusBadge tone={closed ? "success" : ticket.state === "IN_REVIEW" ? "warning" : "info"}>
            {ticket.state.replace("_", " ")}
          </StatusBadge>
        </div>

        <ol className="thread">
          <li className="thread-item">
            <span className="thread-avatar">{ticket.raisedByName.slice(0, 1).toUpperCase()}</span>
            <div>
              <div className="thread-meta">
                <strong>{ticket.raisedByName}</strong>
                <span className="thread-tag">{ticket.raisedByRole}</span>
                <time suppressHydrationWarning>{when(ticket.createdAt)}</time>
              </div>
              <p>{ticket.body}</p>
            </div>
          </li>
          {messages.map((m) => (
            <li key={m.id} className={m.authorUid === viewerUid ? "thread-item mine" : "thread-item"}>
              <span className={`thread-avatar${m.authorRole === "admin" ? " is-staff" : ""}`}>
                {m.authorRole === "admin" ? <ShieldCheck size={14} strokeWidth={2.2} /> : m.authorName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="thread-meta">
                  <strong>{m.authorName}</strong>
                  {m.authorRole === "admin" && <span className="thread-tag">Support</span>}
                  <time suppressHydrationWarning>{when(m.createdAt)}</time>
                </div>
                <p>{m.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {error && <div className="error-box">{error}</div>}

        <form className="thread-composer" onSubmit={send}>
          <textarea
            className="textarea"
            style={{ minHeight: 80 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={closed ? "This ticket is closed, but you can still add a note." : "Add to the ticket…"}
            aria-label="Ticket message"
          />
          <button className="button button-primary" disabled={busy === "msg" || !body.trim()} type="submit">
            <Send size={15} strokeWidth={2.2} />{busy === "msg" ? "Sending…" : "Send"}
          </button>
        </form>
      </section>

      <aside className="panel card">
        <div className="panel-head"><h2>Details</h2></div>
        <div className="facts">
          <div className="fact"><span>Type</span><strong>{ticket.kind === "DISPUTE" ? "Dispute" : "Support"}</strong></div>
          <div className="fact"><span>Raised by</span><strong>{ticket.raisedByName}</strong></div>
          {ticket.amountAtRisk != null && (
            <div className="fact"><span>Amount frozen</span><strong>€{ticket.amountAtRisk.toLocaleString()}</strong></div>
          )}
          {ticket.contractId && (
            <div className="fact">
              <span>Contract</span>
              <strong><a href={`/contracts/${ticket.contractId}`}>Open</a></strong>
            </div>
          )}
        </div>

        {ticket.resolution && (
          <div className="notice" style={{ marginTop: 14 }}>
            <strong>Resolution</strong>
            {ticket.resolution}
          </div>
        )}

        {isAdmin && (
          <>
            <hr />
            <div className="field">
              <label htmlFor="tk-res">Resolution note</label>
              <textarea
                id="tk-res" className="textarea" style={{ minHeight: 70 }}
                value={resolution} onChange={(e) => setResolution(e.target.value)}
                placeholder="What you decided and why."
              />
            </div>
            {ticket.kind === "DISPUTE" && (
              <div className="field">
                <label htmlFor="tk-out">Outcome for the frozen milestone</label>
                <select id="tk-out" className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div className="review-buttons">
              <button className="button button-primary button-wide" disabled={busy !== ""} onClick={() => resolve("RESOLVED")}>
                {busy === "RESOLVED" ? "Working…" : "Resolve"}
              </button>
              <button className="button button-secondary button-wide" disabled={busy !== ""} onClick={() => resolve("IN_REVIEW")}>
                Mark in review
              </button>
              <button className="button button-secondary button-wide" disabled={busy !== ""} onClick={() => resolve("CLOSED")}>
                Close without action
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
