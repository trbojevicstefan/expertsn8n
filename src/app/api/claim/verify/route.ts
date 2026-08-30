import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { claimCodeMatches, normalizeEmail } from "@/lib/claim-code";
import { CLAIM_COOKIE, CLAIM_TTL_MS, claimDocId, claimSessionDocId } from "@/lib/claim-session";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(64),
});

/** Deliberately identical for "no such code", "wrong code" and "already used"
 *  so the endpoint cannot be used to enumerate which emails were seeded. */
const REJECTED = "That email and code combination is not valid, or the code has already been used.";

export async function POST(req: Request) {
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Claiming is not available right now." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Enter your email address and the code you were sent." }, { status: 400 });
  }

  const email = normalizeEmail(input.email);
  const db = adminDb();
  const claimRef = db.collection("claimCodes").doc(claimDocId(email));
  const claimSnap = await claimRef.get();

  if (!claimSnap.exists) return NextResponse.json({ error: REJECTED }, { status: 400 });

  const claim = claimSnap.data() as {
    expertId: string; email: string; codeHash: string; used: boolean;
  };

  if (claim.used || claim.email !== email || !claimCodeMatches(input.code, claim.codeHash)) {
    return NextResponse.json({ error: REJECTED }, { status: 400 });
  }

  const profileSnap = await db.collection("expertProfiles").doc(claim.expertId).get();
  if (!profileSnap.exists) return NextResponse.json({ error: REJECTED }, { status: 400 });
  const profile = profileSnap.data() as { name: string; slug: string; title: string; claimState?: string };

  if (profile.claimState === "CLAIMED") {
    return NextResponse.json({ error: "This profile has already been claimed. Log in instead." }, { status: 409 });
  }

  // A server-side session rather than a signed token: it can be revoked, and
  // the browser only ever holds an opaque id.
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + CLAIM_TTL_MS;
  await db.collection("claimSessions").doc(claimSessionDocId(sessionId)).set({
    expertId: claim.expertId,
    email,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  const res = NextResponse.json({
    ok: true,
    expert: { name: profile.name, slug: profile.slug, title: profile.title },
  });
  res.cookies.set(CLAIM_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(CLAIM_TTL_MS / 1000),
  });
  return res;
}
