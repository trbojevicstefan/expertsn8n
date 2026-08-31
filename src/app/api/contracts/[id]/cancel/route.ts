import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { recordContractActivity } from "@/lib/contract-activity";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { evaluateContractCancellation } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";
import { effectivePaymentStatus } from "@/lib/payments/state";
import type { Contract } from "@/lib/types";

const schema = z.object({ reason: z.string().trim().min(10).max(1000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Contracts are not available right now." }, { status: 503 });
  }

  const { id } = await params;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Explain the cancellation in at least 10 characters." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("contracts").doc(id);
  let idempotent = false;
  let otherUid = "";
  let jobTitle = "Contract";
  const nowIso = new Date().toISOString();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("NOT_FOUND:Contract not found.");
      const current = { id: snap.id, ...snap.data() } as Contract;

      const isClient = current.clientId === session.uid;
      const isExpert = current.expertUid === session.uid;
      const policy = evaluateContractCancellation({
        contractStatus: current.status,
        isClient,
        isExpert,
        isAdmin: Boolean(session.admin),
        paymentStatuses: (current.milestones || []).map(effectivePaymentStatus),
      });
      if (!policy.ok) {
        const kind = policy.status === 403 ? "FORBIDDEN" : "CONFLICT";
        throw new Error(`${kind}:${policy.message}`);
      }

      otherUid = isClient ? current.expertUid : current.clientId;
      jobTitle = current.jobTitle || "Contract";

      if (policy.idempotent) {
        idempotent = true;
        return;
      }

      tx.set(
        ref,
        {
          status: "CANCELLED",
          cancelledAt: nowIso,
          cancelledByUid: session.uid,
          cancellationReason: input.reason,
          updatedAt: nowIso,
        },
        { merge: true },
      );

      if (current.jobId) {
        tx.set(
          db.collection("jobs").doc(current.jobId),
          { status: "OPEN", acceptedProposalId: null, contractId: null, updatedAt: nowIso },
          { merge: true },
        );
      }
      if (current.proposalId) {
        tx.set(
          db.collection("proposals").doc(current.proposalId),
          { status: "SUBMITTED", contractId: null, updatedAt: nowIso },
          { merge: true },
        );
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel contract.";
    const [kind, detail] = message.includes(":") ? message.split(/:(.*)/s, 2) : ["BAD_REQUEST", message];
    const status = kind === "NOT_FOUND" ? 404 : kind === "FORBIDDEN" ? 403 : kind === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: detail || "Could not cancel contract." }, { status });
  }

  if (idempotent) return NextResponse.json({ ok: true, status: "CANCELLED", idempotent: true });

  await recordContractActivity({
    contractId: id,
    type: "CONTRACT_CANCELLED",
    actorUid: session.uid,
    actorName: session.name || session.email,
    title: "Contract cancelled",
    detail: input.reason,
    createdAt: nowIso,
  });

  if (otherUid && otherUid !== session.uid) {
    await notifyUser(otherUid, {
      type: "MESSAGE",
      title: `Contract cancelled: ${jobTitle}`,
      body: input.reason.slice(0, 160),
      href: `/contracts/${id}`,
    });
  }

  return NextResponse.json({ ok: true, status: "CANCELLED" });
}
