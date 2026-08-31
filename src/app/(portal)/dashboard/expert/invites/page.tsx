import { MailOpen } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ExpertInvitesList, type ExpertInviteItem } from "@/components/expert-invites-list";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

async function invitesFor(uid: string): Promise<ExpertInviteItem[]> {
  if (!firebaseAdminConfigured) return [];
  try {
    const snap = await adminDb().collection("jobInvites").where("expertUid", "==", uid).limit(100).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ExpertInviteItem)
      .sort((a, b) => String(b.expiresAt || "").localeCompare(String(a.expiresAt || "")));
  } catch {
    return [];
  }
}

export default async function Invites() {
  const session = await requireSession();
  const invites = await invitesFor(session.uid);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Private invitations</h1>
          <p>Review invite-only briefs, accept the ones you want, then send a proposal.</p>
        </div>
      </div>

      {invites.length === 0 ? (
        <EmptyState
          icon={<MailOpen size={22} strokeWidth={1.9} />}
          title="No invitations yet"
          body="When a client shortlists you for a private job, it appears here. A complete profile with a photo and a workflow showcase makes an invitation far more likely."
          action={{ label: "Complete your profile", href: "/dashboard/expert/profile" }}
        />
      ) : (
        <ExpertInvitesList invites={invites} />
      )}
    </>
  );
}
