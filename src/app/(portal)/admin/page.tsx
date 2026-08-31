import Link from "next/link";
import { ArrowUpRight, BadgeCheck, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { EmptyState } from "@/components/empty-state";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

async function count(collection: string, filter?: [string, string | boolean]): Promise<number> {
  if (!firebaseAdminConfigured) return 0;
  try {
    const base = adminDb().collection(collection);
    const q = filter ? base.where(filter[0], "==", filter[1]) : base;
    return (await q.count().get()).data().count;
  } catch {
    return 0;
  }
}

export default async function Admin() {
  await requireAdmin();

  const [published, awaitingReview, unclaimed, verified, openJobs, pendingDocs, pendingShowcases] =
    await Promise.all([
      count("expertProfiles", ["status", "PUBLISHED"]),
      // Self-signups land here and stay out of the directory until reviewed.
      count("expertProfiles", ["status", "SUBMITTED"]),
      count("expertProfiles", ["claimState", "UNCLAIMED"]),
      count("expertProfiles", ["verified", true]),
      count("jobs", ["status", "OPEN"]),
      count("expertDocuments", ["reviewState", "PENDING"]),
      count("expertShowcases", ["reviewState", "PENDING"]),
    ]);

  const kpis: [string, string | number][] = [
    ["In the directory", published],
    ["Awaiting review", awaitingReview],
    ["Unclaimed", unclaimed],
    ["Verified", verified],
    ["Documents pending", pendingDocs],
  ];

  const queues = [
    awaitingReview > 0
      ? {
          title: `${awaitingReview} profile${awaitingReview === 1 ? "" : "s"} awaiting review`,
          body: "Signed up through the site and not visible in the directory until published.",
          href: "/admin/experts",
        }
      : null,
    pendingShowcases > 0
      ? {
          title: `${pendingShowcases} showcase${pendingShowcases === 1 ? "" : "s"} awaiting review`,
          body: "Submitted work samples stay hidden on the public profile until approved.",
          href: "/admin/experts",
        }
      : null,
    openJobs > 0
      ? { title: `${openJobs} open job${openJobs === 1 ? "" : "s"}`, body: "Publicly listed and accepting proposals.", href: "/jobs" }
      : null,
    published - verified > 0
      ? {
          title: `${published - verified} profile${published - verified === 1 ? "" : "s"} not yet verified`,
          body: "Seeded from applications and published unvetted. They show a Not yet vetted notice until reviewed.",
          href: "/admin/experts",
        }
      : null,
    pendingDocs > 0
      ? {
          title: `${pendingDocs} document${pendingDocs === 1 ? "" : "s"} awaiting review`,
          body: "CVs, portfolios and identity documents uploaded by experts.",
          href: "/admin/experts",
        }
      : null,
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
        {kpis.map(([label, value]) => (
          <div className="admin-kpi card" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="panel card">
        <div className="panel-head"><h2>Queues requiring attention</h2></div>
        {queues.length === 0 ? (
          <EmptyState title="Nothing waiting" body="No profiles or documents are queued for review right now." />
        ) : (
          queues.map((q) => (
            <div className="activity" key={q.title}>
              <div className="activity-icon"><BadgeCheck size={17} /></div>
              <div>
                <strong>{q.title}</strong>
                <span>{q.body}</span>
              </div>
              <Link href={q.href} aria-label={q.title}><ArrowUpRight size={16} /></Link>
            </div>
          ))
        )}
      </section>
    </>
  );
}
