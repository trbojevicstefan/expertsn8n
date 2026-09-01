import { FieldValue } from "firebase-admin/firestore";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AppNotification, NotificationType, SessionUser } from "@/lib/types";
import { deliverTransactionalNotification } from "@/lib/customerio";

const COLLECTION = "notifications";

interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  expertId?: string | null;
}

/**
 * Admin notifications are a single broadcast document rather than one copy per
 * administrator: the set of admins changes, and fanning out would leave stale
 * copies behind. Read state is tracked per-admin in `readBy`.
 */
export async function notifyAdmins(n: NewNotification): Promise<void> {
  if (!firebaseAdminConfigured) return;
  await adminDb().collection(COLLECTION).add({
    recipientUid: null,
    audience: "ADMIN",
    readBy: [],
    createdAt: new Date().toISOString(),
    expertId: n.expertId ?? null,
    ...n,
  });
}

export async function notifyUser(uid: string, n: NewNotification): Promise<void> {
  if (!firebaseAdminConfigured || !uid) return;
  const ref = await adminDb().collection(COLLECTION).add({
    recipientUid: uid,
    audience: "USER",
    readAt: null,
    createdAt: new Date().toISOString(),
    expertId: n.expertId ?? null,
    ...n,
  });
  await deliverTransactionalNotification(uid, {
    notificationId: ref.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
  });
}

function isUnread(n: AppNotification, uid: string): boolean {
  return n.audience === "ADMIN" ? !(n.readBy || []).includes(uid) : !n.readAt;
}

/** Everything addressed to this person, newest first. */
export async function listNotifications(session: SessionUser, limit = 60): Promise<AppNotification[]> {
  if (!firebaseAdminConfigured) return [];
  const db = adminDb();

  const queries = [db.collection(COLLECTION).where("recipientUid", "==", session.uid).limit(limit).get()];
  if (session.admin) {
    queries.push(db.collection(COLLECTION).where("audience", "==", "ADMIN").limit(limit).get());
  }

  const snaps = await Promise.all(queries);
  const seen = new Set<string>();
  const all: AppNotification[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      all.push({ id: d.id, ...d.data() } as AppNotification);
    }
  }

  // Sorted in memory so no composite index is needed for the two queries above.
  return all
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

export async function unreadCount(session: SessionUser): Promise<number> {
  const all = await listNotifications(session);
  return all.filter((n) => isUnread(n, session.uid)).length;
}

export function withUnread(items: AppNotification[], uid: string) {
  return items.map((n) => ({ ...n, unread: isUnread(n, uid) }));
}

/** Marks everything currently addressed to this person as read. */
export async function markAllRead(session: SessionUser): Promise<number> {
  if (!firebaseAdminConfigured) return 0;
  const db = adminDb();
  const all = await listNotifications(session, 200);
  const unread = all.filter((n) => isUnread(n, session.uid));
  if (unread.length === 0) return 0;

  const batch = db.batch();
  const nowIso = new Date().toISOString();
  for (const n of unread) {
    const ref = db.collection(COLLECTION).doc(n.id);
    if (n.audience === "ADMIN") {
      batch.update(ref, { readBy: FieldValue.arrayUnion(session.uid) });
    } else {
      batch.update(ref, { readAt: nowIso });
    }
  }
  await batch.commit();
  return unread.length;
}
