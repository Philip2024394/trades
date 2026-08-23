import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/071_walker_provenance_cycle_link.sql", "utf8");

const pre = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business_field_provenance' AND column_name='cycle_run_id')) AS col_exists,
    (SELECT COUNT(*)::int FROM nex.food_business_field_provenance) AS provenance_rows
`);
console.log("── pre-migration ──"); console.log(" ", pre.rows[0]);

try {
  await pool.query(sql);
  console.log("migration 071 applied ok");
} catch (err) {
  console.log("FAIL:", err.message);
  await pool.end();
  process.exit(1);
}

const post = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business_field_provenance' AND column_name='cycle_run_id')) AS col_exists,
    (SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_provenance_cycle_run')) AS idx_exists,
    (SELECT COUNT(*)::int FROM nex.food_business_field_provenance) AS provenance_rows,
    (SELECT COUNT(*)::int FROM nex.food_business_field_provenance WHERE cycle_run_id IS NOT NULL) AS with_cycle_link
`);
console.log("── post-migration ──"); console.log(" ", post.rows[0]);
const p = post.rows[0];
console.log(p.col_exists && p.idx_exists ? "GREEN · migration 071 verified" : "AMBER");
await pool.end();
