// Smoke tests for the reliability layer.
//
// Verifies:
//   1. emitHeartbeat writes + upserts correctly
//   2. startCycleRun + finishCycleRun record complete cycles
//   3. evaluateHealth returns correct states for HEALTHY/WARNING/CRITICAL/UNKNOWN inputs
//   4. worker_health_status view returns the same states
//   5. Failure-recovery simulation (worker fails then recovers)
//   6. Watchdog detects stale heartbeats
//
// Cleans up all test-fixture rows before exit. Does NOT touch real worker data.

import pg from "pg";
import { emitHeartbeat, startCycleRun, finishCycleRun, evaluateHealth, loadHealthStatus } from "./reliability.mjs";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const T = { pass: 0, fail: 0, errors: [] };
function check(name, cond, detail = "") {
  if (cond) { T.pass++; console.log(`  ✓ ${name}${detail ? "  · " + detail : ""}`); }
  else { T.fail++; T.errors.push(name); console.log(`  ✗ ${name}${detail ? "  · " + detail : ""}`); }
}

console.log("═".repeat(72));
console.log("NEX RELIABILITY LAYER · SMOKE TESTS");
console.log("═".repeat(72));

const testWorkers = [
  "test:reliability:healthy",
  "test:reliability:warning",
  "test:reliability:critical_stale",
  "test:reliability:critical_failures",
  "test:reliability:unknown",
];

// Clean any prior test data
for (const wid of testWorkers) {
  await pool.query(`DELETE FROM nex.worker_cycle_run WHERE worker_id = $1`, [wid]);
  await pool.query(`DELETE FROM nex.worker_heartbeat WHERE worker_id = $1`, [wid]);
}

// ── TEST 1 · pure evaluator (no DB) ─────────────────────────────────────────
console.log("\n── TEST 1 · evaluateHealth pure function ──");
{
  const now = new Date("2026-08-21T12:00:00Z");
  const freshHb = new Date("2026-08-21T11:55:00Z");   // 5min ago
  const staleHb = new Date("2026-08-21T10:00:00Z");   // 120min ago
  const oldHb = new Date("2026-08-21T11:30:00Z");     // 30min ago
  check("unknown when no heartbeat", evaluateHealth({ lastHeartbeatAt: null, now }).health === "UNKNOWN");
  check("healthy with fresh HB + clean cycle", evaluateHealth({ lastHeartbeatAt: freshHb, lastCycleStatus: "completed", lastCycleErrorsCount: 0, recentFailures24h: 0, now }).health === "HEALTHY");
  check("critical when 3+ failures", evaluateHealth({ lastHeartbeatAt: freshHb, lastCycleStatus: "failed", lastCycleErrorsCount: 5, recentFailures24h: 3, now }).health === "CRITICAL");
  check("critical when heartbeat > 60min", evaluateHealth({ lastHeartbeatAt: staleHb, lastCycleStatus: "completed", lastCycleErrorsCount: 0, recentFailures24h: 0, now }).health === "CRITICAL");
  check("warning when HB stale + errors", evaluateHealth({ lastHeartbeatAt: oldHb, lastCycleStatus: "failed", lastCycleErrorsCount: 2, recentFailures24h: 1, now }).health === "WARNING");
  check("warning when errors but HB fresh", evaluateHealth({ lastHeartbeatAt: freshHb, lastCycleStatus: "failed", lastCycleErrorsCount: 1, recentFailures24h: 1, now }).health === "WARNING");
}

// ── TEST 2 · Heartbeat write + upsert ────────────────────────────────────
console.log("\n── TEST 2 · heartbeat write + upsert ──");
{
  await emitHeartbeat(pool, { workerId: "test:reliability:healthy", workerType: "test", status: "running" });
  await emitHeartbeat(pool, { workerId: "test:reliability:healthy", workerType: "test", status: "completed" });
  const r = await pool.query(`SELECT last_status FROM nex.worker_heartbeat WHERE worker_id='test:reliability:healthy'`);
  check("heartbeat upsert works", r.rowCount === 1 && r.rows[0].last_status === "completed");
}

