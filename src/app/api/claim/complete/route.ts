import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { CLAIM_COOKIE, claimDocId, claimSessionDocId } from "@/lib/claim-session";

const schema = z.object({ idToken: z.string().min(20) });

const sessionCookieName = process.env.SESSION_COOKIE_NAME || "n8nexperts_session";

/** Google returns a sized avatar URL; ask for something big enough for the
 *  profile header rather than the 96px default. */
function upscaleGooglePhoto(url: string): string {
  return url.replace(/=s\d+(-c)?$/, "=s512-c");
}

export async function POST(req: Request) {
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Claiming is not available right now." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Missing sign-in token." }, { status: 400 });
  }

  const store = await cookies();
  const sessionId = store.get(CLAIM_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Your claim session expired. Enter your code again." }, { status: 401 });
  }

  const db = adminDb();
  const claimSessionRef = db.collection("claimSessions").doc(claimSessionDocId(sessionId));
  const claimSessionSnap = await claimSessionRef.get();
  if (!claimSessionSnap.exists) {
    return NextResponse.json({ error: "Your claim session expired. Enter your code again." }, { status: 401 });
  }

  const claimSession = claimSessionSnap.data() as { expertId: string; email: string; expiresAt: number };
  if (Date.now() > claimSession.expiresAt) {
    await claimSessionRef.delete();
    return NextResponse.json({ error: "Your claim session expired. Enter your code again." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(input.idToken, true);
  } catch {
    return NextResponse.json({ error: "Could not verify your sign-in." }, { status: 401 });
  }

  const profileRef = db.collection("expertProfiles").doc(claimSession.expertId);
  const claimRef = db.collection("claimCodes").doc(claimDocId(claimSession.email));

  const authPhoto = typeof decoded.picture === "string" ? upscaleGooglePhoto(decoded.picture) : "";
  const nowIso = new Date().toISOString();

  try {
    await db.runTransaction(async (tx) => {
      const [claimSnap, profileSnap] = await Promise.all([tx.get(claimRef), tx.get(profileRef)]);
      if (!claimSnap.exists || !profileSnap.exists) throw new Error("This profile is no longer available to claim.");
      if ((claimSnap.data() as { used: boolean }).used) throw new Error("This code has already been used.");

      const profile = profileSnap.data() as { missingFields?: string[] };
      const remaining = (profile.missingFields || []).filter((f) => (authPhoto ? f !== "photo" : true));

      tx.update(profileRef, {
        claimState: "CLAIMED",
        claimedByUid: decoded.uid,
        claimedAt: nowIso,
        updatedAt: nowIso,
        ...(authPhoto ? { photoUrl: authPhoto, photoStatus: "APPROVED" } : {}),
        missingFields: remaining,
      });

      tx.update(claimRef, {
        used: true,
        usedAt: nowIso,
        usedByUid: decoded.uid,
        usedByEmail: decoded.email || null,
      });

      tx.set(
        db.collection("users").doc(decoded.uid),
        {
          email: decoded.email || claimSession.email,
          name: decoded.name || "",
          role: "expert",
          status: "ACTIVE",
          expertId: claimSession.expertId,
          createdAt: nowIso,
          lastLoginAt: nowIso,
        },
        { merge: true },
      );
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not complete the claim." },
      { status: 409 },
    );
  }

  await claimSessionRef.delete();

  // Log them straight in so they land on the profile editor already signed in.
  const expiresIn = Number(process.env.SESSION_COOKIE_DAYS || 5) * 24 * 60 * 60 * 1000;
  const sessionCookie = await adminAuth().createSessionCookie(input.idToken, { expiresIn });

  const res = NextResponse.json({ ok: true, photoLinked: Boolean(authPhoto) });
  res.cookies.set(sessionCookieName, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(expiresIn / 1000),
  });
  res.cookies.set(CLAIM_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
