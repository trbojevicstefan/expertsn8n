import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { recordContractActivity } from "@/lib/contract-activity";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import type { Contract, ContractReview } from "@/lib/types";

const schema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(2000),
});

function reviewId(contractId: string, reviewerUid: string): string {
  return createHash("sha256").update(`${contractId}:${reviewerUid}`).digest("hex");
}

async function refreshExpertRating(expertId: string) {
  const db = adminDb();
  const snap = await db
    .collection("reviews")
    .where("revieweeExpertId", "==", expertId)
    .where("direction", "==", "CLIENT_TO_EXPERT")
    .limit(500)
    .get();

  const ratings = snap.docs
    .map((doc) => Number((doc.data() || {}).rating))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  if (!ratings.length) return;

  const rating = Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10;
  await db.collection("expertProfiles").doc(expertId).set(
    { rating, reviewCount: ratings.length, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Reviews are not available right now." }, { status: 503 });
  }

  const { id } = await params;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Choose a 1-5 rating and write at least 10 characters." }, { status: 400 });
  }

  const db = adminDb();
  const contractSnap = await db.collection("contracts").doc(id).get();
  if (!contractSnap.exists) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  const contract = { id: contractSnap.id, ...contractSnap.data() } as Contract;

  const isClient = contract.clientId === session.uid;
  const isExpert = contract.expertUid === session.uid;
  if (!isClient && !isExpert) {
    return NextResponse.json({ error: "Only the two contract parties can leave a review." }, { status: 403 });
  }
  if (contract.status !== "COMPLETED") {
    return NextResponse.json({ error: "Reviews open after every milestone has been released." }, { status: 409 });
  }

  const direction = isClient ? "CLIENT_TO_EXPERT" : "EXPERT_TO_CLIENT";
  const revieweeUid = isClient ? contract.expertUid : contract.clientId;
  const ref = db.collection("reviews").doc(reviewId(id, session.uid));
  const nowIso = new Date().toISOString();

  let created = false;
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return;
    tx.create(ref, {
      contractId: id,
      reviewerUid: session.uid,
      revieweeUid,
      revieweeExpertId: isClient ? contract.expertId : null,
      direction,
      rating: input.rating,
      comment: input.comment,
      createdAt: nowIso,
    } satisfies Omit<ContractReview, "id">);
    created = true;
  });

  if (!created) {
    const existing = await ref.get();
    return NextResponse.json({ ok: true, id: ref.id, review: existing.data(), idempotent: true });
  }

  if (isClient && contract.expertId) await refreshExpertRating(contract.expertId);

  await recordContractActivity({
    contractId: id,
    type: "REVIEW_SUBMITTED",
    actorUid: session.uid,
    actorName: session.name || session.email,
    title: `${isClient ? "Client" : "Expert"} review submitted`,
    detail: `${input.rating}/5 rating`,
    createdAt: nowIso,
  });

  if (revieweeUid) {
    await notifyUser(revieweeUid, {
      type: "REVIEW_DECISION",
      title: `New review on ${contract.jobTitle}`,
      body: `${input.rating}/5 — ${input.comment.slice(0, 140)}`,
      href: `/contracts/${id}`,
    });
  }

  return NextResponse.json({ ok: true, id: ref.id }, { status: 201 });
}