// ── TEST 3 · Cycle run start + finish ───────────────────────────────────
console.log("\n── TEST 3 · cycle run start + finish ──");
{
  const cycleId = await startCycleRun(pool, { workerId: "test:reliability:healthy", workerType: "test", workerConfig: "smoke" });
  await new Promise(r => setTimeout(r, 100));
  const duration = await finishCycleRun(pool, cycleId, { status: "completed", recordsProcessed: 10, recordsNew: 3, errorsCount: 0, summary: { test: true }, doctrineChecks: { "Discovery ≠ Outreach": "HELD" } });
  check("finishCycleRun returned duration_ms", typeof duration === "number" && duration >= 100, `duration=${duration}ms`);
  const r = await pool.query(`SELECT status, records_new, doctrine_checks FROM nex.worker_cycle_run WHERE id=$1`, [cycleId]);
  check("cycle row completed status", r.rows[0].status === "completed");
  check("cycle row records_new", r.rows[0].records_new === 3);
  check("cycle row doctrine_checks", r.rows[0].doctrine_checks["Discovery ≠ Outreach"] === "HELD");
}

// ── TEST 4 · Simulate WARNING (fresh HB + failed cycle) ─────────────────
console.log("\n── TEST 4 · simulate WARNING state ──");
{
  const wid = "test:reliability:warning";
  const cycleId = await startCycleRun(pool, { workerId: wid, workerType: "test" });
  await finishCycleRun(pool, cycleId, { status: "failed", errorsCount: 1, summary: { test: true }, doctrineChecks: {} });
  await emitHeartbeat(pool, { workerId: wid, workerType: "test", status: "failed" });
  const r = await pool.query(`SELECT health FROM nex.worker_health_status WHERE worker_id=$1`, [wid]);
  check("view reports WARNING for fresh HB + failed cycle", r.rows[0].health === "WARNING", `got ${r.rows[0].health}`);
}

// ── TEST 5 · Simulate CRITICAL via stale heartbeat ──────────────────────
console.log("\n── TEST 5 · simulate CRITICAL (stale heartbeat) ──");
{
  const wid = "test:reliability:critical_stale";
  await pool.query(
    `INSERT INTO nex.worker_heartbeat (worker_id, worker_type, last_heartbeat_at, last_status)
     VALUES ($1, 'test', now() - interval '90 minutes', 'idle')
     ON CONFLICT (worker_id) DO UPDATE SET last_heartbeat_at = EXCLUDED.last_heartbeat_at`,
    [wid]
  );
  const r = await pool.query(`SELECT health, seconds_since_heartbeat FROM nex.worker_health_status WHERE worker_id=$1`, [wid]);
  check("view reports CRITICAL for stale heartbeat", r.rows[0].health === "CRITICAL", `hb ${r.rows[0].seconds_since_heartbeat}s ago`);
}

// ── TEST 6 · Simulate CRITICAL via 3 failures ───────────────────────────
console.log("\n── TEST 6 · simulate CRITICAL (3 failures in 24h) ──");
{
  const wid = "test:reliability:critical_failures";
  await emitHeartbeat(pool, { workerId: wid, workerType: "test", status: "failed" });
  for (let i = 0; i < 3; i++) {
    const cid = await startCycleRun(pool, { workerId: wid, workerType: "test" });
    await finishCycleRun(pool, cid, { status: "failed", errorsCount: 1, summary: {}, doctrineChecks: {} });
  }
  const r = await pool.query(`SELECT health, recent_failures_24h FROM nex.worker_health_status WHERE worker_id=$1`, [wid]);
  check("view reports CRITICAL for 3 failures", r.rows[0].health === "CRITICAL", `${r.rows[0].recent_failures_24h} failures`);
}

// ── TEST 7 · Simulate UNKNOWN (heartbeat row but no cycles) ────────────
console.log("\n── TEST 7 · UNKNOWN state (has HB but implicit no cycles counts) ──");
{
  const wid = "test:reliability:unknown";
  await emitHeartbeat(pool, { workerId: wid, workerType: "test", status: "idle" });
  const r = await pool.query(`SELECT health FROM nex.worker_health_status WHERE worker_id=$1`, [wid]);
  // No cycles + fresh heartbeat → HEALTHY (view treats absence of cycle as neutral)
  // UNKNOWN is only when NO heartbeat exists · verified in TEST 1 evaluateHealth
  check("worker with heartbeat but no cycles = HEALTHY (view semantics)", r.rows[0].health === "HEALTHY", `got ${r.rows[0].health}`);
}

