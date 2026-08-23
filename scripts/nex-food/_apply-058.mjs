import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/058_nex_food_claim_codes.sql", "utf8");
try { await pool.query(sql); console.log("migration 058 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const r = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='nex' AND tablename='food_claim_code'`);
console.log(`tables: ${r.rowCount}`); r.rows.forEach(t => console.log(`  ${t.tablename}`));
const t = await pool.query(`SELECT template_id, language FROM nex.food_outreach_template WHERE purpose='claim_code' ORDER BY template_id`);
console.log(`claim_code templates: ${t.rowCount}`); t.rows.forEach(x => console.log(`  ${x.template_id} (${x.language})`));
await pool.end();
