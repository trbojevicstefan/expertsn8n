import Link from "next/link";
import { Check, CheckCircle2, ExternalLink } from "lucide-react";
import { getSession } from "@/lib/auth/server";
import { ProfileEditor } from "@/components/profile-editor";
import { completenessDetail, documentsForUid, expertProfileForUid } from "@/lib/expert-account";
import { MessageThread } from "@/components/message-thread";
import { threadFor } from "@/lib/expert-messages";

export const dynamic = "force-dynamic";

export default async function ExpertProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string; photo?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();

  if (!session) {
    return (
      <div className="portal-head">
        <div>
          <h1>Expert profile</h1>
          <p>Log in to manage your profile.</p>
        </div>
      </div>
    );
  }

  const profile = await expertProfileForUid(session.uid);

  if (!profile) {
    return (
      <>
        <div className="portal-head">
          <div>
            <h1>Expert profile</h1>
            <p>No expert profile is linked to this account yet.</p>
          </div>
        </div>
        <div className="form-card card">
          <div className="notice">
            <strong>Did we email you a claim code?</strong>
            If we created a profile from an application you sent us, claim it to take ownership.
          </div>
          <Link className="button button-primary" href="/claim">Claim an existing profile</Link>
          <Link className="button button-secondary" href="/onboarding/expert" style={{ marginLeft: 10 }}>
            Apply from scratch
          </Link>
        </div>
      </>
    );
  }

  const [documents, messages] = await Promise.all([
    documentsForUid(session.uid),
    threadFor(profile.id),
  ]);
  const { pct, gaps, extras } = completenessDetail(profile);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Expert profile</h1>
          <p>This is the profile clients see in the directory.</p>
        </div>
        <Link href={`/experts/${profile.slug}`} className="button button-secondary" target="_blank">
          {profile.status === "PUBLISHED" ? "View public profile" : "Preview public profile"}
          <ExternalLink size={15} strokeWidth={2.2} />
        </Link>
      </div>

      {params.claimed === "1" && (
        <div className="funding-banner">
          <CheckCircle2 size={20} strokeWidth={2.2} />
          <div>
            <strong>Profile claimed. It is yours now.</strong>
            <span>
              {params.photo === "required"
                ? "Add a photo below and fill in anything marked outstanding."
                : "We pulled your photo across. Fill in anything marked outstanding below."}
            </span>
          </div>
        </div>
      )}

      <div className="completeness-card card">
        <div className="completeness-head">
          <div>
            <strong>Profile completeness</strong>
            <span>{pct}% complete</span>
          </div>
          <span className={`status ${pct >= 80 ? "status-success" : pct >= 50 ? "status-warning" : "status-danger"}`}>
            {pct >= 80 ? "Strong" : pct >= 50 ? "Needs work" : "Incomplete"}
          </span>
        </div>
        <div className="completeness-bar"><span style={{ width: `${pct}%` }} /></div>
        {gaps.length > 0 ? (
          <p className="completeness-missing">
            To reach 100%, still needed: {gaps.join(", ")}.
          </p>
        ) : (
          <p className="completeness-missing">Everything required is filled in.</p>
        )}

        {extras.some((x) => !x.done) && (
          <div className="strengthen">
            <strong>Optional, but clients ask about these</strong>
            <ul>
              {extras.map((x) => (
                <li key={x.label} className={x.done ? "done" : ""}>
                  {x.done ? <Check size={13} strokeWidth={2.6} /> : <span className="dot" />}
                  {x.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <MessageThread messages={messages} viewerUid={session.uid} mode="expert" />

      <ProfileEditor
        profile={profile}
        uid={session.uid}
        documents={documents}
        photoRequired={(profile.missingFields || []).includes("photo")}
      />
    </>
  );
}
