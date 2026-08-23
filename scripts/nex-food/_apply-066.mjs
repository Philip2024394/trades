import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/066_nex_food_freshness.sql", "utf8");
try { await pool.query(sql); console.log("migration 066 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }

const cols = await pool.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='nex' AND table_name='food_business'
    AND column_name IN ('source_updated_at','last_verified_at','verification_source')
  ORDER BY column_name
`);
console.log("── new columns ──");
for (const r of cols.rows) console.log(`  ${r.column_name.padEnd(22)}  ${r.data_type}`);

const views = await pool.query(`
  SELECT table_name FROM information_schema.views
  WHERE table_schema='nex' AND table_name IN
    ('food_business_freshness','food_reverification_candidates','food_business_freshness_summary')
  ORDER BY table_name
`);
console.log("── new views ──");
for (const r of views.rows) console.log(`  ${r.table_name}`);

// Baseline · before backfill, everything is UNVERIFIED
const dist = await pool.query(`SELECT * FROM nex.food_business_freshness_summary WHERE city='Yogyakarta'`);
console.log("\n── freshness distribution · BEFORE backfill (expect all UNVERIFIED) ──");
if (dist.rowCount === 0) console.log("  no rows");
else for (const r of dist.rows) console.log(`  ${r.city.padEnd(15)} fresh=${r.fresh} aging=${r.aging} stale=${r.stale} expired=${r.expired} unverified=${r.unverified} total=${r.total}`);

await pool.end();
