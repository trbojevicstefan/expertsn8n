import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { ExpertCard } from "@/components/expert-card";
import { listPublishedExperts } from "@/lib/data";

// Profiles are claimed and edited continuously, so the directory reads live
// rather than being frozen into the build output.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find n8n experts",
  description: "Browse n8n developers by skill, integration, availability and experience.",
};

const AVAILABILITY = ["Available now", "This week", "Within 2 weeks"];
const SPECIALTY = ["AI agents", "CRM automation", "APIs & webhooks", "Data pipelines", "Support automation"];
const INTEGRATIONS = ["HubSpot", "Salesforce", "OpenAI", "Google Workspace", "Postgres"];

export default async function ExpertsPage() {
  const experts = await listPublishedExperts();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">Expert directory</span>
            <h1>Find the right n8n specialist.</h1>
            <p>
              Browse experts by automation skill, integration and availability. Invite someone privately
              or post a public job. Profiles marked as not yet vetted were built from direct applications
              and have not been through marketplace review.
            </p>
          </div>
        </section>

        <div className="container directory-layout">
          <aside className="filters">
            <div className="filter-block">
              <h4>Availability</h4>
              {AVAILABILITY.map((x) => <label className="check" key={x}><input type="checkbox" />{x}</label>)}
            </div>
            <div className="filter-block">
              <h4>Specialty</h4>
              {SPECIALTY.map((x) => <label className="check" key={x}><input type="checkbox" />{x}</label>)}
            </div>
            <div className="filter-block">
              <h4>Integrations</h4>
              {INTEGRATIONS.map((x) => <label className="check" key={x}><input type="checkbox" />{x}</label>)}
            </div>
          </aside>

          <section>
            <div className="results-toolbar">
              <span><strong>{experts.length}</strong> {experts.length === 1 ? "expert" : "experts"}</span>
              <select className="select" style={{ width: 180 }} defaultValue="recommended" aria-label="Sort experts">
                <option value="recommended">Recommended</option>
                <option value="rating">Highest rated</option>
                <option value="rate">Lowest rate</option>
              </select>
            </div>
            <div className="results-list">
              {experts.map((e) => <ExpertCard expert={e} key={e.id} />)}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
