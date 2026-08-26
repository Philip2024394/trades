// scripts/nex-diag-stall.mjs
// Diagnose the 12:54-13:09 UTC workforce stall.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const b = (t) => `\n${"═".repeat(70)}\n  ${t}\n${"═".repeat(70)}`;
const p = (r) => console.log(JSON.stringify(r, null, 2));
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

try {
  // 1 · are they working RIGHT NOW?
  console.log(b("§A · workforce activity in the last 5 minutes"));
  p(await q(`
    SELECT
      (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '5 minutes') AS started_last_5min,
      (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at >= now() - interval '5 minutes') AS finished_last_5min,
      (SELECT count(*) FROM nex.worker_heartbeat WHERE last_heartbeat_at >= now() - interval '5 minutes') AS heartbeats_last_5min,
      (SELECT max(started_at)::text FROM nex.worker_cycle_run) AS most_recent_cycle_start,
      (SELECT max(finished_at)::text FROM nex.worker_cycle_run) AS most_recent_cycle_finish,
      (SELECT max(last_heartbeat_at)::text FROM nex.worker_heartbeat) AS most_recent_heartbeat
  `));

  // 2 · what was the LAST cycle to complete successfully?
  console.log(b("§B · last 5 completed cycles"));
  p(await q(`
    SELECT worker_type, worker_config, worker_id, started_at, finished_at, status, records_new, duration_ms
    FROM nex.worker_cycle_run
    WHERE finished_at IS NOT NULL
    ORDER BY finished_at DESC LIMIT 5
  `));

  // 3 · what about the orchestrator picks — did the orchestrator stop deciding?
  console.log(b("§C · last 10 orchestrator picks"));
  await q(`SELECT to_regclass('nex.discovery_orchestrator_pick')`).then(async r => {
    if (r[0]?.to_regclass) {
      // Adapt to the actual columns present
      const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='nex' AND table_name='discovery_orchestrator_pick' ORDER BY ordinal_position`)).map(c => c.column_name);
      console.log("  columns:", cols.join(", "));
      p(await q(`SELECT * FROM nex.discovery_orchestrator_pick ORDER BY 1 DESC LIMIT 10`));
    } else {
      console.log("(table not present)");
    }
  });

  // 4 · provider rate lease state — is the governor holding leases nobody released?
  console.log(b("§D · provider rate leases (open + last released)"));
  await q(`SELECT to_regclass('nex.provider_rate_lease')`).then(async r => {
    if (r[0]?.to_regclass) {
      p(await q(`
        SELECT provider, count(*) AS total_leases,
               count(*) FILTER (WHERE released_at IS NULL) AS open_leases,
               max(acquired_at)::text AS most_recent_acquire,
               max(released_at)::text AS most_recent_release,
               min(acquired_at) FILTER (WHERE released_at IS NULL)::text AS oldest_open_acquire
        FROM nex.provider_rate_lease
        GROUP BY provider ORDER BY provider
      `));
      const lcols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='nex' AND table_name='provider_rate_lease' ORDER BY ordinal_position`)).map(c => c.column_name);
      console.log("\n  lease columns:", lcols.join(", "));
      console.log("\n  open leases (detail):");
      p(await q(`SELECT *, now() - acquired_at AS age_open FROM nex.provider_rate_lease WHERE released_at IS NULL ORDER BY acquired_at ASC LIMIT 20`));
    } else {
      console.log("(table not present)");
    }
  });

  // 5 · scheduler job status
  console.log(b("§E · scheduler job status (last 20 runs across all jobs)"));
  await q(`SELECT to_regclass('nex.scheduler_run')`).then(async r => {
    if (r[0]?.to_regclass) {
      p(await q(`
        SELECT job_name, started_at, finished_at, status, error, duration_ms
        FROM nex.scheduler_run
        ORDER BY started_at DESC LIMIT 20
      `));
    } else {
      console.log("(nex.scheduler_run not present)");
    }
  });

  // 6 · rotation state — is the controller still tracking combos?
  console.log(b("§F · discovery rotation state (last touched)"));
  await q(`SELECT to_regclass('nex.discovery_rotation_state')`).then(async r => {
    if (r[0]?.to_regclass) {
      p(await q(`
        SELECT city, category, state, current_streak, last_cycle_started_at, state_entered_at, updated_at
        FROM nex.discovery_rotation_state
        ORDER BY updated_at DESC LIMIT 8
      `));
    } else {
      console.log("(table not present)");
    }
  });

  // 7 · pattern check — the 9 zombies from 12:54-13:09 · what config family?
  console.log(b("§G · zombie config pattern (13:00 UTC batch)"));
  p(await q(`
    SELECT worker_type, worker_id,
           split_part(worker_config, ':', 1) AS config_family,
           count(*) AS zombies,
           string_agg(worker_config, ' | ' ORDER BY worker_config) AS configs
    FROM nex.worker_cycle_run
    WHERE finished_at IS NULL AND started_at >= now() - interval '6 hours'
    GROUP BY 1,2,3 ORDER BY zombies DESC
  `));

  await pool.end();
} catch (err) {
  console.error("DIAG FAILED:", err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
}
