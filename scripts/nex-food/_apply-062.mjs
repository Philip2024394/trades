import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/062_nex_food_owner_supplied.sql", "utf8");
try { await pool.query(sql); console.log("migration 062 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }

const cols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='nex' AND table_name='food_claim_code'
    AND column_name IN ('pending_owner_data','entry_path')
  ORDER BY column_name
`);
console.log("── Verification · new columns ──");
for (const r of cols.rows) console.log(`  ${r.column_name}  (${r.data_type})`);

const v = await pool.query(`SELECT count(*) FROM nex.food_pending_self_service_claims`);
console.log(`── View food_pending_self_service_claims exists · rowcount=${v.rows[0].count}`);
await pool.end();
