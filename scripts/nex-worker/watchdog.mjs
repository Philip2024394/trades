#!/usr/bin/env node
// NEX Worker Reliability · watchdog.
//
// Reads current health per worker · emits alert lines for any worker in
// WARNING/CRITICAL state. Never auto-restarts. Never auto-runs anything.
// Purely observational · logs to stdout + appends to nex.audit_log if the
// state changed since last check.
//
// Designed to be run manually or from a cron · alerts are for human action.
//
// USAGE
//   node --env-file=.env.local scripts/nex-worker/watchdog.mjs [--json]

import pg from "pg";
import { loadHealthStatus } from "./reliability.mjs";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const wantJson = process.argv.includes("--json");
const pool = new pg.Pool({ connectionString: url });

const health = await loadHealthStatus(pool);

const alerts = health.filter(h => h.health === "CRITICAL" || h.health === "WARNING");
const criticals = alerts.filter(h => h.health === "CRITICAL");
const warnings = alerts.filter(h => h.health === "WARNING");
const unknowns = health.filter(h => h.health === "UNKNOWN");
const healthies = health.filter(h => h.health === "HEALTHY");

if (wantJson) {
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    workers_monitored: health.length,
    counts: {
      HEALTHY: healthies.length,
      WARNING: warnings.length,
      CRITICAL: criticals.length,
      UNKNOWN: unknowns.length,
    },
    alerts: alerts.map(h => ({
      worker_id: h.worker_id,
      worker_type: h.worker_type,
      health: h.health,
      seconds_since_heartbeat: h.seconds_since_heartbeat,
      last_cycle_status: h.last_cycle_status,
      recent_failures_24h: h.recent_failures_24h,
    })),
  }, null, 2));
} else {
  console.log(`── WATCHDOG · ${new Date().toISOString()} ──`);
  console.log(`  workers monitored: ${health.length}`);
  console.log(`  HEALTHY:  ${healthies.length}`);
  console.log(`  WARNING:  ${warnings.length}`);
  console.log(`  CRITICAL: ${criticals.length}`);
  console.log(`  UNKNOWN:  ${unknowns.length}`);
  console.log("");
  if (alerts.length === 0) {
    console.log("  ✓ no alerts · all monitored workers are healthy or awaiting first cycle");
  } else {
    for (const a of alerts) {
      const label = a.health === "CRITICAL" ? "🔴 CRITICAL" : "🟡 WARNING";
      const hbAge = a.seconds_since_heartbeat != null ? `${a.seconds_since_heartbeat}s ago` : "never";
      console.log(`  ${label}  ${a.worker_id}  (${a.worker_type})`);
      console.log(`      heartbeat: ${hbAge}  last cycle: ${a.last_cycle_status ?? "none"}  failures24h: ${a.recent_failures_24h}`);
    }
  }
  console.log("");
  console.log(`  next action: humans review · watchdog NEVER auto-restarts`);
}

// Record the check in audit_log so we have a history of watchdog runs
try {
  await pool.query(
    `INSERT INTO nex.audit_log (entity_type, entity_id, action, actor, after_state, notes)
     VALUES ('worker_reliability', 'watchdog', 'watchdog_check', 'script:watchdog.mjs', $1::jsonb, $2)`,
    [
      JSON.stringify({
        workers_monitored: health.length,
        counts: {
          HEALTHY: healthies.length, WARNING: warnings.length,
          CRITICAL: criticals.length, UNKNOWN: unknowns.length,
        },
        alerts: alerts.length,
      }),
      alerts.length > 0
        ? `${alerts.length} alert(s): ${alerts.map(a => a.worker_id + "=" + a.health).join(" · ")}`
        : "no alerts",
    ]
  );
} catch (err) {
  // audit_log write is nice-to-have · never fail watchdog on this
  console.log(`  (audit_log write skipped: ${err.message})`);
}

await pool.end();
