"use client";

import { useEffect, useState } from "react";
import { applyActionCode } from "firebase/auth";
import { ArrowRight, LoaderCircle, MailCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { requestVerificationEmail } from "@/lib/auth/client-verification";
import { firebaseAuth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

async function refreshSession() {
  const user = firebaseAuth?.currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;

  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return response.ok;
}

export function VerifyEmailCard() {
  const router = useRouter();
  const [message, setMessage] = useState("Open the verification link we sent to your inbox.");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const oobCode = new URLSearchParams(window.location.search).get("oobCode");
    if (oobCode && firebaseAuth) {
      const auth = firebaseAuth;
      const verifyFromLink = async () => {
        await Promise.resolve();
        setWorking(true);
        setMessage("Verifying your email securely...");
        try {
          await applyActionCode(auth, oobCode);
          if (await refreshSession()) {
            router.replace("/dashboard");
            return;
          }
          setMessage("Email verified. Redirecting you to sign in...");
          window.setTimeout(() => router.replace("/sign-in?verified=1"), 900);
        } catch {
          setMessage("This verification link is invalid or expired. Request a fresh email below.");
          setWorking(false);
        }
      };
      void verifyFromLink();
    }

    const timer = window.setInterval(async () => {
      if (await refreshSession()) router.push("/dashboard");
    }, 5000);
    return () => window.clearInterval(timer);
  }, [router]);

  const check = async () => {
    setWorking(true);
    try {
      if (await refreshSession()) {
        router.push("/dashboard");
      } else {
        setMessage("The address is not verified yet. Click the link in your email, then try again.");
      }
    } finally {
      setWorking(false);
    }
  };

  const resend = async () => {
    const user = firebaseAuth?.currentUser;
    if (!user) {
      router.push("/sign-in");
      return;
    }
    setWorking(true);
    try {
      await requestVerificationEmail();
      setMessage("A fresh n8nexperts verification email has been sent. Check your inbox.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resend the verification email.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="auth-form verify-card">
      <div className="verify-icon" aria-hidden="true">
        <MailCheck size={28} />
      </div>
      <span className="eyebrow verify-eyebrow">Check your inbox</span>
      <h1>Verify your email</h1>
      <p className="verify-lead">
        We sent a secure verification link to the email address connected to your account.
      </p>
      <div className="verify-status" role="status" aria-live="polite">
        <span className="verify-status-dot" aria-hidden="true" />
        <span>{message}</span>
      </div>
      <button className="button button-primary button-wide" disabled={working} onClick={check}>
        {working ? <LoaderCircle className="verify-spinner" size={17} /> : <ArrowRight size={17} />}
        {working ? "Checking..." : "I verified my email"}
      </button>
      <button className="button button-secondary button-wide" disabled={working} onClick={resend}>
        <RefreshCw size={16} />
        Resend verification email
      </button>
      <p className="verify-auto-check">
        <span aria-hidden="true" /> This page checks your verification automatically every few seconds.
      </p>
      <p className="verify-account-link">
        Wrong account? <Link href="/sign-in">Return to sign in</Link>
      </p>
    </div>
  );
}
