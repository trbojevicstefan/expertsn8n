"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword,
  signInWithPopup, updateProfile,
} from "firebase/auth";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { firebaseAuth, firebaseClientConfigured } from "@/lib/firebase/client";

type Expert = { name: string; slug: string; title: string };

async function completeClaim(): Promise<{ photoLinked: boolean }> {
  if (!firebaseAuth?.currentUser) throw new Error("Sign-in did not complete.");
  // Forced refresh so a display name set moments earlier is in the token.
  const idToken = await firebaseAuth.currentUser.getIdToken(true);
  const res = await fetch("/api/claim/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not complete the claim.");
  return data;
}

export function ClaimForm() {
  const [step, setStep] = useState<"code" | "connect">("code");
  const [expert, setExpert] = useState<Expert | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not verify that code.");
      setExpert(data.expert);
      setStep("connect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setLoading(false);
    }
  };

  const finish = async () => {
    const { photoLinked } = await completeClaim();
    window.location.href = photoLinked
      ? "/dashboard/expert/profile?claimed=1"
      : "/dashboard/expert/profile?claimed=1&photo=required";
  };

  const withGoogle = async () => {
    if (!firebaseAuth) return setError("Authentication is not configured.");
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  };

  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseAuth) return setError("Authentication is not configured.");
    setError("");
    setLoading(true);
    try {
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (expert?.name) await updateProfile(cred.user, { displayName: expert.name });
      } catch (err) {
        // Already registered with this address — treat it as a log-in instead.
        const codeStr = (err as { code?: string }).code;
        if (codeStr === "auth/email-already-in-use") {
          await signInWithEmailAndPassword(firebaseAuth, email, password);
        } else {
          throw err;
        }
      }
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
      setLoading(false);
    }
  };

  if (step === "code") {
    return (
      <form className="auth-form" onSubmit={verify}>
        <h1>Claim your profile</h1>
        <p>
          We built a profile from the application you sent us. Enter the email you applied with and the
          code we sent you to take ownership of it.
        </p>
        {!firebaseClientConfigured && (
          <div className="info-box">Claiming is temporarily unavailable. Please try again shortly.</div>
        )}
        <div className="field">
          <label htmlFor="claim-email">Email address</label>
          <input
            id="claim-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="claim-code">Claim code</label>
          <input
            id="claim-code"
            className="input claim-code-input"
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="one-time-code"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        {error && <div className="error-box">{error}</div>}
        <button disabled={loading} className="button button-primary button-wide" type="submit">
          {loading ? "Checking…" : "Continue"}
        </button>
        <p className="claim-note">
          <ShieldCheck size={14} strokeWidth={2.2} />
          Each code works once. If yours does not work, reply to the email we sent you.
        </p>
      </form>
    );
  }

  return (
    <div className="auth-form">
      <div className="claim-found">
        <CheckCircle2 size={18} strokeWidth={2.2} />
        <div>
          <strong>{expert?.name}</strong>
          <span>{expert?.title}</span>
        </div>
      </div>
      <h1>Secure your account</h1>
      <p>
        Connect a Google account and we will pull your profile photo across automatically. That is the
        fastest route — you will not need a password at all.
      </p>

      <button disabled={loading} className="button button-primary button-wide button-lg" type="button" onClick={withGoogle}>
        Continue with Google
      </button>

      {!showPassword ? (
        <>
          <div className="separator">or</div>
          <button
            type="button"
            className="button button-secondary button-wide"
            onClick={() => setShowPassword(true)}
            disabled={loading}
          >
            <KeyRound size={16} strokeWidth={2.2} />
            Set a password instead
          </button>
        </>
      ) : (
        <form onSubmit={withPassword}>
          <div className="separator">or set a password</div>
          <div className="field">
            <label htmlFor="claim-password">Choose a password</label>
            <input
              id="claim-password"
              className="input"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button disabled={loading} className="button button-secondary button-wide" type="submit">
            {loading ? "Working…" : "Create account and claim"}
          </button>
        </form>
      )}

      {error && <div className="error-box">{error}</div>}

      <p className="claim-note">
        <ShieldCheck size={14} strokeWidth={2.2} />
        If you do not add a photo, your profile stays visible for now but will be hidden once photo
        checks are enforced.
      </p>
    </div>
  );
}
