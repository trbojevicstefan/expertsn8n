import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { contractActivities } from "@/lib/contract-activity";
import { StatusBadge } from "@/components/status-badge";
import { ContractWorkspace } from "@/components/contract-workspace";
import {
  canSeeContract,
  contractMessages,
  contractReviews,
  fundedTotal,
  loadContract,
  releasedTotal,
} from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const contract = await loadContract(id);
  if (!contract || !canSeeContract(contract, session)) notFound();

  const [messages, activities, reviews] = await Promise.all([
    contractMessages(id),
    contractActivities(id),
    contractReviews(id),
  ]);
  const role = contract.clientId === session.uid ? "client" : contract.expertUid === session.uid ? "expert" : "admin";

  return (
    <>
      <div className="portal-head">
        <div>
          <Link href="/dashboard/contracts" className="back-link">
            <ArrowLeft size={14} strokeWidth={2.2} />All contracts
          </Link>
          <h1>{contract.jobTitle || "Contract"}</h1>
          <p>
            {contract.clientName} ↔ {contract.expertName} · {contract.currency} {(contract.totalAmount || 0).toLocaleString()} total ·
            {" "}{contract.currency} {fundedTotal(contract).toLocaleString()} funded · {contract.currency} {releasedTotal(contract).toLocaleString()} released
          </p>
        </div>
        <StatusBadge tone={contract.status === "COMPLETED" ? "success" : contract.status === "CANCELLED" ? "danger" : "info"}>
          {contract.status}
        </StatusBadge>
      </div>

      <ContractWorkspace
        contract={contract}
        messages={messages}
        activities={activities}
        reviews={reviews}
        viewerUid={session.uid}
        role={role}
      />
    </>
  );
}
