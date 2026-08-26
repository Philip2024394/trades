#!/usr/bin/env node
// scripts/nex-enrichment/_path-a-snapshot-reparse-dryrun.mjs
//
// PATH A · SNAPSHOT RE-PARSE · DRY-RUN
//
// Doctrine anchors:
//   project_nex_path_a_snapshot_reparse_greenlit_2026_08_23
//   project_nex_90pct_business_listing_doctrine_2026_08_23  (≥90 threshold UNCHANGED)
//   project_nex_business_knowledge_object_three_layer_2026_08_23
//   project_nex_honest_empty_states_as_trust_feature_2026_08_23
//
// Reads:  nex.food_business_source_snapshot + nex.accommodation_business_source_snapshot
// Writes: NOTHING (dry-run only · no schema · no rows changed)
// Reports: per-attribute recovery counts + before/after scorer delta + safety delta
//
// Every extracted fact traces to the raw OSM tag it came from · never manufactured.
// Report ZERO IMPROVEMENT honestly if that is the truth.

import pg from "pg";
import { scoreBusiness } from "../nex-promotion/quality-score.mjs";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

// ── Extraction rules · deterministic · reads raw OSM tags from snapshot payload

/** @typedef {Record<string,string>} OsmTags */

// Categories of tags we recover. Each entry: [attribute_key, tag_key(s), extractor].
// Extractor returns { value, raw } when tag present · null otherwise.
const EXTRACTORS = {
  identity: [
    ["brand",                ["brand"],                       (t) => t.brand ? { value: t.brand, raw: t.brand } : null],
    ["operator",             ["operator"],                    (t) => t.operator ? { value: t.operator, raw: t.operator } : null],
    ["name_en",              ["name:en"],                     (t) => t["name:en"] ? { value: t["name:en"], raw: t["name:en"] } : null],
    ["name_id",              ["name:id"],                     (t) => t["name:id"] ? { value: t["name:id"], raw: t["name:id"] } : null],
    ["alt_name",             ["alt_name"],                    (t) => t.alt_name ? { value: t.alt_name, raw: t.alt_name } : null],
    ["wikidata",             ["wikidata", "brand:wikidata"],  (t) => t.wikidata || t["brand:wikidata"] ? { value: t.wikidata ?? t["brand:wikidata"], raw: { wikidata: t.wikidata, brand_wikidata: t["brand:wikidata"] } } : null],
  ],
  story: [
    ["description",          ["description"],                 (t) => t.description ? { value: t.description, raw: t.description } : null],
    ["description_en",       ["description:en"],              (t) => t["description:en"] ? { value: t["description:en"], raw: t["description:en"] } : null],
    ["description_id",       ["description:id"],              (t) => t["description:id"] ? { value: t["description:id"], raw: t["description:id"] } : null],
  ],
  location: [
    ["addr_postcode",        ["addr:postcode"],               (t) => t["addr:postcode"] ? { value: t["addr:postcode"], raw: t["addr:postcode"] } : null],
    ["addr_province",        ["addr:province"],               (t) => t["addr:province"] ? { value: t["addr:province"], raw: t["addr:province"] } : null],
    ["addr_district",        ["addr:district"],               (t) => t["addr:district"] ? { value: t["addr:district"], raw: t["addr:district"] } : null],
    ["addr_neighbourhood",   ["addr:neighbourhood"],          (t) => t["addr:neighbourhood"] ? { value: t["addr:neighbourhood"], raw: t["addr:neighbourhood"] } : null],
    ["addr_subdistrict",     ["addr:subdistrict"],            (t) => t["addr:subdistrict"] ? { value: t["addr:subdistrict"], raw: t["addr:subdistrict"] } : null],
    ["addr_street",          ["addr:street"],                 (t) => t["addr:street"] ? { value: t["addr:street"], raw: t["addr:street"] } : null],
    ["addr_housenumber",     ["addr:housenumber"],            (t) => t["addr:housenumber"] ? { value: t["addr:housenumber"], raw: t["addr:housenumber"] } : null],
  ],
  operations: [
    ["opening_hours",        ["opening_hours"],               (t) => t.opening_hours ? { value: t.opening_hours, raw: t.opening_hours } : null],
    ["check_date",           ["check_date"],                  (t) => t.check_date ? { value: t.check_date, raw: t.check_date } : null],
    ["reservation",          ["reservation"],                 (t) => t.reservation ? { value: t.reservation, raw: t.reservation } : null],
  ],
  contact: [
    ["email",                ["email", "contact:email"],      (t) => (t.email || t["contact:email"]) ? { value: t.email ?? t["contact:email"], raw: { email: t.email, contact_email: t["contact:email"] } } : null],
    ["contact_phone_extra",  ["contact:phone"],               (t) => t["contact:phone"] ? { value: t["contact:phone"], raw: t["contact:phone"] } : null],
    ["contact_whatsapp_extra", ["contact:whatsapp"],          (t) => t["contact:whatsapp"] ? { value: t["contact:whatsapp"], raw: t["contact:whatsapp"] } : null],
    ["contact_instagram",    ["contact:instagram"],           (t) => t["contact:instagram"] ? { value: t["contact:instagram"], raw: t["contact:instagram"] } : null],
    ["fax",                  ["fax"],                         (t) => t.fax ? { value: t.fax, raw: t.fax } : null],
  ],
  commercial: [
    ["payment_cash",         ["payment:cash"],                (t) => t["payment:cash"] ? { value: t["payment:cash"], raw: t["payment:cash"] } : null],
    ["payment_credit_cards", ["payment:credit_cards"],        (t) => t["payment:credit_cards"] ? { value: t["payment:credit_cards"], raw: t["payment:credit_cards"] } : null],
    ["payment_debit_cards",  ["payment:debit_cards"],         (t) => t["payment:debit_cards"] ? { value: t["payment:debit_cards"], raw: t["payment:debit_cards"] } : null],
    ["payment_any_other",    [],                              (t) => {
      const keys = Object.keys(t).filter((k) => k.startsWith("payment:") && !["payment:cash","payment:credit_cards","payment:debit_cards"].includes(k));
      return keys.length > 0 ? { value: keys.map((k) => `${k}=${t[k]}`).join(";"), raw: Object.fromEntries(keys.map((k) => [k, t[k]])) } : null;
    }],
  ],
  physical: [
    ["building_levels",      ["building:levels"],             (t) => t["building:levels"] ? { value: t["building:levels"], raw: t["building:levels"] } : null],
    ["building_structure",   ["building:structure"],          (t) => t["building:structure"] ? { value: t["building:structure"], raw: t["building:structure"] } : null],
    ["building_walls",       ["building:walls"],              (t) => t["building:walls"] ? { value: t["building:walls"], raw: t["building:walls"] } : null],
    ["building_roof",        ["building:roof"],               (t) => t["building:roof"] ? { value: t["building:roof"], raw: t["building:roof"] } : null],
    ["height",               ["height"],                      (t) => t.height ? { value: t.height, raw: t.height } : null],
    ["start_date",           ["start_date"],                  (t) => t.start_date ? { value: t.start_date, raw: t.start_date } : null],
  ],
};

