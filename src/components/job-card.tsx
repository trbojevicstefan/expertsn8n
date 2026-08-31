import Link from "next/link";
import { BadgeCheck, Clock3 } from "lucide-react";
import type { MarketplaceJob } from "@/lib/types";

export function JobCard({ job }: { job: MarketplaceJob }) {
  return (
    <article className="job-card card">
      <div className="job-head">
        <div>
          <span className="eyebrow">{job.postedAt}</span>
          <h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3>
        </div>
        <span className="budget">
          €{job.budgetMin.toLocaleString()}–€{job.budgetMax.toLocaleString()}
        </span>
      </div>

      <p>{job.description}</p>

      <div className="chip-row">
        {job.integrations.map((x) => <span className="chip" key={x}>{x}</span>)}
      </div>

      <div className="job-footer">
        {/* Only claim payment is verified when the record actually says so. */}
        {job.verifiedPayment && <span><BadgeCheck size={15} /> Payment verified</span>}
        <span><Clock3 size={15} /> {job.delivery}</span>
        <span>{job.proposalCount} {job.proposalCount === 1 ? "proposal" : "proposals"}</span>
      </div>
    </article>
  );
}
