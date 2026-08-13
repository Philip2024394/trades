#!/usr/bin/env node
// rollup-gate.test.mjs · Wave 3 · H4 · contract tests for the 049 activation gate
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H4-MIGRATION-049-GATE.md
//
// Assertions (from the H4 test matrix, §5 of the design doc):
//   G1 · Flag=1 + 049 fully applied → no throw · counter unchanged
//   G2 · Flag=1 + table missing → MigrationDependencyError · missing lists table · counter bumped
//   G3 · Flag=1 + function missing → MigrationDependencyError · missing lists function · counter bumped
//   G4 · Flag=1 + both missing → MigrationDependencyError · missing lists both · counter bumped
//   G5 · Flag=0 + 049 absent → no throw · no DB probe · counter unchanged
//   G6 · Repeated call after G1 (cached-ready) → zero further DB round-trips
//   G7 · Repeated call after G2 (negative not cached) → probe re-runs each time
//   G8 · Error message identifies migration + remediation command

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");
const requireFromHere = createRequire(import.meta.url);

// Loader stubs the DB + ingest modules · the gate only depends on those two.
// We supply our own counter incrementer so we can verify bump counts without
// touching the real observability store.
async function loadGate({ isRollupAsync }) {
  const src = readFileSync(join(REPO, "src/lib/nex/analytics/rollup-gate.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  const counterCalls = [];
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { MigrationDependencyError, checkRollupSchema, assertRollupAsyncReady, _resetGateCacheForTests, _setCounterIncrForTests };`,
  )(mod, process, mod.exports, (id) => {
    if (id === "@/lib/nex/db") return {};
    if (id === "./ingest") return { isRollupAsync };
    if (id === "@/lib/nex/observability/counters") {
      return { incr: (name) => counterCalls.push(name) };
    }
    return requireFromHere(id);
  });
  const api = mod.exports;
  api._setCounterIncrForTests((name) => counterCalls.push(name));
  api._resetGateCacheForTests();
  return { ...api, counterCalls };
}

// Fake pg client whose to_regclass / to_regprocedure results we control.
function fakeClient({ tablePresent = true, fnPresent = true, calls } = {}) {
  return {
    calls: calls ?? [],
    query: async (text, params) => {
      (calls ?? []).push({ text, params });
      // Only the probe query matters here.
      return {
        rows: [{
          table_oid: tablePresent ? "nex.analytics_rollup_queue" : null,
          fn_oid:    fnPresent    ? "nex.claim_analytics_rollup_batch" : null,
        }],
        rowCount: 1,
      };
    },
    release: () => {},
  };
}

test("G1 · Flag=1 + 049 fully applied · no throw · counter unchanged", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const calls = [];
  const c = fakeClient({ calls });
  await g.assertRollupAsyncReady(c);
  assert.equal(g.counterCalls.length, 0, "counter must NOT bump on success");
  assert.equal(calls.length, 1, "probe must run exactly once");
});

test("G2 · Flag=1 + table missing · MigrationDependencyError · counter bumped", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const c = fakeClient({ tablePresent: false, fnPresent: true });
  let caught = null;
  try { await g.assertRollupAsyncReady(c); } catch (e) { caught = e; }
  assert.ok(caught, "must throw");
  assert.equal(caught.code, "migration-049-not-applied");
  assert.equal(caught.migration, "049_analytics_rollup_queue.sql");
  assert.ok(caught.missing_objects.some((m) => m.includes("nex.analytics_rollup_queue")),
    `missing_objects must list the table · got ${JSON.stringify(caught.missing_objects)}`);
  assert.equal(g.counterCalls.filter((n) => n === "analytics.rollup_missing_table").length, 1);
});

test("G3 · Flag=1 + function missing · MigrationDependencyError · counter bumped", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const c = fakeClient({ tablePresent: true, fnPresent: false });
  let caught = null;
  try { await g.assertRollupAsyncReady(c); } catch (e) { caught = e; }
  assert.ok(caught, "must throw");
  assert.ok(caught.missing_objects.some((m) => m.includes("nex.claim_analytics_rollup_batch")),
    `missing_objects must list the function · got ${JSON.stringify(caught.missing_objects)}`);
  assert.equal(g.counterCalls.filter((n) => n === "analytics.rollup_missing_table").length, 1);
});

test("G4 · Flag=1 + both missing · missing lists both · counter bumped once", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const c = fakeClient({ tablePresent: false, fnPresent: false });
  let caught = null;
  try { await g.assertRollupAsyncReady(c); } catch (e) { caught = e; }
  assert.ok(caught);
  assert.equal(caught.missing_objects.length, 2);
  assert.ok(caught.missing_objects.some((m) => m.includes("analytics_rollup_queue")));
  assert.ok(caught.missing_objects.some((m) => m.includes("claim_analytics_rollup_batch")));
  assert.equal(g.counterCalls.filter((n) => n === "analytics.rollup_missing_table").length, 1);
});

test("G5 · Flag=0 · gate is a no-op · zero DB probes · zero counter bumps", async () => {
  const g = await loadGate({ isRollupAsync: () => false });
  const calls = [];
  const c = fakeClient({ tablePresent: false, fnPresent: false, calls });
  await g.assertRollupAsyncReady(c);
  assert.equal(calls.length, 0, "no probe should fire when flag is off");
  assert.equal(g.counterCalls.length, 0, "no counter bump when flag is off");
});

test("G6 · Repeated call after G1 (cached-ready) · zero further DB probes", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const calls = [];
  const c = fakeClient({ calls });
  await g.assertRollupAsyncReady(c);
  await g.assertRollupAsyncReady(c);
  await g.assertRollupAsyncReady(c);
  assert.equal(calls.length, 1, "positive result must be cached · only first call probes");
});

test("G7 · Repeated call after G2 (negative not cached) · probe re-runs each time", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const calls = [];
  const c = fakeClient({ tablePresent: false, fnPresent: true, calls });
  for (const _ of [1, 2, 3]) {
    let caught = null;
    try { await g.assertRollupAsyncReady(c); } catch (e) { caught = e; }
    assert.ok(caught);
  }
  assert.equal(calls.length, 3, "negative verdict must NOT be cached · probe fires each time");
});

test("G8 · error message identifies migration filename AND remediation command", async () => {
  const g = await loadGate({ isRollupAsync: () => true });
  const c = fakeClient({ tablePresent: false, fnPresent: false });
  let caught = null;
  try { await g.assertRollupAsyncReady(c); } catch (e) { caught = e; }
  assert.match(caught.message, /migration 049 not applied/,
    "error message must name the migration");
  assert.match(caught.message, /049_analytics_rollup_queue\.sql/,
    "error message must name the migration filename");
  assert.match(caught.message, /nex:apply-storage-schema/,
    "error message must name the remediation command");
  assert.match(caught.message, /NEX_ANALYTICS_ROLLUP_ASYNC/,
    "error message must reference the flag operators need to toggle");
});
