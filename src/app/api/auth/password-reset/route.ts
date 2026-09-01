import { NextResponse } from "next/server";
import { z } from "zod";
import { sendCustomerIoPasswordReset } from "@/lib/customerio";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const schema = z.object({ email: z.string().email().max(320) });
const RESEND_COOLDOWN_MS = 60_000;

/**
 * The response never varies on whether the address exists. Someone locked out
 * gets the same answer as someone probing for registered emails, and a
 * marketplace's member list is exactly what an enumeration attack is after.
 */
const ACCEPTED = { ok: true } as const;

export async function POST(request: Request) {
  let email: string;
  try {
    ({ email } = schema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const user = await adminAuth().getUserByEmail(email);
    const userRef = adminDb().collection("users").doc(user.uid);
    const lastSentAt = Date.parse(String((await userRef.get()).data()?.passwordResetLastSentAt || ""));
    if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      return NextResponse.json(ACCEPTED);
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io").replace(/\/$/, "");
    const firebaseLink = new URL(
      await adminAuth().generatePasswordResetLink(email, { url: `${appUrl}/sign-in` }),
    );
    const oobCode = firebaseLink.searchParams.get("oobCode");
    if (!oobCode) throw new Error("Firebase did not return a reset code");

    const resetUrl = new URL("/reset-password", appUrl);
    resetUrl.searchParams.set("oobCode", oobCode);

    await sendCustomerIoPasswordReset(user.uid, email, resetUrl.toString());
    await userRef.set({ passwordResetLastSentAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    // An unknown address is the expected case, not a fault worth logging.
    if ((error as { code?: string }).code !== "auth/user-not-found") {
      console.error("Unable to send password reset email", error);
    }
  }

  return NextResponse.json(ACCEPTED);
}
