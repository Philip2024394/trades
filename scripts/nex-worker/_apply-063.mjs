import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/063_nex_worker_reliability.sql", "utf8");
try { await pool.query(sql); console.log("migration 063 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const t = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='nex' AND table_name IN ('worker_heartbeat','worker_cycle_run') ORDER BY table_name`);
console.log("── tables ──"); for (const r of t.rows) console.log("  " + r.table_name);
const v = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema='nex' AND table_name IN ('worker_health_status','worker_24h_activity') ORDER BY table_name`);
console.log("── views ──"); for (const r of v.rows) console.log("  " + r.table_name);
const empty = await pool.query(`SELECT (SELECT count(*) FROM nex.worker_heartbeat)::int AS hb, (SELECT count(*) FROM nex.worker_cycle_run)::int AS cr, (SELECT count(*) FROM nex.worker_health_status)::int AS hs, (SELECT count(*) FROM nex.worker_24h_activity)::int AS act`);
console.log("── initial state ──");
console.log("  heartbeats:", empty.rows[0].hb, " cycle_runs:", empty.rows[0].cr, " health_rows:", empty.rows[0].hs, " 24h_rows:", empty.rows[0].act);
await pool.end();
