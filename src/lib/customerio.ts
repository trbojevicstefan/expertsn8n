import { completenessDetail } from "@/lib/expert-account";
import { adminDb } from "@/lib/firebase/admin";
import type { ExpertProfile } from "@/lib/types";

type CustomerIoAttributes = Record<string, boolean | number | string | null>;

type CustomerIoEventData = Record<string, boolean | number | string | null>;

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
    throw new Error(`Customer.io Track API returned ${response.status}`);
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
  return typeof value === "string" ? value.slice(0, max) : "";
}

function list(value: unknown): string {
  return Array.isArray(value) ? value.map(String).filter(Boolean).join(", ").slice(0, 1000) : "";
}

/**
 * Mirror marketplace state into flat Customer.io attributes so campaigns can
 * segment on profile gaps without reading Firestore at send time.
 */
export async function syncMarketplaceUser(uid: string, eventName?: string): Promise<boolean> {
  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return false;

  const user = userSnap.data() || {};
  const role = user.role === "expert" ? "expert" : user.role === "admin" ? "admin" : "client";
  const attributes: CustomerIoAttributes = {
    email: text(user.email, 320),
    name: text(user.name, 160),
    role,
    account_status: text(user.status, 80) || "ACTIVE",
    account_created_at: text(user.createdAt, 80),
    last_login_at: text(user.lastLoginAt, 80),
  };

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
    const missing = [
      ...(!client.companyName ? ["Company name"] : []),
      ...(!client.billingCountry ? ["Billing country"] : []),
      ...(!client.description ? ["Description"] : []),
    ];

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

  try {
    await identifyCustomer(uid, attributes);
    if (eventName) await trackCustomerEvent(uid, eventName, { role });
    return true;
  } catch (error) {
    console.error("Customer.io marketplace sync failed", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
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
