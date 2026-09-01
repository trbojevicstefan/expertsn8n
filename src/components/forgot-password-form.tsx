"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle, MailCheck, Send } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not send the reset email.");
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the reset email.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-form verify-card">
        <div className="verify-icon" aria-hidden="true">
          <MailCheck size={28} />
        </div>
        <h1>Check your inbox</h1>
        <p className="verify-lead">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. The link is
          valid for one hour.
        </p>
        <Link className="button button-secondary button-wide" href="/sign-in">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Reset your password</h1>
      <p>Enter the address you signed up with and we will send you a link to choose a new password.</p>
      <div className="field">
        <label>Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="button button-primary button-wide" type="submit" disabled={loading}>
        {loading ? <LoaderCircle className="verify-spinner" size={17} /> : <Send size={16} />}
        {loading ? "Sending..." : "Send reset link"}
      </button>
      <p style={{ marginTop: 18, fontSize: 12, textAlign: "center" }}>
        Remembered it? <Link href="/sign-in" style={{ color: "#2563eb", fontWeight: 700 }}>Log in</Link>
      </p>
    </form>
  );
}
