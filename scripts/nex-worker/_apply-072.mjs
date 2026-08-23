import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/072_delivery_worker_registry_consolidation.sql", "utf8");

const pre = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='delivery_workers')) AS plural_exists,
    (SELECT COALESCE((SELECT COUNT(*)::int FROM nex.delivery_workers), 0)) AS plural_rows,
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='worker_heartbeat')) AS canonical_ready
`);
console.log("── pre-migration ──"); console.log(" ", pre.rows[0]);

try {
  await pool.query(sql);
  console.log("migration 072 applied ok");
} catch (err) {
  console.log("FAIL:", err.message);
  await pool.end();
  process.exit(1);
}

const post = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='delivery_workers')) AS plural_still_exists,
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='delivery_workers_archive_2026_08_22')) AS archive_exists,
    (SELECT COUNT(*)::int FROM nex.delivery_workers_archive_2026_08_22) AS archive_count
`);
console.log("── post-migration ──"); console.log(" ", post.rows[0]);
const p = post.rows[0];
console.log(!p.plural_still_exists && p.archive_exists ? "GREEN · migration 072 verified" : "AMBER");
await pool.end();
