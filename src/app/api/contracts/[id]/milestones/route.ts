import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { evaluateMilestoneAction } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";
import { paymentProvider } from "@/lib/payments";
import { markProviderActionPending, paymentIdempotencyKey } from "@/lib/payments/actions";
import { processConfirmedProviderPaymentEvent } from "@/lib/payments/events";
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

  if (input.action === "submit") {
    const nowIso = new Date().toISOString();
    milestones[idx] = { ...milestone, status: "SUBMITTED", submittedAt: nowIso, submissionNote: input.note };
    await ref.set({ milestones, updatedAt: nowIso }, { merge: true });
    await notifyUser(contract.clientId, {
      type: "MESSAGE",
      title: `Work submitted on ${contract.jobTitle}`,
      body: input.note.slice(0, 160) || `"${milestone.title}" is ready for your review.`,
      href: `/contracts/${contract.id}`,
    });
    return NextResponse.json({ ok: true, milestones });
  }

  try {
    const provider = paymentProvider();

    if (input.action === "fund") {
      const funding = await provider.createFundingSession({
        milestoneId: milestone.id,
        contractId: contract.id,
        clientId: contract.clientId,
        amount: milestone.amount,
        currency: contract.currency,
        idempotencyKey: paymentIdempotencyKey(contract.id, milestone.id, "fund"),
      });

      await markProviderActionPending({
        contractId: contract.id,
        milestoneId: milestone.id,
        action: "fund",
        provider: funding.provider,
        providerActionId: funding.providerActionId,
      });

      if (funding.status === "PENDING") {
        return NextResponse.json(
          {
            ok: true,
            paymentStatus: "PENDING",
            providerActionId: funding.providerActionId,
            checkoutUrl: funding.checkoutUrl,
          },
          { status: 202 },
        );
      }

      const applied = await processConfirmedProviderPaymentEvent({
        provider: funding.provider,
        eventId: `${funding.providerActionId}:confirmed`,
        actionId: funding.providerActionId,
        kind: "FUNDING_CONFIRMED",
        contractId: contract.id,
        milestoneId: milestone.id,
        amount: milestone.amount,
        currency: contract.currency,
        occurredAt: new Date().toISOString(),
      });

      if (contract.expertUid && applied.applied) {
        await notifyUser(contract.expertUid, {
          type: "MESSAGE",
          title: `Milestone funded on ${contract.jobTitle}`,
          body: `${contract.currency} ${milestone.amount.toLocaleString()} is held against "${milestone.title}". Messaging is open.`,
          href: `/contracts/${contract.id}`,
        });
      }

      return NextResponse.json({ ok: true, paymentStatus: applied.paymentStatus });
    }

    const release = await provider.releaseFunds({
      milestoneId: milestone.id,
      contractId: contract.id,
      amount: milestone.amount,
      currency: contract.currency,
      expertId: contract.expertId,
      idempotencyKey: paymentIdempotencyKey(contract.id, milestone.id, "release"),
    });

    await markProviderActionPending({
      contractId: contract.id,
      milestoneId: milestone.id,
      action: "release",
      provider: release.provider,
      providerActionId: release.providerActionId,
    });

    if (release.status === "PENDING") {
      return NextResponse.json(
        { ok: true, paymentStatus: "RELEASE_PENDING", providerActionId: release.providerActionId },
        { status: 202 },
      );
    }

    const applied = await processConfirmedProviderPaymentEvent({
      provider: release.provider,
      eventId: `${release.providerActionId}:confirmed`,
      actionId: release.providerActionId,
      kind: "RELEASE_CONFIRMED",
      contractId: contract.id,
      milestoneId: milestone.id,
      amount: milestone.amount,
      currency: contract.currency,
      occurredAt: new Date().toISOString(),
    });

    if (contract.expertUid && applied.applied) {
      await notifyUser(contract.expertUid, {
        type: "MESSAGE",
        title: `Funds released on ${contract.jobTitle}`,
        body: `${contract.currency} ${milestone.amount.toLocaleString()} released for "${milestone.title}".`,
        href: `/contracts/${contract.id}`,
      });
    }

    return NextResponse.json({ ok: true, paymentStatus: applied.paymentStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment provider action failed." },
      { status: 503 },
    );
  }
}
