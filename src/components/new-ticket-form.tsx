"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Plus, X } from "lucide-react";

export function NewTicketForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open the ticket.");
      router.push(`/support/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the ticket.");
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="button button-primary" onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={2.2} />New ticket
      </button>
    );
  }

  return (
    <form className="form-card card ticket-form" onSubmit={submit}>
      <div className="form-section">
        <h2><LifeBuoy size={17} strokeWidth={2} style={{ display: "inline", verticalAlign: "-3px", marginRight: 7 }} />
          Tell us what is wrong</h2>
        <p>Anything that is not working, or a problem with someone you are working with.</p>
        <div className="field">
          <label htmlFor="tk-subject">Subject</label>
          <input
            id="tk-subject" className="input" required minLength={5} maxLength={140}
            value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Short summary"
          />
        </div>
        <div className="field">
          <label htmlFor="tk-body">What happened?</label>
          <textarea
            id="tk-body" className="textarea" required minLength={20}
            value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="What you expected, what happened instead, and what you would like done."
          />
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="invite-actions">
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Opening…" : "Open ticket"}
        </button>
        <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>
          <X size={15} strokeWidth={2.2} />Cancel
        </button>
      </div>
    </form>
  );
}
