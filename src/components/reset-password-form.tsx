"use client";

import { useEffect, useState } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, LoaderCircle } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const oobCode = useSearchParams().get("oobCode") || "";
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(oobCode ? "" : "This reset link is incomplete. Request a new one.");
  const [checking, setChecking] = useState(Boolean(oobCode));
  const [saving, setSaving] = useState(false);

  // Checking the code up front means an expired link says so immediately,
  // rather than after someone has typed a new password twice.
  useEffect(() => {
    if (!oobCode || !firebaseAuth) return;
    const auth = firebaseAuth;
    void (async () => {
      try {
        setAccount(await verifyPasswordResetCode(auth, oobCode));
      } catch {
        setError("This reset link is invalid or has expired. Request a new one.");
      } finally {
        setChecking(false);
      }
    })();
  }, [oobCode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (!firebaseAuth) {
      setError("Firebase is not configured.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, password);
      router.replace("/sign-in?reset=1");
    } catch {
      setError("Could not set that password. Request a fresh reset link and try again.");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="auth-form verify-card">
        <LoaderCircle className="verify-spinner" size={24} />
        <p className="verify-lead">Checking your reset link...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="auth-form verify-card">
        <h1>Reset link expired</h1>
        <div className="error-box">{error}</div>
        <Link className="button button-primary button-wide" href="/forgot-password">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Choose a new password</h1>
      <p>Setting a new password for <strong>{account}</strong>.</p>
      <div className="field">
        <label>New password</label>
        <input
          className="input"
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label>Confirm new password</label>
        <input
          className="input"
          type="password"
          minLength={8}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="button button-primary button-wide" type="submit" disabled={saving}>
        {saving ? <LoaderCircle className="verify-spinner" size={17} /> : <KeyRound size={16} />}
        {saving ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
