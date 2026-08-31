import Link from "next/link";
import { Plus } from "lucide-react";
import { ClientJobsTable } from "@/components/client-jobs-table";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth/server";
import { listJobsForClient } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MyJobs() {
  const session = await requireSession();
  const jobs = await listJobsForClient(session.uid);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>My jobs</h1>
          <p>Manage public posts, private searches, invitations and proposals.</p>
        </div>
        <Link href="/dashboard/client/jobs/new" className="button button-primary">
          <Plus size={16} strokeWidth={2.2} />New job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Plus size={22} strokeWidth={1.9} />}
          title="You have not posted a job yet"
          body="Describe the outcome you need and reviewed n8n experts can submit proposals with a milestone breakdown. Posting is free."
          action={{ label: "Post your first job", href: "/dashboard/client/jobs/new" }}
        />
      ) : (
        <ClientJobsTable jobs={jobs} />
      )}
    </>
  );
}
