import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Clock3, LockKeyhole } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { findJob } from "@/lib/data";
import { postedLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) return { title: "Job not found" };
  return { title: job.title, description: job.description.slice(0, 200) };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) notFound();

  // Records written before these fields existed would throw when spread.
  const tags = [...(job.skills ?? []), ...(job.integrations ?? [])];
  const proposals = job.proposalCount ?? 0;

  return (
    <>
      <SiteHeader />
      <main>
        <div className="container job-detail-grid">
          <article className="detail-card card">
            <span className="eyebrow">Posted {postedLabel(job.postedAt)}</span>
            <h1>{job.title}</h1>

            <div className="job-footer" style={{ borderTop: 0, paddingTop: 0, marginTop: 0, marginBottom: 23 }}>
              {job.verifiedPayment && <span><BadgeCheck size={15} />Payment verified</span>}
              {job.delivery && <span><Clock3 size={15} />{job.delivery}</span>}
              <span>{proposals} {proposals === 1 ? "proposal" : "proposals"}</span>
            </div>

            <h3>What we need</h3>
            <p>{job.description}</p>

            {tags.length > 0 && (
              <>
                <h3>Skills &amp; integrations</h3>
                <div className="chip-row">
                  {tags.map((x) => <span className="chip" key={x}>{x}</span>)}
                </div>
              </>
            )}

            <div className="notice" style={{ marginTop: 26 }}>
              <strong>Platform communication rule</strong>
              Direct contact details, phone numbers, email addresses and external meeting links are blocked
              before the first milestone is funded. Use proposal fields for scope clarification.
            </div>
          </article>

          <aside className="job-sidebar card">
            <span className="muted">Fixed-price budget</span>
            <div className="money-big">
              €{(job.budgetMin ?? 0).toLocaleString()}–€{(job.budgetMax ?? 0).toLocaleString()}
            </div>
            {job.delivery && <p className="muted">Expected delivery: {job.delivery}</p>}

            <Link className="button button-primary button-wide" href={`/sign-in?next=/jobs/${job.id}`}>
              Submit a proposal
            </Link>

            <div className="verified-box">
              <LockKeyhole size={18} />
              <div>
                <strong>Funds-first workflow</strong>
                <br />
                Full communication unlocks when a contract milestone is funded.
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
