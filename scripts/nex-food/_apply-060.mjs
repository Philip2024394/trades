import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/060_nex_food_enrichment.sql", "utf8");
try { await pool.query(sql); console.log("migration 060 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const t = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='nex' AND tablename LIKE 'food_enrichment%' ORDER BY tablename`);
console.log(`tables: ${t.rowCount}`); t.rows.forEach(x => console.log(`  ${x.tablename}`));
const v = await pool.query(`SELECT viewname FROM pg_views WHERE schemaname='nex' AND viewname='food_business_completeness'`);
console.log(`views: ${v.rowCount}`); v.rows.forEach(x => console.log(`  ${x.viewname}`));
const w = await pool.query(`SELECT rule_key, rule_value_int FROM nex.food_hq_rule WHERE rule_key LIKE 'completeness_weight_%' ORDER BY rule_key`);
console.log(`completeness weights (${w.rowCount}):`);
w.rows.forEach(r => console.log(`  ${r.rule_key.padEnd(35)} ${r.rule_value_int}`));
await pool.end();
