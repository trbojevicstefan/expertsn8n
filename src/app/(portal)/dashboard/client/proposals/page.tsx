import { Inbox } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { EmptyState } from "@/components/empty-state";
import { ProposalsReceived, type ReceivedProposal } from "@/components/proposals-received";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

async function proposalsForClient(uid: string): Promise<ReceivedProposal[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb().collection("proposals").where("clientId", "==", uid).limit(200).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ReceivedProposal)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default async function ClientProposals() {
  const session = await requireSession();
  const proposals = await proposalsForClient(session.uid);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Proposals received</h1>
          <p>Accepting one creates a contract and its milestones. Nothing is charged until you fund one.</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} strokeWidth={1.9} />}
          title="No proposals yet"
          body="Experts send proposals against your open jobs. If a job has been open for a while with nothing coming in, try widening the budget or inviting people directly from the directory."
          action={{ label: "Browse the directory", href: "/experts" }}
        />
      ) : (
        <ProposalsReceived proposals={proposals} />
      )}
    </>
  );
}
