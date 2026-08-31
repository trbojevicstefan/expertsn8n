/**
 * Seeds developer candidates who applied by email into Firestore, mints a
 * one-time claim code for each, and writes the operator sheet.
 *
 * INCREMENTAL BY DESIGN. Codes have already been sent out and profiles have
 * already been claimed and edited, so a re-run must never:
 *   - overwrite an existing expertProfiles document, or
 *   - mint a new code for an email that already has one.
 * Candidates already present in Firestore are left untouched and their existing
 * code is carried over from the previous sheet.
 *
 *   node --experimental-strip-types scripts/seed-candidates.mjs
 *
 * Env:
 *   GCP_PROJECT   target project id (default: studio-7677538569-60fbd)
 *   ACCESS_TOKEN  OAuth token (default: `gcloud auth print-access-token`)
 *   SHEET_DIR     where the sheet lives (default: the user's Downloads)
 *   APP_URL       base url used in the sheet links
 *   DRY_RUN=1     print the plan and skip all writes
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { seedCandidates } from "../src/lib/seed/candidates.ts";
import { generateClaimCode, hashClaimCode, normalizeEmail } from "../src/lib/claim-code.ts";

const PROJECT = process.env.GCP_PROJECT || "studio-7677538569-60fbd";
const DRY_RUN = process.env.DRY_RUN === "1";
const SHEET_DIR = process.env.SHEET_DIR || path.join(homedir(), "Downloads");
const APP_URL = process.env.APP_URL || "https://n8nexperts.io";
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`;

const CSV_PATH = path.join(SHEET_DIR, "n8nexperts-claim-codes.csv");
const MD_PATH = path.join(SHEET_DIR, "n8nexperts-claim-codes.md");

// A dry run still reads live state — that is the whole point of it — and only
// skips the writes.
const accessToken = process.env.ACCESS_TOKEN
  || execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", shell: true }).trim();

const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "x-goog-user-project": PROJECT,
};

/* ---------- Firestore value encoding ---------- */

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Cannot encode value of type ${typeof value}`);
}

function encodeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = encode(v);
  return fields;
}

function docWrite(collection, id, data) {
  return { update: { name: `${DOC_ROOT}/${collection}/${id}`, fields: encodeFields(data) } };
}

/* ---------- reading existing state ---------- */

async function existingProfileIds() {
  const ids = new Set();
  let pageToken = "";
  do {
    const url = `${BASE}/expertProfiles?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`list expertProfiles failed (${res.status})`);
    const body = await res.json();
    for (const d of body.documents || []) ids.add(d.name.split("/").pop());
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return ids;
}

/** email -> code, recovered from the previous sheet so live codes survive. */
function previousCodes() {
  if (!existsSync(CSV_PATH)) return new Map();
  const text = readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const map = new Map();
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    // Name,Email,Claim code,... — none of the first three fields are quoted.
    const [, email, code] = line.split(",");
    if (email && code) map.set(normalizeEmail(email), code.trim());
  }
  return map;
}

/* ---------- sheet ---------- */

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeSheet(rows) {
  const header = ["Name", "Email", "Claim code", "Profile URL", "Slug", "Country", "Documents on file", "Missing fields"];
  const csv = [header, ...rows.map((r) => [r.name, r.email, r.code, r.url, r.slug, r.country, r.documents, r.missing])]
    .map((cols) => cols.map(csvCell).join(","))
    .join("\r\n");
  writeFileSync(CSV_PATH, "﻿" + csv, "utf8");

  const md = [
    "# n8nexperts — claim codes",
    "",
    `Generated ${new Date().toISOString()}`,
    "",
    `Claim page: ${APP_URL}/claim`,
    "",
    "Each person enters their email address and the code below, then connects a Google account",
    "(or sets a password) to take ownership of their profile. Each code works once.",
    "",
    "| Name | Email | Claim code | Profile |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.name} | ${r.email} | \`${r.code}\` | ${r.url} |`),
    "",
  ].join("\n");
  writeFileSync(MD_PATH, md, "utf8");
}

/* ---------- main ---------- */

async function main() {
  const already = await existingProfileIds();
  const carried = previousCodes();
  const now = new Date().toISOString();

  const writes = [];
  const rows = [];
  const created = [];
  const skipped = [];

  for (const c of seedCandidates) {
    const email = normalizeEmail(c.email);
    const isNew = !already.has(c.id);

    if (!isNew) {
      // Leave the live document completely alone — it may be claimed and edited.
      const code = carried.get(email);
      skipped.push(c.name + (code ? "" : " (no code in previous sheet!)"));
      rows.push(sheetRow(c, code || "(unknown — not in previous sheet)"));
      continue;
    }

    const code = generateClaimCode();
    const claimId = createHash("sha256").update(email).digest("hex").slice(0, 32);
    created.push(c.name);

    writes.push(docWrite("expertProfiles", c.id, {
      slug: c.slug, name: c.name, title: c.title, bio: c.bio,
      location: c.location, country: c.country, timezone: c.timezone,
      photoUrl: "", skills: c.skills, integrations: c.integrations,
      hourlyRate: c.hourlyRate, currency: "EUR", availability: c.availability,
      rating: 0, reviewCount: 0, completedProjects: 0,
      verified: false, status: "PUBLISHED", badges: [], links: c.links,
      source: "application", photoStatus: "MISSING",
      claimState: "UNCLAIMED", claimedByUid: null, claimedAt: null,
      missingFields: c.missing, createdAt: now, updatedAt: now,
    }));

    writes.push(docWrite("expertPrivate", c.id, {
      email, documentsOnFile: c.documents,
      seededFrom: "team@n8nlab.io application mailbox", seededAt: now,
    }));

    writes.push(docWrite("claimCodes", claimId, {
      expertId: c.id, email, codeHash: hashClaimCode(code),
      used: false, createdAt: now, usedAt: null, usedByUid: null, usedByEmail: null,
    }));

    rows.push(sheetRow(c, code));
  }

  console.log(`Existing, left untouched (${skipped.length}):`);
  for (const s of skipped) console.log("   ", s);
  console.log(`\nNew, seeded (${created.length}):`);
  for (const s of created) console.log("   ", s);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] would apply ${writes.length} writes and rewrite the sheet with ${rows.length} rows.`);
    return;
  }

  for (let i = 0; i < writes.length; i += 400) {
    const res = await fetch(`${BASE}:commit`, {
      method: "POST", headers, body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
    });
    if (!res.ok) throw new Error(`commit failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  mkdirSync(SHEET_DIR, { recursive: true });
  writeSheet(rows);

  console.log(`\nWrote ${writes.length} documents.`);
  console.log(`Sheet: ${CSV_PATH}`);
  console.log(`Sheet: ${MD_PATH}`);
}

function sheetRow(c, code) {
  return {
    name: c.name,
    email: c.email,
    code,
    url: `${APP_URL}/experts/${c.slug}`,
    slug: c.slug,
    country: c.country || "(not stated)",
    documents: c.documents.join(" | ") || "(none)",
    missing: c.missing.join(" | "),
  };
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
