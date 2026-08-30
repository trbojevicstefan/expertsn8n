import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Claim codes are handed to candidates out of band so they can take ownership
 * of a profile that was seeded from their application email.
 *
 * Alphabet excludes I, L, O, U, 0 and 1 so a code read off a screen or a phone
 * call cannot be mistyped into a different valid code.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const GROUPS = 3;
const GROUP_LEN = 4;

export function generateClaimCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let out = "";
    for (let i = 0; i < GROUP_LEN; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(out);
  }
  return groups.join("-");
}

/** Strips formatting so "k7m3 pqr2-x9ab" and "K7M3-PQR2-X9AB" hash the same. */
export function normalizeClaimCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashClaimCode(raw: string): string {
  return createHash("sha256").update(normalizeClaimCode(raw)).digest("hex");
}

/** Constant-time compare so a wrong code cannot be narrowed down by timing. */
export function claimCodeMatches(raw: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashClaimCode(raw), "hex");
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, "hex");
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
