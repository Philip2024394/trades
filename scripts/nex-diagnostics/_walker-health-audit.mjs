#!/usr/bin/env node
// scripts/nex-diagnostics/_walker-health-audit.mjs
//
// WALKER HEALTH AUDIT · READ-ONLY · no code changes · no cadence changes · no restarts
//
// Doctrine anchor: Philip 2026-08-23 · establish PROCESS ALIVE ≠ HEALTHY through stages:
//   PROCESS ALIVE → SCHEDULE FIRING → WALKER EXECUTING → SOURCE RESPONDING →
//   DATA CHANGING → PROVENANCE PRESERVED
//
// Reports per-Walker: PID · last tick · previous tick · cadence · last discovery ·
//   recent new rows · recent updates · exit · errors · verdict
//
// Detects silent-stall problem (alive process doing nothing).

import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

const WALKERS = [
  { key: "acquisition:food:Yogyakarta",         short: "food",   businessTable: "food_business",         provenanceTable: "food_business_field_provenance",         workerConfigLike: "food:Yogyakarta:%" },
  { key: "acquisition:accommodation:Yogyakarta", short: "accom",  businessTable: "accommodation_business", provenanceTable: "accommodation_business_field_provenance", workerConfigLike: "accommodation:Yogyakarta:%" },
];

// ── STAGE 1 · Process evidence ────────────────────────────────────────
function listNodeProcesses() {
  try {
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq node.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" });
    return out.split(/\r?\n/).filter(Boolean).map((l) => {
      const parts = l.replace(/"/g, "").split(",");
      return { image: parts[0], pid: parts[1], memKB: Number((parts[4] || "0").replace(/[^\d]/g, "")) };
    });
  } catch { return []; }
}
function readSessionFile() {
  const path = "data/nex-scheduler/walker-session.json";
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}
function readSchedulerLogTail(n = 40) {
  const path = ".nex-scheduler.log";
  if (!existsSync(path)) return null;
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.slice(-n);
  } catch { return null; }
}

// ── STAGE 2/3/4 · Scheduler + Walker + Source evidence via DB ─────────
async function heartbeat(walkerKey) {
  const r = await pool.query(`
    SELECT worker_id, last_heartbeat_at, last_status, worker_config,
           EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS age_seconds
      FROM nex.worker_heartbeat
     WHERE worker_id = $1
     ORDER BY last_heartbeat_at DESC LIMIT 1
  `, [walkerKey]);
  return r.rows[0] ?? null;
}

async function recentCycles(walkerConfigLike, limit = 10) {
  const r = await pool.query(`
    SELECT id, worker_config, started_at, finished_at, status,
           records_processed, records_new, errors_count,
           EXTRACT(EPOCH FROM (finished_at - started_at))::int AS duration_s
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND worker_config LIKE $1
     ORDER BY started_at DESC LIMIT $2
  `, [walkerConfigLike, limit]);
  return r.rows;
}

async function cyclesSince(walkerConfigLike, secondsAgo) {
  const r = await pool.query(`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE status='completed')::int AS completed,
           COUNT(*) FILTER (WHERE status='failed')::int AS failed,
           COALESCE(SUM(records_processed),0)::int AS processed_sum,
           COALESCE(SUM(records_new),0)::int AS new_sum,
           COALESCE(SUM(errors_count),0)::int AS errors_sum
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition'
       AND worker_config LIKE $1
       AND started_at >= now() - ($2 * interval '1 second')
  `, [walkerConfigLike, secondsAgo]);
  return r.rows[0];
}

// ── STAGE 5 · Data changing evidence ──────────────────────────────────
async function recentInserts(businessTable, secondsAgo) {
  const r = await pool.query(`
    SELECT COUNT(*)::int AS n,
           MAX(source_ingested_at) AS latest_insert
      FROM nex.${businessTable}
     WHERE city='Yogyakarta' AND source_ingested_at >= now() - ($1 * interval '1 second')
  `, [secondsAgo]);
  return r.rows[0];
}

async function updatesSince(businessTable, secondsAgo) {
  // Note: NEX doesn't have an explicit updated_at on the business tables
  // (except accommodation which has it). Use source_updated_at where present.
  const columns = await pool.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='nex' AND table_name=$1
       AND column_name IN ('source_updated_at','updated_at')
  `, [businessTable]);
  const timeCol = columns.rows.map((r) => r.column_name).includes("updated_at") ? "updated_at" : "source_updated_at";
  const r = await pool.query(`
    SELECT COUNT(*)::int AS n, MAX(${timeCol}) AS latest_update
      FROM nex.${businessTable}
     WHERE city='Yogyakarta' AND ${timeCol} >= now() - ($1 * interval '1 second')
  `, [secondsAgo]);
  return { ...r.rows[0], timeCol };
}

// ── STAGE 6 · Provenance evidence ─────────────────────────────────────
async function provenanceSince(provenanceTable, secondsAgo) {
  const r = await pool.query(`
    SELECT COUNT(*)::int AS n, MAX(written_at) AS latest_provenance
      FROM nex.${provenanceTable}
     WHERE written_at >= now() - ($1 * interval '1 second')
  `, [secondsAgo]);
  return r.rows[0];
}

// ── Helpers ───────────────────────────────────────────────────────────
function fmtTS(d) {
  if (!d) return "—";
  const iso = typeof d === "string" ? d : d.toISOString();
  return iso.replace("T", " ").replace(".000Z", "Z");
}
function fmtAge(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds/60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds/3600)}h ago`;
  return `${Math.round(seconds/86400)}d ago`;
}
function humanMB(kb) { return `${(kb/1024).toFixed(0)} MB`; }

