import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Mail, MapPin } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { AdminReviewActions } from "@/components/admin-review-actions";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { MISSING_FIELD_LABELS } from "@/lib/expert-account";
import type { ExpertDocument, ExpertProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PrivateRecord {
  email?: string;
  documentsOnFile?: string[];
  seededFrom?: string;
}

interface Verification {
  state?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

async function load(id: string) {
  if (!firebaseAdminConfigured) return null;
  const db = adminDb();
  const profileSnap = await db.collection("expertProfiles").doc(id).get();
  if (!profileSnap.exists) return null;

  const profile = { id: profileSnap.id, ...profileSnap.data() } as ExpertProfile;

  const [privateSnap, verificationSnap, docsSnap] = await Promise.all([
    db.collection("expertPrivate").doc(id).get(),
    db.collection("expertVerifications").doc(id).get(),
    profile.claimedByUid
      ? db.collection("expertDocuments").where("ownerUid", "==", profile.claimedByUid).get()
      : db.collection("expertDocuments").where("expertId", "==", id).get(),
  ]);

  return {
    profile,
    priv: (privateSnap.data() || {}) as PrivateRecord,
    verification: (verificationSnap.data() || {}) as Verification,
    documents: docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExpertDocument),
  };
}

export default async function AdminExpertReview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  const { profile, priv, verification, documents } = data;
  const missing = (profile.missingFields || []).map((f) => MISSING_FIELD_LABELS[f] || f);

  return (
    <>
      <div className="portal-head">
        <div>
          <Link href="/admin/experts" className="back-link">
            <ArrowLeft size={14} strokeWidth={2.2} />All experts
          </Link>
          <h1>{profile.name}</h1>
          <p>{profile.title}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge tone={profile.verified ? "success" : "warning"}>
            {profile.verified ? "VERIFIED" : profile.status}
          </StatusBadge>
          <Link href={`/experts/${profile.slug}`} className="button button-secondary button-sm" target="_blank">
            Public profile <ExternalLink size={14} strokeWidth={2.2} />
          </Link>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className="panel card">
            <div className="profile-heading">
              <Avatar name={profile.name} src={profile.photoUrl} />
              <div>
                <strong style={{ fontSize: 16 }}>{profile.name}</strong>
                <div className="muted-row" style={{ marginTop: 4 }}>
                  <MapPin size={14} />
                  {[profile.location, profile.country, profile.timezone].filter(Boolean).join(" · ") || "Location not stated"}
                </div>
                {priv.email && (
                  <div className="muted-row" style={{ marginTop: 4 }}>
                    <Mail size={14} />
                    <a href={`mailto:${priv.email}`}>{priv.email}</a>
                  </div>
                )}
              </div>
            </div>

            <div className="review-facts">
              <div><span>Source</span><strong>{profile.source === "application" ? "Email application" : "Self signup"}</strong></div>
              <div><span>Claim</span><strong>{profile.claimState || "UNCLAIMED"}</strong></div>
              <div><span>Photo</span><strong>{profile.photoStatus || "MISSING"}</strong></div>
              <div><span>Rate</span><strong>{profile.hourlyRate > 0 ? `€${profile.hourlyRate}/hr` : "Not stated"}</strong></div>
              <div><span>Availability</span><strong>{profile.availability || "Not stated"}</strong></div>
              <div><span>Claimed at</span><strong>{profile.claimedAt ? new Date(profile.claimedAt).toLocaleDateString() : "—"}</strong></div>
            </div>

            {missing.length > 0 && (
              <div className="notice notice-warning" style={{ marginTop: 18 }}>
                <strong>Outstanding fields</strong>
                {missing.join(", ")}.
              </div>
            )}
          </section>

          <section className="panel card">
            <div className="panel-head"><h2>About, as written by the applicant</h2></div>
            <p style={{ color: "var(--ink-500)", lineHeight: 1.75 }}>{profile.bio}</p>
            {(profile.skills?.length > 0 || profile.integrations?.length > 0) && (
              <div className="chip-row" style={{ marginTop: 16 }}>
                {[...(profile.skills || []), ...(profile.integrations || [])].map((x) => (
                  <span className="chip" key={x}>{x}</span>
                ))}
              </div>
            )}
            {profile.links && profile.links.length > 0 && (
              <div className="profile-links">
                {profile.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="profile-link">
                    {l.label} <ExternalLink size={13} strokeWidth={2.2} />
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="panel card">
            <div className="panel-head"><h2>Documents</h2></div>

            {documents.length === 0 && !(priv.documentsOnFile || []).length ? (
              <EmptyState
                icon={<FileText size={20} strokeWidth={1.9} />}
                title="Nothing uploaded"
                body="The expert has not uploaded a CV, portfolio or identity document through the platform yet."
              />
            ) : (
              <>
                {documents.length > 0 && (
                  <ul className="doc-list">
                    {documents.map((d) => (
                      <li key={d.id}>
                        <FileText size={16} strokeWidth={2} />
                        <div>
                          <strong>{d.fileName}</strong>
                          <span>{d.kind} · {(d.sizeBytes / 1024 / 1024).toFixed(1)} MB · {d.reviewState.toLowerCase()}</span>
                        </div>
                        <a
                          className="button button-secondary button-sm"
                          href={`/api/admin/documents/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {(priv.documentsOnFile || []).length > 0 && (
                  <div className="notice" style={{ marginTop: documents.length ? 16 : 0 }}>
                    <strong>Attached to the original application</strong>
                    {(priv.documentsOnFile || []).join(", ")} — these arrived by email and live in the
                    application mailbox, not in platform storage.
                  </div>
                )}
              </>
            )}
          </section>

          {verification.state && (
            <section className="panel card">
              <div className="panel-head"><h2>Last decision</h2></div>
              <div className="review-facts">
                <div><span>State</span><strong>{verification.state}</strong></div>
                <div><span>Reviewed</span><strong>{verification.reviewedAt ? new Date(verification.reviewedAt).toLocaleString() : "—"}</strong></div>
              </div>
              {verification.reviewNotes && (
                <p style={{ marginTop: 12, color: "var(--ink-500)" }}>{verification.reviewNotes}</p>
              )}
            </section>
          )}
        </div>

        <aside>
          <AdminReviewActions
            expertId={profile.id}
            currentStatus={profile.status}
            verified={Boolean(profile.verified)}
          />
        </aside>
      </div>
    </>
  );
}
