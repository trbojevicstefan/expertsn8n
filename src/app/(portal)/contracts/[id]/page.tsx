import { notFound } from "next/navigation";
import { Check, CircleDollarSign, FileCheck2, Send, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

interface Milestone {
  id: string; title: string; amount: number; status: string;
}
interface Contract {
  id: string;
  title?: string;
  clientUid?: string;
  expertUid?: string;
  clientName?: string;
  expertName?: string;
  status?: string;
  totalAmount?: number;
  fundedAmount?: number;
  messagingUnlockedAt?: string | null;
  milestones?: Milestone[];
  timeline?: { label: string; detail: string }[];
}

async function loadContract(id: string): Promise<Contract | null> {
  if (!firebaseAdminConfigured) return null;
  const snap = await adminDb().collection("contracts").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Contract;
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const contract = await loadContract(id);

  if (!contract) notFound();

  // A contract is only ever visible to its two parties or an admin.
  const isParty = contract.clientUid === session.uid || contract.expertUid === session.uid;
  if (!isParty && !session.admin) notFound();

  const funded = contract.fundedAmount ?? 0;
  const messagingUnlocked = Boolean(contract.messagingUnlockedAt);
  const milestones = contract.milestones ?? [];

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>{contract.title || "Contract"}</h1>
          <p>
            Contract {contract.id}
            {contract.expertName && contract.clientName ? ` · ${contract.expertName} ↔ ${contract.clientName}` : ""}
          </p>
        </div>
        <StatusBadge tone={contract.status === "IN_PROGRESS" ? "success" : "neutral"}>
          {contract.status || "DRAFT"}
        </StatusBadge>
      </div>

      {funded > 0 ? (
        <div className="funding-banner">
          <ShieldCheck size={22} strokeWidth={2} />
          <div>
            <strong>€{funded.toLocaleString()} funded</strong>
            <span>
              Contract messaging and files are unlocked. Release occurs only after client approval or
              dispute resolution.
            </span>
          </div>
        </div>
      ) : (
        <div className="notice">
          <strong>Not funded yet</strong>
          Messaging and file exchange unlock the moment the first milestone is funded.
        </div>
      )}

      <div className="contract-layout">
        <section className="panel card">
          <div className="panel-head">
            <h2>Contract timeline</h2>
            {contract.totalAmount != null && (
              <span className="muted">Fixed price · €{contract.totalAmount.toLocaleString()} total</span>
            )}
          </div>

          {contract.timeline?.length ? (
            <div className="timeline">
              {contract.timeline.map((t) => (
                <div className="timeline-item" key={t.label}>
                  <span className="timeline-dot"><Check size={13} /></span>
                  <div>
                    <strong>{t.label}</strong>
                    <p>{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileCheck2 size={20} strokeWidth={1.9} />}
              title="No events yet"
              body="Offer acceptance, funding, submissions and approvals appear here as they happen."
            />
          )}

          <div className="panel-head" style={{ marginTop: 12 }}>
            <h2>Messages</h2>
            <span className={`status ${messagingUnlocked ? "status-success" : "status-neutral"}`}>
              {messagingUnlocked ? "Unlocked" : "Locked until funding"}
            </span>
          </div>

          <div className="message-box">
            <div className="messages">
              <EmptyState
                title={messagingUnlocked ? "No messages yet" : "Messaging is locked"}
                body={
                  messagingUnlocked
                    ? "Everything said here stays on the contract record."
                    : "Contact details and external links are blocked until the first milestone is funded."
                }
              />
            </div>
            <form className="composer">
              <input
                placeholder={messagingUnlocked ? "Message inside the funded contract…" : "Locked until funding"}
                disabled={!messagingUnlocked}
              />
              <button type="button" className="button button-primary button-sm" disabled={!messagingUnlocked}>
                <Send size={14} />Send
              </button>
            </form>
          </div>
        </section>

        <aside className="panel card">
          <div className="panel-head"><h2>Milestones</h2></div>
          {milestones.length === 0 ? (
            <EmptyState title="No milestones" body="Milestones are agreed when the offer is accepted." />
          ) : (
            milestones.map((m) => (
              <div className="activity" key={m.id}>
                <div className="activity-icon"><CircleDollarSign size={17} /></div>
                <div>
                  <strong>{m.title}</strong>
                  <span>€{m.amount.toLocaleString()}</span>
                </div>
                <StatusBadge tone={m.status === "FUNDED" ? "success" : "neutral"}>{m.status}</StatusBadge>
              </div>
            ))
          )}
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />
          <button className="button button-secondary button-wide" disabled={funded === 0}>
            Open dispute
          </button>
        </aside>
      </div>
    </>
  );
}
