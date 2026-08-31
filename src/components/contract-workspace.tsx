"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  History,
  LockKeyhole,
  RotateCcw,
  Send,
  ShieldCheck,
  Star,
  Upload,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";
import type { Contract, ContractActivity, ContractMessage, ContractReview } from "@/lib/types";

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  RELEASED: "success",
  FUNDED: "info",
  SUBMITTED: "warning",
  CHANGES_REQUESTED: "warning",
  RELEASE_PENDING: "warning",
  DISPUTED: "danger",
  REFUNDED: "danger",
  AWAITING_FUNDING: "warning",
  DRAFT: "neutral",
};

export function ContractWorkspace({
  contract,
  messages: initialMessages,
  activities,
  reviews,
  viewerUid,
  role,
}: {
  contract: Contract;
  messages: ContractMessage[];
  activities: ContractActivity[];
  reviews: ContractReview[];
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
  const [changesFor, setChangesFor] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [review, setReview] = useState({ rating: "5", comment: "" });

  const unlocked = Boolean(contract.messagingUnlockedAt);
  const active = contract.status === "ACTIVE";
  const myReview = reviews.find((item) => item.reviewerUid === viewerUid);
  const money = (n: number) => `${contract.currency} ${(n || 0).toLocaleString()}`;

  const act = async (
    milestoneId: string,
    action: "fund" | "submit" | "request_changes" | "release",
    note = "",
  ) => {
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
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
      setChangesFor(null);
      setChangeNote("");
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

  const cancelContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("cancel");
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel the contract.");
      setCancelOpen(false);
      setCancelReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the contract.");
    } finally {
      setBusy("");
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("review");
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Number(review.rating), comment: review.comment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit the review.");
      setReview({ rating: "5", comment: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the review.");
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
            <strong>Funding confirmed</strong>
            <span>Messaging is open. Funds only move to release/refund after provider confirmation.</span>
          </div>
        </div>
      ) : (
        <div className="notice">
          <strong>Not funded yet</strong>
          Messaging is available, but contact details and external links stay blocked until provider-confirmed funding.
        </div>
      )}

      {contract.status === "CANCELLED" && (
        <div className="notice">
          <strong>Contract cancelled</strong>
          {contract.cancellationReason || "No further milestone actions are available."}
        </div>
      )}

      {contract.status === "COMPLETED" && (
        <div className="funding-banner">
          <Check size={22} strokeWidth={2.2} />
          <div>
            <strong>Contract completed</strong>
            <span>All milestones are released. Each side can now leave one final review.</span>
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <div className="contract-layout">
        <section className="panel card">
          <div className="panel-head">
            <h2>Messages</h2>
            <span className={`status ${unlocked ? "status-success" : "status-neutral"}`}>
              {unlocked ? "Unlocked" : "Contact guarded"}
            </span>
          </div>

          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              body={unlocked
                ? "Everything said here stays on the contract record."
                : "You can talk before funding, but contact details and links are blocked until funding is confirmed."}
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

              {m.submissionNote && <p className="milestone-note"><strong>Submission:</strong> {m.submissionNote}</p>}
              {m.changeRequestNote && <p className="milestone-note"><strong>Requested changes:</strong> {m.changeRequestNote}</p>}

              {active && (
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
                      {busy === `submit-${m.id}` ? "Submitting…" : m.status === "CHANGES_REQUESTED" ? "Resubmit work" : "Submit work"}
                    </button>
                  )}
                  {(role === "client" || role === "admin") && m.status === "SUBMITTED" && (
                    <>
                      <button className="button button-primary button-sm" disabled={busy !== ""} onClick={() => act(m.id, "release")}>
                        <Check size={13} strokeWidth={2.4} />
                        {busy === `release-${m.id}` ? "Releasing…" : "Approve and release"}
                      </button>
                      <button className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => setChangesFor(m.id)}>
                        <RotateCcw size={13} strokeWidth={2.2} />Request changes
                      </button>
                    </>
                  )}
                  {["FUNDED", "SUBMITTED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(m.status) && role !== "admin" && (
                    <button className="button button-secondary button-sm" disabled={busy !== ""} onClick={() => setDisputeFor(m.id)}>
                      <AlertTriangle size={13} strokeWidth={2.2} />Raise a problem
                    </button>
                  )}
                </div>
              )}

              {changesFor === m.id && (
                <form
                  className="dispute-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(m.id, "request_changes", changeNote.trim());
                  }}
                >
                  <div className="field">
                    <label htmlFor={`changes-${m.id}`}>What needs changing?</label>
                    <textarea
                      id={`changes-${m.id}`}
                      className="textarea"
                      required
                      minLength={10}
                      maxLength={2000}
                      style={{ minHeight: 90 }}
                      value={changeNote}
                      onChange={(e) => setChangeNote(e.target.value)}
                      placeholder="Be specific so the expert can resubmit without guessing."
                    />
                  </div>
                  <div className="invite-actions">
                    <button className="button button-primary button-sm" disabled={busy !== "" || changeNote.trim().length < 10} type="submit">
                      {busy === `request_changes-${m.id}` ? "Requesting…" : "Send change request"}
                    </button>
                    <button type="button" className="button button-secondary button-sm" onClick={() => { setChangesFor(null); setChangeNote(""); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

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
              <strong>Provider-confirmed money state</strong>
              <br />
              Checkout or transfer acceptance alone never marks funds as moved.
            </div>
          </div>

          {active && role !== "admin" && (
            <div style={{ marginTop: 16 }}>
              {!cancelOpen ? (
                <button className="button button-secondary button-sm" onClick={() => setCancelOpen(true)}>
                  <XCircle size={13} strokeWidth={2.2} />Cancel contract
                </button>
              ) : (
                <form className="dispute-form" onSubmit={cancelContract}>
                  <div className="field">
                    <label htmlFor="cancel-reason">Why are you cancelling?</label>
                    <textarea
                      id="cancel-reason"
                      className="textarea"
                      required
                      minLength={10}
                      maxLength={1000}
                      style={{ minHeight: 80 }}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Direct cancellation only works when no money is currently at risk."
                    />
                  </div>
                  <span className="field-hint">If a milestone is funded or payment is pending, open a dispute instead.</span>
                  <div className="invite-actions">
                    <button className="button button-primary button-sm" disabled={busy === "cancel" || cancelReason.trim().length < 10} type="submit">
                      {busy === "cancel" ? "Cancelling…" : "Confirm cancellation"}
                    </button>
                    <button type="button" className="button button-secondary button-sm" onClick={() => setCancelOpen(false)}>Keep contract</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </aside>
      </div>

      <div className="contract-layout" style={{ marginTop: 20 }}>
        <section className="panel card">
          <div className="panel-head">
            <h2><History size={18} strokeWidth={2} /> Activity</h2>
          </div>
          {activities.length === 0 ? (
            <EmptyState title="No activity yet" body="Contract lifecycle events will appear here as work and money move." />
          ) : (
            <ol className="thread">
              {activities.slice().reverse().map((item) => (
                <li className="thread-item" key={item.id}>
                  <span className="thread-avatar">{item.actorName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <div className="thread-meta">
                      <strong>{item.title}</strong>
                      <time suppressHydrationWarning>{when(item.createdAt)}</time>
                    </div>
                    {item.detail && <p>{item.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="panel card">
          <div className="panel-head"><h2><Star size={18} strokeWidth={2} /> Reviews</h2></div>

          {reviews.length > 0 && reviews.map((item) => (
            <div className="milestone" key={item.id}>
              <div className="milestone-head">
                <div>
                  <strong>{item.direction === "CLIENT_TO_EXPERT" ? "Client → expert" : "Expert → client"}</strong>
                  <span>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
                </div>
              </div>
              <p className="milestone-note">{item.comment}</p>
            </div>
          ))}

          {contract.status === "COMPLETED" && role !== "admin" && !myReview && (
            <form className="dispute-form" onSubmit={submitReview}>
              <div className="field">
                <label htmlFor="contract-rating">Rating</label>
                <select id="contract-rating" className="input" value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })}>
                  <option value="5">5 — Excellent</option>
                  <option value="4">4 — Good</option>
                  <option value="3">3 — Okay</option>
                  <option value="2">2 — Poor</option>
                  <option value="1">1 — Very poor</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="contract-review">Final review</label>
                <textarea
                  id="contract-review"
                  className="textarea"
                  required
                  minLength={10}
                  maxLength={2000}
                  style={{ minHeight: 100 }}
                  value={review.comment}
                  onChange={(e) => setReview({ ...review, comment: e.target.value })}
                  placeholder={role === "client" ? "How was the expert's delivery?" : "How was it working with this client?"}
                />
              </div>
              <button className="button button-primary button-sm" disabled={busy === "review" || review.comment.trim().length < 10} type="submit">
                <Star size={13} strokeWidth={2.2} />{busy === "review" ? "Submitting…" : "Submit final review"}
              </button>
            </form>
          )}

          {contract.status === "COMPLETED" && role !== "admin" && myReview && (
            <div className="verified-box">
              <Check size={18} />
              <div><strong>Your review is submitted</strong><br />Each side gets one final review per completed contract.</div>
            </div>
          )}

          {contract.status !== "COMPLETED" && reviews.length === 0 && (
            <EmptyState title="Reviews unlock on completion" body="Both sides can leave one review after every milestone is released." />
          )}
        </aside>
      </div>
    </>
  );
}
