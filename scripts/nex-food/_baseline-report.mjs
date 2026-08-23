#!/usr/bin/env node
// NEX Food · Phase 8.0 baseline report (required before Phase 8.4).
// Reports the exact numbers Philip specified.
import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const total = (await pool.query(`
  SELECT COUNT(*)::int AS n FROM nex.food_business
  WHERE claim_status IN ('listed','invited','claimed','paying')
`)).rows[0].n;

const byCategory = (await pool.query(`
  SELECT category, COUNT(*)::int AS n FROM nex.food_business
  WHERE claim_status IN ('listed','invited','claimed','paying')
  GROUP BY category ORDER BY n DESC
`)).rows;

const contactable = (await pool.query(`
  SELECT
    (COUNT(*) FILTER (WHERE whatsapp_number IS NOT NULL AND whatsapp_number <> ''))::int AS whatsapp,
    (COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone <> ''))::int                     AS phone,
    (COUNT(*) FILTER (WHERE website IS NOT NULL AND website <> ''))::int                 AS website,
    (COUNT(*) FILTER (
      WHERE (whatsapp_number IS NOT NULL AND whatsapp_number <> '')
         OR (phone IS NOT NULL AND phone <> '')
    ))::int AS any_contact
  FROM nex.food_business
  WHERE claim_status IN ('listed','invited','claimed','paying')
`)).rows[0];

const evidence = (await pool.query(`
  SELECT field_name, COUNT(DISTINCT business_ref)::int AS businesses
  FROM nex.food_enrichment_evidence
  GROUP BY field_name
  ORDER BY businesses DESC
`)).rows;

const evidenceByField = new Map(evidence.map((r) => [r.field_name, r.businesses]));

const compAvg = (await pool.query(`
  SELECT ROUND(AVG(completeness_pct)::numeric, 1) AS avg_pct,
         ROUND(MIN(completeness_pct)::numeric, 1) AS min_pct,
         ROUND(MAX(completeness_pct)::numeric, 1) AS max_pct
  FROM nex.food_business_completeness
`)).rows[0];

const compBuckets = (await pool.query(`
  SELECT
    (COUNT(*) FILTER (WHERE completeness_pct <  25))::int                                  AS bucket_0_25,
    (COUNT(*) FILTER (WHERE completeness_pct >= 25 AND completeness_pct < 50))::int        AS bucket_25_50,
    (COUNT(*) FILTER (WHERE completeness_pct >= 50 AND completeness_pct < 75))::int        AS bucket_50_75,
    (COUNT(*) FILTER (WHERE completeness_pct >= 75))::int                                  AS bucket_75_100
  FROM nex.food_business_completeness
`)).rows[0];

const outreachReady = (await pool.query(`
  SELECT COUNT(*)::int AS n FROM nex.food_business_next_action
  WHERE next_action IN ('INVITE_BUSINESS','FOLLOW_UP')
`)).rows[0].n;

const wait = (await pool.query(`
  SELECT COUNT(*)::int AS n FROM nex.food_business_next_action
  WHERE next_action IN ('WAIT','CLAIM_PENDING','ONBOARD')
`)).rows[0].n;

const readyToConvert = (await pool.query(`
  SELECT COUNT(*)::int AS n FROM nex.food_business_next_action
  WHERE next_action IN ('OFFER_MEMBERSHIP','OFFER_PAY_PER_RESULT')
`)).rows[0].n;

const noAction = (await pool.query(`
  SELECT COUNT(*)::int AS n FROM nex.food_business_next_action
  WHERE next_action = 'NO_ACTION'
`)).rows[0].n;

const evidenceConfidence = (await pool.query(`
  SELECT
    (COUNT(*) FILTER (WHERE confidence >= 0.85))::int                        AS high,
    (COUNT(*) FILTER (WHERE confidence >= 0.60 AND confidence < 0.85))::int  AS medium,
    (COUNT(*) FILTER (WHERE confidence < 0.60))::int                         AS low,
    COUNT(*)::int                                                            AS total
  FROM nex.food_enrichment_evidence
`)).rows[0];

