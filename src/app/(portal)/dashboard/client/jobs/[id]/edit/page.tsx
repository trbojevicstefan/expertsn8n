import { notFound } from "next/navigation";
import { JobForm } from "@/components/job-form";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { MarketplaceJob } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!firebaseAdminConfigured) notFound();

  const snap = await adminDb().collection("jobs").doc(id).get();
  if (!snap.exists) notFound();
  const job = { id: snap.id, ...snap.data() } as MarketplaceJob;
  if (job.clientId !== session.uid && !session.admin) notFound();
  if (!["DRAFT", "OPEN"].includes(job.status)) notFound();

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Edit job</h1>
          <p>Update the brief, budget or delivery window while the job is still draft/open.</p>
        </div>
      </div>
      <JobForm job={job} />
    </>
  );
}
