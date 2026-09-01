import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { notifyUser } from "@/lib/notifications";
import { syncMarketplaceUser } from "@/lib/customerio";

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

    const existing = await db
      .collection("proposals")
      .where("jobId", "==", input.jobId)
      .where("expertUid", "==", session.uid)
      .limit(1)
      .get();
    if (!existing.empty) throw new Error("You have already sent a proposal for this job.");

    const nowIso = new Date().toISOString();
    const ref = db.collection("proposals").doc();

    // Denormalised so both dashboards can render a row without a second read,
    // and keyed by the account as well as the profile so each side can query it.
    await ref.set({
      ...input,
      jobTitle: job.title || "",
      clientId: job.clientId || "",
      expertUid: session.uid,
      expertId,
      expertName: profile.name || session.name || session.email,
      delivery: `${input.deliveryDays} day${input.deliveryDays === 1 ? "" : "s"}`,
      status: "SUBMITTED",
      currency: "EUR",
      createdAt: nowIso,
    });

    // The count shown on the job card was never incremented, so every job
    // advertised zero proposals no matter how many it had.
    await jobRef.set({ proposalCount: FieldValue.increment(1), updatedAt: nowIso }, { merge: true });

    if (job.clientId) {
      await notifyUser(job.clientId, {
        type: "MESSAGE",
        title: `New proposal on ${job.title}`,
        body: `${profile.name || "An expert"} proposed €${input.price.toLocaleString()} over ${input.deliveryDays} days.`,
        href: "/dashboard/client/jobs",
      });
      await syncMarketplaceUser(job.clientId, "proposal_received");
    }

    await syncMarketplaceUser(session.uid, "proposal_submitted");

    return NextResponse.json({ id: ref.id, status: "SUBMITTED" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid proposal" }, { status: 400 });
  }
}
