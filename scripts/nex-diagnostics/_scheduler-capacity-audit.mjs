#!/usr/bin/env node
// Scheduler concurrency + Victus capacity · read-only

import pg from "pg";
import os from "node:os";
import { execFileSync } from "node:child_process";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

function humanMB(bytes) { return `${(bytes / 1024 / 1024).toFixed(0)} MB`; }
function humanGB(bytes) { return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`; }

function listNodeProcesses() {
  try {
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq node.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" });
    const rows = out.split(/\r?\n/).filter(Boolean).map((l) => {
      const parts = l.replace(/"/g, "").split(",");
      return { pid: parts[1], memKB: Number(parts[4].replace(/[^\d]/g, "")) };
    });
    return rows;
  } catch { return []; }
}

async function pgStats() {
  const r = await pool.query(`
    SELECT
      current_setting('max_connections')::int AS max_connections,
      (SELECT COUNT(*) FROM pg_stat_activity WHERE datname='nex_dev')::int AS active_nex_dev,
      (SELECT COUNT(*) FROM pg_stat_activity)::int AS active_total
  `);
  const byApp = await pool.query(`
    SELECT COALESCE(application_name,'-') AS app, COUNT(*)::int AS n
      FROM pg_stat_activity WHERE datname='nex_dev'
      GROUP BY 1 ORDER BY n DESC
  `);
  return { ...r.rows[0], byApp: byApp.rows };
}

async function schedulerWorkersFromCode() {
  // Static intel from src/lib/nex-hq/walker-verticals.ts + scripts/nex-dev-scheduler.mjs
  return [
    { key: "acquisition:food:Yogyakarta",              kind: "chained non-stop (spawn)",            cadence: "~33s (30s cycle + 3s polite)" },
    { key: "acquisition:accommodation:Yogyakarta",     kind: "chained non-stop (spawn)",            cadence: "~33s" },
    { key: "cle:conversation",                         kind: "interval spawn",                       cadence: "600s (10 min)" },
    { key: "brain:cron-tick",                          kind: "interval http",                        cadence: "180s (3 min)" },
    { key: "social:cron-tick",                         kind: "interval http",                        cadence: "60s (1 min)" },
    { key: "promotion:food:Yogyakarta:quality-check",  kind: "interval spawn",                       cadence: "1800s (30 min)" },
  ];
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║  DIAGNOSTIC · SCHEDULER CONCURRENCY + VICTUS CAPACITY · read-only ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  console.log("── System (Victus) ──────────────────────────────────────────");
  console.log(`  hostname          ${os.hostname()}`);
  console.log(`  platform          ${os.platform()} ${os.release()}`);
  console.log(`  arch              ${os.arch()}`);
  console.log(`  cpu               ${os.cpus().length} logical cores · ${os.cpus()[0]?.model ?? "unknown"}`);
  console.log(`  total memory      ${humanGB(os.totalmem())}`);
  console.log(`  free memory       ${humanGB(os.freemem())}  (${(100*os.freemem()/os.totalmem()).toFixed(1)}%)`);
  console.log(`  load avg (1/5/15) ${os.loadavg().map((n)=>n.toFixed(2)).join("/")}`);
  console.log(`  uptime            ${(os.uptime()/3600).toFixed(1)} h\n`);

  console.log("── Current node.exe processes ───────────────────────────────");
  const procs = listNodeProcesses();
  let totalNodeMemKB = 0;
  for (const p of procs) {
    totalNodeMemKB += p.memKB;
    console.log(`  pid ${p.pid.padStart(6)}  ${humanMB(p.memKB * 1024).padStart(9)}`);
  }
  console.log(`  ─────────`);
  console.log(`  ${procs.length} node processes · ${humanMB(totalNodeMemKB * 1024)} total RAM\n`);

  console.log("── PostgreSQL capacity ──────────────────────────────────────");
  const pg = await pgStats();
  console.log(`  max_connections          ${pg.max_connections}`);
  console.log(`  currently active (nex_dev) ${pg.active_nex_dev} / ${pg.max_connections}`);
  console.log(`  currently active (all DBs) ${pg.active_total} / ${pg.max_connections}`);
  console.log(`  by application:`);
  for (const row of pg.byApp) console.log(`    ${row.app.padEnd(30)} ${row.n}`);
  console.log();

  console.log("── Scheduled workers (from DEV_SCHEDULE) ────────────────────");
  const workers = await schedulerWorkersFromCode();
  for (const w of workers) console.log(`  · ${w.key.padEnd(45)}  ${w.kind.padEnd(30)}  ${w.cadence}`);
  console.log(`  → ${workers.length} concurrent workers today (2 acquisition + 4 support)\n`);

  console.log("── Governor: what DOES exist today ──────────────────────────");
  console.log("  ✓ setInterval fires each interval-mode worker regardless of load");
  console.log("  ✓ chained loop for acquisition (Promise chain + 3s polite delay)");
  console.log("  ✓ child-process isolation (Walker crash cannot kill scheduler or siblings)");
  console.log("  ✓ per-Walker cursor persistence (independent zone rotation state)");
  console.log("  ✓ per-Walker heartbeat row (independent health tracking)");
  console.log("  ✓ Postgres pool per lib (nex-food/db · nex-accommodation/db)");
  console.log("  ✓ pool.connectionTimeoutMillis bumped to 15s (Windows dev cold-start)\n");

  console.log("── Governor: what does NOT exist yet ────────────────────────");
  console.log("  ✗ NO resource check before spawning next cycle");
  console.log("  ✗ NO CPU / RAM monitoring in scheduler process");
  console.log("  ✗ NO cross-Walker OSM rate-limit awareness (each polite-delays only itself)");
  console.log("  ✗ NO auto-throttle when DB pool nears max");
  console.log("  ✗ NO auto-pause for degraded Walker (heartbeat > 2× cadence)");
  console.log("  ✗ NO hot-add (must restart scheduler to register new Walker)");
  console.log("  ✗ NO governor state visible in HQ\n");

  // Empirical per-Walker RAM footprint estimate.
  // Each acquisition cycle spawns a child node process that peaks briefly.
  // Rough numbers from observed tasklist: scheduler ~50-80 MB, each cycle child ~50-100 MB peak.
  // With 3s polite delay and ~30s cycle, at most 1 child per Walker is alive at a time.
  console.log("── Rough per-Walker RAM math ────────────────────────────────");
  console.log("  scheduler parent process       ~50-80 MB (persistent)");
  console.log("  per-Walker cycle child (peak)  ~50-100 MB (transient · 20-40s)");
  console.log("  chained mode = at most 1 child per Walker alive at a time");
  console.log("  6 concurrent workers today ≈ 300-600 MB peak Walker load");
  console.log("  + Next.js dev server (Turbopack)  ~500-1000 MB\n");

  console.log("── Safe concurrency ceiling (Victus · 8 GB RAM · RTX 2050) ─");
  const totalGB = os.totalmem() / 1024 / 1024 / 1024;
  const budgetForWalkersGB = 2.0;                    // reserve OS + Next dev + Postgres + browser headroom
  const perWalkerPeakMB = 100;                        // pessimistic
  const perWalkerAvgMB  = 60;                         // typical
  const safePeak = Math.floor((budgetForWalkersGB * 1024) / perWalkerPeakMB);
  const safeAvg  = Math.floor((budgetForWalkersGB * 1024) / perWalkerAvgMB);
  console.log(`  total RAM              ${totalGB.toFixed(1)} GB`);
  console.log(`  budgeted for Walkers   ${budgetForWalkersGB} GB (reserves OS + Next + Postgres + browser)`);
  console.log(`  per-Walker peak (pessimistic)  ${perWalkerPeakMB} MB → safe ceiling ~${safePeak} concurrent walkers`);
  console.log(`  per-Walker typical avg         ${perWalkerAvgMB} MB → practical ceiling ~${safeAvg} concurrent walkers`);
  console.log(`  Postgres pool ceiling  ${Math.floor(pg.max_connections * 0.6)} conns for Walkers (60% of ${pg.max_connections}, leaves 40% for Next/HQ)\n`);

  console.log("── Recommendation ───────────────────────────────────────────");
  console.log("  Yogyakarta laboratory · SAFE to add up to 5 acquisition walkers total");
  console.log("  (food + accommodation + services + beauty + property) without a governor.");
  console.log("  Adding Walker #6+ requires the governor design (resource pressure signals + auto-throttle).");
  console.log("  Do NOT add non-Yogyakarta cities without approval (Yogya-as-laboratory doctrine).");
  console.log("");

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
