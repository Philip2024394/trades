// Kitchen Brain Image Audit (Philip 2026-08-01 · read-heavy · write only to Working)
//
// Reviews every entry in data/nex-image-manifest.json against existing metadata
// (subject_domain · tags · description · original_prompt · notes · title).
// Classifies each URL as one of:
//   - staircase_confirmed  → already in the Staircase Visual Brain · skip
//   - kitchen_candidate    → clearly kitchen-related · NOT any staircase signal · WRITE to Kitchen Working Library
//   - ambiguous_review     → BOTH kitchen AND staircase signals · WRITE to Ambiguous Review list · Philip decides
//   - no_metadata          → tags empty AND description missing/generic
//   - unclassified         → has metadata but no kitchen signal · default state · not moved
//
// STRICT RULES (Philip 2026-08-01):
//   - No AI vision inference · metadata only
//   - No modifications to any staircase record
//   - No writes to Confirmed Kitchen Library
//   - Writes ONLY to data/nex-kitchen-brain/working/ and data/nex-kitchen-brain/pending-review/

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const MANIFEST_PATH = join(cwd, "data/nex-image-manifest.json");
const STAIRCASE_CONFIRMED_PATH = join(cwd, "data/nex-confirmed-images.json");
const KITCHEN_CONFIRMED_PATH = join(cwd, "data/nex-kitchen-confirmed-images.json");
const KITCHEN_WORKING_PATH = join(cwd, "data/nex-kitchen-brain/working/working-images.json");
const AMBIGUOUS_PATH = join(cwd, "data/nex-kitchen-brain/pending-review/ambiguous-review.json");

// ─── Load ─────────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const staircase = JSON.parse(readFileSync(STAIRCASE_CONFIRMED_PATH, "utf8"));
const kitchen   = JSON.parse(readFileSync(KITCHEN_CONFIRMED_PATH, "utf8"));

const staircaseConfirmedUrls = new Set();
for (const r of staircase.confirmed) {
  staircaseConfirmedUrls.add(r.url);
  if (Array.isArray(r.additional_views)) for (const v of r.additional_views) staircaseConfirmedUrls.add(v);
}
const kitchenConfirmedUrls = new Set();
for (const r of kitchen.confirmed) {
  kitchenConfirmedUrls.add(r.url);
  if (Array.isArray(r.additional_views)) for (const v of r.additional_views) kitchenConfirmedUrls.add(v);
}

// ─── Keyword sets ─────────────────────────────────────────────────
// Kitchen keywords. NOTE: "island" is deliberately excluded from this list
// because it also appears in staircase contexts ("island staircase"). It's
// only credited as a kitchen signal when it co-occurs with another kitchen
// keyword (see scoring below).

const KITCHEN_KEYWORDS = [
  "kitchen", "kitchens", "kitchenette",
  "cabinet", "cabinets", "cabinetry",
  "worktop", "worktops", "countertop", "countertops",
  "hob", "hobs", "cooker", "cookers", "oven", "ovens",
  "dishwasher", "dishwashers", "fridge", "fridges", "refrigerator", "refrigerators",
  "freezer", "freezers", "microwave",
  "extractor hood", "cooker hood", "range hood", "range cooker",
  "pantry", "larder", "backsplash", "splashback",
  "galley kitchen", "shaker kitchen", "handleless kitchen",
  "kitchen appliance", "kitchen appliances",
  "belfast sink", "butler sink", "undermount sink",
];

// Only accept "island" as kitchen if any of these appear too.
const ISLAND_KITCHEN_ANCHORS = [
  "kitchen", "cabinet", "worktop", "cooker", "hob", "oven",
  "seating", "breakfast bar", "pendant", "dining",
];

// Staircase keywords (to detect mixed-content images).
const STAIRCASE_KEYWORDS = [
  "staircase", "stairs", "stair", "stairway", "stairwell",
  "step", "steps", "tread", "treads", "riser", "risers",
  "newel", "newels", "baluster", "balusters", "balustrade", "balustrades",
  "handrail", "handrails", "banister", "banisters",
  "string", "stringer", "stringers", "spindle", "spindles",
  "flight", "flights", "landing", "helical", "spiral", "cantilever",
];

