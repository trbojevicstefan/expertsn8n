"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, ShieldCheck } from "lucide-react";
import type { ExpertMessage } from "@/lib/types";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

/** Formatted in the reader's own locale and timezone, which the server cannot
 *  know. The server and client therefore render different text on purpose, so
 *  the mismatch is declared rather than left to trip hydration. */
function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * The review conversation for one profile. The same thread is rendered on both
 * sides — staff see it on the review screen, the expert sees it on their
 * profile — so nothing is said about a profile that its owner cannot read.
 */
export function MessageThread({
  messages: initial,
  viewerUid,
  mode,
  expertId,
  canRequestChanges = false,
}: {
  messages: ExpertMessage[];
  viewerUid: string;
  mode: "expert" | "admin";
  expertId?: string;
  canRequestChanges?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [requestChanges, setRequestChanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const url = mode === "admin"
        ? `/api/admin/experts/${encodeURIComponent(expertId || "")}/message`
        : "/api/expert/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "admin" ? { body: body.trim(), requestChanges } : { body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send that.");
      setMessages((prev) => [...prev, data.message]);
      setBody("");
      setRequestChanges(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel card thread-panel">
      <div className="panel-head">
        <h2>{mode === "admin" ? "Message this expert" : "Messages from the review team"}</h2>
      </div>

      {messages.length === 0 ? (
        <p className="muted thread-empty">
          {mode === "admin"
            ? "Nothing sent yet. Tell them exactly what is missing — it goes to their dashboard and their notifications."
            : "No messages yet. If a reviewer needs something from you, it will appear here."}
        </p>
      ) : (
        <ol className="thread">
          {messages.map((m) => (
            <li key={m.id} className={m.authorUid === viewerUid ? "thread-item mine" : "thread-item"}>
              <span className={`thread-avatar${m.authorRole === "admin" ? " is-staff" : ""}`}>
                {m.authorRole === "admin" ? <ShieldCheck size={14} strokeWidth={2.2} /> : initials(m.authorName)}
              </span>
              <div>
                <div className="thread-meta">
                  <strong>{m.authorName}</strong>
                  {m.authorRole === "admin" && <span className="thread-tag">Review team</span>}
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
          style={{ minHeight: 84 }}
          placeholder={
            mode === "admin"
              ? "e.g. Your showcase needs the failure handling described, and the profile still has no rate."
              : "Reply to the review team…"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Message"
        />
        {canRequestChanges && (
          <label className="check">
            <input
              type="checkbox"
              checked={requestChanges}
              onChange={(e) => setRequestChanges(e.target.checked)}
            />
            Also send the profile back for changes (removes it from the directory)
          </label>
        )}
        {error && <div className="error-box">{error}</div>}
        <button className="button button-primary" disabled={busy || !body.trim()} type="submit">
          <Send size={15} strokeWidth={2.2} />
          {busy ? "Sending…" : requestChanges ? "Send and request changes" : "Send message"}
        </button>
      </form>
    </section>
  );
}
