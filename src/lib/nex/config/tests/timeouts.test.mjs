#!/usr/bin/env node
// timeouts.test.mjs · Wave 3 · H3 · config + error-class contract tests
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md
//
// Assertions:
//   T1  · defaults returned when env vars unset (T-1 30000 · T-3 10000 · T-4 60000)
//   T2  · T-6 / T-7 default to 0 (DISABLED) so worker-cycle / per-job wrappers
//         are no-ops until an operator opts in
//   T3  · env-var overrides honoured when inside sanity range
//   T4  · out-of-range values fall back to default
//   T5  · negative / non-numeric values fall back to default
//   T6  · TimeoutError carries stable .code + .timeout_class + .budget_ms
//   T7  · isTimeoutError type guard matches TimeoutError instances AND objects
//         with a code starting with "timeout-"
//   T8  · snapshotTimeouts returns a shape matching the 5 timeout classes

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

// Load the config module via esbuild-transform+eval so the test doesn't need
// a full TS build. Pattern matches the finalize.test.mjs loader shape.
const SRC = readFileSync(join(REPO, "src/lib/nex/config/timeouts.ts"), "utf8");
const stripped = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `\nmodule.exports = { TimeoutError, isTimeoutError, statementTimeoutMs, connectionTimeoutMs, idleInTransactionTimeoutMs, workerCycleDeadlineMs, jobBudgetMs, snapshotTimeouts, _resetWarnedForTests };`,
)(mod, process, mod.exports, () => ({}));
const {
  TimeoutError, isTimeoutError,
  statementTimeoutMs, connectionTimeoutMs, idleInTransactionTimeoutMs,
  workerCycleDeadlineMs, jobBudgetMs, snapshotTimeouts,
  _resetWarnedForTests,
} = mod.exports;

test("T1 · defaults returned when env vars unset (T-1/T-3/T-4 have sane defaults)", () => {
  const empty = {};
  assert.equal(statementTimeoutMs(empty), 30_000);
  assert.equal(connectionTimeoutMs(empty), 10_000);
  assert.equal(idleInTransactionTimeoutMs(empty), 60_000);
});

test("T2 · T-6 + T-7 DEFAULT to 0 · worker cycle and job budget disabled until opt-in", () => {
  const empty = {};
  assert.equal(workerCycleDeadlineMs(empty), 0);
  assert.equal(jobBudgetMs(empty), 0);
});

test("T3 · env-var overrides honoured when inside sanity range", () => {
  assert.equal(statementTimeoutMs({ NEX_PG_STATEMENT_TIMEOUT_MS: "45000" }), 45000);
  assert.equal(connectionTimeoutMs({ NEX_PG_CONNECTION_TIMEOUT_MS: "5000" }), 5000);
  assert.equal(idleInTransactionTimeoutMs({ NEX_PG_IDLE_TX_TIMEOUT_MS: "120000" }), 120000);
  assert.equal(workerCycleDeadlineMs({ NEX_WORKER_CYCLE_DEADLINE_MS: "600000" }), 600000);
  assert.equal(jobBudgetMs({ NEX_WORKER_JOB_BUDGET_MS: "300000" }), 300000);
});

test("T4 · out-of-range values fall back to default (T-1 max 600s · T-6 max 60m)", () => {
  _resetWarnedForTests();
  assert.equal(statementTimeoutMs({ NEX_PG_STATEMENT_TIMEOUT_MS: "999999999" }), 30_000);
  assert.equal(statementTimeoutMs({ NEX_PG_STATEMENT_TIMEOUT_MS: "500" }), 30_000);
  assert.equal(workerCycleDeadlineMs({ NEX_WORKER_CYCLE_DEADLINE_MS: "30" }), 0);
  assert.equal(workerCycleDeadlineMs({ NEX_WORKER_CYCLE_DEADLINE_MS: "99999999" }), 0);
});

test("T5 · negative / non-numeric fall back to default (no throw)", () => {
  _resetWarnedForTests();
  assert.equal(statementTimeoutMs({ NEX_PG_STATEMENT_TIMEOUT_MS: "-10" }), 30_000);
  assert.equal(statementTimeoutMs({ NEX_PG_STATEMENT_TIMEOUT_MS: "not-a-number" }), 30_000);
});

test("T6 · TimeoutError carries stable .code + .timeout_class + .budget_ms", () => {
  const e = new TimeoutError("statement", 30_000);
  assert.equal(e.name, "TimeoutError");
  assert.equal(e.code, "timeout-statement");
  assert.equal(e.timeout_class, "statement");
  assert.equal(e.budget_ms, 30_000);
  assert.match(e.message, /timeout-statement/);

  const e2 = new TimeoutError("worker_cycle", 900_000, "custom");
  assert.equal(e2.code, "timeout-worker-cycle");
  assert.equal(e2.message, "custom");
});

test("T7 · isTimeoutError matches instance AND duck-typed 'code' prefix", () => {
  assert.ok(isTimeoutError(new TimeoutError("job_budget", 300_000)));
  assert.ok(isTimeoutError({ code: "timeout-statement" }));
  assert.ok(!isTimeoutError(new Error("nope")));
  assert.ok(!isTimeoutError({ code: "other-error" }));
  assert.ok(!isTimeoutError(null));
  assert.ok(!isTimeoutError(undefined));
  assert.ok(!isTimeoutError("timeout-statement"));
});

test("T8 · snapshotTimeouts returns the 5-key shape", () => {
  const snap = snapshotTimeouts({});
  assert.deepEqual(Object.keys(snap).sort(), [
    "connection_timeout_ms",
    "idle_in_transaction_timeout_ms",
    "job_budget_ms",
    "statement_timeout_ms",
    "worker_cycle_deadline_ms",
  ]);
  assert.equal(snap.statement_timeout_ms, 30_000);
  assert.equal(snap.worker_cycle_deadline_ms, 0);
});
