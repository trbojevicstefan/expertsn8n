import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Eye, ExternalLink, Info, MapPin, ShieldCheck, Star } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/avatar";
import { findExpertBySlug, findExpertBySlugForViewer, listShowcasesForExpert, listJobsForClient } from "@/lib/data";
import { getSession } from "@/lib/auth/server";
import { InviteExpert } from "@/components/invite-expert";
import { StructuredData, expertSchema } from "@/components/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const expert = await findExpertBySlug(slug);
  // Metadata is public output, so it describes published profiles only. A
  // preview reaches the page through the session, never through a crawler.
  if (!expert) return { title: "Expert profile", robots: { index: false, follow: false } };
  const description = expert.bio.slice(0, 200);
  return {
    title: `${expert.name} — ${expert.title}`,
    description,
    alternates: { canonical: `/experts/${slug}` },
    openGraph: {
      title: `${expert.name} — ${expert.title}`,
      description,
      type: "profile",
      url: `/experts/${slug}`,
      images: expert.photoUrl ? [expert.photoUrl] : undefined,
    },
  };
}

export default async function ExpertPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  const found = await findExpertBySlugForViewer(slug, session);
  if (!found) notFound();

  const { profile: expert, preview } = found;
  const items = await listShowcasesForExpert(expert.id);
  const canInvite = Boolean(session && (session.role === "client" || session.admin));
  const myJobs = canInvite && session
    ? (await listJobsForClient(session.uid))
        .filter((j) => ["DRAFT", "OPEN", "MATCHING"].includes(j.status))
        .map((j) => ({ id: j.id, title: j.title }))
    : [];
  const hasRating = expert.reviewCount > 0;
  const hasRate = expert.hourlyRate > 0;
  const unclaimed = expert.claimState === "UNCLAIMED";

  return (
    <>
      {/* An unpublished profile must never be indexed or shared as if it were live. */}
      {!preview && <StructuredData data={expertSchema(expert)} />}
      <SiteHeader />
      <main>
        <div className="container profile-grid">
          {preview && (
            <div className="funding-banner" style={{ gridColumn: "1 / -1" }}>
              <Eye size={20} strokeWidth={2.2} />
              <div>
                <strong>Preview — clients cannot see this yet.</strong>
                <span>
                  This is exactly how your profile will read once it is published. Its status is{" "}
                  {expert.status}. Only approved showcases appear here, the same as in the directory.
                </span>
              </div>
            </div>
          )}
          <div className="profile-main">
            <section className="profile-header card">
              <div className="profile-heading">
                <Avatar name={expert.name} src={expert.photoUrl} size="xl" />
                <div>
                  <div className="expert-name-line">
                    <h1>{expert.name}</h1>
                    {expert.verified && <CheckCircle2 className="verified-icon" size={20} aria-label="Profile reviewed" />}
                  </div>
                  <p>{expert.title}{expert.companyName ? ` · ${expert.companyName}` : ""}</p>
                  {(expert.location || expert.timezone) && (
                    <div className="muted-row">
                      <MapPin size={15} />
                      {[expert.location, expert.timezone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {expert.badges?.length > 0 && (
                    <div className="chip-row" style={{ marginTop: 10 }}>
                      {expert.badges.map((b) => <StatusBadge key={b} tone="info">{b}</StatusBadge>)}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="profile-about card">
              <h2>About</h2>
              <p>{expert.bio}</p>
              {expert.n8nExperience && expert.n8nExperience.length > 0 && (
                <>
                  <h3 className="about-sub">n8n experience</h3>
                  <div className="chip-row">
                    {expert.n8nExperience.map((x) => <span className="chip chip-accent" key={x}>{x}</span>)}
                  </div>
                </>
              )}
              {(expert.skills.length > 0 || expert.integrations.length > 0) && (
                <div className="chip-row">
                  {[...expert.skills, ...expert.integrations].map((x) => <span className="chip" key={x}>{x}</span>)}
                </div>
              )}
              {expert.links && expert.links.length > 0 && (
                <div className="profile-links">
                  {expert.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="profile-link">
                      {l.label} <ExternalLink size={13} strokeWidth={2.2} />
                    </a>
                  ))}
                </div>
              )}
            </section>

            {items.length > 0 && (
              <section className="showcase-section card">
                <h2>Workflow showcases</h2>
                <p className="muted">Reviewed work samples with client-sensitive information removed.</p>
                <div className="showcase-grid">
                  {items.map((item) => (
                    <article className="showcase-card" key={item.id}>
                      <StatusBadge tone="neutral">{item.complexity}</StatusBadge>
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <span className="outcome">{item.outcome}</span>
                      <div className="chip-row" style={{ marginTop: 12 }}>
                        {item.integrations.map((x) => <span className="chip" key={x}>{x}</span>)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside>
            <div className="hire-card card">
              <div className="price-line">
                <div>
                  {hasRate
                    ? <><strong>€{expert.hourlyRate}</strong><span>/hr reference</span></>
                    : <strong className="rate-tbd">Rate on request</strong>}
                </div>
                {expert.availability && <StatusBadge tone="success">Available</StatusBadge>}
              </div>

              {canInvite && myJobs.length > 0 ? (
                <InviteExpert expertId={expert.id} expertName={expert.name} jobs={myJobs} />
              ) : (
                <Link
                  href={session ? "/dashboard/client/jobs/new" : `/sign-up?invite=${expert.id}`}
                  className="button button-primary button-wide"
                >
                  {session ? "Post a job to invite them" : "Invite to a private job"}
                </Link>
              )}
              <Link href="/sign-up" className="button button-secondary button-wide" style={{ marginTop: 9 }}>
                Post a public job
              </Link>

              <hr />

              <div className="facts">
                <div className="fact">
                  <span>Marketplace rating</span>
                  <strong>
                    {hasRating
                      ? <><Star size={13} fill="currentColor" style={{ color: "var(--gold)", display: "inline" }} /> {expert.rating} ({expert.reviewCount})</>
                      : "No history yet"}
                  </strong>
                </div>
                <div className="fact">
                  <span>Contracts completed</span>
                  <strong>{expert.completedProjects || "None yet"}</strong>
                </div>
                <div className="fact">
                  <span>Availability</span>
                  <strong>{expert.availability || "On request"}</strong>
                </div>
                {expert.hoursPerWeek ? (
                  <div className="fact"><span>Hours per week</span><strong>{expert.hoursPerWeek}</strong></div>
                ) : null}
                {expert.yearsExperience ? (
                  <div className="fact"><span>Experience</span><strong>{expert.yearsExperience}+ years</strong></div>
                ) : null}
                {expert.languages?.length ? (
                  <div className="fact"><span>Languages</span><strong>{expert.languages.join(", ")}</strong></div>
                ) : null}
                {expert.minEngagement ? (
                  <div className="fact"><span>Minimum project</span><strong>€{expert.minEngagement.toLocaleString()}</strong></div>
                ) : null}
              </div>

              {expert.verified ? (
                <div className="verified-box">
                  <ShieldCheck size={18} strokeWidth={2} />
                  <div>
                    <strong>Profile reviewed</strong>
                    <br />
                    Photo, CV and submitted portfolio reviewed by marketplace staff.
                  </div>
                </div>
              ) : (
                <div className="pending-box">
                  <Info size={18} strokeWidth={2} />
                  <div>
                    <strong>Not yet vetted</strong>
                    <br />
                    This profile was built from a direct application and has not been through marketplace
                    review. Treat the details as self-reported.
                  </div>
                </div>
              )}
            </div>

            {unclaimed && (
              <div className="claim-prompt card">
                <strong>Is this you?</strong>
                <p>Claim this profile to edit it, add your photo and upload your documents.</p>
                <Link href="/claim" className="button button-secondary button-wide button-sm">
                  Claim this profile
                </Link>
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
