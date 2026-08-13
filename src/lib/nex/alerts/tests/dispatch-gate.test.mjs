#!/usr/bin/env node
// dispatch-gate.test.mjs · Wave 3 · H5 · Subsystem A dispatcher contract
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H5-DISPATCHER.md
//
// Focus of these tests is the H5 additions to alerts/dispatch.ts:
//   HD1 · gate ON + severity qualifies + one channel has env transport
//         → sent > 0 · alerts.dispatch_no_transport counter NOT bumped
//   HD2 · gate ON + severity qualifies + zero channels have env transport
//         → sent=0/failed=0/skipped=channels.length · counter bumped once
//   HD3 · severity BELOW min → skip everything · counter NOT bumped
//         (severity-below-min is the pre-existing skip path, distinct from
//          "no transport" fail-closed)
//   HD4 · gate OFF via evaluator return payload · dispatch_skipped_gate
//         appears in the return shape (evaluator source assertion)
//
// The dispatch tests use a loader stub for @/lib/nex/delivery/db so we can
// record dispatches without touching a real DB, and stub fetch so we can
// control per-channel outcomes.

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

async function loadDispatch({ counterCalls, logCalls, fetchImpl, dbCalls }) {
  const src = readFileSync(join(REPO, "src/lib/nex/alerts/dispatch.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require", "fetch", "AbortSignal",
    t.code + `\nmodule.exports = { dispatchAlert, recentDispatches };`,
  )(mod, process, mod.exports, (id) => {
    if (id === "@/lib/nex/delivery/db") {
      return {
        withClient: async (fn) => fn({
          query: async (text, params) => { dbCalls.push({ text, params }); return { rows: [], rowCount: null }; },
          release: () => {},
        }),
      };
    }
    if (id === "@/lib/nex/observability/counters") return { incr: (name) => counterCalls.push(name) };
    if (id === "@/lib/nex/observability/logger") return {
      logger: (subsystem) => ({
        debug: (msg, fields) => logCalls.push({ level: "debug", subsystem, msg, fields }),
        info:  (msg, fields) => logCalls.push({ level: "info",  subsystem, msg, fields }),
        warn:  (msg, fields) => logCalls.push({ level: "warn",  subsystem, msg, fields }),
        error: (msg, fields) => logCalls.push({ level: "error", subsystem, msg, fields }),
      }),
    };
    return requireFromHere(id);
  }, fetchImpl, globalThis.AbortSignal);
  return mod.exports;
}

function fakeAlert(overrides = {}) {
  return {
    alert_id: "alert-1",
    rule_id: "rule.test",
    incident_id: null,
    severity: "critical",
    state: "open",
    title: "test alert",
    detail: "detail",
    snapshot: {},
    first_detected_at: new Date().toISOString(),
    last_triggered_at: new Date().toISOString(),
    trigger_count: 1,
    acknowledged_at: null, acknowledged_by: null,
    resolved_at: null, resolved_reason: null, resolved_by: null,
    ...overrides,
  };
}

// ── HD1 ─────────────────────────────────────────────────────────────
test("HD1 · gate ON + severity clears + webhook env set · dispatched · no_transport NOT bumped", async () => {
  process.env.NEX_ALERTS_WEBHOOK_URL = "http://127.0.0.1:0/never-called-in-test";
  delete process.env.NEX_ALERTS_EMAIL_TO;
  delete process.env.NEX_ALERTS_SLACK_WEBHOOK_URL;
  const counterCalls = [], logCalls = [], dbCalls = [];
  const fetchImpl = async () => ({ ok: true, status: 200 });
  const { dispatchAlert } = await loadDispatch({ counterCalls, logCalls, fetchImpl, dbCalls });
  const r = await dispatchAlert(fakeAlert({ severity: "critical" }), ["webhook"]);
  delete process.env.NEX_ALERTS_WEBHOOK_URL;
  assert.equal(r.sent, 1, "webhook should have sent");
  assert.equal(r.failed, 0);
  assert.equal(r.skipped, 0);
  assert.equal(counterCalls.filter((n) => n === "alerts.dispatch_no_transport").length, 0,
    "no_transport counter must NOT bump on successful dispatch");
});

// ── HD2 ─────────────────────────────────────────────────────────────
test("HD2 · gate ON + severity clears + ZERO transports configured · fail-closed · counter bumped + log.warn", async () => {
  delete process.env.NEX_ALERTS_WEBHOOK_URL;
  delete process.env.NEX_ALERTS_EMAIL_TO;
  delete process.env.NEX_ALERTS_SLACK_WEBHOOK_URL;
  const counterCalls = [], logCalls = [], dbCalls = [];
  const { dispatchAlert } = await loadDispatch({ counterCalls, logCalls, fetchImpl: async () => ({ ok: false }), dbCalls });
  const r = await dispatchAlert(fakeAlert({ severity: "critical" }), ["webhook", "email", "slack"]);
  assert.equal(r.sent, 0);
  assert.equal(r.failed, 0);
  assert.equal(r.skipped, 3, "all three channels should skip for missing env");
  const bumps = counterCalls.filter((n) => n === "alerts.dispatch_no_transport");
  assert.equal(bumps.length, 1, "counter must bump exactly once");
  const warn = logCalls.find((l) => l.level === "warn" && l.msg === "no_transport");
  assert.ok(warn, "log.warn no_transport must fire");
  assert.equal(warn.fields.rule_id, "rule.test");
  assert.equal(warn.fields.severity, "critical");
  assert.deepEqual(warn.fields.channels, ["webhook", "email", "slack"]);
});

// ── HD3 ─────────────────────────────────────────────────────────────
test("HD3 · severity BELOW min · early-skip path · counter NOT bumped", async () => {
  process.env.NEX_ALERTS_MIN_SEVERITY = "warning";
  const counterCalls = [], logCalls = [], dbCalls = [];
  const { dispatchAlert } = await loadDispatch({ counterCalls, logCalls, fetchImpl: async () => ({ ok: true }), dbCalls });
  const r = await dispatchAlert(fakeAlert({ severity: "info" }), ["webhook"]);
  delete process.env.NEX_ALERTS_MIN_SEVERITY;
  assert.equal(r.sent, 0);
  assert.equal(r.skipped, 1, "info < min=warning · skipped");
  assert.equal(counterCalls.filter((n) => n === "alerts.dispatch_no_transport").length, 0,
    "no_transport counter must NOT bump when severity is below min (that is a separate skip)");
});

// ── HD4 ─────────────────────────────────────────────────────────────
test("HD4 · evaluator source declares dispatch_skipped_gate return field + isDispatchEnabled export", () => {
  const src = readFileSync(join(REPO, "src/lib/nex/alerts/evaluator.ts"), "utf8");
  assert.match(src, /export\s+function\s+isDispatchEnabled\s*\(/,
    "evaluator.ts must export isDispatchEnabled()");
  assert.match(src, /dispatch_skipped_gate\s*[,:]?/,
    "evaluator.ts must reference the dispatch_skipped_gate return field");
  assert.match(src, /NEX_ALERTS_DISPATCH_ENABLED\s*===\s*["']1["']/,
    "isDispatchEnabled must gate on NEX_ALERTS_DISPATCH_ENABLED === '1'");
});