// ─── Utility ──────────────────────────────────────────────────────
function textBlob(entry) {
  const parts = [
    entry.subject_domain,
    entry.description,
    entry.original_prompt,
    entry.notes,
    entry.master_ai_prompt,
    entry.title,
    Array.isArray(entry.tags) ? entry.tags.join(" ") : "",
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function hasKeyword(blob, list) {
  return list.some((k) => blob.includes(k));
}

function kitchenSignal(entry, blob) {
  const domainHit = (entry.subject_domain || "").toLowerCase() === "kitchen";
  const tagHit = Array.isArray(entry.tags) && entry.tags.some((t) => KITCHEN_KEYWORDS.includes(String(t).toLowerCase()));
  const textHit = hasKeyword(blob, KITCHEN_KEYWORDS);
  // Standalone "island" only counts as kitchen if anchored by another kitchen keyword.
  const islandBare = /\bislands?\b/.test(blob) && !hasKeyword(blob, ISLAND_KITCHEN_ANCHORS);
  const islandAnchored = /\bislands?\b/.test(blob) && hasKeyword(blob, ISLAND_KITCHEN_ANCHORS);
  return domainHit || tagHit || textHit || islandAnchored ? { hit: true, islandBare: false }
       : islandBare ? { hit: false, islandBare: true }
       : { hit: false, islandBare: false };
}

function staircaseSignal(entry, blob) {
  const domainHit = (entry.subject_domain || "").toLowerCase() === "staircase";
  const tagHit = Array.isArray(entry.tags) && entry.tags.some((t) => STAIRCASE_KEYWORDS.includes(String(t).toLowerCase()));
  const textHit = hasKeyword(blob, STAIRCASE_KEYWORDS);
  return domainHit || tagHit || textHit;
}

function hasUsableMetadata(entry) {
  const tags = Array.isArray(entry.tags) && entry.tags.length > 0;
  const desc = typeof entry.description === "string" && entry.description.trim().length > 20;
  const prompt = typeof entry.original_prompt === "string" && entry.original_prompt.trim().length > 20 &&
                 !/unknown/i.test(entry.original_prompt);
  const domain = typeof entry.subject_domain === "string" && entry.subject_domain.trim().length > 0;
  return tags || desc || prompt || domain;
}

function reasonFor(entry, blob) {
  const reasons = [];
  if ((entry.subject_domain || "").toLowerCase() === "kitchen") reasons.push(`subject_domain="kitchen"`);
  if (Array.isArray(entry.tags)) {
    const kt = entry.tags.filter((t) => KITCHEN_KEYWORDS.includes(String(t).toLowerCase()));
    if (kt.length) reasons.push(`tags: ${kt.join(", ")}`);
  }
  const kwHits = KITCHEN_KEYWORDS.filter((k) => blob.includes(k));
  if (kwHits.length) reasons.push(`keywords in text: ${[...new Set(kwHits)].slice(0, 6).join(", ")}`);
  if (/\bislands?\b/.test(blob) && hasKeyword(blob, ISLAND_KITCHEN_ANCHORS)) {
    reasons.push(`"island" anchored by kitchen context`);
  }
  return reasons.join(" · ") || "kitchen signal present in metadata";
}

// ─── Classify ─────────────────────────────────────────────────────
const audit = {
  total: 0,
  staircase_confirmed: 0,
  kitchen_confirmed: 0,
  kitchen_candidates: [],
  ambiguous: [],
  no_metadata: 0,
  unclassified: 0,
};

for (const [url, entry] of Object.entries(manifest.images)) {
  audit.total += 1;
  if (staircaseConfirmedUrls.has(url)) { audit.staircase_confirmed += 1; continue; }
  if (kitchenConfirmedUrls.has(url))   { audit.kitchen_confirmed   += 1; continue; }

  const blob = textBlob(entry);
  const ks = kitchenSignal(entry, blob);
  const ss = staircaseSignal(entry, blob);

  if (ks.hit && ss) {
    audit.ambiguous.push({
      url,
      title:       entry.title ?? null,
      tags:        entry.tags ?? [],
      description: entry.description ?? null,
      subject_domain: entry.subject_domain ?? null,
      reason:      `both kitchen and staircase signals present · ${reasonFor(entry, blob)} · staircase signal: ${STAIRCASE_KEYWORDS.filter((k) => blob.includes(k)).slice(0,5).join(", ") || "domain=staircase"}`,
    });
  } else if (ks.hit) {
    audit.kitchen_candidates.push({
      url,
      title:       entry.title ?? null,
      tags:        entry.tags ?? [],
      description: entry.description ?? null,
      subject_domain: entry.subject_domain ?? null,
      reason:      reasonFor(entry, blob),
    });
  } else if (!hasUsableMetadata(entry)) {
    audit.no_metadata += 1;
  } else {
    audit.unclassified += 1;
  }
}

// ─── Write Working Library (kitchen candidates) ───────────────────
const now = new Date().toISOString();
const workingLib = JSON.parse(readFileSync(KITCHEN_WORKING_PATH, "utf8"));
const existingUrls = new Set((workingLib.images || []).map((i) => i.url));

let addedToWorking = 0;
for (const c of audit.kitchen_candidates) {
  if (existingUrls.has(c.url)) continue;
  workingLib.images.push({
    id:           `NEX-KITCHEN-WORKING-${String(workingLib.images.length + 1).padStart(6, "0")}`,
    url:          c.url,
    source:       "metadata_audit_2026_08_01",
    added_at:     now,
    existing_metadata: {
      title:          c.title,
      tags:           c.tags,
      description:    c.description,
      subject_domain: c.subject_domain,
    },
    classification_reason: c.reason,
    notes:        "Auto-classified as Kitchen Brain candidate by metadata audit. Not yet reviewed. Not customer-visible. Awaiting Philip's manual review before promotion to Confirmed Kitchen Library.",
  });
  addedToWorking += 1;
}
workingLib.updated_at = now;
writeFileSync(KITCHEN_WORKING_PATH, JSON.stringify(workingLib, null, 2), "utf8");

// ─── Write Ambiguous Review list ──────────────────────────────────
const ambiguousLib = {
  version: 1,
  brain: "kitchen",
  bucket: "ambiguous_review",
  purpose: "Images with BOTH kitchen and staircase signals in existing metadata. Philip decides brain assignment. Never customer-visible until Philip's decision. Created 2026-08-01 by scripts/kitchen-brain-metadata-audit.mjs.",
  isolation_note: "ADR-0033 · scaffold only · not queried by any live path.",
  updated_at: now,
  images: audit.ambiguous.map((a, i) => ({
    id:           `NEX-KITCHEN-AMBIG-${String(i + 1).padStart(6, "0")}`,
    url:          a.url,
    added_at:     now,
    existing_metadata: {
      title:          a.title,
      tags:           a.tags,
      description:    a.description,
      subject_domain: a.subject_domain,
    },
    classification_reason: a.reason,
    decision_pending: true,
    notes:        "Image contains BOTH kitchen and staircase signals in existing metadata (e.g. open-plan kitchen with staircase visible). Philip decides brain assignment. Do not classify automatically.",
  })),
};
writeFileSync(AMBIGUOUS_PATH, JSON.stringify(ambiguousLib, null, 2), "utf8");

// ─── Report ───────────────────────────────────────────────────────
console.log("━".repeat(70));
console.log("KITCHEN BRAIN IMAGE AUDIT · " + now);
console.log("━".repeat(70));
console.log("");
console.log(`Total images audited              : ${audit.total}`);
console.log(`Staircase images already confirmed: ${audit.staircase_confirmed}`);
console.log(`Kitchen images already confirmed  : ${audit.kitchen_confirmed}`);
console.log(`Kitchen candidates found          : ${audit.kitchen_candidates.length}  (WRITTEN to Working Library · +${addedToWorking} new)`);
console.log(`Ambiguous (kitchen + staircase)   : ${audit.ambiguous.length}  (WRITTEN to Ambiguous Review · Philip decides)`);
console.log(`No usable metadata                : ${audit.no_metadata}  (skipped)`);
console.log(`Unclassified (metadata · non-kitchen): ${audit.unclassified}  (skipped)`);
console.log("");
console.log(`Reconciliation: ${audit.staircase_confirmed + audit.kitchen_confirmed + audit.kitchen_candidates.length + audit.ambiguous.length + audit.no_metadata + audit.unclassified} / ${audit.total}`);
console.log("");

if (audit.kitchen_candidates.length) {
  console.log("━".repeat(70));
  console.log(`KITCHEN CANDIDATES (${audit.kitchen_candidates.length})`);
  console.log("━".repeat(70));
  for (const c of audit.kitchen_candidates) {
    console.log("");
    console.log(`URL   : ${c.url}`);
    console.log(`TITLE : ${c.title || "(none)"}`);
    console.log(`TAGS  : ${(c.tags || []).join(", ") || "(none)"}`);
    console.log(`DESC  : ${String(c.description || "(none)").slice(0, 200)}${c.description && c.description.length > 200 ? "…" : ""}`);
    console.log(`DOMAIN: ${c.subject_domain || "(none)"}`);
    console.log(`REASON: ${c.reason}`);
  }
}

if (audit.ambiguous.length) {
  console.log("");
  console.log("━".repeat(70));
  console.log(`AMBIGUOUS REVIEW (${audit.ambiguous.length}) · Philip decides`);
  console.log("━".repeat(70));
  for (const a of audit.ambiguous) {
    console.log("");
    console.log(`URL   : ${a.url}`);
    console.log(`TITLE : ${a.title || "(none)"}`);
    console.log(`TAGS  : ${(a.tags || []).join(", ") || "(none)"}`);
    console.log(`DESC  : ${String(a.description || "(none)").slice(0, 200)}${a.description && a.description.length > 200 ? "…" : ""}`);
    console.log(`DOMAIN: ${a.subject_domain || "(none)"}`);
    console.log(`REASON: ${a.reason}`);
  }
}

console.log("");
console.log("Files written:");
console.log(`  ${KITCHEN_WORKING_PATH.replace(cwd + "\\", "").replace(/\\/g, "/")}  (Kitchen Working Library · ${workingLib.images.length} entries total)`);
console.log(`  ${AMBIGUOUS_PATH.replace(cwd + "\\", "").replace(/\\/g, "/")}  (Ambiguous Review · ${audit.ambiguous.length} entries)`);
console.log("");
console.log("No changes to staircase records. No changes to Confirmed Kitchen Library.");
