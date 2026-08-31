"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Plus, Trash2, Workflow, X } from "lucide-react";
import { ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";
import type { Showcase, ShowcaseAttachment } from "@/lib/types";

type Item = Showcase & { reviewState?: string; attachments?: ShowcaseAttachment[] };

const EMPTY = {
  title: "",
  summary: "",
  outcome: "",
  integrations: "",
  complexity: "Advanced" as Showcase["complexity"],
};

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

export function ShowcaseManager({ initial, uid }: { initial: Item[]; uid: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy("save");
    try {
      const res = await fetch("/api/expert/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          integrations: form.integrations.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the showcase.");
      setItems((prev) => [
        {
          id: data.id, expertId: "", title: form.title, summary: form.summary,
          outcome: form.outcome, complexity: form.complexity,
          integrations: form.integrations.split(",").map((s) => s.trim()).filter(Boolean),
          reviewState: "PENDING",
        },
        ...prev,
      ]);
      setForm(EMPTY);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the showcase.");
    } finally {
      setBusy("");
    }
  };

  const attach = async (showcaseId: string, file: File) => {
    if (!firebaseStorage) return setError("Storage is not configured.");
    setError("");
    setBusy(`att-${showcaseId}`);
    try {
      const path = `private/experts/${uid}/showcases/${showcaseId}/${Date.now()}-${safeName(file.name)}`;
      await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type || "application/octet-stream" });
      const res = await fetch(`/api/expert/showcases/${showcaseId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          storagePath: path,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not attach that file.");
      setItems((prev) => prev.map((s) =>
        s.id === showcaseId ? { ...s, attachments: [...(s.attachments || []), data.attachment] } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  };

  const detach = async (showcaseId: string, attachmentId: string) => {
    setBusy(`att-${attachmentId}`);
    try {
      const res = await fetch(
        `/api/expert/showcases/${showcaseId}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.json()).error || "Could not remove that file.");
      setItems((prev) => prev.map((s) =>
        s.id === showcaseId
          ? { ...s, attachments: (s.attachments || []).filter((a) => a.id !== attachmentId) }
          : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that file.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (id: string) => {
    setBusy(`del-${id}`);
    try {
      const res = await fetch(`/api/expert/showcases?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Could not remove it.");
      setItems((prev) => prev.filter((x) => x.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove it.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Workflow showcases</h1>
          <p>Show the business problem, architecture and outcome — not client secrets.</p>
        </div>
        <button className="button button-primary" onClick={() => setOpen((v) => !v)}>
          {open ? <X size={16} strokeWidth={2.2} /> : <Plus size={16} strokeWidth={2.2} />}
          {open ? "Cancel" : "New showcase"}
        </button>
      </div>

      {open && (
        <form className="form-card card" onSubmit={submit} style={{ marginBottom: 18 }}>
          <div className="form-section">
            <h2>New showcase</h2>
            <p>
              A reviewer reads this as evidence. Describe how it handles failure, not just what it does —
              that is the most common reason a showcase comes back.
            </p>
            <div className="field">
              <label htmlFor="sc-title">Title</label>
              <input
                id="sc-title" className="input" required minLength={5}
                placeholder="Zapier to n8n migration for a 40-person ops team"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sc-summary">What you built</label>
              <textarea
                id="sc-summary" className="textarea" required minLength={40}
                placeholder="The business problem, the architecture, the integrations, how failures are handled."
                value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
              <span className="field-hint">Contact details and external links are not allowed here.</span>
            </div>
            <div className="field">
              <label htmlFor="sc-outcome">Measured outcome</label>
              <input
                id="sc-outcome" className="input" required
                placeholder="Cut manual reconciliation from 6 hours to 20 minutes a week"
                value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="sc-int">Integrations, comma separated</label>
                <input
                  id="sc-int" className="input" placeholder="HubSpot, Postgres, Slack"
                  value={form.integrations} onChange={(e) => setForm({ ...form, integrations: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="sc-cx">Complexity</label>
                <select
                  id="sc-cx" className="select" value={form.complexity}
                  onChange={(e) => setForm({ ...form, complexity: e.target.value as Showcase["complexity"] })}
                >
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Expert</option>
                </select>
              </div>
            </div>
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="button button-primary" disabled={busy === "save"} type="submit">
            {busy === "save" ? "Saving…" : "Submit for review"}
          </button>
        </form>
      )}

      {!open && error && <div className="error-box">{error}</div>}

      {items.length === 0 ? (
        <EmptyState
          icon={<Workflow size={22} strokeWidth={1.9} />}
          title="No showcases yet"
          body="A showcase is what gets a profile taken seriously: the business problem, the architecture, the integrations, how failures are handled and what changed for the client. At least one is required before a profile can be verified."
        />
      ) : (
        <div className="showcase-grid">
          {items.map((s) => (
            <article className="showcase-card card" key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <StatusBadge tone={s.reviewState === "APPROVED" ? "success" : "warning"}>
                  {s.reviewState || "PENDING"}
                </StatusBadge>
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => remove(s.id)}
                  disabled={busy === `del-${s.id}`}
                  aria-label={`Remove ${s.title}`}
                >
                  <Trash2 size={13} strokeWidth={2.2} />
                </button>
              </div>
              <h3>{s.title}</h3>
              <p>{s.summary}</p>
              <span className="outcome">{s.outcome}</span>
              {s.integrations?.length > 0 && (
                <div className="chip-row" style={{ marginTop: 12 }}>
                  {s.integrations.map((x) => <span className="chip" key={x}>{x}</span>)}
                </div>
              )}

              <div className="attach-block">
                {(s.attachments || []).length > 0 && (
                  <ul className="attach-list">
                    {(s.attachments || []).map((a) => (
                      <li key={a.id}>
                        <FileText size={14} strokeWidth={2} />
                        <a href={`/api/files?path=${encodeURIComponent(a.storagePath)}`} target="_blank" rel="noopener noreferrer">
                          {a.name}
                        </a>
                        <span>{(a.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                        <button
                          type="button"
                          onClick={() => detach(s.id, a.id)}
                          disabled={busy === `att-${a.id}`}
                          aria-label={`Remove ${a.name}`}
                        >
                          <Trash2 size={12} strokeWidth={2.2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="button button-secondary button-sm attach-add">
                  <Paperclip size={14} strokeWidth={2.2} />
                  {busy === `att-${s.id}` ? "Uploading…" : "Attach a file"}
                  <input
                    type="file"
                    hidden
                    onChange={(e) => e.target.files?.[0] && attach(s.id, e.target.files[0])}
                  />
                </label>
                <span className="attach-hint">PDF, images, documents — up to 25 MB. Visible to you and reviewers only.</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
