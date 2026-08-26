#!/usr/bin/env node
// scripts/nex-enrichment/_bko-seed-from-recovered-evidence.mjs
//
// BKO SEEDER · reads recovered_evidence from food_business + accommodation_business
// and writes one nex.business_knowledge row per attribute · full SCIUD chain.
//
// Doctrine:
//   - source = 'osm_replay' · source_tier = 'OBSERVED' (OSM is machine observation)
//   - interpretation is a bounded sentence · never invents beyond the raw tag
//   - unknown_note names what this evidence does NOT permit NEX to conclude
//   - idempotent · ON CONFLICT DO UPDATE keeps the row live · superseding logic
//     preserved by the schema UNIQUE constraint
//   - never modifies food_business / accommodation_business rows
//   - never touches walker · scheduler · scorer

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

// ── Attribute-key → { domain, interpretation, unknown } mapping ────────
const MAPPING = {
  // identity
  brand:            { d: "identity",             i: "OSM records a brand name for this business.",              u: "Brand identity is what OSM contributors labelled at capture time · may be superseded by later signage." },
  operator:         { d: "identity",             i: "OSM records an operator name for this business.",           u: "Operator may have changed since OSM capture · not independently verified." },
  wikidata:         { d: "identity",             i: "OSM cross-references a Wikidata identity for this business.", u: "Wikidata entry existence does not guarantee ongoing brand accuracy." },
  name_en:          { d: "identity",             i: "OSM records an English name for this business.",            u: "English name may not be the current signage." },
  name_id:          { d: "identity",             i: "OSM records an Indonesian name for this business.",         u: "Indonesian name may not be the current signage." },
  alt_name:         { d: "identity",             i: "OSM records an alternate name for this business.",          u: "Alternate name may be historical." },
  // location
  addr_street_raw:  { d: "location",             i: "OSM records this street address.",                          u: "Street may have been renamed or the business may have moved." },
  addr_housenumber: { d: "location",             i: "OSM records this house number.",                            u: "House number may have changed." },
  addr_postcode:    { d: "location",             i: "OSM records this postcode.",                                u: "Postcode may have changed." },
  addr_province:    { d: "location",             i: "OSM records this province.",                                u: "Administrative boundaries may have changed." },
  addr_district:    { d: "location",             i: "OSM records this district.",                                u: "District boundaries may have changed." },
  addr_neighbourhood:{d: "location",             i: "OSM records this neighbourhood.",                           u: "Neighbourhood naming varies · not authoritative." },
  addr_subdistrict: { d: "location",             i: "OSM records this subdistrict.",                             u: "Subdistrict boundaries may have changed." },
  // contact
  contact_phone:    { d: "contact",              i: "OSM records a phone number for this business.",             u: "Number may have changed · not verified to still work." },
  contact_whatsapp: { d: "contact",              i: "OSM records a WhatsApp contact for this business.",         u: "Does NOT confirm the number still works, that the business monitors WhatsApp, or that it is monitored now." },
  contact_instagram:{ d: "contact",              i: "OSM records an Instagram handle for this business.",        u: "Handle may have changed · account may be inactive." },
  facebook:         { d: "contact",              i: "OSM records a Facebook contact for this business.",         u: "Page may be inactive." },
  email:            { d: "contact",              i: "OSM records an email address for this business.",           u: "Email may bounce · not verified currently monitored." },
  fax:              { d: "contact",              i: "OSM records a fax number for this business.",               u: "Fax may be discontinued." },
  website:          { d: "contact",              i: "OSM records a website for this business.",                  u: "Website may be offline or rebranded." },
  // opening_availability
  opening_hours:    { d: "opening_availability", i: "OSM records these opening hours.",                          u: "Hours may have changed · seasonal changes not captured." },
  check_date:       { d: "freshness",            i: "OSM contributor last verified this business on this date.", u: "Verification only covers the fields present at that time · newer changes not captured." },
  reservation:      { d: "opening_availability", i: "OSM records the reservation policy for this business.",     u: "Policy may have changed." },
  // facilities
  indoor_seating:   { d: "facilities",           i: "OSM records indoor seating for this business.",             u: "Capacity and availability not implied." },
  outdoor_seating:  { d: "facilities",           i: "OSM records outdoor seating for this business.",            u: "Seasonal availability not implied." },
  capacity:         { d: "facilities",           i: "OSM records a capacity figure.",                            u: "Actual seating layout may differ · regulatory occupancy not implied." },
  wifi:             { d: "facilities",           i: "OSM records internet-access availability at this business.",u: "Speed, reliability and current availability not implied." },
  wifi_fee:         { d: "facilities",           i: "OSM records whether internet-access is charged.",           u: "Current fee amount not stored." },
  air_conditioning: { d: "facilities",           i: "OSM records air-conditioning at this business.",            u: "Current working state not implied." },
  takeaway:         { d: "facilities",           i: "OSM records takeaway availability.",                        u: "Menu subset available for takeaway not implied." },
  delivery:         { d: "facilities",           i: "OSM records delivery availability.",                        u: "Delivery radius and providers not implied." },
  drive_through:    { d: "facilities",           i: "OSM records a drive-through at this business.",             u: "Hours of drive-through operation not implied." },
  shop:             { d: "facilities",           i: "OSM records this business's shop type.",                    u: "Range of goods not implied." },
  // accessibility
  wheelchair:       { d: "accessibility",        i: "OSM records a wheelchair-access status for this business.", u: "This is a single OSM tag · not a formal accessibility audit. Actual barriers may exist not captured in the tag." },
  wheelchair_toilets:{d: "accessibility",        i: "OSM records wheelchair-toilet status for this business.",   u: "Not an audit · specific dimensions and grab-rails not implied." },
  toilets:          { d: "accessibility",        i: "OSM records toilet availability at this business.",         u: "Cleanliness and current availability not implied." },
  // family
  changing_table:   { d: "family",               i: "OSM records a baby changing table for this business.",      u: "Does NOT mean the business is family safe. Family suitability requires context NEX doesn't have from this single tag." },
  kids_area:        { d: "family",               i: "OSM records a kids' area at this business.",                u: "Supervision, safety features and current availability not implied." },
  child_seats:      { d: "family",               i: "OSM records the availability of child seats.",              u: "Number, condition and current availability not implied." },
  // suitability (dietary + alcohol)
  diet_vegetarian:  { d: "suitability",          i: "OSM records vegetarian dietary availability.",              u: "Cross-contamination and current menu not implied." },
  diet_vegan:       { d: "suitability",          i: "OSM records vegan dietary availability.",                   u: "Cross-contamination and current menu not implied." },
  diet_halal:       { d: "suitability",          i: "OSM records halal dietary availability.",                   u: "Certification status not implied · formal halal certification requires separate evidence." },
  diet_kosher:      { d: "suitability",          i: "OSM records kosher dietary availability.",                  u: "Certification status not implied." },
  diet_gluten_free: { d: "suitability",          i: "OSM records gluten-free dietary availability.",             u: "Cross-contamination not implied · celiac-safe status not implied." },
  diet_dairy_free:  { d: "suitability",          i: "OSM records dairy-free dietary availability.",              u: "Cross-contamination not implied." },
  diet_pescetarian: { d: "suitability",          i: "OSM records pescetarian dietary availability.",             u: "Menu breadth not implied." },
  alcohol:          { d: "suitability",          i: "OSM records the alcohol availability of this business.",    u: "Licensing status and hours not implied." },
  smoking:          { d: "suitability",          i: "OSM records the smoking policy at this business.",          u: "Enforcement not implied." },
  microbrewery:     { d: "suitability",          i: "OSM records this business as a microbrewery.",              u: "Regulatory brewing licence not implied." },
  brewery:          { d: "suitability",          i: "OSM records this business as a brewery.",                   u: "Regulatory brewing licence not implied." },
  // character
  cuisine:          { d: "character",            i: "OSM records this cuisine descriptor for this business.",    u: "Menu breadth · authenticity · quality not implied." },
  description:      { d: "character",            i: "OSM records a free-text description for this business.",    u: "Descriptions are contributor-supplied · may be outdated." },
  description_en:   { d: "character",            i: "OSM records an English description for this business.",     u: "May be outdated." },
  description_id:   { d: "character",            i: "OSM records an Indonesian description for this business.",  u: "May be outdated." },
  // commercial
  payment_cash:     { d: "commercial",           i: "OSM records cash payment acceptance.",                      u: "Current policy may have changed." },
  payment_credit_cards:{d: "commercial",         i: "OSM records credit-card acceptance.",                       u: "Specific card networks not implied." },
  payment_debit_cards: {d: "commercial",         i: "OSM records debit-card acceptance.",                        u: "Specific networks not implied." },
  payment_other:    { d: "commercial",           i: "OSM records other payment methods.",                        u: "Current policy may have changed." },
  // physical
  building_levels:  { d: "physical",             i: "OSM records the number of building levels.",                u: "Which levels are open to customers not implied." },
  building_structure:{d: "physical",             i: "OSM records the building structure.",                       u: "Structural safety inspections not implied." },
  building_walls:   { d: "physical",             i: "OSM records the wall material.",                            u: "Structural safety not implied." },
  building_roof:    { d: "physical",             i: "OSM records the roof material.",                            u: "Structural safety not implied." },
  height:           { d: "physical",             i: "OSM records the building height.",                          u: "Wayfinding accuracy not implied." },
  start_date:       { d: "identity",             i: "OSM records the start date for this business.",             u: "Business may have opened before OSM record was created." },
};

