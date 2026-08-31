import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { notifyUser } from "@/lib/notifications";

const schema = z.object({
  expertId: z.string().min(3).max(200),
  note: z.string().max(1200).default(""),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "client" && !session.admin)) {
    return NextResponse.json({ error: "Client or admin account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) return NextResponse.json({ error: "Invites are not available right now." }, { status: 503 });

  try {
    const { id } = await params;
    const input = schema.parse(await req.json());
    assertNoOffPlatformContact(input.note);

    const db = adminDb();
    const jobSnap = await db.collection("jobs").doc(id).get();
    const job = jobSnap.data();
    if (!job) throw new Error("Job not found.");
    if (job.clientId !== session.uid && !session.admin) throw new Error("You do not own this job.");
    if (job.status !== "OPEN") throw new Error("Only open jobs can send new invitations.");

    const profileSnap = await db.collection("expertProfiles").doc(input.expertId).get();
    const profile = profileSnap.data();
    if (!profile) throw new Error("Expert not found.");
    if (profile.status === "SUSPENDED") throw new Error("This expert is not available for invitations.");

    const expertUid = typeof profile.claimedByUid === "string" && profile.claimedByUid ? profile.claimedByUid : null;
    if (!expertUid) {
      throw new Error("This expert has not claimed their account yet, so they cannot receive an in-app private invitation.");
    }

    const existing = await db
      .collection("jobInvites")
      .where("jobId", "==", id)
      .where("expertId", "==", input.expertId)
      .limit(20)
      .get();
    const nowMs = Date.now();
    const activeInvite = existing.docs.some((doc) => {
      const invite = doc.data() || {};
      const status = String(invite.status || "SENT");
      const expired = typeof invite.expiresAt === "string" && Date.parse(invite.expiresAt) <= nowMs;
      return !expired && ["SENT", "ACCEPTED"].includes(status);
    });
    if (activeInvite) throw new Error("This expert already has an active invitation to this job.");

    const nowIso = new Date(nowMs).toISOString();
    const ref = db.collection("jobInvites").doc();
    await ref.set({
      jobId: id,
      jobTitle: job.title || "",
      clientId: job.clientId || session.uid,
      clientName: job.clientName || session.name || session.email,
      expertId: input.expertId,
      expertUid,
      expertName: profile.name || "",
      note: input.note,
      budgetMin: job.budgetMin ?? null,
      budgetMax: job.budgetMax ?? null,
      currency: job.currency || "EUR",
      status: "SENT",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: new Date(nowMs + 7 * 86400000).toISOString(),
      respondedAt: null,
      acceptedAt: null,
      declinedAt: null,
    });

    await notifyUser(expertUid, {
      type: "MESSAGE",
      title: `You were invited to a job: ${job.title}`,
      body: input.note ? input.note.slice(0, 160) : "Open your invitations to see the brief.",
      href: "/dashboard/expert/invites",
      expertId: input.expertId,
    });

    return NextResponse.json({ id: ref.id, status: "SENT", notified: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invite failed" }, { status: 400 });
  }
}
