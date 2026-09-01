import { NextResponse } from "next/server";
import { z } from "zod";
import { sendCustomerIoEmailVerification } from "@/lib/customerio";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const schema = z.object({ idToken: z.string().min(20) });
const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: Request) {
  try {
    const { idToken } = schema.parse(await request.json());
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    if (!decoded.email) {
      return NextResponse.json({ error: "This account does not have an email address." }, { status: 400 });
    }
    if (decoded.email_verified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const userRef = adminDb().collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const lastSentAt = Date.parse(String(userSnap.data()?.verificationEmailLastSentAt || ""));
    if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${retryAfter} seconds before requesting another email.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io").replace(/\/$/, "");
    const firebaseLink = new URL(
      await adminAuth().generateEmailVerificationLink(decoded.email, {
        url: `${appUrl}/verify-email`,
      }),
    );
    const oobCode = firebaseLink.searchParams.get("oobCode");
    if (!oobCode) throw new Error("Firebase did not return a verification code");

    const verificationUrl = new URL("/verify-email", appUrl);
    verificationUrl.searchParams.set("mode", "verifyEmail");
    verificationUrl.searchParams.set("oobCode", oobCode);

    await sendCustomerIoEmailVerification(decoded.uid, verificationUrl.toString());
    await userRef.set(
      { verificationEmailLastSentAt: new Date().toISOString() },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unable to send verification email", error);
    return NextResponse.json(
      { error: "We could not send the verification email. Please try again shortly." },
      { status: 503 },
    );
  }
}
