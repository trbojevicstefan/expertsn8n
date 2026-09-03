import Link from "next/link";
import {
  Activity, ArrowRight, Bot, Check, CheckCircle2, Clock, CreditCard, Database,
  Eye, FileCheck2, LockKeyhole, Minus, Plug, Scale, ScrollText, ShieldCheck,
  Sparkles, Target, UserCheck, Users, Workflow,
} from "lucide-react";
import {
  comparisonRows, differentiators, faqs, howItWorks,
  integrationLogos, pricing, useCases, vettingSteps,
} from "@/lib/site-content";
import type { MarketplaceStats } from "@/lib/data";

const icons = {
  target: Target, eye: Eye, shield: ShieldCheck, scale: Scale,
  workflow: Workflow, bot: Bot, users: Users, database: Database,
  activity: Activity, plug: Plug,
} as const;

type IconKey = keyof typeof icons;

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const Cmp = icons[name as IconKey] ?? Target;
  return <Cmp size={size} strokeWidth={1.9} />;
}

export function AnnounceBar() {
  return (
    <div className="announce">
      <div className="container">
        <span className="announce-dot" />
        <span>
          <strong>Applications are reviewed by a person, not a script.</strong>{" "}
          <Link href="/sign-up">Apply as an expert</Link>
        </span>
      </div>
    </div>
  );
}

/**
 * Every figure here is counted from the live directory. The marketplace has no
 * contract history yet, so there is nothing about funded value or ratings to
 * show — and inventing one would be the easiest lie on the page.
 */