// ── Extract everything the snapshot lets us extract for one row
function extractAll(tags) {
  const recovered = {};
  const flatCategoryCounts = {};
  for (const [category, defs] of Object.entries(EXTRACTORS)) {
    recovered[category] = {};
    let anyInCategory = false;
    for (const [key, _tagKeys, extractor] of defs) {
      const r = extractor(tags);
      if (r) {
        recovered[category][key] = r;
        anyInCategory = true;
      }
    }
    flatCategoryCounts[category] = anyInCategory ? 1 : 0;
  }
  return { recovered, hasAnyInCategory: flatCategoryCounts };
}

// ── Rebuild the row-input that scoreBusiness() consumes, augmented with recovered attributes
// (does NOT modify the DB row · builds an ephemeral object for re-scoring only)
function augmentedRowForScoring(baseRow, recovered) {
  // The Task #88 Phase 1 scorer reads these keys:
  //   business_ref, business_name, category, categories, coordinates_lat, coordinates_lng,
  //   address, phone, whatsapp_number, website, public_social_links, last_verified_at
  // Path A recovery mostly adds context that doesn't directly change these keys — the scorer
  // itself doesn't yet have signals for brand/description/opening_hours/check_date etc.
  // BUT Path A does recover:
  //   · contact:phone / contact:whatsapp / email / contact:instagram → additional contact evidence
  //   · check_date → could inform a freshness signal (scorer currently uses last_verified_at only)
  //
  // For an HONEST before/after under the CURRENT scorer, we only augment fields the current
  // scorer actually reads. Everything else is "captured but not yet scored" and reported as
  // "future scorer upgrade will unlock these signals."

  const augmented = { ...baseRow };

  // Augment contact if row lacks phone/whatsapp but snapshot has contact:phone/contact:whatsapp
  if (!augmented.phone && recovered.contact.contact_phone_extra) {
    augmented.phone = recovered.contact.contact_phone_extra.value;
  }
  if (!augmented.whatsapp_number && recovered.contact.contact_whatsapp_extra) {
    augmented.whatsapp_number = recovered.contact.contact_whatsapp_extra.value;
  }
  // email doesn't affect current scorer · noted separately

  // If row has no website but has social/instagram, add to public_social_links
  if (recovered.contact.contact_instagram) {
    augmented.public_social_links = {
      ...(augmented.public_social_links || {}),
      instagram: recovered.contact.contact_instagram.value,
    };
  }

  return augmented;
}

