import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
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
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th><th>Visibility</th><th>Status</th><th>Proposals</th><th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <strong>{j.title}</strong><br />
                    <span className="muted">{j.postedAt}</span>
                  </td>
                  <td><StatusBadge tone={j.visibility === "PRIVATE" ? "neutral" : "info"}>{j.visibility}</StatusBadge></td>
                  <td><StatusBadge tone={j.status === "OPEN" ? "success" : "neutral"}>{j.status}</StatusBadge></td>
                  <td>{j.proposalCount}</td>
                  <td>€{j.budgetMin.toLocaleString()}–€{j.budgetMax.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
