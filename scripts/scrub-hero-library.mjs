// scrub-hero-library — clean scripts/hero-library.json of
//   (a) any "Philip" references in user-visible fields
//   (b) tag banner-style entries with is_banner:true so the Site
//       Interest inspiration feed can filter them out
//
// This is a one-shot cleanup. Safe to re-run — idempotent.
//
// Run: `node scripts/scrub-hero-library.mjs`

import fs from "node:fs";

const path = new URL("../scripts/hero-library.json", import.meta.url);
const raw  = fs.readFileSync(path, "utf8");
const data = JSON.parse(raw);

if (!Array.isArray(data.entries)) {
  console.error("[scrub] no entries[] — aborting");
  process.exit(1);
}

// Fields that get shown to end-users on the Site Interest inspiration
// feed / share overlays / merchant hero picker. Strip Philip references
// from these. `hero_use_case` is admin-only but scrub anyway for hygiene.
const USER_VISIBLE = ["subject", "hero_use_case"];

// Also scrub top-level $-prefixed metadata + any nested $note inside
// palette / other sub-objects. These are internal dev notes that never
// render, but per Philip 2026-07-17 we want zero occurrences anywhere.
function scrubTopMetadata() {
  let n = 0;
  for (const key of Object.keys(data)) {
    if (!key.startsWith("$")) continue;
    if (typeof data[key] !== "string") continue;
    if (!data[key].includes("Philip")) continue;
    data[key] = data[key].replace(/Philip's/g, "the platform's").replace(/\bPhilip\b/g, "Site Interest");
    n++;
  }
  return n;
}
function scrubEntryNested(entry) {
  let n = 0;
  for (const key of Object.keys(entry)) {
    const val = entry[key];
    if (typeof val === "string" && val.includes("Philip")) {
      entry[key] = val.replace(/Philip's/g, "the platform's").replace(/\bPhilip\b/g, "Site Interest");
      n++;
      continue;
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      for (const subKey of Object.keys(val)) {
        const sv = val[subKey];
        if (typeof sv === "string" && sv.includes("Philip")) {
          val[subKey] = sv.replace(/Philip's/g, "the platform's").replace(/\bPhilip\b/g, "Site Interest");
          n++;
        }
      }
    }
  }
  return n;
}

let philipHits = 0;
let bannerTags = 0;

// Regex patterns that mark a hero-library entry as a "banner" — i.e.
// a marketing/composite/text-overlay image that must NOT appear in
// Site Interest's inspiration browse feed. Broad on purpose.
const BANNER_SUBJECT_HINTS = [
  /^Hero banner assigned/i,
  /^User-supplied .* banner/i,
  /banner proportions/i,
  /marketing banner/i,
  /promo banner/i,
  /sign-in.*banner/i,
  /marketplace banner/i,
  /auth banner/i
];
const BANNER_ID_HINTS  = /-banner|banner-\d|^sign-in-banner/i;
const BANNER_KEYWORD   = /(marketing|promo|banner)/i;

for (const entry of data.entries) {
  // (a) Strip Philip references from any user-visible field.
  for (const key of USER_VISIBLE) {
    const val = entry[key];
    if (typeof val !== "string" || !val.includes("Philip")) continue;
    // Replace "Philip's" → "the platform's", "Philip 2026-07-11" →
    // "Site Interest 2026-07-11", and any residual "Philip" → "Site Interest".
    let cleaned = val
      .replace(/Philip's/g, "the platform's")
      .replace(/by Philip/g, "by Site Interest")
      .replace(/Philip 2026/g, "Site Interest 2026")
      .replace(/awaiting Philip's/g, "awaiting")
      .replace(/\bPhilip\b/g, "Site Interest");
    // Fallback: if any "Philip" still there, blunt-swap.
    cleaned = cleaned.replace(/Philip/g, "Site Interest");
    if (cleaned !== val) {
      entry[key] = cleaned;
      philipHits++;
    }
  }
  // Also scrub the internal $posted_by if present (legacy).
  if (typeof entry.$posted_by === "string" && entry.$posted_by.includes("Philip")) {
    entry.$posted_by = entry.$posted_by.replace(/\bPhilip\b/g, "Site Interest");
    philipHits++;
  }

  // (b) Tag banners.
  if (entry.is_banner === true) continue; // already tagged
  const subj = typeof entry.subject === "string" ? entry.subject : "";
  const id   = typeof entry.id === "string" ? entry.id : "";
  const kws  = Array.isArray(entry.keywords_strict) ? entry.keywords_strict : [];

  const looksLikeBanner =
    BANNER_SUBJECT_HINTS.some((rx) => rx.test(subj)) ||
    BANNER_ID_HINTS.test(id) ||
    kws.some((k) => typeof k === "string" && BANNER_KEYWORD.test(k));

  if (looksLikeBanner) {
    entry.is_banner = true;
    bannerTags++;
  }
}

// Nested scrub for any $note field inside sub-objects + top-level $meta.
philipHits += scrubTopMetadata();
for (const entry of data.entries) philipHits += scrubEntryNested(entry);

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`[scrub] DONE. Philip refs scrubbed: ${philipHits}. Banner tags added: ${bannerTags}.`);
