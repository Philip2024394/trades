#!/usr/bin/env node
// NEX Acquisition Workforce · read-only health-check CLI.
//
// Usage:
//   node scripts/nex-acquisition-workforce/health-check.mjs
//   node scripts/nex-acquisition-workforce/health-check.mjs --json
//
// Zero writes. Reads nex.worker_heartbeat + nex.worker_cycle_run and prints
// a structured picture of the acquisition workforce health per Philip's
// 10-state model. Safe to run at any time from any terminal.

import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { deriveHealthState } from "./lib/health-state.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// Load .env.local (same convention as other NEX scripts)
if (existsSync(join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const argv = process.argv.slice(2);
const jsonMode = argv.includes("--json");

(async () => {
  const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 2 });

  let health;
  try {
    health = await deriveHealthState(pool, {});
  } catch (e) {
    console.error(`[health-check] deriveHealthState failed: ${e.message}`);
    console.error(`  Postgres URL: ${NEX_POSTGRES_URL.replace(/:[^:@]+@/, ":****@")}`);
    process.exit(2);
  } finally {
    await pool.end();
  }

  if (jsonMode) {
    console.log(JSON.stringify(health, null, 2));
    process.exit(0);
  }

  const STATE_COLOR = {
    STARTING:            "\x1b[36m",  // cyan
    ALIVE:               "\x1b[36m",
    PROCESSING:          "\x1b[36m",
    PRODUCTIVE:          "\x1b[32m",  // green
    WAITING_FOR_WORK:    "\x1b[33m",  // yellow
    WAITING_FOR_NETWORK: "\x1b[33m",
    WAITING_FOR_PROVIDER:"\x1b[33m",
    STALLED:             "\x1b[31m",  // red
    FAILED:              "\x1b[31m",
    RECOVERING:          "\x1b[35m",  // magenta
    UNKNOWN:             "\x1b[90m",
  };
  const reset = "\x1b[0m";
  const clr = STATE_COLOR[health.state] ?? "";

  console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  NEX ACQUISITION WORKFORCE · HEALTH SNAPSHOT                       ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════╣`);
  console.log(`║  taken at:  ${health.at.padEnd(53)}║`);
  console.log(`║  STATE:     ${clr}${health.state.padEnd(53)}${reset}║`);
  console.log(`╚════════════════════════════════════════════════════════════════════╝`);

  console.log(`\n Reasons:`);
  for (const r of health.reasons) console.log(`   · ${r}`);

  console.log(`\n Supervisor (worker_id='${health.supervisor?.worker_id ?? "acquisition-supervisor"}'):`);
  if (!health.supervisor) {
    console.log(`   ⚠ No heartbeat row exists yet · supervisor has never run`);
  } else {
    const s = health.supervisor;
    console.log(`   last_status         : ${s.last_status}`);
    console.log(`   last_heartbeat_at   : ${s.last_heartbeat_at}`);
    console.log(`   last_heartbeat_age  : ${(s.last_heartbeat_age_ms / 1000).toFixed(1)}s`);
    console.log(`   declared_context    : ${s.worker_config ?? "(none)"}`);
    console.log(`   last_cycle_run_id   : ${s.last_cycle_run_id ?? "(none)"}`);
  }

  console.log(`\n Cycle statistics (all category:* workers + supervisor):`);
  console.log(`   completed_5m        : ${health.cycles.completed_5m}`);
  console.log(`   completed_15m       : ${health.cycles.completed_15m}   (productivity window)`);
  console.log(`   completed_1h        : ${health.cycles.completed_1h}`);
  console.log(`   running_now_fresh   : ${health.cycles.running_now_fresh}   (running AND started_at within 60m · counts as active work)`);
  console.log(`   running_now_all     : ${health.cycles.running_now_all}   (all status='running' regardless of age)`);
  if (health.cycles.zombie_running > 0) {
    console.log(`   \x1b[33mzombie_running      : ${health.cycles.zombie_running}   ⚠ started > 60m ago · never finished · orphan rows\x1b[0m`);
  }
  console.log(`   records_new_1h      : ${health.cycles.records_new_1h}`);
  console.log(`   last_completed_at   : ${health.cycles.last_completed_at ?? "(never)"}`);
  console.log(`   last_started_at     : ${health.cycles.last_started_at   ?? "(never)"}`);

  console.log(`\n Recent child workers (last hour, top 20):`);
  if (health.children.length === 0) {
    console.log(`   (no recent child heartbeats)`);
  } else {
    for (const c of health.children) {
      const ageStr = c.last_heartbeat_age_ms != null ? `${(c.last_heartbeat_age_ms / 1000).toFixed(0)}s ago` : "never";
      console.log(`   ${c.last_status.padEnd(10)} · ${(c.worker_type ?? "").padEnd(25)} · ${(c.worker_config ?? "").padEnd(45)} · ${ageStr}`);
    }
  }

  console.log(`\n Thresholds:`);
  console.log(`   HEARTBEAT_FRESH_MS  : ${health.thresholds.HEARTBEAT_FRESH_MS}`);
  console.log(`   PRODUCTIVE_WINDOW_MS: ${health.thresholds.PRODUCTIVE_WINDOW_MS}`);
  console.log(`   STALL_WINDOW_MS     : ${health.thresholds.STALL_WINDOW_MS}`);
  console.log(`   STARTING_WINDOW_MS  : ${health.thresholds.STARTING_WINDOW_MS}`);
  console.log("");

  process.exit(0);
})();
