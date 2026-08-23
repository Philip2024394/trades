import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/056_nex_food_outreach.sql", "utf8");
try {
  await pool.query(sql);
  console.log("migration 056 applied ok");
} catch (err) {
  console.log("FAIL:", err.message);
  await pool.end();
  process.exit(1);
}
const r = await pool.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'nex' AND tablename LIKE 'food_outreach%'
  ORDER BY tablename
`);
console.log(`tables (${r.rowCount}):`);
r.rows.forEach((t) => console.log(`  ${t.tablename}`));
const tt = await pool.query(`
  SELECT template_id, language, purpose FROM nex.food_outreach_template ORDER BY template_id
`);
console.log(`seed templates: ${tt.rowCount}`);
tt.rows.forEach((t) => console.log(`  ${t.template_id}  (${t.language}, ${t.purpose})`));
await pool.end();
