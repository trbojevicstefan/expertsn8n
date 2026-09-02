"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { BriefcaseBusiness, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { firebaseAuth, firebaseClientConfigured } from "@/lib/firebase/client";
import { requestVerificationEmail } from "@/lib/auth/client-verification";
import type { UserRole } from "@/lib/types";

async function establishSession(role?: UserRole) {
  if (!firebaseAuth?.currentUser) throw new Error("Authentication session was not created.");
  const token = await firebaseAuth.currentUser.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token, role }),
  });
  if (!response.ok) {
    throw new Error((await response.json()).error || "Could not create secure session.");
  }
  return response.json() as Promise<{ emailVerified: boolean; role: UserRole }>;
}

const NOTICES: Record<string, string> = {
  reset: "Password updated. Log in with your new password.",
  verified: "Email verified. Log in to continue.",
};

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const notice = NOTICES[params.get("reset") === "1" ? "reset" : params.get("verified") === "1" ? "verified" : ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!firebaseAuth) {
      setError("Sign-in is temporarily unavailable. Please try again shortly.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "sign-up") {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (name) await updateProfile(credential.user, { displayName: name });

        // Create the marketplace record (and Customer.io profile) before the
        // user leaves this page, then require mailbox verification for access.
        await establishSession(role);
        // The account already exists by this point, so a mail-delivery hiccup
        // must not strand anyone on this form: retrying here only ever returns
        // "email already in use". The verify page owns the resend instead.
        const sent = await requestVerificationEmail().then(() => true, () => false);
        router.push(sent ? "/verify-email" : "/verify-email?sent=0");
        return;
      }

      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const session = await establishSession();
      router.push(
        !credential.user.emailVerified || !session.emailVerified ? "/verify-email" : "/dashboard",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    if (!firebaseAuth) {
      setError("Sign-in is temporarily unavailable. Please try again shortly.");
      return;
    }

    setLoading(true);
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      // Google on an address that already has a password account links the two
      // onto one uid, so the role card is only a proposal: an existing account
      // keeps the role it signed up with. Following the card instead would send
      // an expert into client onboarding they cannot complete.
      const session = await establishSession(mode === "sign-up" ? role : undefined);
      router.push(
        mode === "sign-up"
          ? session.role === "expert"
            ? "/dashboard/expert/profile"
            : "/onboarding/client"
          : "/dashboard",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>
      <p>
        {mode === "sign-up"
          ? "Join as a client or apply to become a reviewed n8n expert."
          : "Log in to jobs, contracts, proposals and messages."}
      </p>
      {!firebaseClientConfigured && (
        <div className="info-box">
          Sign-in is temporarily unavailable. The rest of the site still works — please try again
          shortly.
        </div>
      )}
      {mode === "sign-up" && (
        <>
          <div className="role-cards">
            <button
              type="button"
              className={`role-card ${role === "client" ? "active" : ""}`}
              onClick={() => setRole("client")}
            >
              <BriefcaseBusiness size={20} />
              <strong>I’m hiring</strong>
              <span>Post jobs and hire n8n experts.</span>
            </button>
            <button
              type="button"
              className={`role-card ${role === "expert" ? "active" : ""}`}
              onClick={() => setRole("expert")}
            >
              <UserRoundSearch size={20} />
              <strong>I’m an expert</strong>
              <span>Apply, showcase work and win projects.</span>
            </button>
          </div>
          <div className="field">
            <label>Full name</label>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
        </>
      )}
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="field">
        <label>Password</label>
        <input className="input" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      {notice && <div className="info-box">{notice}</div>}
      {error && <div className="error-box">{error}</div>}
      <button disabled={loading} className="button button-primary button-wide" type="submit">
        {loading ? "Working..." : mode === "sign-up" ? "Create account" : "Log in"}
      </button>
      {mode === "sign-in" && (
        <p style={{ marginTop: 12, fontSize: 12, textAlign: "center" }}>
          <Link href="/forgot-password" style={{ color: "#2563eb", fontWeight: 700 }}>
            Forgot your password?
          </Link>
        </p>
      )}
      <div className="separator">or</div>
      <button disabled={loading} className="button button-secondary button-wide" type="button" onClick={google}>
        Continue with Google
      </button>
      <p style={{ marginTop: 18, fontSize: 12, textAlign: "center" }}>
        {mode === "sign-up" ? (
          <>Already have an account? <a href="/sign-in" style={{ color: "#2563eb", fontWeight: 700 }}>Log in</a></>
        ) : (
          <>New to n8nexperts? <a href="/sign-up" style={{ color: "#2563eb", fontWeight: 700 }}>Create account</a></>
        )}
      </p>
    </form>
  );
}
