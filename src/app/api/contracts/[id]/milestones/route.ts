import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { evaluateMilestoneAction } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";
import { paymentProvider } from "@/lib/payments";
import type { Contract, ContractMilestone } from "@/lib/types";

const schema = z.object({
  milestoneId: z.string().min(1),
  action: z.enum(["fund", "submit", "release"]),
  note: z.string().max(2000).default(""),
});

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
    return NextResponse.json({ error: "Invalid milestone action." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("contracts").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  const contract = { id: snap.id, ...snap.data() } as Contract;
  const isClient = contract.clientId === session.uid;
  const isExpert = contract.expertUid === session.uid;
  if (!isClient && !isExpert && !session.admin) {
    return NextResponse.json({ error: "This contract is not yours." }, { status: 403 });
  }

  const milestones = [...(contract.milestones || [])];
  const idx = milestones.findIndex((m) => m.id === input.milestoneId);
  if (idx < 0) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });

  const milestone = milestones[idx] as ContractMilestone;
  const policy = evaluateMilestoneAction({
    action: input.action,
    milestoneStatus: milestone.status,
    isClient,
    isExpert,
    isAdmin: Boolean(session.admin),
  });
  if (!policy.ok) {
    return NextResponse.json({ error: policy.message }, { status: policy.status });
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt: nowIso };

  if (input.action === "fund") {
    // Funding state is provider-confirmed rather than assumed from a redirect.
    const funding = await paymentProvider().createFundingSession({
      milestoneId: milestone.id,
      contractId: contract.id,
      clientId: contract.clientId,
      amount: milestone.amount,
      currency: contract.currency,
    });
    if (funding.status !== "FUNDED") {
      return NextResponse.json(
        { error: "The payment provider did not confirm funding.", checkoutUrl: funding.checkoutUrl },
        { status: 402 },
      );
    }

    milestones[idx] = { ...milestone, status: "FUNDED", fundedAt: nowIso };
    if (!contract.messagingUnlockedAt) patch.messagingUnlockedAt = nowIso;

    if (contract.expertUid) {
      await notifyUser(contract.expertUid, {
        type: "MESSAGE",
        title: `Milestone funded on ${contract.jobTitle}`,
        body: `€${milestone.amount.toLocaleString()} is held against "${milestone.title}". Messaging is open.`,
        href: `/contracts/${contract.id}`,
      });
    }
  }

  if (input.action === "submit") {
    milestones[idx] = { ...milestone, status: "SUBMITTED", submittedAt: nowIso, submissionNote: input.note };
    await notifyUser(contract.clientId, {
      type: "MESSAGE",
      title: `Work submitted on ${contract.jobTitle}`,
      body: input.note.slice(0, 160) || `"${milestone.title}" is ready for your review.`,
      href: `/contracts/${contract.id}`,
    });
  }

  if (input.action === "release") {
    const release = await paymentProvider().releaseFunds({
      milestoneId: milestone.id,
      contractId: contract.id,
      amount: milestone.amount,
      currency: contract.currency,
      expertId: contract.expertId,
    });
    if (!release.accepted) {
      return NextResponse.json({ error: "The payment provider refused the release." }, { status: 402 });
    }

    milestones[idx] = { ...milestone, status: "RELEASED", releasedAt: nowIso };

    const next = milestones[idx + 1];
    if (next && next.status === "DRAFT") milestones[idx + 1] = { ...next, status: "AWAITING_FUNDING" };
    if (milestones.every((m) => m.status === "RELEASED")) patch.status = "COMPLETED";

    if (contract.expertUid) {
      await notifyUser(contract.expertUid, {
        type: "MESSAGE",
        title: `Funds released on ${contract.jobTitle}`,
        body: `€${milestone.amount.toLocaleString()} released for "${milestone.title}".`,
        href: `/contracts/${contract.id}`,
      });
    }
  }

  await ref.set({ ...patch, milestones }, { merge: true });
  return NextResponse.json({ ok: true, milestones });
}
