import Link from "next/link";
import { BadgeCheck, Clock3 } from "lucide-react";
import type { MarketplaceJob } from "@/lib/types";
import { postedLabel } from "@/lib/format";

export function JobCard({ job }: { job: MarketplaceJob }) {
  // Older records were written without these, and mapping over undefined threw.
  const integrations = job.integrations ?? [];
  const proposals = job.proposalCount ?? 0;

  return (
    <article className="job-card card">
      <div className="job-head">
        <div>
          <span className="eyebrow">{postedLabel(job.postedAt)}</span>
          <h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3>
        </div>
        <span className="budget">
          €{(job.budgetMin ?? 0).toLocaleString()}–€{(job.budgetMax ?? 0).toLocaleString()}
        </span>
      </div>

      <p>{job.description}</p>

      {integrations.length > 0 && (
        <div className="chip-row">
          {integrations.map((x) => <span className="chip" key={x}>{x}</span>)}
        </div>
      )}

      <div className="job-footer">
        {/* Only claim payment is verified when the record actually says so. */}
        {job.verifiedPayment && <span><BadgeCheck size={15} /> Payment verified</span>}
        {job.delivery && <span><Clock3 size={15} /> {job.delivery}</span>}
        <span>{proposals} {proposals === 1 ? "proposal" : "proposals"}</span>
      </div>
    </article>
  );
}
