import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { evaluateProposalLifecycle } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";

const schema = z.object({ action: z.enum(["withdraw", "shortlist", "decline"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) return NextResponse.json({ error: "Proposals are not available right now." }, { status: 503 });

  const { id } = await params;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid proposal action." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("proposals").doc(id);
  const nowIso = new Date().toISOString();
  let nextStatus = "";
  let notifyUid = "";
  let jobTitle = "job";
  let actor = "";
  let idempotent = false;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("NOT_FOUND:Proposal not found.");
      const proposal = snap.data() || {};

      const policy = evaluateProposalLifecycle({
        action: input.action,
        viewerUid: session.uid,
        viewerAdmin: Boolean(session.admin),
        expertUid: String(proposal.expertUid || ""),
        clientId: String(proposal.clientId || ""),
        status: String(proposal.status || "SUBMITTED"),
      });
      if (!policy.ok) {
        throw new Error(`${policy.status === 403 ? "FORBIDDEN" : "CONFLICT"}:${policy.message}`);
      }

      nextStatus = input.action === "withdraw" ? "WITHDRAWN" : input.action === "shortlist" ? "SHORTLISTED" : "DECLINED";
      notifyUid = input.action === "withdraw" ? String(proposal.clientId || "") : String(proposal.expertUid || "");
      jobTitle = String(proposal.jobTitle || "job");
      actor = input.action === "withdraw" ? "expert" : "client";
      if (policy.idempotent) {
        idempotent = true;
        return;
      }

      tx.set(ref, { status: nextStatus, updatedAt: nowIso }, { merge: true });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update proposal.";
    const [kind, detail] = message.includes(":") ? message.split(/:(.*)/s, 2) : ["BAD_REQUEST", message];
    const status = kind === "NOT_FOUND" ? 404 : kind === "FORBIDDEN" ? 403 : kind === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: detail || "Could not update proposal." }, { status });
  }

  if (!idempotent && notifyUid && notifyUid !== session.uid) {
    const title =
      nextStatus === "WITHDRAWN"
        ? `Proposal withdrawn: ${jobTitle}`
        : nextStatus === "SHORTLISTED"
          ? `You were shortlisted: ${jobTitle}`
          : `Proposal declined: ${jobTitle}`;
    const body =
      nextStatus === "WITHDRAWN"
        ? "The expert withdrew their proposal."
        : nextStatus === "SHORTLISTED"
          ? "The client shortlisted your proposal for further consideration."
          : "The client declined this proposal.";
    await notifyUser(notifyUid, {
      type: "MESSAGE",
      title,
      body,
      href: actor === "expert" ? "/dashboard/client/proposals" : "/dashboard/expert/proposals",
    });
  }

  return NextResponse.json({ ok: true, status: nextStatus, idempotent });
}
