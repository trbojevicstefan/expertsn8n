"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Radio } from "lucide-react";
import type { MarketplaceJob } from "@/lib/types";

export function JobForm({ job }: { job?: MarketplaceJob }) {
  const router = useRouter();
  const editing = Boolean(job);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(job?.visibility || "PUBLIC");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries()) as Record<string, string>;
    const list = (v?: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch(editing ? `/api/jobs/${encodeURIComponent(job!.id)}` : "/api/jobs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          visibility,
          skills: list(body.skills),
          integrations: list(body.integrations),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Could not ${editing ? "update" : "create"} job`);

      setMessage({
        tone: "ok",
        text: editing
          ? "Job updated."
          : visibility === "PUBLIC"
            ? "Job posted. It is live in the marketplace now."
            : "Job created. It stays private until you invite experts.",
      });
      router.push("/dashboard/client/jobs");
      router.refresh();
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : `Could not ${editing ? "update" : "create"} job` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-card card" onSubmit={submit}>
      <div className="form-section">
        <h2>Project basics</h2>
        <p>Describe the business outcome, not only the nodes you think you need.</p>
        <div className="field">
          <label htmlFor="jf-title">Job title</label>
          <input id="jf-title" name="title" className="input" required minLength={8}
            defaultValue={job?.title || ""} placeholder="e.g. Rebuild lead routing in n8n" />
        </div>
        <div className="field">
          <label htmlFor="jf-desc">Project description</label>
          <textarea id="jf-desc" name="description" className="textarea" required minLength={40}
            defaultValue={job?.description || ""}
            placeholder="What is happening today, what should the workflow do, and what does success look like?" />
          <span className="field-hint">
            Contact details and external links are not allowed until a milestone is funded.
          </span>
        </div>
      </div>

      <div className="form-section">
        <h2>What it involves</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor="jf-skills">Skills needed, comma separated</label>
            <input id="jf-skills" name="skills" className="input" defaultValue={(job?.skills || []).join(", ")} placeholder="n8n, APIs, AI agents" />
          </div>
          <div className="field">
            <label htmlFor="jf-int">Systems involved, comma separated</label>
            <input id="jf-int" name="integrations" className="input" defaultValue={(job?.integrations || []).join(", ")} placeholder="HubSpot, Postgres, Slack" />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Budget and timing</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor="jf-min">Budget from (€)</label>
            <input id="jf-min" name="budgetMin" type="number" min={100} className="input" required defaultValue={job?.budgetMin || 1000} />
          </div>
          <div className="field">
            <label htmlFor="jf-max">Budget to (€)</label>
            <input id="jf-max" name="budgetMax" type="number" min={100} className="input" required defaultValue={job?.budgetMax || 3000} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="jf-delivery">Delivery window</label>
          <input id="jf-delivery" name="delivery" className="input" required defaultValue={job?.delivery || ""} placeholder="2–3 weeks" />
        </div>
      </div>

      <div className="form-section">
        <h2>Visibility</h2>
        <div className="role-cards">
          <button type="button" onClick={() => setVisibility("PUBLIC")}
            className={`role-card ${visibility === "PUBLIC" ? "active" : ""}`}>
            <Radio size={19} />
            <strong>Public marketplace</strong>
            <span>Experts can discover it and send proposals.</span>
          </button>
          <button type="button" onClick={() => setVisibility("PRIVATE")}
            className={`role-card ${visibility === "PRIVATE" ? "active" : ""}`}>
            <LockKeyhole size={19} />
            <strong>Private search</strong>
            <span>Nobody sees it until you invite specific experts.</span>
          </button>
        </div>
        {editing && (job?.proposalCount || 0) > 0 && (
          <span className="field-hint">Visibility is locked after the first proposal, so existing applicants cannot be silently moved into or out of a private search.</span>
        )}
      </div>

      {message && <div className={message.tone === "ok" ? "info-box" : "error-box"}>{message.text}</div>}

      <button className="button button-primary" disabled={loading} type="submit">
        {loading ? (editing ? "Saving…" : "Posting…") : editing ? "Save job" : visibility === "PUBLIC" ? "Post job" : "Create private job"}
      </button>
    </form>
  );
}
