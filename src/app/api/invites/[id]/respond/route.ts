import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { evaluateInviteResponse } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) return NextResponse.json({ error: "Invitations are not available right now." }, { status: 503 });

  const { id } = await params;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid invitation action." }, { status: 400 });
  }

  const db = adminDb();
  const inviteRef = db.collection("jobInvites").doc(id);
  const nowIso = new Date().toISOString();
  let jobId = "";
  let clientId = "";
  let jobTitle = "job";
  let nextStatus = "";
  let idempotent = false;

  try {
    await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw new Error("NOT_FOUND:Invitation not found.");
      const invite = inviteSnap.data() || {};
      jobId = String(invite.jobId || "");
      if (!jobId) throw new Error("CONFLICT:Invitation has no job.");

      const jobRef = db.collection("jobs").doc(jobId);
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) throw new Error("NOT_FOUND:Job not found.");
      const job = jobSnap.data() || {};

      const policy = evaluateInviteResponse({
        action: input.action,
        viewerUid: session.uid,
        expertUid: String(invite.expertUid || ""),
        status: String(invite.status || "SENT"),
        expiresAt: typeof invite.expiresAt === "string" ? invite.expiresAt : null,
        jobStatus: String(job.status || ""),
        nowMs: Date.now(),
      });
      if (!policy.ok) {
        throw new Error(`${policy.status === 403 ? "FORBIDDEN" : "CONFLICT"}:${policy.message}`);
      }

      nextStatus = input.action === "accept" ? "ACCEPTED" : "DECLINED";
      clientId = String(invite.clientId || job.clientId || "");
      jobTitle = String(invite.jobTitle || job.title || "job");
      if (policy.idempotent) {
        idempotent = true;
        return;
      }

      tx.set(
        inviteRef,
        {
          status: nextStatus,
          respondedAt: nowIso,
          acceptedAt: nextStatus === "ACCEPTED" ? nowIso : null,
          declinedAt: nextStatus === "DECLINED" ? nowIso : null,
          updatedAt: nowIso,
        },
        { merge: true },
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update invitation.";
    const [kind, detail] = message.includes(":") ? message.split(/:(.*)/s, 2) : ["BAD_REQUEST", message];
    const status = kind === "NOT_FOUND" ? 404 : kind === "FORBIDDEN" ? 403 : kind === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: detail || "Could not update invitation." }, { status });
  }

  if (!idempotent && clientId) {
    await notifyUser(clientId, {
      type: "MESSAGE",
      title: `Invitation ${nextStatus === "ACCEPTED" ? "accepted" : "declined"}: ${jobTitle}`,
      body: nextStatus === "ACCEPTED" ? "The expert accepted your private invitation and can now send a proposal." : "The expert declined your private invitation.",
      href: "/dashboard/client/jobs",
    });
  }

  return NextResponse.json({ ok: true, status: nextStatus, jobId, idempotent });
}
