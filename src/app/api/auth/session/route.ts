import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookieName } from "@/lib/auth/server";
import { syncMarketplaceUser } from "@/lib/customerio";

const schema = z.object({
  idToken: z.string().min(20),
  role: z.enum(["client", "expert"]).optional(),
});

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string, ownId: string): Promise<string> {
  const db = adminDb();
  const candidate = base || "expert";
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? candidate : `${candidate}-${i + 1}`;
    const snap = await db.collection("expertProfiles").where("slug", "==", slug).limit(1).get();
    if (snap.empty || snap.docs[0]!.id === ownId) return slug;
  }
  return `${candidate}-${ownId.slice(0, 6).toLowerCase()}`;
}

/**
 * Gives a new expert a profile document straight away.
 *
 * Without this the profile editor has nothing to load, which is why signing up
 * used to drop people on a cut-down onboarding form and only reveal the real
 * editor after they submitted it and reloaded. The draft is not public: it
 * starts at DRAFT and only reaches the directory once it is reviewed.
 */
async function ensureExpertProfile(uid: string, name: string, email: string): Promise<void> {
  const db = adminDb();

  // The link is what matters, not the document id. Someone who claimed a seeded
  // profile is linked to `cand_...`, so checking `expertProfiles/{uid}` alone
  // would miss it, create a second profile and overwrite the link.
  const userSnap = await db.collection("users").doc(uid).get();
  if ((userSnap.data() || {}).expertId) return;

  const profileRef = db.collection("expertProfiles").doc(uid);
  if ((await profileRef.get()).exists) return;

  const displayName = name || email.split("@")[0] || "Expert";
  const nowIso = new Date().toISOString();

  await profileRef.set({
    name: displayName,
    slug: await uniqueSlug(slugify(displayName), uid),
    title: "",
    bio: "",
    location: "",
    country: "",
    timezone: "",
    photoUrl: "",
    skills: [],
    integrations: [],
    languages: [],
    n8nExperience: [],
    hourlyRate: 0,
    currency: "EUR",
    availability: "",
    rating: 0,
    reviewCount: 0,
    completedProjects: 0,
    verified: false,
    status: "DRAFT",
    badges: [],
    links: [],
    source: "self-signup",
    photoStatus: "MISSING",
    claimState: "CLAIMED",
    claimedByUid: uid,
    claimedAt: nowIso,
    missingFields: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await db.collection("expertPrivate").doc(uid).set({ email }, { merge: true });
  await db.collection("users").doc(uid).set({ expertId: uid }, { merge: true });
}

export async function POST(request: Request) {
  try {
    const { idToken, role } = schema.parse(await request.json());
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    const expiresIn = Number(process.env.SESSION_COOKIE_DAYS || 5) * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });

    const db = adminDb();
    const userRef = db.collection("users").doc(decoded.uid);
    const existing = await userRef.get();
    const nowIso = new Date().toISOString();

    if (!existing.exists) {
      await userRef.set({
        email: decoded.email || "",
        name: decoded.name || "",
        role: role || "client",
        status: "ACTIVE",
        createdAt: nowIso,
        lastLoginAt: nowIso,
      });
    } else {
      const update: Record<string, unknown> = { lastLoginAt: nowIso };
      // A name that arrives on a later sign-in fills a gap left by an earlier one.
      if (decoded.name && !(existing.data() || {}).name) update.name = decoded.name;
      await userRef.update(update);
    }

    const effectiveRole = (existing.data() || {}).role || role || "client";
    if (effectiveRole === "expert") {
      await ensureExpertProfile(decoded.uid, decoded.name || "", decoded.email || "");
    }

    await syncMarketplaceUser(decoded.uid, existing.exists ? "logged_in" : "account_created");

    const res = NextResponse.json({
      ok: true,
      role: effectiveRole,
      emailVerified: decoded.email_verified !== false,
    });
    res.cookies.set(cookieName, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to create session" },
      { status: 400 },
    );
  }
}