async function seedVertical(vertical, table, refCol) {
  const q = await pool.query(`
    SELECT ${refCol} as business_ref, recovered_evidence, evidence_source
      FROM ${table}
     WHERE recovered_evidence IS NOT NULL AND recovered_evidence <> '{}'::jsonb
  `);
  let rowsProcessed = 0;
  let bkoRowsWritten = 0;
  let unknownKeys = new Map();
  for (const row of q.rows) {
    rowsProcessed++;
    const evidence = row.recovered_evidence;
    for (const [key, ev] of Object.entries(evidence)) {
      const map = MAPPING[key];
      if (!map) {
        unknownKeys.set(key, (unknownKeys.get(key) || 0) + 1);
        continue;
      }
      await pool.query(
        `INSERT INTO nex.business_knowledge (
           vertical, business_ref, attribute_domain, attribute_key,
           source, source_reference, source_tier, claim,
           interpretation, unknown_note,
           captured_at, snapshot_id, provenance
         ) VALUES ($1,$2,$3,$4,$5,$6,'OBSERVED',$7::jsonb,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (vertical, business_ref, attribute_domain, attribute_key, source, source_reference)
         DO UPDATE SET
           claim = EXCLUDED.claim,
           interpretation = EXCLUDED.interpretation,
           unknown_note = EXCLUDED.unknown_note,
           captured_at = EXCLUDED.captured_at,
           snapshot_id = EXCLUDED.snapshot_id,
           provenance = EXCLUDED.provenance`,
        [
          vertical,
          row.business_ref,
          map.d,
          key,
          "osm_replay",
          ev.source_reference || ev.snapshot_id || null,
          JSON.stringify(ev.value),
          map.i,
          map.u,
          ev.captured_at || new Date().toISOString(),
          ev.snapshot_id || null,
          JSON.stringify({ raw_snippet: ev.raw_snippet || null, evidence_source: row.evidence_source }),
        ],
      );
      bkoRowsWritten++;
    }
  }
  return { rowsProcessed, bkoRowsWritten, unknownKeys };
}

