import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ClientProfile } from "@/lib/types";

/**
 * The gaps a client is chased about, named once.
 *
 * Customer.io mirrors these labels into `client_missing_properties` and its
 * campaigns read them back to people verbatim ("Still missing: Company name,
 * Billing country, Description"). Deriving the in-app prompts from the same
 * list keeps the email and the form from ever naming different fields.
 */
export function clientProfileGaps(profile: Partial<ClientProfile> | null | undefined): string[] {
  const p = profile || {};
  return [
    ...(!p.companyName ? ["Company name"] : []),
    ...(!p.billingCountry ? ["Billing country"] : []),
    ...(!p.description ? ["Description"] : []),
  ];
}

export function clientProfileComplete(profile: Partial<ClientProfile> | null | undefined): boolean {
  return clientProfileGaps(profile).length === 0;
}

export async function clientProfileForUid(uid: string): Promise<ClientProfile | null> {
  if (!firebaseAdminConfigured || !uid) return null;
  const snap = await adminDb().collection("clientProfiles").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as ClientProfile;
}
