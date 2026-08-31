import { Briefcase } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { JobCard } from "@/components/job-card";
import { EmptyState } from "@/components/empty-state";
import { listPublicJobs } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "n8n jobs",
  description: "Browse open n8n automation projects posted through the marketplace.",
};

const BUDGET = ["Under €2,000", "€2,000–€5,000", "€5,000+"];
const SKILLS = ["AI agents", "CRM", "APIs", "Data", "Observability"];

export default async function Jobs() {
  const jobs = await listPublicJobs();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">Open work</span>
            <h1>High-signal n8n projects.</h1>
            <p>
              Public jobs from clients looking specifically for n8n and automation expertise. Experts can
              submit proposals through the platform.
            </p>
          </div>
        </section>

        <div className="container directory-layout">
          <aside className="filters">
            <div className="filter-block">
              <h4>Budget</h4>
              {BUDGET.map((x) => <label className="check" key={x}><input type="checkbox" />{x}</label>)}
            </div>
            <div className="filter-block">
              <h4>Skills</h4>
              {SKILLS.map((x) => <label className="check" key={x}><input type="checkbox" />{x}</label>)}
            </div>
          </aside>

          <section>
            <div className="results-toolbar">
              <span><strong>{jobs.length}</strong> open {jobs.length === 1 ? "project" : "projects"}</span>
              <select className="select" style={{ width: 180 }} aria-label="Sort jobs">
                <option>Newest first</option>
                <option>Highest budget</option>
              </select>
            </div>

            {jobs.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={22} strokeWidth={1.9} />}
                title="No open projects right now"
                body="Nothing has been posted publicly yet. If you are hiring, posting is free and reviewed experts can start submitting proposals straight away."
                action={{ label: "Post a job", href: "/sign-up" }}
              />
            ) : (
              <div className="job-list">
                {jobs.map((job) => <JobCard job={job} key={job.id} />)}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
