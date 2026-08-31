import Link from "next/link";
import { Search, UserRoundSearch } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ExpertProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES = ["PUBLISHED", "SUBMITTED", "NEEDS_CHANGES", "REJECTED", "SUSPENDED"] as const;

interface Filters {
  status?: string;
  claim?: string;
  verified?: string;
  source?: string;
  q?: string;
}

async function allProfiles(): Promise<ExpertProfile[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb().collection("expertProfiles").limit(500).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ExpertProfile)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

/** Filtering happens in memory: the whole set is a few hundred documents, and
 *  every combination of these facets would otherwise need its own index. */
function applyFilters(all: ExpertProfile[], f: Filters): ExpertProfile[] {
  const q = (f.q || "").trim().toLowerCase();
  return all.filter((e) => {
    if (f.status && e.status !== f.status) return false;
    if (f.claim && (e.claimState || "UNCLAIMED") !== f.claim) return false;
    if (f.verified === "yes" && !e.verified) return false;
    if (f.verified === "no" && e.verified) return false;
    if (f.source && (e.source || "self-signup") !== f.source) return false;
    if (q) {
      const hay = `${e.name} ${e.title} ${e.location} ${e.country} ${(e.skills || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function href(current: Filters, patch: Filters): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, String(v));
  const qs = params.toString();
  return qs ? `/admin/experts?${qs}` : "/admin/experts";
}

export default async function AdminExperts({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const all = await allProfiles();
  const experts = applyFilters(all, filters);

  const countFor = (s: string) => all.filter((e) => e.status === s).length;
  const chip = (label: string, active: boolean, to: string, count?: number) => (
    <Link key={label} href={to} className={active ? "filter-chip active" : "filter-chip"}>
      {label}
      {count !== undefined && <span>{count}</span>}
    </Link>
  );

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Expert verification</h1>
          <p>Review identity consistency, CV evidence, profile content and workflow showcases.</p>
        </div>
        <span className="muted">{experts.length} of {all.length}</span>
      </div>

      <div className="filter-bar card">
        <form className="filter-search" action="/admin/experts" method="get">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          {filters.claim && <input type="hidden" name="claim" value={filters.claim} />}
          {filters.verified && <input type="hidden" name="verified" value={filters.verified} />}
          {filters.source && <input type="hidden" name="source" value={filters.source} />}
          <Search size={15} strokeWidth={2.2} />
          <input
            className="input"
            name="q"
            placeholder="Search name, headline, location or skill"
            defaultValue={filters.q || ""}
            aria-label="Search experts"
          />
          <button className="button button-secondary button-sm" type="submit">Search</button>
        </form>

        <div className="filter-row">
          <span className="filter-label">Status</span>
          {chip("All", !filters.status, href(filters, { status: "" }), all.length)}
          {STATUSES.map((s) => chip(s.replace("_", " ").toLowerCase(), filters.status === s, href(filters, { status: s }), countFor(s)))}
        </div>

        <div className="filter-row">
          <span className="filter-label">Claim</span>
          {chip("All", !filters.claim, href(filters, { claim: "" }))}
          {chip("claimed", filters.claim === "CLAIMED", href(filters, { claim: "CLAIMED" }), all.filter((e) => e.claimState === "CLAIMED").length)}
          {chip("unclaimed", filters.claim === "UNCLAIMED", href(filters, { claim: "UNCLAIMED" }), all.filter((e) => (e.claimState || "UNCLAIMED") === "UNCLAIMED").length)}
        </div>

        <div className="filter-row">
          <span className="filter-label">Verified</span>
          {chip("All", !filters.verified, href(filters, { verified: "" }))}
          {chip("verified", filters.verified === "yes", href(filters, { verified: "yes" }), all.filter((e) => e.verified).length)}
          {chip("not verified", filters.verified === "no", href(filters, { verified: "no" }), all.filter((e) => !e.verified).length)}
        </div>

        <div className="filter-row">
          <span className="filter-label">Source</span>
          {chip("All", !filters.source, href(filters, { source: "" }))}
          {chip("application", filters.source === "application", href(filters, { source: "application" }), all.filter((e) => e.source === "application").length)}
          {chip("self signup", filters.source === "self-signup", href(filters, { source: "self-signup" }), all.filter((e) => (e.source || "self-signup") === "self-signup").length)}
        </div>

        {(filters.status || filters.claim || filters.verified || filters.source || filters.q) && (
          <Link className="filter-clear" href="/admin/experts">Clear all filters</Link>
        )}
      </div>

      {experts.length === 0 ? (
        <EmptyState
          icon={<UserRoundSearch size={22} strokeWidth={1.9} />}
          title={all.length === 0 ? "No expert profiles yet" : "Nothing matches those filters"}
          body={
            all.length === 0
              ? "Profiles appear here once someone applies, or once profiles are seeded from the application mailbox."
              : "Try widening the filters or clearing the search."
          }
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
                    <StatusBadge tone={e.verified ? "success" : e.status === "PUBLISHED" ? "info" : "warning"}>
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
