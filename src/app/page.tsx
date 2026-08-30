import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { ExpertCard } from "@/components/expert-card";
import { Avatar } from "@/components/avatar";
import {
  AnnounceBar, CaseStudiesSection, ComparisonSection, DifferentiatorsSection,
  ExpertBand, FaqSection, FinalCta, HowItWorksSection, LogoStrip,
  PricingSection, ProtectionBanner, TestimonialsSection, TrustBar,
  UseCasesSection, VettingSection,
} from "@/components/marketing";
import { listPublishedExperts } from "@/lib/data";
import { faqs } from "@/lib/site-content";

// The featured strip reads live profiles, so the page cannot be frozen at build
// time (where Firebase Admin credentials do not exist and demo data would be
// baked in permanently).
export const dynamic = "force-dynamic";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${appUrl}/#organization`,
      name: "n8nexperts",
      url: appUrl,
      description:
        "A specialist marketplace for hiring reviewed n8n automation developers, with human vetting and milestone-protected payments.",
    },
    {
      "@type": "WebSite",
      "@id": `${appUrl}/#website`,
      url: appUrl,
      name: "n8nexperts",
      publisher: { "@id": `${appUrl}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default async function Home() {
  const experts = (await listPublishedExperts()).slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <AnnounceBar />
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="kicker">
                <span className="kicker-dot" />
                Specialists, not generalists
              </span>
              <h1>
                Hire n8n developers who have <em>already shipped it</em>.
              </h1>
              <p className="hero-copy">
                Every expert here is reviewed by a human across five stages — identity, real workflow case
                studies, a technical read of their architecture, and a reference call. One in nine applicants
                is published.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary button-lg" href="/sign-up">
                  <Search size={17} strokeWidth={2.2} />
                  Post a job — free
                </Link>
                <Link className="button button-secondary button-lg" href="/experts">
                  <Sparkles size={17} strokeWidth={2.2} />
                  Browse the directory
                </Link>
              </div>
              <div className="hero-trust">
                <span><CheckCircle2 size={16} strokeWidth={2.2} />Human-reviewed profiles</span>
                <span><CheckCircle2 size={16} strokeWidth={2.2} />Funds released on approval</span>
                <span><CheckCircle2 size={16} strokeWidth={2.2} />Auditable contract record</span>
              </div>
            </div>

            <div className="hero-panel">
              <div className="hero-panel-top">
                <strong>Available this week</strong>
                <span className="status status-success">Live directory</span>
              </div>
              <div className="mini-search">
                <Search size={16} />
                Search n8n, HubSpot, AI agents…
              </div>
              {experts.slice(0, 3).map((e) => (
                <div className="mini-expert" key={e.id}>
                  <Avatar name={e.name} src={e.photoUrl} size="sm" />
                  <div>
                    <strong>{e.name}</strong>
                    <p>{e.title}</p>
                  </div>
                  <div className="mini-rate">
                    <strong>{e.hourlyRate > 0 ? `€${e.hourlyRate}/hr` : "On request"}</strong>
                    <br />
                    {e.availability || "Ask for availability"}
                  </div>
                </div>
              ))}
              <div className="hero-panel-foot">
                <span><ShieldCheck size={14} strokeWidth={2.2} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />All profiles reference-checked</span>
                <Link className="text-link" href="/experts" style={{ fontSize: 12 }}>
                  See all <ArrowRight size={12} strokeWidth={2.4} style={{ display: "inline", verticalAlign: "-1px" }} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <TrustBar />
        <LogoStrip />
        <DifferentiatorsSection />
        <VettingSection />

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Curated talent</span>
                <h2>People who work in n8n every day.</h2>
              </div>
              <p>
                Each profile carries a reviewed CV, a public photo, at least one detailed workflow case study
                and a checked client reference before it appears here.
              </p>
            </div>
            <div className="experts-grid">
              {experts.map((e) => <ExpertCard key={e.id} expert={e} />)}
            </div>
            <div style={{ textAlign: "center", marginTop: 34 }}>
              <Link href="/experts" className="button button-secondary button-lg">
                Browse all experts <ArrowRight size={16} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        </section>

        <UseCasesSection />
        <HowItWorksSection />
        <ProtectionBanner />
        <CaseStudiesSection />
        <TestimonialsSection />
        <ComparisonSection />
        <PricingSection />
        <ExpertBand />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
