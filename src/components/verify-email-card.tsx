"use client";

import { useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
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
      await sendEmailVerification(user, { url: `${window.location.origin}/verify-email` });
      setMessage("A fresh verification email has been sent. Check spam if it does not arrive soon.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resend the verification email.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="auth-form">
      <h1>Verify your email</h1>
      <p>{message}</p>
      <button className="button button-primary button-wide" disabled={working} onClick={check}>
        I verified my email
      </button>
      <button className="button button-secondary button-wide" disabled={working} onClick={resend}>
        Resend verification email
      </button>
      <p style={{ marginTop: 18, fontSize: 12, textAlign: "center" }}>
        Wrong account? <a href="/sign-in" style={{ color: "#2563eb", fontWeight: 700 }}>Return to sign in</a>
      </p>
    </div>
  );
}
