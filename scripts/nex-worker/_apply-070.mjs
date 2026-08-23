import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/070_unify_worker_heartbeat.sql", "utf8");

// Pre-flight: verify migration 070 is safe to run
const pre = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='worker_heartbeats')) AS plural_exists,
    (SELECT COALESCE((SELECT COUNT(*)::int FROM nex.worker_heartbeats), 0)) AS plural_count,
    (SELECT COUNT(*)::int FROM nex.worker_heartbeat) AS singular_count
`).catch((e) => ({ rows: [{ err: e.message }] }));
console.log("── pre-migration state ──");
console.log(" ", pre.rows[0]);

try {
  const r = await pool.query(sql);
  console.log("migration 070 applied ok");
  if (Array.isArray(r)) {
    for (const step of r) if (step.command) console.log(" ", step.command);
  }
} catch (err) {
  console.log("FAIL:", err.message);
  await pool.end();
  process.exit(1);
}

const post = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='worker_heartbeats')) AS plural_still_exists,
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='worker_heartbeats_archive_2026_08_22')) AS archive_exists,
    (SELECT COUNT(*)::int FROM nex.worker_heartbeats_archive_2026_08_22) AS archive_count,
    (SELECT COUNT(*)::int FROM nex.worker_heartbeat) AS singular_count
`);
console.log("── post-migration state ──");
console.log(" ", post.rows[0]);

const p = post.rows[0];
const green = p.plural_still_exists === false && p.archive_exists === true && p.archive_count === 50 && p.singular_count === 2;
console.log(green ? "GREEN · migration 070 verified" : "AMBER · check post-state above");

await pool.end();