// ── Main audit ────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  WALKER HEALTH AUDIT · READ-ONLY · no code / cadence / scope / restart    ║");
  console.log("║  Philip 2026-08-23 · establish PROCESS ALIVE ≠ HEALTHY through 6 stages    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const nowIso = new Date().toISOString();
  console.log(`Audit run at: ${nowIso}\n`);

  // ── STAGE 1 · PROCESS ALIVE ──
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log("STAGE 1 · PROCESS ALIVE  (tasklist + session file)");
  console.log("═════════════════════════════════════════════════════════════════════════");
  const session = readSessionFile();
  const nodeProcs = listNodeProcesses();
  if (!session) {
    console.log("  ❌ walker-session.json NOT FOUND · scheduler has not written a session file");
  } else {
    console.log(`  session file:  sessionStartedAt=${session.sessionStartedAt}  pid=${session.pid}`);
    const uptime = Math.max(0, Math.round((Date.now() - new Date(session.sessionStartedAt).getTime()) / 1000));
    console.log(`  uptime since session start:  ${fmtAge(uptime)}`);
    const alive = nodeProcs.some((p) => String(p.pid) === String(session.pid));
    console.log(alive
      ? `  ✅ scheduler PID ${session.pid} IS in tasklist (alive)`
      : `  ❌ scheduler PID ${session.pid} is NOT in tasklist (dead)`);
    const proc = nodeProcs.find((p) => String(p.pid) === String(session.pid));
    if (proc) console.log(`  memory: ${humanMB(proc.memKB)}`);
  }
  console.log(`\n  total node.exe processes on Victus:`);
  for (const p of nodeProcs) console.log(`    pid ${String(p.pid).padStart(6)}  ${humanMB(p.memKB).padStart(9)}`);
  console.log(`  system free RAM: ${(os.freemem()/1024/1024/1024).toFixed(2)} GB / ${(os.totalmem()/1024/1024/1024).toFixed(2)} GB`);
  console.log("");

  // ── STAGE 2 · SCHEDULE FIRING (log tail) ──
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log("STAGE 2 · SCHEDULE FIRING  (.nex-scheduler.log tail)");
  console.log("═════════════════════════════════════════════════════════════════════════");
  const logTail = readSchedulerLogTail(20);
  if (!logTail) {
    console.log("  (no .nex-scheduler.log file · cannot verify tick emission from log)");
  } else {
    for (const line of logTail) console.log(`  ${line}`);
  }
  console.log("");

  // ── STAGE 3/4/5/6 · Per-Walker DB evidence ──
  const results = [];
  for (const w of WALKERS) {
    console.log("═════════════════════════════════════════════════════════════════════════");
    console.log(`WALKER: ${w.key}`);
    console.log("═════════════════════════════════════════════════════════════════════════");

    // ── STAGE 3 · WALKER EXECUTING (heartbeat) ──
    console.log("── STAGE 3 · WALKER EXECUTING (heartbeat) ──");
    const hb = await heartbeat(w.key);
    if (!hb) {
      console.log("  ❌ no heartbeat row found for this worker_id");
      results.push({ walker: w.short, process: "—", scheduler: "—", lastTick: "—", source: "—",
                     newRows: 0, updates: 0, errors: 0, dataChanging: "—", verdict: "❌ NO HEARTBEAT" });
      continue;
    }
    const hbAge = hb.age_seconds;
    const hbTier = hbAge == null ? "❌" : hbAge < 60 ? "🟠 running" : hbAge < 900 ? "🟢 idle" : hbAge < 1800 ? "⚠️ overdue" : "🔴 stopped";
    console.log(`  last_heartbeat_at:  ${fmtTS(hb.last_heartbeat_at)}  (age ${fmtAge(hbAge)})  ${hbTier}`);
    console.log(`  last_status:        ${hb.last_status}`);
    console.log(`  worker_config:      ${hb.worker_config}`);

    // ── STAGE 4 · Recent cycles ──
    console.log("\n── STAGE 4 · Recent cycles (last 10) ──");
    const recent = await recentCycles(w.workerConfigLike, 10);
    if (recent.length === 0) {
      console.log("  (no cycle_run rows for this walker)");
    } else {
      for (const c of recent) {
        const err = c.errors_count > 0 || c.status === "failed";
        const marker = err ? "❌" : "✓";
        console.log(`  ${marker} ${fmtTS(c.started_at)}  ${c.worker_config.padEnd(45)}  ${c.status.padEnd(10)}  proc=${String(c.records_processed ?? "-").padStart(4)}  new=${String(c.records_new ?? "-").padStart(4)}  err=${c.errors_count}  dur=${c.duration_s ?? "-"}s`);
      }
    }
    // Cadence between the most recent two cycles
    if (recent.length >= 2) {
      const gapSec = Math.round((new Date(recent[0].started_at).getTime() - new Date(recent[1].started_at).getTime()) / 1000);
      console.log(`  cadence · most-recent gap between cycle starts: ${gapSec}s`);
    }

    // ── STAGE 5 · Cycle activity in last hour ──
    console.log("\n── STAGE 5 · Cycle activity in last 60 min ──");
    const c60 = await cyclesSince(w.workerConfigLike, 3600);
    console.log(`  cycles: ${c60.n}  completed: ${c60.completed}  failed: ${c60.failed}`);
    console.log(`  processed sum: ${c60.processed_sum}  new sum: ${c60.new_sum}  errors sum: ${c60.errors_sum}`);

    // ── STAGE 5b · Data changing (inserts + updates in last hour) ──
    console.log("\n── STAGE 5b · DATA CHANGING (business table inserts / updates last 60 min) ──");
    const ins = await recentInserts(w.businessTable, 3600);
    console.log(`  new rows (source_ingested_at): ${ins.n}  latest_insert=${fmtTS(ins.latest_insert)}`);
    const upd = await updatesSince(w.businessTable, 3600);
    console.log(`  updated rows (${upd.timeCol}): ${upd.n}  latest_update=${fmtTS(upd.latest_update)}`);

    // ── STAGE 6 · Provenance preserved (last hour) ──
    console.log("\n── STAGE 6 · PROVENANCE PRESERVED (last 60 min) ──");
    const prov = await provenanceSince(w.provenanceTable, 3600);
    console.log(`  new provenance rows: ${prov.n}  latest_written=${fmtTS(prov.latest_provenance)}`);

    // ── Verdict ──
    const processAlive = session && nodeProcs.some((p) => String(p.pid) === String(session.pid));
    const scheduleFiring = c60.n > 0;
    const walkerExecuting = hbAge != null && hbAge < 1800;
    const sourceResponding = c60.processed_sum > 0;
    const dataChanging = ins.n > 0 || upd.n > 0;
    const provenancePreserved = prov.n > 0;

    let verdict;
    if (!processAlive)                verdict = "🔴 PROCESS DEAD";
    else if (!scheduleFiring)         verdict = "🔴 SCHEDULE NOT FIRING (0 cycles in last hour)";
    else if (!walkerExecuting)        verdict = "🔴 WALKER NOT EXECUTING (heartbeat stopped)";
    else if (!sourceResponding)       verdict = "🟡 SOURCE NOT RESPONDING (cycles fired but 0 records processed)";
    else if (!dataChanging)           verdict = "🟡 GENUINE-BUT-QUIET (walker eating but no new or updated rows in last hour · normal in dedupe-saturated territory)";
    else if (!provenancePreserved)    verdict = "⚠️ PROVENANCE GAP (data changed but no provenance rows)";
    else                              verdict = "🟢 GENUINELY PROGRESSING";

    console.log(`\n  VERDICT: ${verdict}\n`);

    results.push({
      walker: w.short,
      process: processAlive ? "🟢" : "🔴",
      scheduler: scheduleFiring ? "🟢" : "🔴",
      lastTick: fmtTS(hb.last_heartbeat_at),
      source: sourceResponding ? "🟢" : "🔴",
      newRows: ins.n,
      updates: upd.n,
      errors: c60.errors_sum,
      dataChanging: dataChanging ? "🟢" : "🟡",
      verdict,
    });
  }

  // ── Final compact table (Philip's shape) ──
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log("FINAL COMPACT TABLE (Philip's requested shape)");
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(`  Walker         Process  Scheduler  Last tick                 Source  New rows  Updates  Errors  Data changing  Verdict`);
  console.log(`  ─────────────  ───────  ─────────  ────────────────────────  ──────  ────────  ───────  ──────  ─────────────  ──────────────────`);
  for (const r of results) {
    console.log(`  ${r.walker.padEnd(13)}  ${r.process.padEnd(7)}  ${r.scheduler.padEnd(9)}  ${(r.lastTick||"").padEnd(24)}  ${r.source.padEnd(6)}  ${String(r.newRows).padStart(8)}  ${String(r.updates).padStart(7)}  ${String(r.errors).padStart(6)}  ${r.dataChanging.padEnd(13)}  ${r.verdict}`);
  }
  console.log("");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
