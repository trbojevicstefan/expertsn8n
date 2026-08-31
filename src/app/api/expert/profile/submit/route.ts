import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({
  headline: z.string().min(10).max(120),
  bio: z.string().min(80).max(4000),
  location: z.string().min(2),
  timezone: z.string().min(2),
  rate: z.coerce.number().min(20).max(500),
  skills: z.array(z.string()).min(2),
  photoPath: z.string(),
  cvPath: z.string(),
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

/** Slugs are public URLs, so a collision has to resolve rather than overwrite. */
async function uniqueSlug(base: string, ownUid: string): Promise<string> {
  const db = adminDb();
  const candidate = base || "expert";
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? candidate : `${candidate}-${i + 1}`;
    const snap = await db.collection("expertProfiles").where("slug", "==", slug).limit(1).get();
    if (snap.empty || snap.docs[0]!.id === ownUid) return slug;
  }
  return `${candidate}-${ownUid.slice(0, 6).toLowerCase()}`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  }

  try {
    const input = schema.parse(await req.json());

    const photoPrefix = `private/experts/${session.uid}/photo/`;
    const cvPrefix = `private/experts/${session.uid}/cv/`;
    if (!input.photoPath.startsWith(photoPrefix) || !input.cvPath.startsWith(cvPrefix)) {
      throw new Error("Profile photo and CV uploads must belong to the signed-in expert.");
    }

    const db = adminDb();
    const nowIso = new Date().toISOString();
    const name = session.name || session.email.split("@")[0] || "Expert";
    const profileRef = db.collection("expertProfiles").doc(session.uid);
    const existing = await profileRef.get();
    const slug = (existing.data() || {}).slug || (await uniqueSlug(slugify(name), session.uid));

    const batch = db.batch();

    // Written in the same shape as every other profile so a reviewer can
    // publish it without the directory rendering a nameless card.
    batch.set(
      profileRef,
      {
        name,
        slug,
        title: input.headline,
        bio: input.bio,
        location: input.location,
        country: "",
        timezone: input.timezone,
        photoUrl: "",
        skills: input.skills,
        integrations: [],
        hourlyRate: input.rate,
        currency: "EUR",
        availability: "",
        rating: 0,
        reviewCount: 0,
        completedProjects: 0,
        verified: false,
        status: "SUBMITTED",
        badges: [],
        links: [],
        source: "self-signup",
        photoStatus: "PENDING_REVIEW",
        claimState: "CLAIMED",
        claimedByUid: session.uid,
        claimedAt: nowIso,
        missingFields: [],
        createdAt: (existing.data() || {}).createdAt || nowIso,
        updatedAt: nowIso,
      },
      { merge: true },
    );

    batch.set(
      db.collection("expertPrivate").doc(session.uid),
      { email: session.email, cvStoragePath: input.cvPath, photoStoragePath: input.photoPath },
      { merge: true },
    );

    batch.set(
      db.collection("expertVerifications").doc(session.uid),
      { state: "SUBMITTED", submittedAt: nowIso },
      { merge: true },
    );

    // Without this link the expert dashboard cannot find their own profile.
    batch.set(db.collection("users").doc(session.uid), { expertId: session.uid }, { merge: true });

    await batch.commit();
    return NextResponse.json({ ok: true, state: "SUBMITTED", slug });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid profile" },
      { status: 400 },
    );
  }
}
