import { Plus, Workflow } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { Showcase } from "@/lib/types";

export const dynamic = "force-dynamic";

async function showcasesForUid(uid: string): Promise<(Showcase & { reviewState?: string })[]> {
  if (!firebaseAdminConfigured) return [];
  const userSnap = await adminDb().collection("users").doc(uid).get();
  const expertId = (userSnap.data() || {}).expertId;
  if (typeof expertId !== "string" || !expertId) return [];
  const snap = await adminDb().collection("expertShowcases").where("expertId", "==", expertId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Showcase & { reviewState?: string });
}

export default async function Showcases() {
  const session = await requireSession();
  const items = await showcasesForUid(session.uid);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Workflow showcases</h1>
          <p>Show the business problem, architecture and outcome — not client secrets.</p>
        </div>
        <button className="button button-primary"><Plus size={16} strokeWidth={2.2} />New showcase</button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Workflow size={22} strokeWidth={1.9} />}
          title="No showcases yet"
          body="A showcase is what gets a profile taken seriously: the business problem, the architecture, the integrations, how failures are handled and what changed for the client. At least one is required before a profile can be verified."
        />
      ) : (
        <div className="showcase-grid">
          {items.map((s) => (
            <article className="showcase-card card" key={s.id}>
              <StatusBadge tone={s.reviewState === "APPROVED" ? "success" : "warning"}>
                {s.reviewState || "PENDING"}
              </StatusBadge>
              <h3>{s.title}</h3>
              <p>{s.summary}</p>
              <span className="outcome">{s.outcome}</span>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
