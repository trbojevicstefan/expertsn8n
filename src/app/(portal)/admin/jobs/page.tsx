import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { EmptyState } from "@/components/empty-state";
import { AdminJobsTable } from "@/components/admin-jobs-table";
import { listAllJobs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminJobs() {
  await requireAdmin();
  const jobs = await listAllJobs();

  const open = jobs.filter((j) => j.status === "OPEN").length;
  const publicOpen = jobs.filter((j) => j.status === "OPEN" && j.visibility === "PUBLIC").length;

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>All jobs</h1>
          <p>
            Every job on the marketplace. {open} open, {publicOpen} of them publicly listed.
          </p>
        </div>
        <Link href="/dashboard/client/jobs/new" className="button button-primary">
          <Plus size={16} strokeWidth={2.2} />Post a job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} strokeWidth={1.9} />}
          title="No jobs yet"
          body="Nothing has been posted. You can post one yourself to seed the marketplace, or wait for a client to."
          action={{ label: "Post a job", href: "/dashboard/client/jobs/new" }}
        />
      ) : (
        <AdminJobsTable jobs={jobs} />
      )}
    </>
  );
}