// ── TEST 8 · Failure-recovery: worker fails then next cycle succeeds ────
console.log("\n── TEST 8 · failure-recovery simulation ──");
{
  const wid = "test:reliability:healthy";  // reuse
  // First cycle · succeed (TEST 3 already did this)
  // Second cycle · fail
  let cid = await startCycleRun(pool, { workerId: wid, workerType: "test" });
  await finishCycleRun(pool, cid, { status: "failed", errorsCount: 1, summary: {}, doctrineChecks: {} });
  await emitHeartbeat(pool, { workerId: wid, workerType: "test", status: "failed" });
  let r = await pool.query(`SELECT health FROM nex.worker_health_status WHERE worker_id=$1`, [wid]);
  check("after 1 failed cycle: WARNING (not CRITICAL · <3 failures)", r.rows[0].health === "WARNING", `got ${r.rows[0].health}`);
  // Third cycle · succeed (recovery)
  cid = await startCycleRun(pool, { workerId: wid, workerType: "test" });
  await finishCycleRun(pool, cid, { status: "completed", errorsCount: 0, summary: {}, doctrineChecks: { test: "HELD" } });
  await emitHeartbeat(pool, { workerId: wid, workerType: "test", status: "completed" });
  r = await pool.query(`SELECT health FROM nex.worker_health_status WHERE worker_id=$1`, [wid]);
  check("recovery brings back HEALTHY", r.rows[0].health === "HEALTHY", `got ${r.rows[0].health}`);
}

// ── TEST 9 · 24h view aggregates correctly ──────────────────────────────
console.log("\n── TEST 9 · worker_24h_activity aggregation ──");
{
  // View groups by (worker_id, worker_type, worker_config) so aggregate ACROSS
  // configs for the total count. We created cycles both with and without a
  // config in earlier tests — this test asserts on the total across groups.
  const r = await pool.query(`
    SELECT
      count(*) FILTER (WHERE worker_id = 'test:reliability:healthy')::int AS healthy_groups,
      SUM(cycles_run) FILTER (WHERE worker_id = 'test:reliability:healthy')::int AS healthy_cycles,
      SUM(cycles_completed) FILTER (WHERE worker_id = 'test:reliability:healthy')::int AS healthy_completed,
      SUM(cycles_failed) FILTER (WHERE worker_id = 'test:reliability:healthy')::int AS healthy_failed
    FROM nex.worker_24h_activity
    WHERE worker_id LIKE 'test:reliability:%'
  `);
  const row = r.rows[0];
  check("test:healthy has 3+ cycles across all configs", Number(row.healthy_cycles) >= 3, `cycles=${row.healthy_cycles} across ${row.healthy_groups} config group(s)`);
  check("test:healthy 24h shows mixed completed+failed", Number(row.healthy_completed) >= 2 && Number(row.healthy_failed) >= 1, `${row.healthy_completed}/${row.healthy_failed}`);
}

// ── TEST 10 · loadHealthStatus + Watchdog would-alert simulation ────────
console.log("\n── TEST 10 · watchdog behaviour ──");
{
  const all = await loadHealthStatus(pool);
  const testRows = all.filter(x => x.worker_id?.startsWith?.("test:reliability:"));
  const alerts = testRows.filter(x => x.health === "WARNING" || x.health === "CRITICAL");
  check("watchdog identifies alert-worthy workers", alerts.length >= 2, `${alerts.length} alerts among ${testRows.length} test workers`);
}

// ── CLEANUP ──────────────────────────────────────────────────────────────
console.log("\n── CLEANUP · removing test fixtures ──");
for (const wid of testWorkers) {
  const c1 = await pool.query(`DELETE FROM nex.worker_cycle_run WHERE worker_id = $1 RETURNING id`, [wid]);
  const c2 = await pool.query(`DELETE FROM nex.worker_heartbeat WHERE worker_id = $1 RETURNING worker_id`, [wid]);
  console.log(`  cleaned ${wid}: ${c1.rowCount} cycle_run rows · ${c2.rowCount} heartbeat rows`);
}
// Also clean any watchdog audit entries we created via reliability tests
await pool.query(`DELETE FROM nex.audit_log WHERE entity_type='worker_reliability' AND actor='script:_test-reliability.mjs'`);

console.log("\n═".repeat(72));
console.log(`RESULT: ${T.pass} passed · ${T.fail} failed`);
if (T.fail > 0) {
  console.log(`Failed: ${T.errors.join(" · ")}`);
  await pool.end();
  process.exit(1);
} else {
  console.log(`ALL RELIABILITY LAYER TESTS PASSED`);
}
console.log("═".repeat(72));

await pool.end();
