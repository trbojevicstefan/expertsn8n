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
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Invites are not available right now." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const input = schema.parse(await req.json());
    assertNoOffPlatformContact(input.note);

    const db = adminDb();
    const jobSnap = await db.collection("jobs").doc(id).get();
    const job = jobSnap.data();
    if (!job) throw new Error("Job not found.");
    if (job.clientId !== session.uid && !session.admin) throw new Error("You do not own this job.");
    if (!["DRAFT", "OPEN", "MATCHING"].includes(job.status)) {
      throw new Error("This job is not accepting invites.");
    }

    const profileSnap = await db.collection("expertProfiles").doc(input.expertId).get();
    const profile = profileSnap.data();
    if (!profile) throw new Error("Expert not found.");

    // The expert's dashboard looks the invite up by the account that owns the
    // profile, so both the profile id and the owning uid are recorded. Only
    // writing expertId is why invites never appeared for anyone.
    const expertUid = typeof profile.claimedByUid === "string" ? profile.claimedByUid : null;

    const existing = await db
      .collection("jobInvites")
      .where("jobId", "==", id)
      .where("expertId", "==", input.expertId)
      .limit(1)
      .get();
    if (!existing.empty) throw new Error("This expert has already been invited to this job.");

    const nowIso = new Date().toISOString();
    const ref = db.collection("jobInvites").doc();
    await ref.set({
      jobId: id,
      jobTitle: job.title || "",
      clientId: session.uid,
      clientName: job.clientName || session.name || session.email,
      expertId: input.expertId,
      expertUid,
      expertName: profile.name || "",
      note: input.note,
      budgetMin: job.budgetMin ?? null,
      budgetMax: job.budgetMax ?? null,
      status: "SENT",
      createdAt: nowIso,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    if (expertUid) {
      await notifyUser(expertUid, {
        type: "MESSAGE",
        title: `You were invited to a job: ${job.title}`,
        body: input.note ? input.note.slice(0, 160) : "Open your invitations to see the brief.",
        href: "/dashboard/expert/invites",
        expertId: input.expertId,
      });
    }

    return NextResponse.json({ id: ref.id, status: "SENT", notified: Boolean(expertUid) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invite failed" }, { status: 400 });
  }
}
