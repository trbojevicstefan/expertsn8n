import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyAdmins } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Contract } from "@/lib/types";

const schema = z.object({
  subject: z.string().min(5).max(140),
  body: z.string().min(20).max(6000),
  contractId: z.string().max(200).optional(),
  milestoneId: z.string().max(200).optional(),
});

/**
 * One channel for anything a user needs staff to look at. Attaching a contract
 * makes it a dispute, which additionally freezes the milestone so nothing is
 * released while it is open.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Support is not available right now." }, { status: 503 });
  }

  const limited = await enforceRateLimit({
    scope: "support.ticket.create.user",
    identity: session.uid,
    limit: 6,
    windowMs: 60 * 60 * 1000,
    message: "Too many support requests were opened recently. Try again later.",
  });
  if (limited) return limited;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Give it a subject and describe what happened in a couple of sentences." },
      { status: 400 },
    );
  }

  const db = adminDb();
  const nowIso = new Date().toISOString();
  let amountAtRisk: number | null = null;
  let kind: "GENERAL" | "DISPUTE" = "GENERAL";

  if (input.contractId) {
    const snap = await db.collection("contracts").doc(input.contractId).get();
    if (!snap.exists) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    const contract = { id: snap.id, ...snap.data() } as Contract;
    if (contract.clientId !== session.uid && contract.expertUid !== session.uid && !session.admin) {
      return NextResponse.json({ error: "This contract is not yours." }, { status: 403 });
    }

    kind = "DISPUTE";
    const milestones = [...(contract.milestones || [])];
    const idx = milestones.findIndex((m) => m.id === input.milestoneId);
    if (idx >= 0) {
      amountAtRisk = milestones[idx]!.amount ?? null;
      milestones[idx] = { ...milestones[idx]!, status: "DISPUTED" };
      await snap.ref.set({ milestones, updatedAt: nowIso }, { merge: true });
    }
  }

  const ref = await db.collection("supportTickets").add({
    kind,
    subject: input.subject.trim(),
    body: input.body.trim(),
    state: "OPEN",
    raisedByUid: session.uid,
    raisedByName: session.name || session.email,
    raisedByRole: session.role,
    contractId: input.contractId || null,
    milestoneId: input.milestoneId || null,
    amountAtRisk,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await notifyAdmins({
    type: "MESSAGE",
    title: kind === "DISPUTE" ? `Dispute raised: ${input.subject}` : `Support ticket: ${input.subject}`,
    body: input.body.slice(0, 160),
    href: `/admin/tickets/${ref.id}`,
  });

  return NextResponse.json({ id: ref.id, kind, state: "OPEN" }, { status: 201 });
}
