import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Clock3, LockKeyhole } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { findJob, findJobForViewer } from "@/lib/data";
import { getSession } from "@/lib/auth/server";
import { ProposalForm } from "@/components/proposal-form";
import { postedLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) return { title: "Private job" };
  return { title: job.title, description: job.description.slice(0, 200) };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const access = await findJobForViewer(id, session);
  if (!access) notFound();
  const job = access.job;

  const tags = [...(job.skills ?? []), ...(job.integrations ?? [])];
  const proposals = job.proposalCount ?? 0;

  return (
    <>
      <SiteHeader />
      <main>
        <div className="container job-detail-grid">
          <article className="detail-card card">
            <span className="eyebrow">
              {job.visibility === "PRIVATE" ? "Private invitation" : `Posted ${postedLabel(job.postedAt)}`}
            </span>
            <h1>{job.title}</h1>

            <div className="job-footer" style={{ borderTop: 0, paddingTop: 0, marginTop: 0, marginBottom: 23 }}>
              {job.verifiedPayment && <span><BadgeCheck size={15} />Payment verified</span>}
              {job.delivery && <span><Clock3 size={15} />{job.delivery}</span>}
              {job.visibility === "PUBLIC" && <span>{proposals} {proposals === 1 ? "proposal" : "proposals"}</span>}
              {job.visibility === "PRIVATE" && <span><LockKeyhole size={15} />Invite only</span>}
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
              {job.currency || "EUR"} {(job.budgetMin ?? 0).toLocaleString()}–{(job.budgetMax ?? 0).toLocaleString()}
            </div>
            {job.delivery && <p className="muted">Expected delivery: {job.delivery}</p>}

            {session?.role === "expert" && access.canApply ? (
              <ProposalForm jobId={job.id} budgetMin={job.budgetMin} budgetMax={job.budgetMax} />
            ) : session?.role === "expert" && job.visibility === "PRIVATE" && access.inviteStatus === "SENT" ? (
              <div className="notice">
                <strong>Accept the invitation first</strong>
                You can review this private brief now. Accept it from your Invitations page before sending a proposal.
                <div style={{ marginTop: 12 }}>
                  <Link className="button button-primary button-wide" href="/dashboard/expert/invites">Review invitation</Link>
                </div>
              </div>
            ) : session ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Proposals come from invited or marketplace expert accounts. This is a {session.role} account.
              </p>
            ) : (
              <Link className="button button-primary button-wide" href={`/sign-in?next=/jobs/${job.id}`}>
                Sign in to send a proposal
              </Link>
            )}

            <div className="verified-box">
              <LockKeyhole size={18} />
              <div>
                <strong>Funds-first workflow</strong>
                <br />
                Full communication unlocks when provider-confirmed funding lands on the contract.
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
