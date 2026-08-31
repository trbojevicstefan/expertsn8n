import Link from "next/link";
import { ArrowUpRight, BadgeCheck, ImageOff, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { EmptyState } from "@/components/empty-state";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ExpertProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AuditEntry {
  id: string;
  action?: string;
  actorEmail?: string;
  targetId?: string;
  reason?: string;
  createdAt?: string;
}

async function load() {
  if (!firebaseAdminConfigured) {
    return { profiles: [] as ExpertProfile[], pendingDocs: 0, pendingShowcases: 0, openJobs: 0, audit: [] as AuditEntry[] };
  }
  const db = adminDb();
  const [profileSnap, docSnap, showcaseSnap, jobSnap, auditSnap] = await Promise.all([
    db.collection("expertProfiles").limit(500).get(),
    db.collection("expertDocuments").where("reviewState", "==", "PENDING").limit(200).get(),
    db.collection("expertShowcases").where("reviewState", "==", "PENDING").limit(200).get(),
    db.collection("jobs").where("status", "==", "OPEN").limit(200).get(),
    db.collection("adminAuditLogs").limit(100).get(),
  ]);

  return {
    profiles: profileSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExpertProfile),
    pendingDocs: docSnap.size,
    pendingShowcases: showcaseSnap.size,
    openJobs: jobSnap.size,
    audit: auditSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as AuditEntry)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8),
  };
}

function when(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function Admin() {
  await requireAdmin();
  const { profiles, pendingDocs, pendingShowcases, openJobs, audit } = await load();

  const by = (s: string) => profiles.filter((p) => p.status === s).length;
  const published = by("PUBLISHED");
  const submitted = by("SUBMITTED");
  const needsChanges = by("NEEDS_CHANGES");
  const verified = profiles.filter((p) => p.verified).length;
  const unclaimed = profiles.filter((p) => (p.claimState || "UNCLAIMED") === "UNCLAIMED").length;
  const noPhoto = profiles.filter((p) => p.status === "PUBLISHED" && !p.photoUrl).length;
  const incomplete = profiles.filter((p) => (p.missingFields || []).length > 0).length;

  const countries = new Set(profiles.map((p) => p.country).filter(Boolean)).size;
  const skills = new Set(profiles.flatMap((p) => p.skills || [])).size;

  const kpis: { label: string; value: number | string; href?: string }[] = [
    { label: "In the directory", value: published, href: "/admin/experts?status=PUBLISHED" },
    { label: "Awaiting review", value: submitted, href: "/admin/experts?status=SUBMITTED" },
    { label: "Changes requested", value: needsChanges, href: "/admin/experts?status=NEEDS_CHANGES" },
    { label: "Verified", value: verified, href: "/admin/experts?verified=yes" },
    { label: "Unclaimed", value: unclaimed, href: "/admin/experts?claim=UNCLAIMED" },
  ];

  const queues = [
    submitted > 0 && {
      title: `${submitted} profile${submitted === 1 ? "" : "s"} awaiting review`,
      body: "Signed up through the site and not visible in the directory until published.",
      href: "/admin/experts?status=SUBMITTED",
    },
    pendingShowcases > 0 && {
      title: `${pendingShowcases} showcase${pendingShowcases === 1 ? "" : "s"} awaiting review`,
      body: "Submitted work samples stay hidden on the public profile until approved.",
      href: "/admin/experts",
    },
    pendingDocs > 0 && {
      title: `${pendingDocs} document${pendingDocs === 1 ? "" : "s"} awaiting review`,
      body: "CVs, portfolios and identity documents uploaded by experts.",
      href: "/admin/experts",
    },
    noPhoto > 0 && {
      title: `${noPhoto} listed profile${noPhoto === 1 ? "" : "s"} without a photo`,
      body: "These are public with an initials placeholder where a face should be.",
      href: "/admin/experts?status=PUBLISHED",
    },
    published - verified > 0 && {
      title: `${published - verified} listed profile${published - verified === 1 ? "" : "s"} not yet verified`,
      body: "Published unvetted and showing a Not yet vetted notice until reviewed.",
      href: "/admin/experts?status=PUBLISHED&verified=no",
    },
  ].filter(Boolean) as { title: string; body: string; href: string }[];

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Marketplace operations</h1>
          <p>Verification, moderation, payments and trust signals.</p>
        </div>
        <span className="status status-info"><ShieldCheck size={13} /> ADMIN</span>
      </div>

      <div className="admin-kpis">
        {kpis.map((k) => (
          <Link className="admin-kpi card" key={k.label} href={k.href || "/admin/experts"}>
            <small>{k.label}</small>
            <strong>{k.value}</strong>
          </Link>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel card">
          <div className="panel-head">
            <h2>Queues requiring attention</h2>
            <Link className="muted" href="/admin/experts">All experts</Link>
          </div>
          {queues.length === 0 ? (
            <EmptyState title="Nothing waiting" body="No profiles, showcases or documents are queued for review." />
          ) : (
            queues.map((q) => (
              <div className="activity" key={q.title}>
                <div className="activity-icon">
                  {q.title.includes("photo") ? <ImageOff size={17} /> : <BadgeCheck size={17} />}
                </div>
                <div>
                  <strong>{q.title}</strong>
                  <span>{q.body}</span>
                </div>
                <Link href={q.href} aria-label={q.title}><ArrowUpRight size={16} /></Link>
              </div>
            ))
          )}
        </section>

        <section className="panel card">
          <div className="panel-head"><h2>Coverage</h2></div>
          <div className="coverage">
            <div><strong>{profiles.length}</strong><span>profiles total</span></div>
            <div><strong>{countries}</strong><span>countries</span></div>
            <div><strong>{skills}</strong><span>distinct skills</span></div>
            <div><strong>{incomplete}</strong><span>with gaps</span></div>
            <div><strong>{openJobs}</strong><span>open jobs</span></div>
            <div><strong>{profiles.length - unclaimed}</strong><span>claimed</span></div>
          </div>
        </section>
      </div>

      <section className="panel card" style={{ marginTop: 18 }}>
        <div className="panel-head"><h2>Recent review activity</h2></div>
        {audit.length === 0 ? (
          <EmptyState title="No decisions yet" body="Verification decisions and moderation actions are logged here." />
        ) : (
          <div className="activity-list">
            {audit.map((a) => (
              <div className="activity" key={a.id}>
                <div className="activity-icon"><BadgeCheck size={17} /></div>
                <div>
                  <strong>{(a.action || "ACTION").replace(/^EXPERT_/, "").replace(/_/g, " ").toLowerCase()}</strong>
                  <span>{a.actorEmail || "staff"}{a.reason ? ` — ${a.reason.slice(0, 90)}` : ""}</span>
                </div>
                {a.targetId ? (
                  <Link href={`/admin/experts/${a.targetId}`} aria-label="Open profile"><ArrowUpRight size={16} /></Link>
                ) : (
                  <time>{when(a.createdAt)}</time>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
