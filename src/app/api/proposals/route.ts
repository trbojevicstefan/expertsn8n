import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { privateJobInviteAccess } from "@/lib/marketplace-policy";
import { notifyUser } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  jobId: z.string().min(3).max(200),
  scope: z.string().min(60).max(6000),
  price: z.coerce.number().min(100),
  deliveryDays: z.coerce.number().int().min(1).max(365),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Proposals are not available right now." }, { status: 503 });
  }

  const limited = await enforceRateLimit({
    scope: "proposal.create.user",
    identity: session.uid,
    limit: 20,
    windowMs: 60 * 60 * 1000,
    message: "Too many proposals submitted in a short period. Try again later.",
  });
  if (limited) return limited;

  try {
    const input = schema.parse(await req.json());
    assertNoOffPlatformContact(input.scope);

    const db = adminDb();
    const jobRef = db.collection("jobs").doc(input.jobId);
    const jobSnap = await jobRef.get();
    const job = jobSnap.data();
    if (!job) throw new Error("Job not found.");
    if (job.status !== "OPEN") throw new Error("This job is not accepting proposals.");

    const userSnap = await db.collection("users").doc(session.uid).get();
    const expertId = (userSnap.data() || {}).expertId || session.uid;
    const profile = (await db.collection("expertProfiles").doc(expertId).get()).data() || {};

    if (job.visibility === "PRIVATE") {
      const inviteSnap = await db
        .collection("jobInvites")
        .where("jobId", "==", input.jobId)
        .where("expertUid", "==", session.uid)
        .limit(10)
        .get();
      const accepted = inviteSnap.docs.some((doc) => {
        const invite = doc.data() || {};
        return privateJobInviteAccess({
          inviteStatus: String(invite.status || "SENT"),
          expiresAt: typeof invite.expiresAt === "string" ? invite.expiresAt : null,
          jobStatus: String(job.status || ""),
          nowMs: Date.now(),
        }).canApply;
      });
      if (!accepted) throw new Error("Accept the private invitation before sending a proposal.");
    }

    const existing = await db
      .collection("proposals")
      .where("jobId", "==", input.jobId)
      .where("expertUid", "==", session.uid)
      .limit(10)
      .get();
    const actionableExisting = existing.docs.some((doc) => !["WITHDRAWN", "DECLINED"].includes(String((doc.data() || {}).status)));
    if (actionableExisting) throw new Error("You already have an active proposal for this job.");

    const nowIso = new Date().toISOString();
    const ref = db.collection("proposals").doc();

    await ref.set({
      ...input,
      jobTitle: job.title || "",
      clientId: job.clientId || "",
      expertUid: session.uid,
      expertId,
      expertName: profile.name || session.name || session.email,
      delivery: `${input.deliveryDays} day${input.deliveryDays === 1 ? "" : "s"}`,
      status: "SUBMITTED",
      currency: job.currency || "EUR",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await jobRef.set({ proposalCount: FieldValue.increment(1), updatedAt: nowIso }, { merge: true });

    if (job.clientId) {
      await notifyUser(job.clientId, {
        type: "MESSAGE",
        title: `New proposal on ${job.title}`,
        body: `${profile.name || "An expert"} proposed ${(job.currency || "EUR")} ${input.price.toLocaleString()} over ${input.deliveryDays} days.`,
        href: "/dashboard/client/proposals",
      });
    }

    return NextResponse.json({ id: ref.id, status: "SUBMITTED" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid proposal" }, { status: 400 });
  }
}
