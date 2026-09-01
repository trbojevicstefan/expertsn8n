"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientProfile } from "@/lib/types";

/**
 * One form behind both entry points. Onboarding and later edits post the same
 * four fields, so a second form would only be a place for the two to drift.
 */
export function ClientProfileForm({
  profile,
  redirectTo,
  submitLabel = "Save changes",
}: {
  profile?: ClientProfile | null;
  redirectTo?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(profile?.companyName || "");
  const [website, setWebsite] = useState(profile?.website || "");
  const [billingCountry, setBillingCountry] = useState(profile?.billingCountry || "");
  const [description, setDescription] = useState(profile?.description || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const response = await fetch("/api/client/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, website, billingCountry, description }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the client profile.");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        setSaved(true);
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the client profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-card card" onSubmit={submit}>
      <div className="form-section">
        <h2>Company</h2>
        <div className="field">
          <label>Company name</label>
          <input className="input" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Company website</label>
            <input className="input" type="url" placeholder="https://" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <div className="field">
            <label>Billing country</label>
            <input className="input" value={billingCountry} onChange={(event) => setBillingCountry(event.target.value)} required />
          </div>
        </div>
      </div>
      <div className="form-section">
        <h2>What do you automate?</h2>
        <textarea
          className="textarea"
          minLength={20}
          maxLength={2000}
          placeholder="Tell experts what your team does and where automation creates leverage."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      {saved && <div className="info-box">Company profile saved.</div>}
      <button className="button button-primary" type="submit" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
