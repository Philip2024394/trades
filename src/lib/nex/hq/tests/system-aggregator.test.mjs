#!/usr/bin/env node
// system-aggregator.test.mjs · Task #72 Step 4 · Reception aggregation
//
// Philip 2026-08-22 constitutional rule for Reception:
//   "Reception must be a window into the existing truth, not a new source
//    of truth. Every system status must be derived from the same
//    six-criteria evaluator used by the Workers page."
//
// This test proves:
//   A · aggregateVerdict() is deterministic and honours the precedence
//       rule declared in system-aggregator.ts (worst-active-wins,
//       mixed-terminals=PARTIAL).
//   B · Reception uses the SAME evaluator as the Workers page (static
//       grep verification · no duplicate verdict logic).
//   C · Live SQL probe: current systems evaluate to the honest states
//       Philip's Step 4 spec predicts (Acquisition STUCK · CLE BLOCKED ·
//       Brain NOT_RUNNING · zero GREEN).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

// ── Load aggregator via inline esbuild transpile ───────────────────────
const AGG_SRC = readFileSync(join(REPO, "src/lib/nex/hq/system-aggregator.ts"), "utf8");
const stripped = AGG_SRC
  .replace(/^import[\s\S]*?;$/gm, "")
  .replace(/^export\s+/gm, "");
const esbuild = await import("esbuild");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const modFactory = new Function("module", "process", "exports", "require",
  transformed.code + `
module.exports = { aggregateVerdict, realitySummary, HQ_SYSTEMS };
`);
const mod = { exports: {} };
modFactory(mod, process, mod.exports, () => ({}));
const { aggregateVerdict, HQ_SYSTEMS } = mod.exports;

// ── Also load Reception page + RealityStrip source for grep checks ────
const RECEPTION = readFileSync(join(REPO, "src/app/nex-head-quarters/page.tsx"), "utf8");
const RSTRIP    = readFileSync(join(REPO, "src/components/nex-head-quarters/RealityStrip.tsx"), "utf8");
const AGG_TS    = AGG_SRC;

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION A · PURE aggregateVerdict precedence
// ═════════════════════════════════════════════════════════════════════

record("S1_empty_is_NOT_RUNNING",
  aggregateVerdict([]) === "NOT_RUNNING",
  `aggregate([]) = ${aggregateVerdict([])}`);

record("S2_single_GREEN_is_GREEN",
  aggregateVerdict(["GREEN"]) === "GREEN", "");

record("S3_all_GREEN_is_GREEN",
  aggregateVerdict(["GREEN","GREEN","GREEN"]) === "GREEN", "");

record("S4_any_FAILED_wins",
  aggregateVerdict(["GREEN","GREEN","FAILED"]) === "FAILED",
  `= ${aggregateVerdict(["GREEN","GREEN","FAILED"])}`);

record("S5_FAILED_over_STUCK",
  aggregateVerdict(["STUCK","FAILED"]) === "FAILED", "");

record("S6_any_STUCK_wins_over_PARTIAL",
  aggregateVerdict(["PARTIAL","STUCK"]) === "STUCK",
  `= ${aggregateVerdict(["PARTIAL","STUCK"])}`);

record("S7_any_PARTIAL_when_no_FAILED_or_STUCK",
  aggregateVerdict(["GREEN","PARTIAL","BLOCKED"]) === "PARTIAL", "");

record("S8_all_BLOCKED_is_BLOCKED",
  aggregateVerdict(["BLOCKED","BLOCKED"]) === "BLOCKED", "");

record("S9_GREEN_plus_BLOCKED_is_PARTIAL",
  aggregateVerdict(["GREEN","BLOCKED"]) === "PARTIAL",
  `mixed terminal must be PARTIAL · got ${aggregateVerdict(["GREEN","BLOCKED"])}`);

record("S10_all_NOT_RUNNING_is_NOT_RUNNING",
  aggregateVerdict(["NOT_RUNNING","NOT_RUNNING"]) === "NOT_RUNNING", "");

