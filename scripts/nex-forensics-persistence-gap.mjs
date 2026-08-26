// scripts/nex-forensics-persistence-gap.mjs
// Investigate WHY records_new says 105 but DB tables show 0 new rows.
// Break down the completed cycles since cutover 2 by worker_type + config
// so we know which walker's counter is lying vs. writing somewhere else.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const CUTOVER_2 = "2026-08-24 08:28:23+00";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));

console.log(banner("§P1 · Post-cutover cycles by worker_type + records_new"));
pretty((await pool.query(
  `SELECT worker_type,
          count(*) AS cycles,
          count(*) FILTER (WHERE status='completed') AS completed,
          sum(records_new)       AS records_new_sum,
          sum(records_processed) AS records_processed_sum
     FROM nex.worker_cycle_run
    WHERE started_at >= $1::timestamptz
    GROUP BY worker_type
    ORDER BY records_new_sum DESC NULLS LAST`,
  [CUTOVER_2],
)).rows);

console.log(banner("§P2 · Post-cutover by worker_config · which cycles claim records_new"));
pretty((await pool.query(
  `SELECT worker_config, count(*) AS cycles,
          sum(records_new) AS records_new,
          sum(records_processed) AS records_processed
     FROM nex.worker_cycle_run
    WHERE started_at >= $1::timestamptz AND coalesce(records_new,0) > 0
    GROUP BY worker_config
    ORDER BY records_new DESC`,
  [CUTOVER_2],
)).rows);

console.log(banner("§P3 · Sample one accommodation:Bantul cycle summary to confirm scoring-not-discovery"));
pretty((await pool.query(
  `SELECT worker_config, records_new, finished_at, summary::text AS summary_text
     FROM nex.worker_cycle_run
    WHERE started_at >= $1::timestamptz AND worker_config LIKE 'accommodation:Bantul%' AND coalesce(records_new,0) > 0
    ORDER BY finished_at DESC LIMIT 1`,
  [CUTOVER_2],
)).rows);

console.log(banner("§P4 · Every table with created_at/inserted_at since cutover — find where records land"));
pretty((await pool.query(
  `WITH candidate AS (
     SELECT n.nspname AS schema, c.relname AS table_name
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE c.relkind='r' AND n.nspname='nex'
   )
   SELECT c.schema||'.'||c.table_name AS tbl,
          (SELECT column_name FROM information_schema.columns
             WHERE table_schema=c.schema AND table_name=c.table_name
               AND column_name IN ('created_at','inserted_at','captured_at','ingested_at','source_ingested_at','recorded_at')
             LIMIT 1) AS ts_column
     FROM candidate c
    WHERE (SELECT count(*) FROM information_schema.columns
             WHERE table_schema=c.schema AND table_name=c.table_name
               AND column_name IN ('created_at','inserted_at','captured_at','ingested_at','source_ingested_at','recorded_at')) > 0
    ORDER BY c.table_name`,
)).rows);

console.log(banner("§P5 · Accommodation-promotion tables (scoring pipeline · where records_new likely maps)"));
pretty((await pool.query(
  `WITH tables_with_ts AS (
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='nex'
      AND table_name IN ('food_business_promotion','food_business_promotion_audit','food_business_promotion_decision',
                         'food_business_next_action','food_business_completeness','food_business_freshness',
                         'category_candidate','category_candidate_score')
      AND column_name IN ('created_at','recorded_at','updated_at')
    GROUP BY table_name
  )
  SELECT table_name FROM tables_with_ts ORDER BY table_name`,
)).rows);

console.log(banner("§P6 · food_business_promotion insert activity since cutover"));
try {
  const r = await pool.query(`SELECT count(*) AS added_since_cutover FROM nex.food_business_promotion WHERE recorded_at >= $1::timestamptz`, [CUTOVER_2]);
  pretty(r.rows);
} catch (e) { console.log(`(query failed: ${e.message})`); }

console.log(banner("§P7 · category_candidate insert activity since cutover"));
try {
  const r = await pool.query(`SELECT count(*) AS added_since_cutover FROM nex.category_candidate WHERE created_at >= $1::timestamptz`, [CUTOVER_2]);
  pretty(r.rows);
} catch (e) { console.log(`(query failed: ${e.message})`); }

console.log(banner("§P8 · Category candidate score insert activity since cutover"));
try {
  const r = await pool.query(`SELECT count(*) AS added_since_cutover FROM nex.category_candidate_score WHERE recorded_at >= $1::timestamptz`, [CUTOVER_2]);
  pretty(r.rows);
} catch (e) { console.log(`(query failed: ${e.message})`); }

console.log(banner("§P9 · currently in-flight cycles · are they progressing or stuck?"));
pretty((await pool.query(
  `SELECT worker_config, worker_id,
          started_at,
          EXTRACT(EPOCH FROM (now() - started_at))::int AS age_s,
          (SELECT last_heartbeat_at FROM nex.worker_heartbeat h WHERE h.worker_id = wcr.worker_id ORDER BY last_heartbeat_at DESC LIMIT 1) AS last_hb,
          (SELECT EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int FROM nex.worker_heartbeat h WHERE h.worker_id = wcr.worker_id ORDER BY last_heartbeat_at DESC LIMIT 1) AS hb_stale_s
     FROM nex.worker_cycle_run wcr
    WHERE status='running' AND finished_at IS NULL
    ORDER BY started_at`,
)).rows);

await pool.end();
