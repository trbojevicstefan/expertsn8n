"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function ProposalForm({ jobId, budgetMin, budgetMax }: {
  jobId: string;
  budgetMin?: number;
  budgetMax?: number;
}) {
  const router = useRouter();
  const [scope, setScope] = useState("");
  const [price, setPrice] = useState(budgetMin || 1000);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, scope, price: Number(price), deliveryDays: Number(days) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the proposal.");
      setMsg({ tone: "ok", text: "Proposal sent. You can track it under Proposals." });
      setScope("");
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Could not send the proposal." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="proposal-form card" onSubmit={submit}>
      <h3>Send a proposal</h3>
      <p className="muted">
        Say how you would build it and what it costs. Contact details and external links are blocked
        until a milestone is funded.
      </p>

      <div className="field">
        <label htmlFor="pf-scope">Your approach</label>
        <textarea
          id="pf-scope"
          className="textarea"
          required
          minLength={60}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="The architecture you would use, the milestones you would split it into, and how you would handle failures."
        />
        <span className="field-hint">{scope.length} / 60 characters minimum</span>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="pf-price">Your price (€)</label>
          <input
            id="pf-price" className="input" type="number" min={100} required
            value={price} onChange={(e) => setPrice(Number(e.target.value))}
          />
          {budgetMin != null && budgetMax != null && (
            <span className="field-hint">
              Client budget: €{budgetMin.toLocaleString()}–€{budgetMax.toLocaleString()}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="pf-days">Delivery in days</label>
          <input
            id="pf-days" className="input" type="number" min={1} max={365} required
            value={days} onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
      </div>

      {msg && <div className={msg.tone === "ok" ? "info-box" : "error-box"}>{msg.text}</div>}

      <button className="button button-primary button-wide" disabled={busy || scope.length < 60} type="submit">
        <Send size={15} strokeWidth={2.2} />
        {busy ? "Sending…" : "Send proposal"}
      </button>
    </form>
  );
}