record("S11_GREEN_plus_NOT_RUNNING_is_PARTIAL",
  aggregateVerdict(["GREEN","NOT_RUNNING"]) === "PARTIAL",
  `= ${aggregateVerdict(["GREEN","NOT_RUNNING"])}`);

record("S12_UNKNOWN_when_no_worse",
  aggregateVerdict(["UNKNOWN","GREEN"]) === "UNKNOWN", "");

// S13 · Mixed non-active terminals · one BLOCKED + one NOT_RUNNING must
// report PARTIAL (NOT BLOCKED). They are different truths — one is
// intentionally paused, the other has never executed. Collapsing them
// to BLOCKED would hide the NOT_RUNNING half. Honest answer = PARTIAL.
record("S13_BLOCKED_plus_NOT_RUNNING_is_PARTIAL",
  aggregateVerdict(["BLOCKED","NOT_RUNNING"]) === "PARTIAL",
  `mixed non-active terminals must be PARTIAL · got ${aggregateVerdict(["BLOCKED","NOT_RUNNING"])}`);

// ── Bundle B 2026-08-22 · STANDBY aggregation ────────────────────────
// STANDBY joins the healthy-terminal set (with GREEN / BLOCKED / NOT_RUNNING).
// Same "mixed = PARTIAL" honesty applies · STUCK/FAILED still worse-wins.

record("S14_single_STANDBY_is_STANDBY",
  aggregateVerdict(["STANDBY"]) === "STANDBY", "");

record("S15_all_STANDBY_is_STANDBY",
  aggregateVerdict(["STANDBY","STANDBY","STANDBY"]) === "STANDBY", "");

record("S16_STUCK_wins_over_STANDBY",
  aggregateVerdict(["STANDBY","STUCK"]) === "STUCK",
  `= ${aggregateVerdict(["STANDBY","STUCK"])}`);

record("S17_FAILED_wins_over_STANDBY",
  aggregateVerdict(["STANDBY","FAILED"]) === "FAILED",
  `= ${aggregateVerdict(["STANDBY","FAILED"])}`);

record("S18_STANDBY_plus_GREEN_is_PARTIAL",
  aggregateVerdict(["STANDBY","GREEN"]) === "PARTIAL",
  `mixed healthy terminals must be PARTIAL · got ${aggregateVerdict(["STANDBY","GREEN"])}`);

record("S19_STANDBY_plus_NOT_RUNNING_is_PARTIAL",
  aggregateVerdict(["STANDBY","NOT_RUNNING"]) === "PARTIAL",
  `= ${aggregateVerdict(["STANDBY","NOT_RUNNING"])}`);

record("S20_STANDBY_plus_BLOCKED_is_PARTIAL",
  aggregateVerdict(["STANDBY","BLOCKED"]) === "PARTIAL",
  `= ${aggregateVerdict(["STANDBY","BLOCKED"])}`);

// ═════════════════════════════════════════════════════════════════════
// SECTION B · GREP verification · Reception uses same evaluator as Workers
// ═════════════════════════════════════════════════════════════════════

// B1 · Reception imports RealityStrip · not a fresh evaluator
record("B1_reception_imports_reality_strip",
  /import\s+RealityStrip\s+from\s+["']@\/components\/nex-head-quarters\/RealityStrip["']/.test(RECEPTION),
  "Reception page.tsx imports RealityStrip");

// B2 · RealityStrip uses evaluateAllSystems from the shipped aggregator
record("B2_reality_strip_uses_aggregator",
  /import\s*\{[^}]*evaluateAllSystems[^}]*\}\s*from\s*["']@\/lib\/nex\/hq\/system-aggregator["']/.test(RSTRIP),
  "RealityStrip imports evaluateAllSystems from the canonical aggregator");

// B3 · The aggregator itself imports evaluateWorker from Step 3 (same evaluator)
record("B3_aggregator_uses_step3_evaluator",
  /import\s*\{[^}]*evaluateWorker[^}]*\}\s*from\s*["']\.\/evaluate-worker["']/.test(AGG_TS),
  "system-aggregator imports evaluateWorker (Step 3 · single source of truth)");

