import { firebaseAuth } from "@/lib/firebase/client";

export async function requestVerificationEmail(): Promise<void> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error("Sign in again before requesting a verification email.");

  const response = await fetch("/api/auth/send-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken(true) }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not send the verification email.");
  }
}