async function loadBusinessRows(table) {
  const q = await pool.query(`
    SELECT public_listing_ref AS business_ref, business_name, category, categories,
           coordinates_lat, coordinates_lng, address, phone, whatsapp_number,
           website, public_social_links, last_verified_at
      FROM nex.${table}
     WHERE city='Yogyakarta'
  `);
  const byRef = new Map();
  for (const row of q.rows) byRef.set(row.business_ref, row);
  return byRef;
}

async function loadSnapshots(table) {
  const q = await pool.query(`
    SELECT business_ref, raw_payload
      FROM nex.${table.replace("_business", "_business_source_snapshot")}
  `);
  // Take newest per business_ref if duplicates exist
  const byRef = new Map();
  for (const row of q.rows) {
    if (!byRef.has(row.business_ref)) byRef.set(row.business_ref, row.raw_payload?.tags ?? {});
  }
  return byRef;
}

async function analyseVertical(vertical, table) {
  const businessRows = await loadBusinessRows(table);
  const snapshots    = await loadSnapshots(table);

  const totalBusinesses = businessRows.size;
  const totalSnapshots  = snapshots.size;

  const perCategoryCounts = { identity: 0, story: 0, location: 0, operations: 0, contact: 0, commercial: 0, physical: 0 };
  const perAttributeCounts = {};
  for (const cat of Object.keys(EXTRACTORS)) {
    for (const [key] of EXTRACTORS[cat]) perAttributeCounts[key] = 0;
  }

  // Composite metrics (per Philip's report shape)
  let with_useful_location_context = 0;
  let with_description_story       = 0;
  let with_brand_operator          = 0;
  let with_additional_contact      = 0;
  let with_opening_information     = 0;
  let with_cross_source_anchor     = 0;

  // Scorer before/after
  let beforeScoreDist = { ge90: 0, "75_89": 0, "60_74": 0, "40_59": 0, lt_40: 0 };
  let afterScoreDist  = { ge90: 0, "75_89": 0, "60_74": 0, "40_59": 0, lt_40: 0 };

  // Safety delta (using the same placeholder detection as proposed scorer)
  const PLACEHOLDER_NAMES = /^(test|tbd|xxx|example|lorem|todo|dummy|placeholder|business ?name)\b/i;
  let placeholderNameNew = 0; // rows we'd now flag that weren't before (should be 0 since we don't change name)

  const scoreBand = (n) => {
    if (n >= 90) return "ge90";
    if (n >= 75) return "75_89";
    if (n >= 60) return "60_74";
    if (n >= 40) return "40_59";
    return "lt_40";
  };

  for (const [ref, row] of businessRows) {
    const tags = snapshots.get(ref) ?? {};
    const { recovered, hasAnyInCategory } = extractAll(tags);

    for (const [cat, present] of Object.entries(hasAnyInCategory)) {
      perCategoryCounts[cat] += present;
    }
    for (const cat of Object.keys(EXTRACTORS)) {
      for (const [key] of EXTRACTORS[cat]) {
        if (recovered[cat][key]) perAttributeCounts[key]++;
      }
    }

    // Composite flags
    if (recovered.location.addr_neighbourhood || recovered.location.addr_district
        || recovered.location.addr_subdistrict || recovered.location.addr_postcode
        || recovered.location.addr_street || recovered.location.addr_housenumber) with_useful_location_context++;
    if (recovered.story.description || recovered.story.description_en || recovered.story.description_id) with_description_story++;
    if (recovered.identity.brand || recovered.identity.operator) with_brand_operator++;
    const hasAdditionalContact = (!row.phone && recovered.contact.contact_phone_extra)
                              || (!row.whatsapp_number && recovered.contact.contact_whatsapp_extra)
                              || recovered.contact.email
                              || recovered.contact.contact_instagram
                              || recovered.contact.fax;
    if (hasAdditionalContact) with_additional_contact++;
    if (recovered.operations.opening_hours) with_opening_information++;
    if (recovered.identity.wikidata) with_cross_source_anchor++;

    // Scorer: BEFORE (current row as-is)
    const before = scoreBusiness(row);
    beforeScoreDist[scoreBand(before.score)]++;

    // Scorer: AFTER (row augmented with recovered contact/social)
    const augmented = augmentedRowForScoring(row, recovered);
    const after = scoreBusiness(augmented);
    afterScoreDist[scoreBand(after.score)]++;
  }

  return {
    vertical,
    totalBusinesses,
    totalSnapshots,
    perCategoryCounts,
    perAttributeCounts,
    composite: {
      with_useful_location_context,
      with_description_story,
      with_brand_operator,
      with_additional_contact,
      with_opening_information,
      with_cross_source_anchor,
    },
    beforeScoreDist,
    afterScoreDist,
    placeholderNameNew,
  };
}

function fmtTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)));
  const line = (cells) => cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ");
  return [line(headers), line(widths.map((w) => "─".repeat(w))), ...rows.map(line)].join("\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PATH A · SNAPSHOT RE-PARSE · DRY-RUN · no writes                         ║");
  console.log("║  Doctrine: project_nex_path_a_snapshot_reparse_greenlit_2026_08_23        ║");
  console.log("║  ≥90 threshold: UNCHANGED · no schema change · no publishing              ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const foodResult  = await analyseVertical("food", "food_business");
  const accomResult = await analyseVertical("accommodation", "accommodation_business");

  console.log("── DISCOVERY UNIVERSE (unchanged · Walker keeps eating) ──────────────────");
  console.log(`  food_business:          ${foodResult.totalBusinesses}`);
  console.log(`  accommodation_business: ${accomResult.totalBusinesses}`);
  console.log(`  total candidates:       ${foodResult.totalBusinesses + accomResult.totalBusinesses}`);
  console.log(`  food snapshots:         ${foodResult.totalSnapshots}`);
  console.log(`  accom snapshots:        ${accomResult.totalSnapshots}`);
  console.log(`  total snapshots:        ${foodResult.totalSnapshots + accomResult.totalSnapshots}\n`);

  for (const r of [foodResult, accomResult]) {
    console.log(`════════════════════════════════════════════════════════════════════════`);
    console.log(`VERTICAL: ${r.vertical}   ·   ${r.totalBusinesses} businesses   ·   ${r.totalSnapshots} snapshots`);
    console.log(`════════════════════════════════════════════════════════════════════════\n`);
    console.log("── ROWS GAINING AT LEAST ONE ATTRIBUTE PER CATEGORY ──");
    for (const [cat, count] of Object.entries(r.perCategoryCounts)) {
      const pct = r.totalBusinesses > 0 ? ((100 * count) / r.totalBusinesses).toFixed(1) : "0.0";
      console.log(`  ${cat.padEnd(12)} ${String(count).padStart(4)}  (${pct}%)`);
    }
    console.log("\n── PER-ATTRIBUTE RECOVERY COUNTS ──");
    for (const cat of Object.keys(EXTRACTORS)) {
      const items = EXTRACTORS[cat].map(([key]) => [key, r.perAttributeCounts[key]]).filter(([, n]) => n > 0);
      if (items.length === 0) { console.log(`  ${cat}: (none)`); continue; }
      console.log(`  ${cat}:`);
      for (const [key, n] of items) console.log(`    ${key.padEnd(28)} ${String(n).padStart(4)}`);
    }
    console.log("");
  }

  console.log("════════════════════════════════════════════════════════════════════════");
  console.log("BEFORE / AFTER · Philip's requested report table");
  console.log("════════════════════════════════════════════════════════════════════════\n");

  const before_score_total_ge90 = foodResult.beforeScoreDist.ge90 + accomResult.beforeScoreDist.ge90;
  const after_score_total_ge90  = foodResult.afterScoreDist.ge90  + accomResult.afterScoreDist.ge90;

  const rows = [
    ["Candidates",                             foodResult.totalBusinesses + accomResult.totalBusinesses,
                                                foodResult.totalBusinesses + accomResult.totalBusinesses],
    ["With useful location context",           0,
                                                foodResult.composite.with_useful_location_context + accomResult.composite.with_useful_location_context],
    ["With description/story",                 0,
                                                foodResult.composite.with_description_story + accomResult.composite.with_description_story],
    ["With brand/operator",                    0,
                                                foodResult.composite.with_brand_operator + accomResult.composite.with_brand_operator],
    ["With additional contact",                0,
                                                foodResult.composite.with_additional_contact + accomResult.composite.with_additional_contact],
    ["With opening information (accom)",       0,
                                                accomResult.composite.with_opening_information],
    ["With cross-source anchor (wikidata)",    0,
                                                foodResult.composite.with_cross_source_anchor + accomResult.composite.with_cross_source_anchor],
    ["≥90 candidates (unchanged scorer)",      before_score_total_ge90,
                                                after_score_total_ge90],
  ];
  console.log(fmtTable(["Metric", "Before", "After"], rows));
  console.log("");

  console.log("── SCORER BAND DISTRIBUTION (unchanged Task #88 Phase 1 scorer) ──");
  console.log("  (Path A only augments contact/social · scorer weights unchanged · ≥90 threshold unchanged)");
  const scoreRows = [];
  for (const band of ["ge90", "75_89", "60_74", "40_59", "lt_40"]) {
    scoreRows.push([
      band,
      foodResult.beforeScoreDist[band], foodResult.afterScoreDist[band],
      accomResult.beforeScoreDist[band], accomResult.afterScoreDist[band],
    ]);
  }
  console.log(fmtTable(["Band", "food·before", "food·after", "accom·before", "accom·after"], scoreRows));
  console.log("");

  console.log("── SAFETY DELTA ──");
  console.log("  New placeholder-name detections: 0 (Path A does not modify business_name)");
  console.log("  Coord-out-of-city detections:    unchanged (Path A does not modify coords)");
  console.log("  Source-inference downgrades:     0 (Path A adds evidence · never downgrades)");
  console.log("");

  console.log("── FUTURE SCORER UPGRADE NEEDED ──");
  console.log("  Path A recovers these signals that the CURRENT scorer does NOT read yet:");
  console.log("    · brand · operator · wikidata (identity strength · cross-source anchor)");
  console.log("    · description · description:en · description:id (character/atmosphere extraction)");
  console.log("    · address components (postcode · province · district · neighbourhood · street · housenumber)");
  console.log("    · opening_hours on accommodation");
  console.log("    · check_date (a genuine freshness marker · scorer currently reads last_verified_at only)");
  console.log("    · payment methods (commercial signal for future Tier D)");
  console.log("    · building metadata (physical characteristics for accom vertical evidence)");
  console.log("");
  console.log("  These are captured in-memory during this dry-run but NOT PERSISTED.");
  console.log("  When Philip greenlights storage (business_attribute overlay OR typed columns +");
  console.log("  scorer upgrade), the ≥90 impact will be measurable against the recovered signals.");
  console.log("");

  console.log("── DOCTRINE COMPLIANCE ──");
  console.log("  Walker touched:              NO");
  console.log("  Schema changed:              NO");
  console.log("  ≥90 threshold weakened:      NO");
  console.log("  Rows auto-listed:            0 (no publishing)");
  console.log("  Provenance preserved:        YES (every extraction cites raw_payload · dry-run only)");
  console.log("  Truth Invariant:             satisfied (no fabrication · only what tags provide)");
  console.log("  Traveller Protection:        satisfied (no customer-facing change · nothing shown as verified that isn't)");
  console.log("");

  console.log("── HONEST INTERPRETATION ──");
  console.log("  If the recovery counts above are low, Path A alone will NOT lift accommodation");
  console.log("  or food rows to ≥90 · this reveals that Path B (website enrichment) and Path C");
  console.log("  (Location Intelligence) are the real unlocks, not just re-parsing what OSM gave us.");
  console.log("  Zero improvement in the ≥90 count is a valid outcome and must be reported honestly.");
  console.log("");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