const dedupeReview = (await pool.query(`
  SELECT COUNT(*)::int AS n FROM (
    SELECT dedupe_hash FROM nex.food_business
    WHERE claim_status IN ('listed','invited','claimed','paying')
    GROUP BY dedupe_hash HAVING COUNT(*) > 1
  ) t
`)).rows[0].n;

console.log("╔═══════════════════════════════════════════════════════════════════╗");
console.log("║  NEX FOOD · YOGYAKARTA · Phase 8.0 · BASELINE ENRICHMENT REPORT   ║");
console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

console.log("── Universe ─────────────────────────────────────────────");
console.log(`  Total businesses (listed+):  ${total}`);
console.log(`  By category:`);
byCategory.forEach((r) => console.log(`    ${r.category.padEnd(20)} ${r.n}`));

console.log("\n── Contactability (typed columns · commercial-ready) ────");
console.log(`  Any contact (WhatsApp OR phone): ${contactable.any_contact}  (${((contactable.any_contact/total)*100).toFixed(1)}%)`);
console.log(`  WhatsApp:  ${contactable.whatsapp}`);
console.log(`  Phone:     ${contactable.phone}`);
console.log(`  Website:   ${contactable.website}`);

console.log("\n── Fields with EVIDENCE (not yet promoted to typed) ─────");
const wantFields = [
  "whatsapp_number","phone","website","opening_hours","cuisine",
  "social:instagram","social:facebook","social:tiktok","social:youtube",
  "brand","description","name:en","name:id",
  "diet:vegetarian","diet:vegan","diet:halal",
  "service:delivery","service:takeaway","service:drive_through",
  "menu_url","ordering_url","booking_url",
  "wheelchair_access","internet_access",
  "addr:street","addr:housenumber","addr:suburb","addr:postcode",
];
wantFields.forEach((f) => {
  const n = evidenceByField.get(f) ?? 0;
  console.log(`  ${f.padEnd(28)} ${n}`);
});

console.log("\n── Completeness (NEX_PROFILE_COMPLETENESS %) ────────────");
console.log(`  Average: ${compAvg.avg_pct}%   Min: ${compAvg.min_pct}%   Max: ${compAvg.max_pct}%`);
console.log(`  0-25%   : ${compBuckets.bucket_0_25}   (very sparse · needs enrichment)`);
console.log(`  25-50%  : ${compBuckets.bucket_25_50}  (basic identity + partial contact)`);
console.log(`  50-75%  : ${compBuckets.bucket_50_75}  (good · commercially useful)`);
console.log(`  75-100% : ${compBuckets.bucket_75_100} (rich · full profile)`);

console.log("\n── Commercial next-action ───────────────────────────────");
console.log(`  Ready for outreach (INVITE / FOLLOW_UP):     ${outreachReady}`);
console.log(`  Wait / claim-pending / onboard:              ${wait}`);
console.log(`  READY TO CONVERT (OFFER_MEMBERSHIP):         ${readyToConvert}`);
console.log(`  No action (no contact · suppressed · other): ${noAction}`);

console.log("\n── Evidence confidence bands ────────────────────────────");
console.log(`  Total evidence rows:  ${evidenceConfidence.total}`);
console.log(`  High-confidence   (≥0.85): ${evidenceConfidence.high}`);
console.log(`  Medium-confidence (0.60-0.85): ${evidenceConfidence.medium}`);
console.log(`  Low-confidence    (<0.60): ${evidenceConfidence.low}`);

console.log("\n── Duplicate signal ─────────────────────────────────────");
console.log(`  Businesses sharing dedupe_hash: ${dedupeReview}  (needs Phase 3 review)`);

console.log("\n── GAPS · what enrichment must close before Phase 8.4 ───");
console.log(`  Businesses with NO contact at all: ${total - contactable.any_contact}`);
console.log(`    → cannot be invited via WhatsApp today`);
console.log(`    → owner self-claim is their only current route`);
console.log(`    → external enrichment (Google Places / website scan) would unlock them`);
console.log("");
console.log("PHASE 8.4 GATE: outreach cannot open until contact enrichment closes further.");

await pool.end();
