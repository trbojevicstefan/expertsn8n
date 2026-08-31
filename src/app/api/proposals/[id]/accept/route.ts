import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { evaluateProposalAward } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";
import type { ContractMilestone } from "@/lib/types";

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
  const contractRef = db.collection("contracts").doc(`proposal_${id}`);

  let notifyExpertUid = "";
  let notifyJobTitle = "job";
  let created = false;

  try {
    await db.runTransaction(async (tx) => {
      const proposalSnap = await tx.get(proposalRef);
      if (!proposalSnap.exists) throw new Error("NOT_FOUND:Proposal not found.");

      const proposal = proposalSnap.data() || {};
      // Preserve retry safety even if the associated job is later archived.
      if (proposal.status === "ACCEPTED") return;
      if (!proposal.jobId) throw new Error("CONFLICT:Proposal has no job.");

      const jobRef = db.collection("jobs").doc(String(proposal.jobId));
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) throw new Error("NOT_FOUND:Job not found.");
      const job = jobSnap.data() || {};
      const total = Number(proposal.price);

      const decision = evaluateProposalAward({
        viewerUid: session.uid,
        viewerAdmin: Boolean(session.admin),
        proposalClientId: String(proposal.clientId || ""),
        proposalStatus: String(proposal.status || ""),
        proposalJobId: String(proposal.jobId || ""),
        proposalPrice: total,
        jobClientId: String(job.clientId || ""),
        jobStatus: String(job.status || ""),
      });
      if (!decision.ok) {
        const kind = decision.status === 403 ? "FORBIDDEN" : "CONFLICT";
        throw new Error(`${kind}:${decision.message}`);
      }

      const nowIso = new Date().toISOString();
      tx.create(contractRef, {
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
        messagingUnlockedAt: null,
        milestones: initialMilestones(total),
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      tx.set(
        proposalRef,
        { status: "ACCEPTED", contractId: contractRef.id, updatedAt: nowIso },
        { merge: true },
      );
      tx.set(
        jobRef,
        {
          status: "FILLED",
          acceptedProposalId: id,
          contractId: contractRef.id,
          updatedAt: nowIso,
        },
        { merge: true },
      );

      notifyExpertUid = typeof proposal.expertUid === "string" ? proposal.expertUid : "";
      notifyJobTitle = String(proposal.jobTitle || job.title || "job");
      created = true;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept proposal.";
    const [kind, detail] = message.includes(":") ? message.split(/:(.*)/s, 2) : ["BAD_REQUEST", message];
    const status = kind === "NOT_FOUND" ? 404 : kind === "FORBIDDEN" ? 403 : kind === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: detail || "Could not accept proposal." }, { status });
  }

  if (!created) {
    const snap = await proposalRef.get();
    const existingContractId = String((snap.data() || {}).contractId || contractRef.id);
    return NextResponse.json({ ok: true, contractId: existingContractId, idempotent: true });
  }

  if (notifyExpertUid) {
    await notifyUser(notifyExpertUid, {
      type: "MESSAGE",
      title: `Your proposal was accepted: ${notifyJobTitle}`,
      body: "A contract has been created. Messaging opens when the first milestone is funded.",
      href: `/contracts/${contractRef.id}`,
    });
  }

  return NextResponse.json({ ok: true, contractId: contractRef.id }, { status: 201 });
}
