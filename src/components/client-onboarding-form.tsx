"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientOnboardingForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [billingCountry, setBillingCountry] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/client/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, website, billingCountry, description }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the client profile.");
      router.push("/dashboard/client/jobs/new");
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
      <button className="button button-primary" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save and post a job"}
      </button>
    </form>
  );
}
