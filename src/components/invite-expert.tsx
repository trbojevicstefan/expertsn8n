"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function InviteExpert({ expertId, expertName, jobs }: {
  expertId: string;
  expertName: string;
  jobs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState(jobs[0]?.id || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  if (jobs.length === 0) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the invitation.");
      setMsg({
        tone: "ok",
        text: data.notified
          ? `Invitation sent to ${expertName}.`
          : `Invitation recorded. ${expertName} has not claimed this profile yet, so they will see it once they do.`,
      });
      setNote("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not send the invitation." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="invite-box">
      {!open ? (
        <button type="button" className="button button-primary button-wide" onClick={() => setOpen(true)}>
          Invite to a private job
        </button>
      ) : (
        <form onSubmit={send}>
          <div className="field">
            <label htmlFor="inv-job">Which job?</label>
            <select id="inv-job" className="select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inv-note">Note <span className="label-optional">optional</span></label>
            <textarea
              id="inv-note"
              className="textarea"
              style={{ minHeight: 80 }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you think they are a fit. No contact details until a milestone is funded."
            />
          </div>
          <div className="invite-actions">
            <button className="button button-primary button-sm" disabled={busy} type="submit">
              <Send size={14} strokeWidth={2.2} />{busy ? "Sending…" : "Send invitation"}
            </button>
            <button type="button" className="button button-secondary button-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {msg && <div className={msg.tone === "ok" ? "info-box" : "error-box"}>{msg.text}</div>}
    </div>
  );
}
