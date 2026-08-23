import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/057_nex_food_source_snapshots.sql", "utf8");
try {
  await pool.query(sql);
  console.log("migration 057 applied ok");
} catch (err) {
  console.log("FAIL:", err.message);
  await pool.end();
  process.exit(1);
}
const r = await pool.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname='nex' AND tablename IN ('food_business_source_snapshot','food_business_field_provenance')
  ORDER BY tablename
`);
console.log(`tables (${r.rowCount}):`);
r.rows.forEach((t) => console.log(`  ${t.tablename}`));
await pool.end();
