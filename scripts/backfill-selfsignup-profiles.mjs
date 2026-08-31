/**
 * One-off repair for expert profiles created by the onboarding form before it
 * wrote the full profile shape. Those documents are keyed by Firebase uid and
 * carry a headline and bio but no name or slug, so they cannot be published
 * without the directory rendering a nameless card.
 *
 * Reads the display name from users/{uid} and fills in the missing fields.
 *
 *   node scripts/backfill-selfsignup-profiles.mjs
 *   DRY_RUN=1 node scripts/backfill-selfsignup-profiles.mjs
 */
import { execFileSync } from "node:child_process";

const PROJECT = process.env.GCP_PROJECT || "studio-7677538569-60fbd";
const DRY_RUN = process.env.DRY_RUN === "1";
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`;

const token = process.env.ACCESS_TOKEN
  || execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", shell: true }).trim();

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "x-goog-user-project": PROJECT,
};

const str = (f, k) => f?.[k]?.stringValue ?? "";

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const { documents = [] } = await getJson(`${BASE}/expertProfiles?pageSize=300`);
  const broken = documents.filter((d) => !str(d.fields, "name") || !str(d.fields, "slug"));

  if (broken.length === 0) {
    console.log("Nothing to backfill — every profile has a name and slug.");
    return;
  }

  const takenSlugs = new Set(documents.map((d) => str(d.fields, "slug")).filter(Boolean));
  const writes = [];

  for (const doc of broken) {
    const uid = doc.name.split("/").pop();
    let displayName = "";
    let nameIsReal = false;
    try {
      const user = await getJson(`${BASE}/users/${uid}`);
      displayName = str(user.fields, "name");
      nameIsReal = Boolean(displayName);
      // No display name on the account — an email prefix is a placeholder, not
      // a name, so the profile gets flagged for the reviewer to correct.
      if (!displayName) displayName = str(user.fields, "email").split("@")[0];
    } catch {
      // No user record; fall back to something stable rather than guessing.
    }
    if (!displayName) displayName = `Expert ${uid.slice(0, 6)}`;

    let slug = slugify(displayName) || `expert-${uid.slice(0, 6).toLowerCase()}`;
    let n = 1;
    while (takenSlugs.has(slug)) slug = `${slugify(displayName)}-${++n}`;
    takenSlugs.add(slug);

    const f = doc.fields || {};
    const nowIso = new Date().toISOString();

    const missing = [...(nameIsReal ? [] : ["name"]), "photo"];
    console.log(`  ${uid} -> name "${displayName}"${nameIsReal ? "" : " (derived, flagged)"}, slug "${slug}"`);

    writes.push({
      update: {
        name: `${DOC_ROOT}/expertProfiles/${uid}`,
        fields: {
          name: { stringValue: displayName },
          slug: { stringValue: slug },
          // The form stored the headline; the profile shape calls it title.
          title: { stringValue: str(f, "title") || str(f, "headline") },
          country: { stringValue: str(f, "country") },
          photoUrl: { stringValue: str(f, "photoUrl") },
          currency: { stringValue: str(f, "currency") || "EUR" },
          availability: { stringValue: str(f, "availability") },
          rating: { integerValue: "0" },
          reviewCount: { integerValue: "0" },
          completedProjects: { integerValue: "0" },
          badges: { arrayValue: { values: [] } },
          links: { arrayValue: { values: [] } },
          integrations: f.integrations || { arrayValue: { values: [] } },
          source: { stringValue: "self-signup" },
          photoStatus: { stringValue: "PENDING_REVIEW" },
          claimState: { stringValue: "CLAIMED" },
          claimedByUid: { stringValue: uid },
          claimedAt: { stringValue: nowIso },
          missingFields: { arrayValue: { values: missing.map((m) => ({ stringValue: m })) } },
          updatedAt: { stringValue: nowIso },
        },
      },
      updateMask: {
        fieldPaths: [
          "name", "slug", "title", "country", "photoUrl", "currency", "availability",
          "rating", "reviewCount", "completedProjects", "badges", "links", "integrations",
          "source", "photoStatus", "claimState", "claimedByUid", "claimedAt",
          "missingFields", "updatedAt",
        ],
      },
    });

    // Link the profile back to the account so the dashboard can find it.
    writes.push({
      update: {
        name: `${DOC_ROOT}/users/${uid}`,
        fields: { expertId: { stringValue: uid } },
      },
      updateMask: { fieldPaths: ["expertId"] },
    });
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] would apply ${writes.length} writes for ${broken.length} profile(s).`);
    return;
  }

  const res = await fetch(`${BASE}:commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`commit failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  console.log(`\nBackfilled ${broken.length} profile(s).`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
