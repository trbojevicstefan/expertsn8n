"use client";

import { useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { AlertTriangle, CheckCircle2, FileText, Trash2, Upload, UserRound } from "lucide-react";
import { firebaseStorage } from "@/lib/firebase/client";
import type { ExpertDocument, ExpertProfile } from "@/lib/types";

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
  const [form, setForm] = useState({
    title: profile.title || "",
    bio: profile.bio || "",
    location: profile.location || "",
    country: profile.country || "",
    timezone: profile.timezone || "",
    hourlyRate: profile.hourlyRate || 0,
    availability: profile.availability || "",
    skills: (profile.skills || []).join(", "),
    integrations: (profile.integrations || []).join(", "),
  });
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
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          integrations: form.integrations.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setMsg({ tone: "ok", text: "Profile saved." });
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
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not remove." });
    } finally {
      setBusy("");
    }
  };

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

      <button className="button button-primary" disabled={busy === "save"} type="submit">
        {busy === "save" ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
