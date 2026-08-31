import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { paymentProvider } from "@/lib/payments";
import { markProviderActionPending, paymentIdempotencyKey } from "@/lib/payments/actions";
import { processConfirmedProviderPaymentEvent } from "@/lib/payments/events";
import type { Contract, SupportTicket } from "@/lib/types";

const schema = z.object({
  state: z.enum(["IN_REVIEW", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(2000).default(""),
  /** For a dispute: what happens to the frozen milestone. */
  outcome: z.enum(["none", "release", "refund", "reopen"]).default("none"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Support is not available right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid resolution." }, { status: 400 });
  }

  const db = adminDb();
  const snap = await db.collection("supportTickets").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const ticket = { id: snap.id, ...snap.data() } as SupportTicket;
  const nowIso = new Date().toISOString();

  // A disputed milestone remains frozen until the provider confirms the money
  // outcome. A provider merely accepting a transfer/refund request is not a
  // reason to close the dispute.
  if (ticket.contractId && ticket.milestoneId && input.outcome !== "none") {
    const contractRef = db.collection("contracts").doc(ticket.contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    const contract = { id: contractSnap.id, ...contractSnap.data() } as Contract;
    const milestones = [...(contract.milestones || [])];
    const idx = milestones.findIndex((m) => m.id === ticket.milestoneId);
    if (idx < 0) return NextResponse.json({ error: "Disputed milestone not found." }, { status: 404 });
    const milestone = milestones[idx]!;

    if (input.outcome === "reopen") {
      milestones[idx] = { ...milestone, status: "FUNDED", paymentStatus: "FUNDED" };
      await contractRef.set({ milestones, updatedAt: nowIso }, { merge: true });
    }

    if (input.outcome === "release" || input.outcome === "refund") {
      try {
        const action = input.outcome;
        const provider = paymentProvider();
        const providerResult =
          action === "release"
            ? await provider.releaseFunds({
                milestoneId: milestone.id,
                contractId: contract.id,
                amount: milestone.amount,
                currency: contract.currency,
                expertId: contract.expertId,
                idempotencyKey: paymentIdempotencyKey(contract.id, milestone.id, "release"),
              })
            : await provider.refundFunds({
                milestoneId: milestone.id,
                contractId: contract.id,
                amount: milestone.amount,
                currency: contract.currency,
                expertId: contract.expertId,
                idempotencyKey: paymentIdempotencyKey(contract.id, milestone.id, "refund"),
              });

        await markProviderActionPending({
          contractId: contract.id,
          milestoneId: milestone.id,
          action,
          provider: providerResult.provider,
          providerActionId: providerResult.providerActionId,
        });

        if (providerResult.status === "PENDING") {
          await snap.ref.set(
            {
              state: "IN_REVIEW",
              resolution: input.resolution,
              updatedAt: nowIso,
              pendingPaymentOutcome: action,
              pendingProviderActionId: providerResult.providerActionId,
            },
            { merge: true },
          );
          return NextResponse.json(
            {
              ok: true,
              state: "IN_REVIEW",
              paymentStatus: action === "release" ? "RELEASE_PENDING" : "REFUND_PENDING",
            },
            { status: 202 },
          );
        }

        await processConfirmedProviderPaymentEvent({
          provider: providerResult.provider,
          eventId: `${providerResult.providerActionId}:confirmed`,
          actionId: providerResult.providerActionId,
          kind: action === "release" ? "RELEASE_CONFIRMED" : "REFUND_CONFIRMED",
          contractId: contract.id,
          milestoneId: milestone.id,
          amount: milestone.amount,
          currency: contract.currency,
          occurredAt: nowIso,
        });
      } catch {
        return NextResponse.json({ error: "The payment provider could not complete that dispute outcome." }, { status: 503 });
      }
    }
  }

  await snap.ref.set(
    {
      state: input.state,
      resolution: input.resolution,
      resolvedBy: input.state === "RESOLVED" ? session.uid : null,
      resolvedAt: input.state === "RESOLVED" ? nowIso : null,
      updatedAt: nowIso,
      pendingPaymentOutcome: null,
      pendingProviderActionId: null,
    },
    { merge: true },
  );

  await db.collection("adminAuditLogs").add({
    actorId: session.uid,
    actorEmail: session.email,
    action: `TICKET_${input.state}`,
    targetType: "ticket",
    targetId: id,
    reason: `${input.resolution}${input.outcome !== "none" ? ` (milestone ${input.outcome})` : ""}`,
    createdAt: nowIso,
  });

  await notifyUser(ticket.raisedByUid, {
    type: "REVIEW_DECISION",
    title: `Your ticket was ${input.state.toLowerCase().replace("_", " ")}: ${ticket.subject}`,
    body: input.resolution.slice(0, 160) || "Open the ticket to see the outcome.",
    href: `/support/${id}`,
  });

  return NextResponse.json({ ok: true, state: input.state });
}