export function TrustBar({ stats }: { stats: MarketplaceStats }) {
  const items = [
    { value: String(stats.experts), label: "n8n specialists listed", helper: "Every one applied directly to us" },
    { value: String(stats.countries), label: "Countries represented", helper: "Across European and global timezones" },
    { value: String(stats.specialisms), label: "Distinct skills covered", helper: "From custom nodes to voice agents" },
    { value: String(stats.claimed), label: "Profiles claimed", helper: "Owned and maintained by the expert" },
  ];

  return (
    <section className="trustbar" aria-label="Marketplace at a glance">
      <div className="container">
        {items.map((s) => (
          <div className="trustbar-item" key={s.label}>
            <strong>{s.value}</strong>
            <b>{s.label}</b>
            <span>{s.helper}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

import { BrandIcon } from "./brand-icon";

export function LogoStrip() {
  return (
    <div className="logo-strip">
      <div className="container">
        <span className="strip-label">Workflows shipped across</span>
        {integrationLogos.map((name) => <BrandIcon key={name} name={name} />)}
      </div>
    </div>
  );
}

export function DifferentiatorsSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Why a specialist marketplace</span>
            <h2>Four hundred tags is not a talent pool.</h2>
          </div>
          <p>
            Automation work fails for boring reasons — no error handling, no ownership, no record of what
            was agreed. The marketplace is built around those four failure modes.
          </p>
        </div>
        <div className="diff-grid">
          {differentiators.map((d) => (
            <article className="diff-card card" key={d.title}>
              <div className="diff-icon"><Icon name={d.icon} /></div>
              <h3>{d.title}</h3>
              <p>{d.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function VettingSection() {
  return (
    <section id="vetting" className="section section-soft">
      <div className="container vetting-layout">
        <div className="vetting-aside">
          <span className="eyebrow">The review process</span>
          <h2>Five stages before a profile is verified.</h2>
          <p>
            Nobody buys a marketplace badge that means nothing. This is exactly what a profile has to survive
            to carry one. Profiles still working through it stay listed, marked as not yet vetted, so you
            always know which is which.
          </p>
          <div className="vetting-badge">
            <ShieldCheck size={18} strokeWidth={2} />
            Reviewed by people who build in n8n
          </div>
        </div>
        <div className="vetting-list">
          {vettingSteps.map((v) => (
            <div className="vetting-row" key={v.step}>
              <div className="vetting-index">{v.step}</div>
              <div className="vetting-body">
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">What gets built here</span>
            <h2>The work people actually hire for.</h2>
          </div>
          <p>
            Six categories cover most of the marketplace. If your problem does not fit one of them, post it
            anyway — scoping questions are free.
          </p>
        </div>
        <div className="usecase-grid">
          {useCases.map((u) => (
            <article className="usecase-card card" key={u.title}>
              <Icon name={u.icon} size={26} />
              <h3>{u.title}</h3>
              <p>{u.body}</p>
              <div className="usecase-tags">
                {u.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section section-soft">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">How hiring works</span>
            <h2>From a problem to a funded contract.</h2>
          </div>
          <p>
            Four steps, and the money never moves before there is something to review. Funding a milestone is
            what turns a conversation into a contract.
          </p>
        </div>
        <div className="flow-grid">
          {howItWorks.map((s) => (
            <article className="flow-card card" key={s.step}>
              <div className="flow-num">{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <ul className="flow-points">
                {s.points.map((p) => (
                  <li key={p}><Check size={15} strokeWidth={2.4} />{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProtectionBanner() {
  return (
    <section className="section">
      <div className="container">
        <div className="safety-banner">
          <div>
            <h2>The relationship stays protected until it becomes a contract.</h2>
            <p>
              Before funding, proposals and clarification messages pass through a contact guard that blocks
              direct contact details and external links. The moment a milestone is funded, full contract
              messaging and file exchange unlock for both sides — and every decision after that lands on an
              auditable timeline.
            </p>
          </div>
          <div className="safety-points">
            <span><UserCheck size={17} strokeWidth={2} />Manual profile moderation</span>
            <span><CreditCard size={17} strokeWidth={2} />Funds held against milestones</span>
            <span><LockKeyhole size={17} strokeWidth={2} />Contact guard before funding</span>
            <span><ScrollText size={17} strokeWidth={2} />Audit trail on every action</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ComparisonSection() {
  return (
    <section className="section section-soft">
      <div className="container">
        <div className="section-head section-head-center">
          <div>
            <span className="eyebrow">Honest comparison</span>
            <h2>Against a general freelance platform.</h2>
          </div>
          <p>
            General platforms are fine for a logo or a landing page. Production automation is a different
            purchase, and it fails in different ways.
          </p>
        </div>
        <div className="compare">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">&nbsp;</th>
                <th scope="col">General freelance platform</th>
                <th scope="col">n8nexperts</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((r) => (
                <tr key={r.feature}>
                  <td>{r.feature}</td>
                  <td>
                    <span className="compare-cell compare-no">
                      <Minus size={15} strokeWidth={2.4} />{r.generic}
                    </span>
                  </td>
                  <td>
                    <span className="compare-cell compare-yes">
                      <Check size={15} strokeWidth={2.6} />{r.ours}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="section">
      <div className="container">
        <div className="section-head section-head-center">
          <div>
            <span className="eyebrow">Pricing</span>
            <h2>Free to hire. One fee, on delivery.</h2>
          </div>
          <p>No subscriptions, no bidding credits, no charge for posting a job or contacting an expert.</p>
        </div>
        <div className="pricing-grid">
          {pricing.map((p) => (
            <article className={`pricing-card card${p.highlight ? " highlight" : ""}`} key={p.audience}>
              {p.highlight && <span className="pricing-flag">Applications open</span>}
              <h3>{p.audience}</h3>
              <div className="pricing-price">{p.price}</div>
              <p>{p.line}</p>
              <ul className="pricing-points">
                {p.points.map((pt) => (
                  <li key={pt}><CheckCircle2 size={16} strokeWidth={2.2} />{pt}</li>
                ))}
              </ul>
              <Link className={`button button-wide ${p.highlight ? "button-primary" : "button-secondary"}`} href={p.cta.href}>
                {p.cta.label}
              </Link>
            </article>
          ))}
        </div>
        <p className="pricing-note">
          Payment processing is passed through at cost. Fees are shown on every milestone before you confirm it.
        </p>
      </div>
    </section>
  );
}

export function ExpertBand() {
  return (
    <section className="section section-ink">
      <div className="container expert-band">
        <div>
          <span className="eyebrow">For n8n developers</span>
          <h2>Get listed once. Stop bidding forever.</h2>
          <p>
            No credits, no race to the bottom, no rewriting the same proposal forty times. Clients arrive
            having already read your case studies, and the fee only applies when a milestone is released.
          </p>
          <Link className="button button-accent button-lg" href="/sign-up">
            Apply as an expert <ArrowRight size={17} strokeWidth={2.2} />
          </Link>
        </div>
        <div className="expert-checklist">
          <div>
            <FileCheck2 size={18} strokeWidth={2} />
            <div>
              <strong>One application, reviewed by a human</strong>
              <span>Decision within five working days</span>
            </div>
          </div>
          <div>
            <Sparkles size={18} strokeWidth={2} />
            <div>
              <strong>Your work does the selling</strong>
              <span>Case studies, not a bidding queue</span>
            </div>
          </div>
          <div>
            <Clock size={18} strokeWidth={2} />
            <div>
              <strong>Paid on approval</strong>
              <span>Funded before you start, released when accepted</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="section section-soft">
      <div className="container">
        <div className="section-head section-head-center">
          <div>
            <span className="eyebrow">Questions</span>
            <h2>The things people ask before hiring.</h2>
          </div>
          <p>Still unclear on something? Post a job — scoping questions cost nothing.</p>
        </div>
        <div className="faq-list">
          {faqs.map((f) => (
            <details className="faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final-cta">
      <div className="container">
        <span className="eyebrow">Get started</span>
        <h2>Describe the outcome. We will find who can build it.</h2>
        <p>
          Posting is free and takes about four minutes. Most jobs receive their first reviewed proposals
          within a day and a half.
        </p>
        <div className="final-cta-actions">
          <Link className="button button-primary button-lg" href="/sign-up">
            Post a job <ArrowRight size={17} strokeWidth={2.2} />
          </Link>
          <Link className="button button-secondary button-lg" href="/experts">Browse the directory</Link>
        </div>
        <p className="final-cta-note">No card required · No fee to hire · Milestone protection on every contract</p>
      </div>
    </section>
  );
}
