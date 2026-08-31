import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ExpertProfile } from "@/lib/types";
import { UserRoundSearch } from "lucide-react";

export const dynamic = "force-dynamic";

async function allProfiles(): Promise<ExpertProfile[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb().collection("expertProfiles").limit(500).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ExpertProfile)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function AdminExperts() {
  await requireAdmin();
  const experts = await allProfiles();

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Expert verification</h1>
          <p>Review identity consistency, CV evidence, profile content and workflow showcases.</p>
        </div>
      </div>

      {experts.length === 0 ? (
        <EmptyState
          icon={<UserRoundSearch size={22} strokeWidth={1.9} />}
          title="No expert profiles yet"
          body="Profiles appear here once someone applies, or once profiles are seeded from the application mailbox."
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Expert</th><th>Source</th><th>Claim</th><th>Photo</th><th>Outstanding</th><th>State</th><th />
              </tr>
            </thead>
            <tbody>
              {experts.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="table-person">
                      <Avatar name={e.name} src={e.photoUrl} size="sm" />
                      <div>
                        <strong>{e.name}</strong><br />
                        <span className="muted">{e.location || e.country || "Location not stated"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{e.source === "application" ? "Application" : "Self signup"}</td>
                  <td>
                    <StatusBadge tone={e.claimState === "CLAIMED" ? "success" : "neutral"}>
                      {e.claimState || "UNCLAIMED"}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={e.photoStatus === "APPROVED" ? "success" : e.photoStatus === "PENDING_REVIEW" ? "warning" : "danger"}>
                      {e.photoStatus || "MISSING"}
                    </StatusBadge>
                  </td>
                  <td className="muted">
                    {e.missingFields?.length ? `${e.missingFields.length} field${e.missingFields.length === 1 ? "" : "s"}` : "None"}
                  </td>
                  <td>
                    <StatusBadge tone={e.verified ? "success" : "warning"}>
                      {e.verified ? "VERIFIED" : e.status}
                    </StatusBadge>
                  </td>
                  <td className="text-right">
                    <Link className="button button-secondary button-sm" href={`/admin/experts/${e.id}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
