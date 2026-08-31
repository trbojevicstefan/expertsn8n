import { CircleDollarSign } from "lucide-react";
import { requireAdmin } from "@/lib/auth/server";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

interface Payment {
  id: string; contractId?: string; kind?: string; amount?: number; state?: string; createdAt?: string;
}

async function payments(): Promise<Payment[]> {
  if (!firebaseAdminConfigured) return [];
  try {
    const snap = await adminDb().collection("payments").limit(200).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);
  } catch {
    return [];
  }
}

export default async function Payments() {
  await requireAdmin();
  const rows = await payments();

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Payments &amp; reconciliation</h1>
          <p>Financial state is server-authoritative and provider-confirmed.</p>
        </div>
      </div>

      <div className="notice">
        <strong>Provider adapter</strong>
        This deployment runs the mock adapter. Activate Mangopay or Stripe only after merchant and platform
        approval, webhook verification and reconciliation tests. No real money moves until then.
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CircleDollarSign size={22} strokeWidth={1.9} />}
          title="No payment records"
          body="Milestone funding, releases and refunds appear here once a contract is funded through the platform."
        />
      ) : (
        <div className="data-card card">
          <table className="data-table">
            <thead>
              <tr><th>Reference</th><th>Contract</th><th>Type</th><th>Amount</th><th>State</th><th>Created</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.id}</strong></td>
                  <td>{p.contractId || "—"}</td>
                  <td>{p.kind || "—"}</td>
                  <td>{p.amount != null ? `€${p.amount.toLocaleString()}` : "—"}</td>
                  <td><StatusBadge tone="info">{p.state || "PENDING"}</StatusBadge></td>
                  <td className="muted">{p.createdAt || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