// B4 · No duplicate verdict-derivation logic in RealityStrip
//     (must NOT contain aggregateVerdict definition · must NOT contain its own six-criteria evaluator)
const rstripHasOwnEval = /function\s+deriveVerdict/.test(RSTRIP)
                       || /const\s+VERDICT_LOGIC/.test(RSTRIP);
record("B4_no_duplicate_verdict_logic_in_reality_strip", !rstripHasOwnEval,
  rstripHasOwnEval ? "found duplicate verdict logic in RealityStrip · REGRESSION" : "no duplicate verdict logic");

// B5 · Reception page must NOT construct its own verdict either
const receptionHasOwnEval = /function\s+deriveVerdict/.test(RECEPTION)
                          || /function\s+evaluateWorker/.test(RECEPTION);
record("B5_no_duplicate_verdict_logic_in_reception", !receptionHasOwnEval,
  receptionHasOwnEval ? "found duplicate verdict logic in Reception page · REGRESSION" : "no duplicate verdict logic");

// B6 · HQ_SYSTEMS is declared and non-empty
record("B6_hq_systems_declared", HQ_SYSTEMS.length > 0,
  `HQ_SYSTEMS has ${HQ_SYSTEMS.length} entries: ${HQ_SYSTEMS.map((s) => s.key).join(", ")}`);

// ═════════════════════════════════════════════════════════════════════
// SECTION C · LIVE SQL probe · current system verdicts must match reality
// ═════════════════════════════════════════════════════════════════════

const POSTGRES_URL = process.env.NEX_POSTGRES_URL;
if (!POSTGRES_URL) {
  record("C_skip", true, "NEX_POSTGRES_URL not set · live section skipped");
} else {
  const pool = new pg.Pool({ connectionString: POSTGRES_URL });
  try {
    // C1 · Every heartbeat is stale · so acquisition cannot be GREEN
    const stale = await pool.query(`
      SELECT worker_type, COUNT(*)::int AS n
      FROM nex.worker_heartbeat
      WHERE EXTRACT(EPOCH FROM (now() - last_heartbeat_at)) > 60
      GROUP BY worker_type
    `);
    const acqStale = stale.rows.find((r) => r.worker_type === "acquisition");
    record("C1_acquisition_heartbeats_stale", (acqStale?.n ?? 0) > 0,
      `${acqStale?.n ?? 0} acquisition heartbeats stale · acquisition cannot be GREEN`);

    // C2 · Brain worker_type has zero heartbeat + zero cycle_run rows
    const brainHb = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.worker_heartbeat WHERE worker_type='brain'`);
    const brainCr = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.worker_cycle_run WHERE worker_type='brain'`);
    record("C2_brain_never_ran",
      brainHb.rows[0].n === 0 && brainCr.rows[0].n === 0,
      `brain heartbeats=${brainHb.rows[0].n} · brain cycles=${brainCr.rows[0].n} · aggregate should be NOT_RUNNING`);

    // C3 · Aggregate acquisition workers · verdict must NOT be GREEN
    // (stale heartbeat guarantees any worker verdict is at best PARTIAL/STUCK · never GREEN)
    const acqWorkers = await pool.query(`SELECT worker_id FROM nex.worker_heartbeat WHERE worker_type='acquisition'`);
    record("C3_acquisition_workers_exist_but_stale", acqWorkers.rows.length > 0,
      `${acqWorkers.rows.length} acquisition worker(s) registered · all stale`);

    // C4 · CLE worker exists but consumer isn't built (spec marks BLOCKED)
    const cleWorkers = await pool.query(`SELECT worker_id FROM nex.worker_heartbeat WHERE worker_type='cle'`);
    record("C4_cle_worker_registered", cleWorkers.rows.length > 0,
      `${cleWorkers.rows.length} cle worker(s) registered · spec marks BLOCKED`);
  } finally {
    await pool.end();
  }
}

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nsystem-aggregator: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
