/**
 * Seeds the 22 developer candidates who applied by email into Firestore,
 * mints a one-time claim code for each, and writes the operator sheet.
 *
 * Uses the Firestore REST API with a gcloud access token so no service-account
 * key file has to exist on disk.
 *
 *   node --experimental-strip-types scripts/seed-candidates.mjs
 *
 * Env:
 *   GCP_PROJECT     target project id (default: studio-7677538569-60fbd)
 *   ACCESS_TOKEN    OAuth token (default: `gcloud auth print-access-token`)
 *   SHEET_DIR       where to write the sheet (default: the user's Downloads)
 *   DRY_RUN=1       print what would be written and skip the API calls
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { seedCandidates } from "../src/lib/seed/candidates.ts";
import { generateClaimCode, hashClaimCode, normalizeEmail } from "../src/lib/claim-code.ts";

const PROJECT = process.env.GCP_PROJECT || "studio-7677538569-60fbd";
const DRY_RUN = process.env.DRY_RUN === "1";
const SHEET_DIR = process.env.SHEET_DIR || path.join(homedir(), "Downloads");
/** Resource path used inside request bodies — must not carry the API host. */
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`;

function token() {
  if (process.env.ACCESS_TOKEN) return process.env.ACCESS_TOKEN;
  return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", shell: true }).trim();
}

/* ---------- Firestore value encoding ---------- */

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value) } };
  }
  throw new Error(`Cannot encode value of type ${typeof value}`);
}

function encodeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = encode(v);
  return fields;
}

/* ---------- writes ---------- */

async function commit(writes, accessToken) {
  if (DRY_RUN) return;
  const res = await fetch(`${BASE}:commit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": PROJECT,
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    throw new Error(`Firestore commit failed (${res.status}): ${(await res.text()).slice(0, 600)}`);
  }
}

function docWrite(collection, id, data) {
  return {
    update: { name: `${DOC_ROOT}/${collection}/${id}`, fields: encodeFields(data) },
  };
}

/* ---------- sheet ---------- */

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(rows) {
  const header = ["Name", "Email", "Claim code", "Profile URL", "Slug", "Country", "Documents on file", "Missing fields"];
  return [header, ...rows.map((r) => [r.name, r.email, r.code, r.url, r.slug, r.country, r.documents, r.missing])]
    .map((cols) => cols.map(csvCell).join(","))
    .join("\r\n");
}

/* ---------- main ---------- */

async function main() {
  const accessToken = DRY_RUN ? "" : token();
  const appUrl = process.env.APP_URL || "https://n8nexperts--studio-7677538569-60fbd.us-central1.hosted.app";
  const now = new Date().toISOString();

  const writes = [];
  const rows = [];

  for (const c of seedCandidates) {
    const code = generateClaimCode();
    const email = normalizeEmail(c.email);
    // Doc id is a hash of the email so the claim lookup is a direct get and
    // needs no composite index (and no email appears in a document path).
    const claimId = createHash("sha256").update(email).digest("hex").slice(0, 32);

    writes.push(
      docWrite("expertProfiles", c.id, {
        slug: c.slug,
        name: c.name,
        title: c.title,
        bio: c.bio,
        location: c.location,
        country: c.country,
        timezone: c.timezone,
        photoUrl: "",
        skills: c.skills,
        integrations: c.integrations,
        hourlyRate: c.hourlyRate,
        currency: "EUR",
        availability: c.availability,
        rating: 0,
        reviewCount: 0,
        completedProjects: 0,
        // Not vetted yet — these are seeded applications, so the profile must
        // not claim marketplace verification anywhere in the UI.
        verified: false,
        status: "PUBLISHED",
        badges: [],
        links: c.links,
        source: "application",
        photoStatus: "MISSING",
        claimState: "UNCLAIMED",
        claimedByUid: null,
        claimedAt: null,
        missingFields: c.missing,
        createdAt: now,
        updatedAt: now,
      }),
    );

    writes.push(
      docWrite("expertPrivate", c.id, {
        email,
        documentsOnFile: c.documents,
        seededFrom: "team@n8nlab.io application mailbox",
        seededAt: now,
      }),
    );

    writes.push(
      docWrite("claimCodes", claimId, {
        expertId: c.id,
        email,
        codeHash: hashClaimCode(code),
        used: false,
        createdAt: now,
        usedAt: null,
        usedByUid: null,
        usedByEmail: null,
      }),
    );

    rows.push({
      name: c.name,
      email: c.email,
      code,
      url: `${appUrl}/experts/${c.slug}`,
      slug: c.slug,
      country: c.country || "(not stated)",
      documents: c.documents.join(" | ") || "(none)",
      missing: c.missing.join(" | "),
    });
  }

  // Firestore commits cap at 500 writes; 66 fits, but chunk anyway.
  for (let i = 0; i < writes.length; i += 400) {
    await commit(writes.slice(i, i + 400), accessToken);
    process.stdout.write(`  committed ${Math.min(i + 400, writes.length)}/${writes.length} writes\n`);
  }

  mkdirSync(SHEET_DIR, { recursive: true });
  const csvPath = path.join(SHEET_DIR, "n8nexperts-claim-codes.csv");
  writeFileSync(csvPath, "﻿" + buildCsv(rows), "utf8");

  const mdPath = path.join(SHEET_DIR, "n8nexperts-claim-codes.md");
  const md = [
    "# n8nexperts — claim codes",
    "",
    `Generated ${now}`,
    "",
    `Claim page: ${appUrl}/claim`,
    "",
    "Each person enters their email address and the code below, then connects a Google account",
    "(or sets a password) to take ownership of their profile. Each code works once.",
    "",
    "| Name | Email | Claim code | Profile |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.name} | ${r.email} | \`${r.code}\` | ${r.url} |`),
    "",
  ].join("\n");
  writeFileSync(mdPath, md, "utf8");

  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Seeded ${seedCandidates.length} candidates.`);
  console.log(`Sheet: ${csvPath}`);
  console.log(`Sheet: ${mdPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