async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  BKO SEEDER · recovered_evidence → nex.business_knowledge                 ║");
  console.log("║  source='osm_replay' · source_tier='OBSERVED' · SCIUD per attribute      ║");
  console.log("║  Idempotent · never modifies food/accommodation rows                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  console.log("── ACCOMMODATION ──────────────────────────────────────────────");
  const accom = await seedVertical(
    "accommodation",
    "nex.accommodation_business",
    "public_listing_ref",
  );
  console.log(`  rows scanned : ${accom.rowsProcessed}`);
  console.log(`  BKO rows written : ${accom.bkoRowsWritten}`);
  if (accom.unknownKeys.size > 0) {
    console.log(`  unknown attribute keys (skipped · consider extending MAPPING):`);
    for (const [k, n] of accom.unknownKeys) console.log(`    ${k}: ${n}`);
  }

  console.log("\n── FOOD ───────────────────────────────────────────────────────");
  const food = await seedVertical(
    "food",
    "nex.food_business",
    "public_listing_ref",
  );
  console.log(`  rows scanned : ${food.rowsProcessed}`);
  console.log(`  BKO rows written : ${food.bkoRowsWritten}`);
  if (food.unknownKeys.size > 0) {
    console.log(`  unknown attribute keys (skipped · consider extending MAPPING):`);
    for (const [k, n] of food.unknownKeys) console.log(`    ${k}: ${n}`);
  }

  console.log(`\n── DOCTRINE COMPLIANCE ───────────────────────────────────────`);
  console.log(`  Business rows modified: NO (read-only on food/accommodation)`);
  console.log(`  Walker/scheduler touched: NO`);
  console.log(`  Scorer touched: NO`);
  console.log(`  Source tier: OBSERVED (OSM is machine observation · never VERIFIED)`);
  console.log(`  Every row has interpretation + unknown_note (SCIUD complete)`);
  console.log(`  Idempotent: YES (ON CONFLICT DO UPDATE preserves the live row)`);
  console.log(`  Runtime: ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
