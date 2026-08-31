import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import type { ContractMilestone } from "@/lib/types";

/**
 * Accepting a proposal is what creates a contract. Nothing did this before, so
 * a proposal was a dead end: it could be sent and read, and then the trail
 * stopped.
 *
 * The value is split into two milestones so there is something to fund now and
 * something held back against delivery, which is the whole point of the model.
 */
function initialMilestones(total: number): ContractMilestone[] {
  const first = Math.round(total / 2);
  return [
    { id: randomUUID(), title: "Milestone 1 — build", amount: first, status: "AWAITING_FUNDING" },
    { id: randomUUID(), title: "Milestone 2 — handover", amount: total - first, status: "DRAFT" },
  ];
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Contracts are not available right now." }, { status: 503 });
  }

  const { id } = await params;
  const db = adminDb();
  const proposalRef = db.collection("proposals").doc(id);
  const proposalSnap = await proposalRef.get();
  if (!proposalSnap.exists) return NextResponse.json({ error: "Proposal not found." }, { status: 404 });

  const proposal = proposalSnap.data() || {};
  if (proposal.clientId !== session.uid && !session.admin) {
    return NextResponse.json({ error: "This proposal is not on your job." }, { status: 403 });
  }
  if (proposal.status === "ACCEPTED") {
    return NextResponse.json({ error: "This proposal has already been accepted." }, { status: 409 });
  }

  const jobRef = db.collection("jobs").doc(proposal.jobId);
  const job = (await jobRef.get()).data() || {};
  const nowIso = new Date().toISOString();
  const total = Number(proposal.price) || 0;

  const contractRef = db.collection("contracts").doc();
  const batch = db.batch();

  batch.set(contractRef, {
    jobId: proposal.jobId,
    jobTitle: proposal.jobTitle || job.title || "",
    proposalId: id,
    clientId: proposal.clientId,
    clientName: job.clientName || session.name || session.email,
    expertUid: proposal.expertUid,
    expertId: proposal.expertId,
    expertName: proposal.expertName || "",
    totalAmount: total,
    currency: proposal.currency || "EUR",
    status: "ACTIVE",
    // Stays null until money is actually held. The contact guard depends on it.
    messagingUnlockedAt: null,
    milestones: initialMilestones(total),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  batch.set(proposalRef, { status: "ACCEPTED", contractId: contractRef.id, updatedAt: nowIso }, { merge: true });
  batch.set(jobRef, { status: "FILLED", updatedAt: nowIso }, { merge: true });

  await batch.commit();

  if (proposal.expertUid) {
    await notifyUser(proposal.expertUid, {
      type: "MESSAGE",
      title: `Your proposal was accepted: ${proposal.jobTitle || "job"}`,
      body: "A contract has been created. Messaging opens when the first milestone is funded.",
      href: `/contracts/${contractRef.id}`,
    });
  }

  return NextResponse.json({ ok: true, contractId: contractRef.id }, { status: 201 });
}
