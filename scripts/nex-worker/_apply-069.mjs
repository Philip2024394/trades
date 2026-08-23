import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/069_nex_worker_missed_runs.sql", "utf8");
try { await pool.query(sql); console.log("migration 069 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const t = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='nex' AND table_name='worker_schedule'`);
const v = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema='nex' AND table_name IN ('worker_expected_runs','worker_missed_runs_24h','worker_health_status') ORDER BY table_name`);
console.log("── tables ──"); for (const r of t.rows) console.log("  " + r.table_name);
console.log("── views ──"); for (const r of v.rows) console.log("  " + r.table_name);
const empty = await pool.query(`SELECT (SELECT count(*) FROM nex.worker_schedule)::int AS sched, (SELECT count(*) FROM nex.worker_expected_runs)::int AS exp, (SELECT count(*) FROM nex.worker_missed_runs_24h)::int AS missed`);
console.log("── initial state ──"); console.log("  schedules:", empty.rows[0].sched, "· expected_runs:", empty.rows[0].exp, "· missed_24h:", empty.rows[0].missed);
await pool.end();
