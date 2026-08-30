import { createHash } from "node:crypto";

export const CLAIM_COOKIE = "n8nexperts_claim";
export const CLAIM_TTL_MS = 30 * 60 * 1000;

/** Claim records are keyed by a hash of the email so no address appears in a
 *  document path and the lookup stays a direct get with no index. */
export function claimDocId(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 32);
}

export function claimSessionDocId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}
