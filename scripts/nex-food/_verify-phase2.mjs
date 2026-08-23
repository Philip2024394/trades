#!/usr/bin/env node
// Verify Phase 2 · list what's now in nex.food_business + category breakdown.
import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const total = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_business`);
console.log(`Total rows in nex.food_business: ${total.rows[0].n}\n`);

const byCat = await pool.query(`
  SELECT category, COUNT(*)::int AS n
  FROM nex.food_business
  GROUP BY category
  ORDER BY n DESC
`);
console.log("By category:");
byCat.rows.forEach((r) => console.log(`  ${r.category.padEnd(22)} ${r.n}`));
console.log();

const byStatus = await pool.query(`
  SELECT claim_status, owner_status, COUNT(*)::int AS n
  FROM nex.food_business
  GROUP BY claim_status, owner_status
  ORDER BY n DESC
`);
console.log("By status:");
byStatus.rows.forEach((r) => console.log(`  claim=${r.claim_status.padEnd(12)} owner=${r.owner_status.padEnd(10)} ${r.n}`));
console.log();

const sample = await pool.query(`
  SELECT public_listing_ref, business_name, category, phone, website, source
  FROM nex.food_business
  ORDER BY created_at
`);
console.log("All rows:");
sample.rows.forEach((r) => {
  console.log(`  ${r.public_listing_ref}  [${r.category.padEnd(18)}] ${r.business_name}`);
  console.log(`      phone=${r.phone ?? "—"}  website=${(r.website ?? "—").slice(0, 60)}`);
  console.log(`      source=${r.source}`);
});

await pool.end();
