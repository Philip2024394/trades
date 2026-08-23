#!/usr/bin/env node
// Verify Phase 8 · runs the exact same queries the HQ funnel API/page runs.
import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const CLAIM_STAGES = ["discovered","verifying","listed","invited","claimed","paying"];
const CATEGORIES = ["restaurant","coffee-cafe","ice-cream-dessert","fast-food"];

const funnel = await pool.query(`SELECT claim_status, category, COUNT(*)::int AS n FROM nex.food_business GROUP BY claim_status, category`);
const owner = await pool.query(`SELECT owner_status, COUNT(*)::int AS n FROM nex.food_business GROUP BY owner_status`);
const cities = await pool.query(`SELECT city, COUNT(*)::int AS n FROM nex.food_business GROUP BY city ORDER BY n DESC`);
const outreach = await pool.query(`SELECT status, COUNT(*)::int AS n FROM nex.food_outreach_attempt WHERE created_at > now() - interval '30 days' GROUP BY status ORDER BY n DESC`);
const claims = await pool.query(`SELECT c.business_ref, c.consumed_at, b.business_name FROM nex.food_claim_code c JOIN nex.food_business b ON b.public_listing_ref = c.business_ref WHERE c.consumed_at IS NOT NULL AND c.consumed_at > now() - interval '30 days' ORDER BY c.consumed_at DESC`);
const provStale = await pool.query(`SELECT COUNT(DISTINCT business_ref)::int AS n FROM nex.food_business_field_provenance WHERE trust_layer = 'source_import'`);
const provAdv = await pool.query(`SELECT COUNT(DISTINCT business_ref)::int AS n FROM nex.food_business_field_provenance WHERE trust_layer IN ('admin_verified','owner_verified','nex_curated')`);
const supp = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_outreach_suppression`);
const snap = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_business_source_snapshot`);

const byStage = {};
for (const stage of CLAIM_STAGES) { byStage[stage] = { total: 0 }; for (const c of CATEGORIES) byStage[stage][c] = 0; }
for (const r of funnel.rows) { byStage[r.claim_status][r.category] = r.n; byStage[r.claim_status].total += r.n; }

console.log("── NEX Food HQ · Funnel Snapshot ──\n");
console.log(`Total businesses in pipeline : ${funnel.rows.reduce((s,r) => s + r.n, 0)}`);
console.log(`Source snapshots preserved   : ${snap.rows[0].n}`);
console.log(`Suppressions on record       : ${supp.rows[0].n}`);
console.log(`Outreach attempts (30d)      : ${outreach.rows.reduce((s,r) => s + r.n, 0)}`);
console.log();
console.log("Funnel by claim_status × category:");
console.log("  stage".padEnd(14) + "total".padEnd(8) + CATEGORIES.map(c => c.slice(0, 12).padEnd(14)).join(""));
for (const stage of CLAIM_STAGES) {
  console.log("  " + stage.padEnd(12) + String(byStage[stage].total).padEnd(8) +
    CATEGORIES.map(c => String(byStage[stage][c] || "").padEnd(14)).join(""));
}
console.log();
console.log("Owner status:");
const ow = { unknown: 0, contacted: 0, responded: 0, verified: 0 };
for (const r of owner.rows) ow[r.owner_status] = r.n;
console.log(`  unknown=${ow.unknown}  contacted=${ow.contacted}  responded=${ow.responded}  verified=${ow.verified}`);
console.log();
console.log("Cities:");
cities.rows.forEach(r => console.log(`  ${r.city.padEnd(20)} ${r.n}`));
console.log();
console.log("Outreach last 30d by status:");
outreach.rows.forEach(r => console.log(`  ${r.status.padEnd(14)} ${r.n}`));
console.log();
console.log(`Provenance freshness:`);
console.log(`  rows only source_import : ${provStale.rows[0].n} (never touched by admin/owner)`);
console.log(`  rows with verified data : ${provAdv.rows[0].n}`);
console.log();
console.log("Recent claims (30d):");
if (claims.rowCount === 0) console.log("  (none yet)");
claims.rows.forEach(c => console.log(`  ${c.business_ref}  ${c.business_name.padEnd(45)} claimed=${c.consumed_at.toISOString()}`));

await pool.end();
