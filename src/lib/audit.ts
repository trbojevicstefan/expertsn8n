import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { SessionUser } from "@/lib/types";

export interface AuditEventInput {
  actor: SessionUser;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only helper for privileged marketplace decisions. Client Firestore
 * rules do not grant writes to this collection; server code only ever creates
 * new records and never updates/deletes an existing audit event.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<string | null> {
  if (!firebaseAdminConfigured) return null;
  const ref = adminDb().collection("auditEvents").doc();
  await ref.create({
    actorUid: input.actor.uid,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason || "",
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    immutable: true,
  });
  return ref.id;
}
