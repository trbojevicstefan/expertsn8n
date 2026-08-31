import { MailOpen } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

interface Invite {
  id: string; clientName?: string; jobTitle?: string;
  budgetMin?: number; budgetMax?: number; status?: string; expiresAt?: string;
}

async function invitesFor(uid: string): Promise<Invite[]> {
  if (!firebaseAdminConfigured) return [];
  try {
    const snap = await adminDb().collection("jobInvites").where("expertUid", "==", uid).limit(100).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite);
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
          <p>Invite-only jobs sent directly by clients.</p>
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
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Client</th><th>Project</th><th>Budget</th><th>Status</th><th>Expires</th></tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.clientName || "—"}</strong></td>
                  <td>{i.jobTitle || "—"}</td>
                  <td>
                    {i.budgetMin != null && i.budgetMax != null
                      ? `€${i.budgetMin.toLocaleString()}–€${i.budgetMax.toLocaleString()}`
                      : "—"}
                  </td>
                  <td><StatusBadge tone="info">{i.status || "SENT"}</StatusBadge></td>
                  <td className="muted">{i.expiresAt || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
