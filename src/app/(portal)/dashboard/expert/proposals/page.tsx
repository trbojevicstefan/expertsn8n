import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ExpertProposalsList, type ExpertProposalItem } from "@/components/expert-proposals-list";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

async function proposalsFor(uid: string): Promise<ExpertProposalItem[]> {
  if (!firebaseAdminConfigured) return [];
  try {
    const snap = await adminDb().collection("proposals").where("expertUid", "==", uid).limit(100).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExpertProposalItem);
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
          <p>Your public-job applications and private invite responses. You can withdraw an actionable proposal until it is accepted or declined.</p>
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
        <ExpertProposalsList proposals={proposals} />
      )}
    </>
  );
}
