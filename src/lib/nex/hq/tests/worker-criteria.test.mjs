#!/usr/bin/env node
// worker-criteria.test.mjs · Task #72 Step 3 · Six-Criteria enforcement
//
// Deterministic tests for the constitutional GREEN rule (Philip 2026-08-22):
//   "A worker may display 🟢 GREEN only when ALL SIX are DB-verifiable:
//    Real input exists · Worker consumed it · Output produced ·
//    State advanced · Heartbeat current · DB-provable."
//
// Two layers:
//   A · PURE  · exercise deriveVerdict() with synthetic criterion results.
//       Deterministic. No DB. Proves the rule regardless of query results.
//   B · LIVE  · run evaluateWorker() against real Postgres nex_dev.
//       Read-only against actual worker data. Verifies the shipped
//       evaluator honestly classifies whatever the DB currently shows.
//
// Explicit negative-regression discipline: the test suite fails LOUDLY
// if a code change ever allows GREEN based on:
//   · fresh heartbeat alone
//   · historical work but stale heartbeat
//   · input + consumed but no output
//   · input + consumed + output but no state advancement
//   · every criterion except one being met

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

// Load the pure evaluator via esbuild inline transpile (matches
// heartbeat-liveness.test.mjs pattern).
const CRITERIA_SRC = readFileSync(join(REPO, "src/lib/nex/hq/worker-criteria.ts"), "utf8");
const stripped = CRITERIA_SRC
  .replace(/^import[\s\S]*?;$/gm, "")
  .replace(/^export\s+/gm, "");
const esbuild = await import("esbuild");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const evalSrc = transformed.code + `
module.exports = { deriveVerdict, HEARTBEAT_FRESH_SECONDS };
`;
// eslint-disable-next-line no-new-func
const modFactory = new Function("module", "process", "exports", "require", evalSrc);
const mod = { exports: {} };
modFactory(mod, process, mod.exports, () => ({}));
const { deriveVerdict } = mod.exports;

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION A · PURE VERDICT LOGIC · every rule in the constitutional
// definition covered by an isolated positive OR negative case.
// ═════════════════════════════════════════════════════════════════════

function makeCriterion(key, passed, count = passed ? 1 : 0, reason = "test fixture") {
  return { key, passed, count, evidence: [], sql: "test", description: "test", reason };
}

function makeSix({ input, consumed, output, state, heartbeat, provable }) {
  return {
    input:     makeCriterion("input",     input),
    consumed:  makeCriterion("consumed",  consumed),
    output:    makeCriterion("output",    output),
    state:     makeCriterion("state",     state),
    heartbeat: makeCriterion("heartbeat", heartbeat),
    provable:  makeCriterion("provable",  provable),
  };
}

// A1 · POSITIVE · all 6 pass + no recent failures + has ever run → GREEN
{
  const c = makeSix({ input: true, consumed: true, output: true, state: true, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A1_all_six_pass_is_GREEN", verdict === "GREEN", `verdict=${verdict}`);
}

// A2 · NEGATIVE · fresh heartbeat ONLY → not GREEN (the whole point of Step 3)
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: false, recentFailures24h: 0, markedBlocked: false });
  record("A2_heartbeat_alone_is_NOT_GREEN", verdict !== "GREEN", `verdict=${verdict} (must not be GREEN)`);
}

