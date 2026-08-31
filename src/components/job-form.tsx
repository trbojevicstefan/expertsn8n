"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Radio } from "lucide-react";

export function JobForm() {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries()) as Record<string, string>;
    const list = (v?: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          visibility,
          skills: list(body.skills),
          integrations: list(body.integrations),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create job");

      setMessage({
        tone: "ok",
        text: visibility === "PUBLIC"
          ? "Job posted. It is live in the marketplace now."
          : "Job created. It stays private until you invite experts.",
      });
      router.push("/dashboard/client/jobs");
      router.refresh();
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Could not create job" });
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
            placeholder="e.g. Rebuild lead routing in n8n" />
        </div>
        <div className="field">
          <label htmlFor="jf-desc">Project description</label>
          <textarea id="jf-desc" name="description" className="textarea" required minLength={40}
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
            <input id="jf-skills" name="skills" className="input" placeholder="n8n, APIs, AI agents" />
          </div>
          <div className="field">
            <label htmlFor="jf-int">Systems involved, comma separated</label>
            <input id="jf-int" name="integrations" className="input" placeholder="HubSpot, Postgres, Slack" />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Budget and timing</h2>
        <div className="form-row">
          <div className="field">
            <label htmlFor="jf-min">Budget from (€)</label>
            <input id="jf-min" name="budgetMin" type="number" min={100} className="input" required defaultValue={1000} />
          </div>
          <div className="field">
            <label htmlFor="jf-max">Budget to (€)</label>
            <input id="jf-max" name="budgetMax" type="number" min={100} className="input" required defaultValue={3000} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="jf-delivery">Delivery window</label>
          <input id="jf-delivery" name="delivery" className="input" required placeholder="2–3 weeks" />
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
      </div>

      {message && <div className={message.tone === "ok" ? "info-box" : "error-box"}>{message.text}</div>}

      <button className="button button-primary" disabled={loading} type="submit">
        {loading ? "Posting…" : visibility === "PUBLIC" ? "Post job" : "Create private job"}
      </button>
    </form>
  );
}
