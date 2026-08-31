import { Scale } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

interface Dispute {
  id: string; contractId?: string; reason?: string; amountAtRisk?: number; state?: string;
}

async function disputes(): Promise<Dispute[]> {
  if (!firebaseAdminConfigured) return [];
  try {
    const snap = await adminDb().collection("disputes").limit(200).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dispute);
  } catch {
    return [];
  }
}

export default async function Disputes() {
  await requireAdmin();
  const cases = await disputes();

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Disputes</h1>
          <p>Evidence review freezes release until a moderator resolution is executed.</p>
        </div>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={<Scale size={22} strokeWidth={1.9} />}
          title="No open disputes"
          body="Nothing is currently escalated. Disputes appear here when either side raises one against a funded milestone, and funds stay held until a moderator resolves it."
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Case</th><th>Contract</th><th>Reason</th><th>Amount at risk</th><th>State</th></tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.id}</strong></td>
                  <td>{c.contractId || "—"}</td>
                  <td>{c.reason || "—"}</td>
                  <td>{c.amountAtRisk != null ? `€${c.amountAtRisk.toLocaleString()}` : "—"}</td>
                  <td><StatusBadge tone="warning">{c.state || "OPEN"}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
