"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import { AlertTriangle, CheckCircle2, FileText, Plus, Send, Trash2, Upload, UserRound } from "lucide-react";
import { firebaseStorage } from "@/lib/firebase/client";
import type { ExpertDocument, ExpertProfile } from "@/lib/types";

const N8N_EXPERIENCE_OPTIONS = [
  "n8n Cloud",
  "Self-hosted n8n",
  "Queue mode / scaling",
  "Custom nodes",
  "AI agents in n8n",
  "Migrations from Zapier or Make",
];

const DOC_KINDS = [
  { value: "cv", label: "CV / resume" },
  { value: "portfolio", label: "Portfolio" },
  { value: "certificate", label: "Certificate" },
  { value: "id", label: "Identity document" },
  { value: "other", label: "Other" },
] as const;

const ACCEPT = ".pdf,.doc,.docx,image/jpeg,image/png,image/webp";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export function ProfileEditor({
  profile,
  uid,
  documents: initialDocuments,
  photoRequired,
}: {
  profile: ExpertProfile;
  uid: string;
  documents: ExpertDocument[];
  photoRequired: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: profile.name || "",
    companyName: profile.companyName || "",
    title: profile.title || "",
    bio: profile.bio || "",
    location: profile.location || "",
    country: profile.country || "",
    timezone: profile.timezone || "",
    hourlyRate: profile.hourlyRate || 0,
    availability: profile.availability || "",
    skills: (profile.skills || []).join(", "),
    integrations: (profile.integrations || []).join(", "),
    languages: (profile.languages || []).join(", "),
    yearsExperience: profile.yearsExperience || 0,
    hoursPerWeek: profile.hoursPerWeek || 0,
    minEngagement: profile.minEngagement || 0,
  });
  const [n8nExperience, setN8nExperience] = useState<string[]>(profile.n8nExperience || []);
  const [links, setLinks] = useState<{ label: string; url: string }[]>(profile.links || []);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || "");
  const [documents, setDocuments] = useState(initialDocuments);
  const [docKind, setDocKind] = useState<string>("cv");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState("");

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/expert/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hourlyRate: Number(form.hourlyRate) || 0,
          yearsExperience: Number(form.yearsExperience) || 0,
          hoursPerWeek: Number(form.hoursPerWeek) || 0,
          minEngagement: Number(form.minEngagement) || 0,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          integrations: form.integrations.split(",").map((s) => s.trim()).filter(Boolean),
          languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
          n8nExperience,
          links: links.filter((l) => l.label.trim() && l.url.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setMsg({ tone: "ok", text: "Profile saved." });
      // The completeness bar is rendered on the server, so it only moves once
      // the route data is refetched.
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy("");
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!firebaseStorage) return setMsg({ tone: "err", text: "Storage is not configured." });
    setBusy("photo");
    setMsg(null);
    try {
      const path = `private/experts/${uid}/photo/${Date.now()}-${safeName(file.name)}`;
      await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type });
      const res = await fetch("/api/expert/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path, contentType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not publish the photo.");
      setPhotoUrl(data.photoUrl);
      setMsg({ tone: "ok", text: "Photo published to your profile." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Photo upload failed." });
    } finally {
      setBusy("");
    }
  };

  const uploadDocument = async (file: File) => {
    if (!firebaseStorage) return setMsg({ tone: "err", text: "Storage is not configured." });
    setBusy("doc");
    setMsg(null);
    try {
      const path = `private/experts/${uid}/documents/${docKind}/${Date.now()}-${safeName(file.name)}`;
      await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type });
      const res = await fetch("/api/expert/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: docKind,
          fileName: file.name,
          storagePath: path,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the document.");
      setDocuments((d) => [
        {
          id: data.id, expertId: profile.id, kind: docKind as ExpertDocument["kind"],
          fileName: file.name, storagePath: path, contentType: file.type,
          sizeBytes: file.size, uploadedAt: new Date().toISOString(), reviewState: "PENDING",
        },
        ...d,
      ]);
      setMsg({ tone: "ok", text: `${file.name} uploaded.` });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy("");
    }
  };

  const removeDocument = async (id: string) => {
    setBusy(`del-${id}`);
    try {
      const res = await fetch(`/api/expert/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Could not remove the document.");
      setDocuments((d) => d.filter((x) => x.id !== id));
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not remove." });
    } finally {
      setBusy("");
    }
  };

  const submitForReview = async () => {
    setBusy("submit");
    setMsg(null);
    try {
      const res = await fetch("/api/expert/submit-for-review", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit for review.");
      setMsg({ tone: "ok", text: "Sent for review. We will message you here when it has been looked at." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not submit for review." });
    } finally {
      setBusy("");
    }
  };

  const canSubmit = profile.status === "DRAFT" || profile.status === "NEEDS_CHANGES";

  return (
    <form className="form-card card" onSubmit={save}>
      {photoRequired && !photoUrl && (
        <div className="notice notice-warning">
          <strong>We still need a profile photo.</strong>
          Your profile is public right now, but it will be hidden from the directory once photo checks
          are enforced. Add a photo below, or connect a Google account to pull one across.
        </div>
      )}

      <div className="form-section">
        <h2>Profile photo</h2>
        <p>A clear headshot. JPG, PNG or WebP, up to 8&nbsp;MB.</p>
        <div className="photo-row">
          {photoUrl ? (
            <img className="avatar avatar-lg" src={photoUrl} alt="Your profile photo" />
          ) : (
            <span className="avatar avatar-lg avatar-empty"><UserRound size={26} strokeWidth={1.8} /></span>
          )}
          <label className="button button-secondary">
            <Upload size={16} strokeWidth={2.2} />
            {busy === "photo" ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <h2>Who you are</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor="pe-name">Full name</label>
            <input
              id="pe-name" className="input" required minLength={2}
              value={form.name} onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pe-company">Company or trading name <span className="label-optional">optional</span></label>
            <input
              id="pe-company" className="input" placeholder="If you work through a company"
              value={form.companyName} onChange={(e) => set("companyName", e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>Your public profile address</label>
          <div className="readonly-field">
            <span>/experts/{profile.slug}</span>
            <span className="field-hint">
              Fixed. Your name can change; the link cannot, because it has already been shared.
            </span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Professional identity</h2>
        <div className="field">
          <label htmlFor="pe-title">Headline</label>
          <input id="pe-title" className="input" value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pe-bio">About your work</label>
          <textarea id="pe-bio" className="textarea" value={form.bio} onChange={(e) => set("bio", e.target.value)} required />
          <span className="field-hint">
            Put links in the profile links section rather than the bio — contact details and external
            links are stripped from bios.
          </span>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="pe-location">Location</label>
            <input id="pe-location" className="input" placeholder="Berlin, Germany" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pe-country">Country</label>
            <input id="pe-country" className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="pe-tz">Timezone</label>
            <input id="pe-tz" className="input" placeholder="CET" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pe-rate">Reference hourly rate (€)</label>
            <input id="pe-rate" className="input" type="number" min={0} value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pe-avail">Availability</label>
          <input id="pe-avail" className="input" placeholder="20 hrs / week" value={form.availability} onChange={(e) => set("availability", e.target.value)} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="pe-skills">Skills, comma separated</label>
            <input id="pe-skills" className="input" value={form.skills} onChange={(e) => set("skills", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pe-int">Integrations, comma separated</label>
            <input id="pe-int" className="input" value={form.integrations} onChange={(e) => set("integrations", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Working details</h2>
        <p>These answer the questions clients ask before they get in touch.</p>
        <div className="form-row">
          <div className="field">
            <label htmlFor="pe-langs">Languages you work in, comma separated</label>
            <input
              id="pe-langs" className="input" placeholder="English, German, Serbian"
              value={form.languages} onChange={(e) => set("languages", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pe-years">Years of experience</label>
            <input
              id="pe-years" className="input" type="number" min={0} max={60}
              value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="pe-hours">Hours available per week</label>
            <input
              id="pe-hours" className="input" type="number" min={0} max={80}
              value={form.hoursPerWeek} onChange={(e) => set("hoursPerWeek", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pe-min">Smallest project you take (€)</label>
            <input
              id="pe-min" className="input" type="number" min={0}
              value={form.minEngagement} onChange={(e) => set("minEngagement", e.target.value)}
            />
            <span className="field-hint">Saves both sides a conversation that was never going to work.</span>
          </div>
        </div>
        <div className="field">
          <label>Where your n8n experience sits</label>
          <div className="checkbox-grid">
            {N8N_EXPERIENCE_OPTIONS.map((opt) => (
              <label className="check" key={opt}>
                <input
                  type="checkbox"
                  checked={n8nExperience.includes(opt)}
                  onChange={(e) =>
                    setN8nExperience(e.target.checked
                      ? [...n8nExperience, opt]
                      : n8nExperience.filter((x) => x !== opt))}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Links</h2>
        <p>
          Your portfolio, GitHub, LinkedIn or a demo. These appear on your public profile — which is why
          links are stripped out of the bio.
        </p>
        {links.length > 0 && (
          <div className="link-rows">
            {links.map((l, i) => (
              <div className="link-row" key={i}>
                <input
                  className="input"
                  placeholder="Label (e.g. GitHub)"
                  value={l.label}
                  aria-label={`Link ${i + 1} label`}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="input"
                  type="url"
                  placeholder="https://…"
                  value={l.url}
                  aria-label={`Link ${i + 1} URL`}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                />
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  aria-label={`Remove link ${i + 1}`}
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                </button>
              </div>
            ))}
          </div>
        )}
        {links.length < 8 && (
          <button
            type="button"
            className="button button-secondary"
            style={{ marginTop: links.length ? 12 : 4 }}
            onClick={() => setLinks([...links, { label: "", url: "" }])}
          >
            <Plus size={16} strokeWidth={2.2} />Add a link
          </button>
        )}
      </div>

      <div className="form-section">
        <h2>Documents</h2>
        <p>
          Your CV, portfolio, certificates or identity document. These stay private to you and marketplace
          reviewers — they are never shown on your public profile. PDF, Word or image, up to 20&nbsp;MB.
        </p>
        <div className="doc-upload">
          <select className="select" value={docKind} onChange={(e) => setDocKind(e.target.value)} aria-label="Document type">
            {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <label className="button button-secondary">
            <Upload size={16} strokeWidth={2.2} />
            {busy === "doc" ? "Uploading…" : "Choose file"}
            <input type="file" accept={ACCEPT} hidden onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])} />
          </label>
        </div>

        {documents.length > 0 && (
          <ul className="doc-list">
            {documents.map((d) => (
              <li key={d.id}>
                <FileText size={16} strokeWidth={2} />
                <div>
                  <strong>{d.fileName}</strong>
                  <span>
                    {DOC_KINDS.find((k) => k.value === d.kind)?.label || d.kind} ·{" "}
                    {(d.sizeBytes / 1024 / 1024).toFixed(1)} MB · {d.reviewState.toLowerCase()}
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => removeDocument(d.id)}
                  disabled={busy === `del-${d.id}`}
                  aria-label={`Remove ${d.fileName}`}
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {msg && (
        <div className={msg.tone === "ok" ? "info-box" : "error-box"}>
          {msg.tone === "ok" ? <CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} /> : <AlertTriangle size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />}
          {msg.text}
        </div>
      )}

      <div className="editor-actions">
        <button className="button button-primary" disabled={busy === "save"} type="submit">
          {busy === "save" ? "Saving…" : "Save changes"}
        </button>

        {canSubmit && (
          <button
            type="button"
            className="button button-accent"
            disabled={busy === "submit"}
            onClick={submitForReview}
          >
            <Send size={15} strokeWidth={2.2} />
            {busy === "submit" ? "Sending…" : "Submit for review"}
          </button>
        )}

        {profile.status === "SUBMITTED" && (
          <span className="editor-state">Waiting for review. You can keep editing while you wait.</span>
        )}
        {profile.status === "PUBLISHED" && (
          <span className="editor-state">Live in the directory. Saved changes appear straight away.</span>
        )}
      </div>
    </form>
  );
}
