import { FileText } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

interface Proposal {
  id: string; jobTitle?: string; price?: number; delivery?: string; status?: string;
}

async function proposalsFor(uid: string): Promise<Proposal[]> {
  if (!firebaseAdminConfigured) return [];
  try {
    const snap = await adminDb().collection("proposals").where("expertUid", "==", uid).limit(100).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Proposal);
  } catch {
    return [];
  }
}

export default async function Proposals() {
  const session = await requireSession();
  const proposals = await proposalsFor(session.uid);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Proposals</h1>
          <p>Your public-job applications and private invite responses.</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} strokeWidth={1.9} />}
          title="You have not sent a proposal yet"
          body="Browse the open projects and send a proposal with your proposed approach, a milestone breakdown and a timeline. There are no bidding credits — proposals cost nothing."
          action={{ label: "Browse open projects", href: "/jobs" }}
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Project</th><th>Price</th><th>Delivery</th><th>Status</th></tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.jobTitle || "—"}</strong></td>
                  <td>{p.price != null ? `€${p.price.toLocaleString()}` : "—"}</td>
                  <td>{p.delivery || "—"}</td>
                  <td><StatusBadge tone="info">{p.status || "SUBMITTED"}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