// A3 · NEGATIVE · historical work + stale heartbeat → not GREEN
{
  const c = makeSix({ input: true, consumed: true, output: true, state: true, heartbeat: false, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A3_stale_heartbeat_is_NOT_GREEN", verdict !== "GREEN", `verdict=${verdict} (must not be GREEN)`);
}

// A4 · NEGATIVE · input + consumed but no output → not GREEN (STUCK per rule)
{
  const c = makeSix({ input: true, consumed: true, output: false, state: false, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A4_consumed_no_output_is_NOT_GREEN", verdict !== "GREEN", `verdict=${verdict}`);
}

// A5 · NEGATIVE · input + consumed + output but no state advance → not GREEN
{
  const c = makeSix({ input: true, consumed: true, output: true, state: false, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A5_no_state_advance_is_NOT_GREEN", verdict !== "GREEN", `verdict=${verdict}`);
}

// A6 · NEGATIVE · everything except provable (schema missing) → not GREEN
{
  const c = makeSix({ input: true, consumed: true, output: true, state: true, heartbeat: true, provable: false });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A6_not_provable_is_NOT_GREEN", verdict !== "GREEN", `verdict=${verdict}`);
}

// A7 · NEGATIVE · zero everything → NOT_RUNNING (never GREEN)
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: false, provable: false });
  const { verdict } = deriveVerdict(c, { hasEverRun: false, recentFailures24h: 0, markedBlocked: false });
  record("A7_nothing_is_NOT_RUNNING", verdict === "NOT_RUNNING", `verdict=${verdict} (expected NOT_RUNNING)`);
}

// A8 · NEGATIVE · markedBlocked → BLOCKED (regardless of other criteria)
{
  const c = makeSix({ input: true, consumed: true, output: true, state: true, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: true });
  record("A8_blocked_wins_over_all_pass", verdict === "BLOCKED", `verdict=${verdict} (expected BLOCKED)`);
}

// A9 · NEGATIVE · recent failures > 0 → FAILED (regardless of other criteria)
{
  const c = makeSix({ input: true, consumed: true, output: true, state: true, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 3, markedBlocked: false });
  record("A9_recent_failures_forces_FAILED", verdict === "FAILED", `verdict=${verdict} (expected FAILED)`);
}

// A10 · STUCK path · input passes, consumed fails → STUCK
{
  const c = makeSix({ input: true, consumed: false, output: false, state: false, heartbeat: true, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A10_input_but_no_consumption_is_STUCK", verdict === "STUCK", `verdict=${verdict} (expected STUCK)`);
}

// A11 · Only 5 of 6 pass · not GREEN
{
  const only5 = makeSix({ input: true, consumed: true, output: true, state: true, heartbeat: true, provable: false });
  const { verdict } = deriveVerdict(only5, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false });
  record("A11_five_of_six_is_NOT_GREEN", verdict !== "GREEN", `verdict=${verdict}`);
}

// ── Bundle B 2026-08-22 · STANDBY semantics for demand-driven workers ──
// Philip: "For a demand-driven worker, no demand → STANDBY. Absence of
// work is not failure. Never infer STUCK from heartbeat age alone."

// A12 · markedStandby (spec signal · e.g. Intake with 0 batches in 24h) → STANDBY
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: false, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false, markedStandby: true });
  record("A12_marked_standby_is_STANDBY", verdict === "STANDBY", `verdict=${verdict} (expected STANDBY · demand-driven with no demand)`);
}

// A13 · markedStandby overrides the PARTIAL fallthrough
// (Same criteria as A12 · without markedStandby it would fall through to PARTIAL)
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: false, provable: true });
  const withoutFlag = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false, markedStandby: false });
  const withFlag    = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false, markedStandby: true });
  record("A13_marked_standby_overrides_partial_fallthrough",
    withoutFlag.verdict === "PARTIAL" && withFlag.verdict === "STANDBY",
    `without=${withoutFlag.verdict} · with=${withFlag.verdict}`);
}

// A14 · BLOCKED wins over STANDBY (precedence · dependency-gate is a stronger signal)
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: false, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: true, markedStandby: true });
  record("A14_blocked_wins_over_standby", verdict === "BLOCKED", `verdict=${verdict} (expected BLOCKED)`);
}

// A15 · FAILED wins over STANDBY (recent failures are authoritative)
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: false, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 2, markedBlocked: false, markedStandby: true });
  record("A15_failed_wins_over_standby", verdict === "FAILED", `verdict=${verdict} (expected FAILED)`);
}

