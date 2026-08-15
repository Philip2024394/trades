// NEX Design System Finalisation · family clustering (Philip 2026-08-14).
//
// Reads the enumerated section inventory and assigns each section to one
// of 5 proposed design families. Families are derived from telemetryTags,
// section names, and section libraries (never from a redesign — this is
// purely a clustering pass over existing metadata).
//
// Proposed 5-family scheme (locked in-session · owner to approve/rename):
//
//   1. Trust-First      · minimal, fast-load, image-optional, trust-signal focus.
//                         Best for: trades where credentials + response speed sell.
//   2. Editorial        · full-bleed photography, sophisticated typography.
//                         Best for: architectural, luxury, portfolio-led businesses.
//   3. Trade-Native     · service-area / postcode / product-grid / local utility.
//                         Best for: local trades whose USP is coverage + inventory.
//   4. Interactive      · motion-heavy, animated, video, kinetic.
//                         Best for: businesses competing on modernity + energy.
//   5. Utility & Content · every non-hero building block (services, contact, faq,
//                          gallery, pricing, features, footer, etc.). Composes
//                          INTO any of the 4 hero families.
//
// Non-negotiable: this file only tags existing sections. It does not
// redesign, does not add sections, does not remove sections.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const IN  = join(ROOT, "data", "design-system", "section-inventory.json");
const OUT = join(ROOT, "data", "design-system", "family-assignments.json");

const inv = JSON.parse(readFileSync(IN, "utf8"));

// Deterministic clustering rules — tag-based, tie-broken by first match.
// Each rule tests: tags-any, name-contains-any, id-contains-any.
// Explicit id → family mapping for the 25 hero sections. Order below
// reflects INTENT (motion-primary heroes → Interactive; photo-first →
// Editorial; local-utility → Trade-Native; trust-signal → Trust-First).
const HERO_FAMILY_BY_ID = {
  // Trust-First · minimal, image-optional, credential-forward.
  "hero.trust_anchor_1":       "Trust-First",
  "hero.trust_minimal_1":      "Trust-First",
  "hero.minimal_centred_1":    "Trust-First",
  "hero.badge_wall_1":         "Trust-First",
  "hero.stat_hero_1":          "Trust-First",  // stat-driven, no photo
  // Editorial · photo-forward, sophisticated typography.
  "hero.split_photo_left_1":   "Editorial",
  "hero.portfolio_mosaic_1":   "Editorial",
  "hero.magazine_editorial_1": "Editorial",
  "hero.product_showroom_1":   "Editorial",   // premium product tiles
  // Trade-Native · service-area, postcode, local utility, product grids.
  "hero.map_hero_1":           "Trade-Native",
  "hero.postcode_local_1":     "Trade-Native",
  "hero.plant_hire_bold_1":    "Trade-Native",
  "hero.emergency_247_1":      "Trade-Native",
  "hero.qr_poster_hero_1":     "Trade-Native",
  "hero.compare_hero_1":       "Trade-Native",
  "hero.review_wave_1":        "Trade-Native",
  "hero.chat_bubble_hero_1":   "Trade-Native",
  "hero.before_after_slider_1":"Trade-Native",
  // Interactive · motion or video is the design point.
  "hero.animated_gradient_1":  "Interactive",
  "hero.animation_hero_1":     "Interactive",
  "hero.tilt_3d_1":            "Interactive",
  "hero.cursor_spotlight_1":   "Interactive",
  "hero.marquee_scroll_1":     "Interactive",
  "hero.text_kinetic_1":       "Interactive",
  "hero.video_background_1":   "Interactive"
};

const UTILITY_LIBRARIES = new Set([
  "cta", "gallery", "services", "contact", "faq", "footer", "team",
  "testimonials", "pricing", "features", "banner", "brands", "categories",
  "map", "newsletter", "product_grid", "statistics", "trust_bar", "video"
]);

function assignFamily(s) {
  if (s.library !== "hero") {
    return UTILITY_LIBRARIES.has(s.library) ? "Utility & Content" : "Uncategorised";
  }
  return HERO_FAMILY_BY_ID[s.id] ?? "Uncategorised";
}

const assignments = inv.inventory.map((s) => ({
  id: s.id,
  library: s.library,
  name: s.name,
  family: assignFamily(s),
  matchTrace: []
}));

const byFamily = {};
for (const a of assignments) {
  byFamily[a.family] = (byFamily[a.family] ?? 0) + 1;
}

const output = {
  ranAt: new Date().toISOString(),
  families: [
    { name: "Trust-First",       description: "Minimal · fast-load · image-optional · trust-signals dominant. Best for trades where credentials + response speed sell." },
    { name: "Editorial",         description: "Full-bleed photography · sophisticated typography. Best for architectural / luxury / portfolio-led businesses." },
    { name: "Trade-Native",      description: "Service-area · postcode · product-grid · local utility. Best for local trades whose USP is coverage + inventory." },
    { name: "Interactive",       description: "Motion-heavy · animated · video · kinetic. Best for businesses competing on modernity + energy." },
    { name: "Utility & Content", description: "Every non-hero building block. Composes into any of the 4 hero families." }
  ],
  byFamily,
  assignments
};

writeFileSync(OUT, JSON.stringify(output, null, 2));

console.log(`clustered ${assignments.length} sections into ${Object.keys(byFamily).length} families`);
for (const [fam, n] of Object.entries(byFamily).sort()) {
  console.log(`  ${fam.padEnd(22)} ${n}`);
}
console.log(`  wrote ${OUT.replace(ROOT + "\\", "").replaceAll("\\", "/")}`);

const uncategorised = assignments.filter((a) => a.family === "Uncategorised");
if (uncategorised.length > 0) {
  console.log("");
  console.log(`  ⚠ ${uncategorised.length} uncategorised (need owner decision):`);
  for (const u of uncategorised) console.log(`      · ${u.id} (${u.name})`);
}

// Per-family listing so the owner can spot-check.
console.log("");
console.log("Per-family membership:");
for (const [fam] of Object.entries(byFamily).sort()) {
  console.log(`  ${fam}:`);
  for (const a of assignments.filter((x) => x.family === fam)) {
    console.log(`    · ${a.id.padEnd(30)} ${a.name}`);
  }
}
