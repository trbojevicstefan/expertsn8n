import { clientProfileGaps } from "@/lib/client-account";
import { completenessDetail } from "@/lib/expert-account";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { ClientProfile, ExpertProfile } from "@/lib/types";

type CustomerIoAttributes = Record<string, boolean | number | string | null>;

type CustomerIoEventData = Record<string, boolean | number | string | null>;

export interface TransactionalNotification {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  href: string;
}

interface CustomerIoOutboxTask {
  kind: "profile_sync" | "transactional_notification";
  uid: string;
  eventName?: string;
  notification?: TransactionalNotification;
}

function customerIoConfig() {
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const trackApiKey = process.env.CUSTOMERIO_TRACK_API_KEY;
  const region = process.env.CUSTOMERIO_REGION?.toLowerCase() === "eu" ? "eu" : "us";

  if (!siteId || !trackApiKey) return null;

  return {
    authorization: `Basic ${Buffer.from(`${siteId}:${trackApiKey}`).toString("base64")}`,
    baseUrl: region === "eu" ? "https://track-eu.customer.io" : "https://track.customer.io",
  };
}

async function customerIoRequest(path: string, method: "POST" | "PUT", body: object): Promise<void> {
  const config = customerIoConfig();
  if (!config) return;

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: config.authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`Customer.io Track API returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

async function enqueueTask(id: string, task: CustomerIoOutboxTask, reason: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await adminDb().collection("customerioOutbox").doc(id).set(
    {
      ...task,
      status: "PENDING",
      attempts: 0,
      lastError: reason.slice(0, 500),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true },
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appApiBase(): string {
  const region = process.env.CUSTOMERIO_REGION?.toLowerCase() === "eu" ? "eu" : "us";
  return region === "eu" ? "https://api-eu.customer.io" : "https://api.customer.io";
}

/**
 * The App API explains every rejection in its response body. Discarding it left
 * a bare `400` in the logs, which reads the same whether the recipient is
 * missing, the message id is unknown or the sending domain is unverified.
 */
async function sendAppApiEmail(body: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.CUSTOMERIO_APP_API_KEY;
  if (!apiKey) throw new Error("CUSTOMERIO_APP_API_KEY is not configured");

  const response = await fetch(`${appApiBase()}/v1/send/email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`Customer.io App API returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

/**
 * Every transactional send needs its own `to`: the message template carries the
 * design, not the recipient. Firebase Auth is the authority on the address, so
 * it settles cases where the mirrored Firestore copy is missing or malformed.
 */
async function recipientEmail(uid: string): Promise<string> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const stored = String(snap.data()?.email || "").trim();
  if (EMAIL_PATTERN.test(stored)) return stored;

  const authEmail = String((await adminAuth().getUser(uid).catch(() => null))?.email || "").trim();
  if (EMAIL_PATTERN.test(authEmail)) return authEmail;

  throw new Error(`No email address on file for ${uid}`);
}

async function sendTransactionalNotification(
  uid: string,
  notification: TransactionalNotification,
): Promise<void> {
  const messageId = process.env.CUSTOMERIO_TRANSACTIONAL_MESSAGE_ID;
  if (!messageId) throw new Error("CUSTOMERIO_TRANSACTIONAL_MESSAGE_ID is not configured");

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  await sendAppApiEmail({
    transactional_message_id: messageId,
    to: await recipientEmail(uid),
    identifiers: { id: uid },
    message_data: {
      notification_id: notification.notificationId,
      notification_type: notification.type,
      title: notification.title,
      body: notification.body,
      action_url: `${appUrl}${notification.href}`,
    },
  });
}

/** Send a branded verification message while Firebase remains the token authority. */
export async function sendCustomerIoEmailVerification(
  uid: string,
  email: string,
  verificationUrl: string,
): Promise<void> {
  const messageId = process.env.CUSTOMERIO_VERIFICATION_MESSAGE_ID;
  if (!messageId) throw new Error("CUSTOMERIO_VERIFICATION_MESSAGE_ID is not configured");

  await sendAppApiEmail({
    transactional_message_id: messageId,
    to: email,
    identifiers: { id: uid },
    message_data: { verification_url: verificationUrl },
  });
}

/** Attempt immediately; persist the exact notification for retry if delivery is unavailable. */
export async function deliverTransactionalNotification(
  uid: string,
  notification: TransactionalNotification,
): Promise<void> {
  try {
    await sendTransactionalNotification(uid, notification);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown transactional error";
    console.error("Customer.io transactional email failed", reason);
    await enqueueTask(`notification_${notification.notificationId}`, {
      kind: "transactional_notification",
      uid,
      notification,
    }, reason);
  }
}

/** Create or update a Customer.io profile using the Firebase UID as its stable ID. */
export async function identifyCustomer(uid: string, attributes: CustomerIoAttributes): Promise<void> {
  await customerIoRequest(`/api/v1/customers/${encodeURIComponent(uid)}`, "PUT", attributes);
}

/** Record a server-side behavioral event for an identified Customer.io profile. */
export async function trackCustomerEvent(
  uid: string,
  name: string,
  data: CustomerIoEventData = {},
): Promise<void> {
  await customerIoRequest(`/api/v1/customers/${encodeURIComponent(uid)}/events`, "POST", {
    name,
    data,
  });
}

function text(value: unknown, max = 1000): string {
  if (typeof value !== "string") return "";
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= max) return value;
  let end = max;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end -= 1;
  return bytes.subarray(0, end).toString("utf8");
}

function list(value: unknown): string {
  return Array.isArray(value) ? text(value.map(String).filter(Boolean).join(", ")) : "";
}

/**
 * Mirror marketplace state into flat Customer.io attributes so campaigns can
 * segment on profile gaps without reading Firestore at send time.
 */
export async function syncMarketplaceUser(
  uid: string,
  eventName?: string,
  enqueueOnFailure = true,
): Promise<boolean> {
  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return false;

  const user = userSnap.data() || {};
  const role = user.role === "expert" ? "expert" : user.role === "admin" ? "admin" : "client";
  const authUser = await adminAuth().getUser(uid).catch(() => null);
  const email = text(user.email, 320).trim();
  const name = text(user.name, 160).trim();
  const attributes: CustomerIoAttributes = {
    role,
    account_status: text(user.status, 80) || "ACTIVE",
    account_created_at: text(user.createdAt, 80),
    last_login_at: text(user.lastLoginAt, 80),
    account_email_verified: Boolean(authUser?.emailVerified),
    account_auth_providers: (authUser?.providerData || []).map((provider) => provider.providerId).join(", "),
    account_has_name: Boolean(user.name),
    sync_schema_version: 1,
    sync_last_attempt_at: new Date().toISOString(),
  };
  // Customer.io rejects an empty/invalid email attribute. Legacy imported
  // profiles can still sync by their stable Firebase UID until they claim the
  // profile and add a real address.
  if (EMAIL_PATTERN.test(email)) attributes.email = email;
  if (name) attributes.name = name;

  if (role === "expert") {
    const expertId = text(user.expertId, 200) || uid;
    const [profileSnap, documentSnap, showcaseSnap] = await Promise.all([
      db.collection("expertProfiles").doc(expertId).get(),
      db.collection("expertDocuments").where("ownerUid", "==", uid).get(),
      db.collection("expertShowcases").where("expertId", "==", expertId).get(),
    ]);

    const profile = { id: expertId, ...(profileSnap.data() || {}) } as ExpertProfile;
    const detail = completenessDetail(profile);
    const documents = documentSnap.docs.map((doc) => doc.data());
    const showcases = showcaseSnap.docs.map((doc) => doc.data());
    const approvedShowcases = showcases.filter((item) => item.reviewState === "APPROVED").length;
    const pendingShowcases = showcases.filter((item) => item.reviewState === "PENDING").length;
    const hasCv = documents.some((item) => item.kind === "cv");
    const missing = [
      ...detail.gaps,
      ...(!hasCv ? ["CV"] : []),
      ...(showcases.length === 0 ? ["Showcase"] : []),
    ];

    Object.assign(attributes, {
      expert_id: expertId,
      expert_profile_status: text(profile.status, 80) || "DRAFT",
      expert_verified: Boolean(profile.verified),
      expert_profile_completeness_pct: detail.pct,
      expert_profile_complete: missing.length === 0,
      expert_missing_properties: missing.join(", ").slice(0, 1000),
      expert_title: text(profile.title, 200),
      expert_description: text(profile.bio),
      expert_has_description: Boolean(profile.bio && profile.bio.length > 80),
      expert_has_photo: Boolean(profile.photoUrl),
      expert_photo_status: text(profile.photoStatus, 80),
      expert_has_cv: hasCv,
      expert_document_count: documents.length,
      expert_has_showcase: showcases.length > 0,
      expert_showcase_count: showcases.length,
      expert_approved_showcase_count: approvedShowcases,
      expert_pending_showcase_count: pendingShowcases,
      expert_skills: list(profile.skills),
      expert_integrations: list(profile.integrations),
      expert_languages: list(profile.languages),
      expert_location: text(profile.location, 200),
      expert_country: text(profile.country, 120),
      expert_timezone: text(profile.timezone, 80),
      expert_availability: text(profile.availability, 120),
      expert_hourly_rate: Number(profile.hourlyRate || 0),
      expert_currency: text(profile.currency, 16) || "EUR",
      expert_years_experience: Number(profile.yearsExperience || 0),
      expert_hours_per_week: Number(profile.hoursPerWeek || 0),
      expert_updated_at: text(profile.updatedAt, 80),
    });
  }

  if (role === "client") {
    const clientSnap = await db.collection("clientProfiles").doc(uid).get();
    const client = clientSnap.data() || {};
    const missing = clientProfileGaps(client as Partial<ClientProfile>);

    Object.assign(attributes, {
      client_company_name: text(client.companyName, 200),
      client_company_website: text(client.website, 300),
      client_billing_country: text(client.billingCountry, 120),
      client_description: text(client.description),
      client_onboarding_complete: missing.length === 0,
      client_missing_properties: missing.join(", "),
      client_updated_at: text(client.updatedAt, 80),
    });
  }

  const relationshipField = role === "expert" ? "expertUid" : "clientId";
  const [jobsSnap, proposalsSnap, contractsSnap, messagesSnap, notificationsSnap] = await Promise.all([
    role === "client"
      ? db.collection("jobs").where("clientId", "==", uid).limit(500).get()
      : Promise.resolve(null),
    db.collection("proposals").where(relationshipField, "==", uid).limit(500).get(),
    db.collection("contracts").where(relationshipField, "==", uid).limit(500).get(),
    db.collection("contractMessages").where("authorUid", "==", uid).limit(500).get(),
    db.collection("notifications").where("recipientUid", "==", uid).limit(500).get(),
  ]);
  const proposals = proposalsSnap.docs.map((doc) => doc.data());
  const contracts = contractsSnap.docs.map((doc) => doc.data());
  const notifications = notificationsSnap.docs.map((doc) => doc.data());
  Object.assign(attributes, {
    marketplace_proposal_count: proposals.length,
    marketplace_submitted_proposal_count: proposals.filter((item) => item.status === "SUBMITTED").length,
    marketplace_accepted_proposal_count: proposals.filter((item) => item.status === "ACCEPTED").length,
    marketplace_contract_count: contracts.length,
    marketplace_active_contract_count: contracts.filter((item) => item.status === "ACTIVE").length,
    marketplace_completed_contract_count: contracts.filter((item) => item.status === "COMPLETED").length,
    messaging_sent_count: messagesSnap.size,
    messaging_notification_count: notifications.length,
    messaging_unread_notification_count: notifications.filter((item) => !item.readAt).length,
  });
  if (jobsSnap) {
    const jobs = jobsSnap.docs.map((doc) => doc.data());
    Object.assign(attributes, {
      client_job_count: jobs.length,
      client_open_job_count: jobs.filter((item) => item.status === "OPEN").length,
      client_filled_job_count: jobs.filter((item) => item.status === "FILLED").length,
    });
  }

  try {
    await identifyCustomer(uid, attributes);
    if (eventName) await trackCustomerEvent(uid, eventName, { role });
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    console.error("Customer.io marketplace sync failed", reason);
    if (enqueueOnFailure) {
      await enqueueTask(`profile_${uid}`, { kind: "profile_sync", uid, eventName }, reason);
    }
    return false;
  }
}

/** Drain durable failures. Safe to call repeatedly; completed records remain as an audit trail. */
export async function drainCustomerIoOutbox(limit = 50): Promise<{ processed: number; failed: number }> {
  const db = adminDb();
  const snap = await db.collection("customerioOutbox").where("status", "==", "PENDING").limit(limit).get();
  let processed = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const task = doc.data() as CustomerIoOutboxTask & { attempts?: number };
    try {
      if (task.kind === "profile_sync") {
        const ok = await syncMarketplaceUser(task.uid, task.eventName, false);
        if (!ok) throw new Error("Profile sync failed");
      } else if (task.kind === "transactional_notification" && task.notification) {
        await sendTransactionalNotification(task.uid, task.notification);
      } else {
        throw new Error("Invalid Customer.io outbox task");
      }
      await doc.ref.set({ status: "COMPLETED", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      processed += 1;
    } catch (error) {
      failed += 1;
      await doc.ref.set({
        attempts: Number(task.attempts || 0) + 1,
        lastError: (error instanceof Error ? error.message : "Unknown error").slice(0, 500),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  }

  return { processed, failed };
}

export async function syncAllMarketplaceUsers(): Promise<{ synced: number; failed: number }> {
  const snap = await adminDb().collection("users").get();
  let synced = 0;
  let failed = 0;

  for (let index = 0; index < snap.docs.length; index += 10) {
    const batch = snap.docs.slice(index, index + 10);
    const results = await Promise.all(
      batch.map((doc) => syncMarketplaceUser(doc.id, "customerio_profile_backfilled")),
    );
    synced += results.filter(Boolean).length;
    failed += results.filter((result) => !result).length;
  }

  return { synced, failed };
}