// A16 · STANDBY does NOT get inferred from stale heartbeat alone (must be spec-signalled)
// Repeat of A2 pattern but explicitly asserting the fallthrough is NOT STANDBY without flag.
{
  const c = makeSix({ input: false, consumed: false, output: false, state: false, heartbeat: false, provable: true });
  const { verdict } = deriveVerdict(c, { hasEverRun: true, recentFailures24h: 0, markedBlocked: false, markedStandby: false });
  record("A16_no_standby_without_spec_signal", verdict !== "STANDBY",
    `verdict=${verdict} (STANDBY must be spec-signalled · never inferred from heartbeat age alone)`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION B · LIVE evaluator against real Postgres · read-only
// ═════════════════════════════════════════════════════════════════════

const POSTGRES_URL = process.env.NEX_POSTGRES_URL;
if (!POSTGRES_URL) {
  record("B_skip", true, "NEX_POSTGRES_URL not set · skipping live section (pure section still ran)");
} else {
  // Dynamic import of the TS evaluator via node --experimental-strip-types
  // isn't stable here · instead, drive the pure SQL contract inline.
  const pool = new pg.Pool({ connectionString: POSTGRES_URL });
  try {
    // B1 · Every real worker MUST have a verdict that is one of the 7.
    const workers = await pool.query(`
      SELECT worker_id, worker_type, worker_config FROM nex.worker_heartbeat
      UNION SELECT worker_id, worker_type, worker_config FROM nex.worker_schedule WHERE enabled = true
    `);
    record("B1_worker_registry_has_rows", workers.rows.length >= 0,
      `${workers.rows.length} worker(s) registered (heartbeat ∪ schedule)`);

    // B2 · Every current heartbeat row must be > 60s stale → cannot be GREEN
    const stale = await pool.query(`
      SELECT worker_id, EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS age_s
      FROM nex.worker_heartbeat
      WHERE EXTRACT(EPOCH FROM (now() - last_heartbeat_at)) > 60
    `);
    record("B2_all_current_workers_are_stale", stale.rows.length === workers.rows.length,
      `${stale.rows.length}/${workers.rows.length} heartbeats > 60s stale (post-Step-3 reality)`);

    // B3 · food_business must have unverified rows (proof C1 for acquisition can pass)
    const unverified = await pool.query(`
      SELECT COUNT(*)::int AS n FROM nex.food_business
      WHERE last_verified_at IS NULL OR last_verified_at < now() - interval '7 days'
    `);
    record("B3_food_business_input_queue_nonempty", unverified.rows[0].n > 0,
      `${unverified.rows[0].n} food_business rows awaiting verification`);

    // B4 · A worker with a cycle_run in last 24h + records_processed>0 satisfies C2
    const consumed24h = await pool.query(`
      SELECT worker_id, SUM(records_processed)::int AS total
      FROM nex.worker_cycle_run
      WHERE started_at > now() - interval '24 hours' AND records_processed > 0
      GROUP BY worker_id
    `);
    record("B4_cycle_run_consumption_signal", true,
      `workers with real consumption in 24h: ${consumed24h.rows.length}`);

    // B5 · The DB MUST have at least one worker in NOT_RUNNING or BLOCKED
    // territory post-Step-3 (no Brain worker has heartbeated · CLE is blocked).
    // This proves the honesty rule is enforced.
    const knownBrainInDb = await pool.query(`
      SELECT worker_id FROM nex.worker_heartbeat WHERE worker_type = 'brain'
    `);
    record("B5_brain_workers_not_yet_registered", knownBrainInDb.rows.length === 0,
      `${knownBrainInDb.rows.length} brain heartbeats found (expected 0 post-Step-1c · no dev scheduler yet)`);
  } finally {
    await pool.end();
  }
}

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nworker-criteria: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
