// scripts/nex-forensics-persistence-check.mjs · v2 · focused persistence trace

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const banner = (t) => `\n${"═".repeat(70)}\n  ${t}\n${"═".repeat(70)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));

console.log(banner("Food snapshot activity · last 7h + 24h"));
pretty((await pool.query(`
  SELECT
    (SELECT count(*) FROM nex.food_business_source_snapshot WHERE source_ingested_at >= now() - interval '7 hours') AS food_snap_7h,
    (SELECT count(*) FROM nex.food_business_source_snapshot WHERE source_ingested_at >= now() - interval '24 hours') AS food_snap_24h,
    (SELECT max(source_ingested_at) FROM nex.food_business_source_snapshot) AS food_snap_latest
`)).rows);

console.log(banner("Accommodation snapshot activity · last 7h + 24h"));
pretty((await pool.query(`
  SELECT
    (SELECT count(*) FROM nex.accommodation_business_source_snapshot WHERE captured_at >= now() - interval '7 hours') AS accom_snap_7h,
    (SELECT count(*) FROM nex.accommodation_business_source_snapshot WHERE captured_at >= now() - interval '24 hours') AS accom_snap_24h,
    (SELECT max(captured_at) FROM nex.accommodation_business_source_snapshot) AS accom_snap_latest
`)).rows);

console.log(banner("The one accommodation cycle claiming records_new · full summary"));
const s = (await pool.query(`
  SELECT worker_config, records_new, finished_at, summary::text AS summary_text
  FROM nex.worker_cycle_run
  WHERE worker_config = 'accommodation:Bantul:prambanan'
    AND coalesce(records_new,0) > 0
  ORDER BY finished_at DESC LIMIT 1
`)).rows[0];
console.log(s ? `${s.worker_config} @ ${s.finished_at} · records_new=${s.records_new}\nSUMMARY:\n${s.summary_text}` : "no such cycle");

console.log(banner("Transport failed cycle · full summary (understand why status=failed with 0 errors)"));
const t = (await pool.query(`
  SELECT worker_config, status, duration_ms, finished_at, summary::text AS summary_text
  FROM nex.worker_cycle_run
  WHERE worker_config='transport:Yogyakarta:query-universe-v1' AND status='failed'
  ORDER BY finished_at DESC LIMIT 1
`)).rows[0];
console.log(t ? `${t.worker_config} status=${t.status} dur=${t.duration_ms}ms\nSUMMARY:\n${t.summary_text}` : "no such cycle");

console.log(banner("Market failed cycle · full summary (understand persistent errors)"));
const m = (await pool.query(`
  SELECT worker_config, status, errors_count, records_processed, duration_ms, finished_at, summary::text AS summary_text
  FROM nex.worker_cycle_run
  WHERE worker_config LIKE 'market:%' AND status='failed'
  ORDER BY finished_at DESC LIMIT 1
`)).rows[0];
console.log(m ? `${m.worker_config} status=${m.status} errors=${m.errors_count} processed=${m.records_processed} dur=${m.duration_ms}ms\nSUMMARY (first 1200 chars):\n${m.summary_text?.slice(0,1200)}` : "no such cycle");

await pool.end();
