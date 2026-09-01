import Link from "next/link";
import { Inbox, Plus, UserRoundSearch } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { EmptyState } from "@/components/empty-state";
import { clientProfileForUid, clientProfileGaps } from "@/lib/client-account";

export const dynamic = "force-dynamic";

async function countWhere(collection: string, field: string, value: string): Promise<number> {
  if (!firebaseAdminConfigured) return 0;
  try {
    const snap = await adminDb().collection(collection).where(field, "==", value).count().get();
    return snap.data().count;
  } catch {
    // Collection does not exist yet — that is a real zero, not an error.
    return 0;
  }
}

export default async function Dashboard() {
  const session = await requireSession();
  const client = session.role === "client";

  const stats = client
    ? [
        { label: "Jobs posted", value: await countWhere("jobs", "clientId", session.uid), helper: "Across all statuses" },
        { label: "Proposals received", value: await countWhere("proposals", "clientId", session.uid), helper: "Awaiting your review" },
        { label: "Active contracts", value: await countWhere("contracts", "clientId", session.uid), helper: "Funded and in progress" },
      ]
    : [
        { label: "Invitations", value: await countWhere("jobInvites", "expertUid", session.uid), helper: "Private job invites" },
        { label: "Proposals sent", value: await countWhere("proposals", "expertUid", session.uid), helper: "Across all jobs" },
        { label: "Active contracts", value: await countWhere("contracts", "expertUid", session.uid), helper: "Funded and in progress" },
      ];

  const nothingYet = stats.every((s) => s.value === 0);
  // Same wording the Customer.io campaign uses, so the email and the dashboard
  // never disagree about what is outstanding.
  const profileGaps = client ? clientProfileGaps(await clientProfileForUid(session.uid)) : [];

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>{client ? "Hiring dashboard" : "Expert dashboard"}</h1>
          <p>
            {client
              ? "Track jobs, funded contracts and expert activity."
              : "Manage your profile, invites, proposals and active client work."}
          </p>
        </div>
        <Link href={client ? "/dashboard/client/jobs/new" : "/jobs"} className="button button-primary">
          <Plus size={16} strokeWidth={2.2} />
          {client ? "Post a job" : "Find projects"}
        </Link>
      </div>

      {profileGaps.length > 0 && (
        <div className="notice">
          <strong>Your company profile is missing: {profileGaps.join(", ")}.</strong>
          Experts weigh this up before bidding.{" "}
          <Link href="/dashboard/client/profile">Complete your profile</Link>
        </div>
      )}

      <div className="stats-grid stats-grid-3">
        {stats.map((s) => (
          <div className="stat-card card" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>{s.helper}</small>
          </div>
        ))}
      </div>

      {nothingYet ? (
        <EmptyState
          icon={client ? <Plus size={22} strokeWidth={1.9} /> : <UserRoundSearch size={22} strokeWidth={1.9} />}
          title={client ? "No activity yet" : "Nothing in your queue yet"}
          body={
            client
              ? "Post your first job and reviewed experts can start submitting proposals. Posting is free and takes about four minutes."
              : "You have no invitations or proposals yet. Browse open projects, and make sure your profile is complete so clients can find you."
          }
          action={client ? { label: "Post a job", href: "/dashboard/client/jobs/new" } : { label: "Browse open projects", href: "/jobs" }}
        />
      ) : (
        <div className="dashboard-grid">
          <section className="panel card">
            <div className="panel-head"><h2>Recent activity</h2></div>
            <EmptyState
              icon={<Inbox size={20} strokeWidth={1.9} />}
              title="No activity to show"
              body="Contract events, milestone funding and messages will appear here as they happen."
            />
          </section>
          <section className="panel card">
            <div className="panel-head"><h2>Quick actions</h2></div>
            <div className="quick-list">
              {client ? (
                <>
                  <Link href="/dashboard/client/jobs/new">Post a job<span>→</span></Link>
                  <Link href="/experts">Browse experts<span>→</span></Link>
                  <Link href="/dashboard/client/jobs">My jobs<span>→</span></Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard/expert/profile">Complete your profile<span>→</span></Link>
                  <Link href="/jobs">Find projects<span>→</span></Link>
                  <Link href="/dashboard/expert/showcases">Add a showcase<span>→</span></Link>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
