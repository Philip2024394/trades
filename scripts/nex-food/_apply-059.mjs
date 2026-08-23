import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/059_nex_food_commercial_events.sql", "utf8");
try { await pool.query(sql); console.log("migration 059 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const tables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='nex' AND tablename IN ('food_commercial_event','food_hq_rule','food_business_next_action','food_next_action_audit') ORDER BY tablename`);
console.log(`tables: ${tables.rowCount}`); tables.rows.forEach(t => console.log(`  ${t.tablename}`));
const mv = await pool.query(`SELECT matviewname FROM pg_matviews WHERE schemaname='nex' AND matviewname='food_business_value'`);
console.log(`materialized views: ${mv.rowCount}`); mv.rows.forEach(t => console.log(`  ${t.matviewname}`));
const rules = await pool.query(`SELECT rule_key, rule_value_int, description FROM nex.food_hq_rule ORDER BY rule_key`);
console.log(`seed HQ rules: ${rules.rowCount}`); rules.rows.forEach(r => console.log(`  ${r.rule_key} = ${r.rule_value_int} · ${r.description}`));
await pool.end();
