#!/usr/bin/env node
// observability-core.test.mjs · Wave 11 · GROUP B remediation
//
// Contract tests for the shared observability primitives:
//   src/lib/nex/observability/outcome.ts
//   src/lib/nex/observability/counters.ts
//   src/lib/nex/observability/signals.ts
//   src/lib/nex/observability/validate.ts
//
// The tests enforce Philip's rules (2026-08-10):
//   · Success / skipped / rejected / failed / unavailable / fallback all named
//   · No silent catch — signals always fire
//   · Never log secrets · sanitised detail
//   · Machine-readable counters
//   · Positive AND failure signal both tested

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const requireFromHere = createRequire(import.meta.url);

async function loadTs(relPath, exports) {
  const src = readFileSync(join(REPO, relPath), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { ${exports.join(", ")} };`,
  )(mod, process, mod.exports, (id) => {
    // Stub the events module so signals don't reach the real audit trail
    // during unit tests.
    if (id === "@/lib/nex/events/fs-store") return { emitEventSafe: () => Promise.resolve() };
    // W-OBS-1 Path A · signals.ts now imports ./correlation for ALS
    // fallback. The unit tests here exercise EXPLICIT-CID paths (which
    // don't depend on ALS) so a null-returning stub preserves original
    // test semantics. If a future test needs live ALS behavior, replace
    // this stub with the real module or use AsyncLocalStorage inline.
    if (id === "./correlation") return { getCorrelationId: () => null };
    // Stub the counters + signals modules for validate.ts so it uses
    // real implementations we load here (chained via requireFromHere).
    return requireFromHere(id);
  });
  return mod.exports;
}

// ── outcome.ts ─────────────────────────────────────────────────────

const outcome = await loadTs("src/lib/nex/observability/outcome.ts",
  ["success", "skipped", "rejected", "failed", "unavailable", "fallback", "isSuccess", "isFallback", "isProblem"]);

test("O1 · success wraps value", () => {
  const o = outcome.success(42);
  assert.equal(o.kind, "success");
  assert.equal(o.value, 42);
  assert.equal(outcome.isSuccess(o), true);
  assert.equal(outcome.isProblem(o), false);
});

test("O2 · skipped / rejected / failed / unavailable all carry a reason", () => {
  for (const [maker, kind] of [
    [outcome.skipped,      "skipped"],
    [outcome.rejected,     "rejected"],
    [outcome.failed,       "failed"],
    [outcome.unavailable,  "unavailable"],
  ]) {
    const o = maker("some-reason");
    assert.equal(o.kind, kind);
    assert.equal(o.reason, "some-reason");
    assert.equal(outcome.isProblem(o), true);
  }
});

test("O3 · fallback carries value AND reason (both dimensions)", () => {
  const o = outcome.fallback([], "pg-unavailable", "ECONNREFUSED");
  assert.equal(o.kind, "fallback");
  assert.deepEqual(o.value, []);
  assert.equal(o.reason, "pg-unavailable");
  assert.equal(o.primary_error_code, "ECONNREFUSED");
  assert.equal(outcome.isFallback(o), true);
  // Fallback is neither success nor problem · it's its own category.
  assert.equal(outcome.isSuccess(o), false);
  assert.equal(outcome.isProblem(o), false);
});

test("O4 · failed carries optional error_code + detail", () => {
  const o = outcome.failed("provider-error", { error_code: "ECONNRESET", detail: "voice-context call" });
  assert.equal(o.error_code, "ECONNRESET");
  assert.equal(o.detail, "voice-context call");
});

// ── counters.ts ────────────────────────────────────────────────────

const counters = await loadTs("src/lib/nex/observability/counters.ts",
  ["incr", "read", "snapshot", "_resetAllCountersForTests"]);

test("C1 · fresh counter reads zero with null last_at", () => {
  counters._resetAllCountersForTests();
  const s = counters.read("shadow.mirror_failed");
  assert.equal(s.count, 0);
  assert.equal(s.last_at, null);
});

test("C2 · incr bumps count and stamps last_at", () => {
  counters._resetAllCountersForTests();
  counters.incr("router.route_failed");
  counters.incr("router.route_failed");
  counters.incr("router.route_failed");
  const s = counters.read("router.route_failed");
  assert.equal(s.count, 3);
  assert.match(s.last_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test("C3 · snapshot returns every named counter, even zero ones (honest '—' doctrine)", () => {
  counters._resetAllCountersForTests();
  counters.incr("audit.emit_failed");
  const snap = counters.snapshot();
  // Every named counter appears
  assert.ok("shadow.mirror_failed" in snap);
  assert.ok("audit.emit_failed" in snap);
  assert.ok("validate.row_dropped" in snap);
  // Zero counters have count=0 · not omitted
  assert.equal(snap["shadow.mirror_failed"].count, 0);
  assert.equal(snap["audit.emit_failed"].count, 1);
});

test("C4 · snapshot is a deep copy (mutation does not affect store)", () => {
  counters._resetAllCountersForTests();
  counters.incr("jobs.create_failed");
  const s1 = counters.read("jobs.create_failed");
  s1.count = 999;                           // mutate the copy
  const s2 = counters.read("jobs.create_failed");
  assert.equal(s2.count, 1, "counter store must not be mutated by callers");
});

// ── signals.ts ─────────────────────────────────────────────────────

const signalsMod = await loadTs("src/lib/nex/observability/signals.ts", ["emitSignal"]);

function captureWarn(fn) {
  const orig = console.warn;
  const captured = [];
  console.warn = (...args) => captured.push(args.join(" "));
  try { fn(); } finally { console.warn = orig; }
  return captured;
}

test("S1 · emitSignal writes a structured console.warn line", () => {
  const out = captureWarn(() => {
    signalsMod.emitSignal({
      subsystem: "brain",
      kind: "shadow-write-failed",
      code: "insertRecord",
      correlation_id: "abc123",
      detail: "primary insert succeeded but secondary rejected",
    });
  });
  const line = out[0];
  assert.match(line, /\[nex-signal\]/);
  assert.match(line, /subsystem=brain/);
  assert.match(line, /kind=shadow-write-failed/);
  assert.match(line, /code=insertRecord/);
  assert.match(line, /correlation=abc123/);
  assert.match(line, /detail="primary insert succeeded/);
});

test("S2 · emitSignal NEVER throws · even with garbage input", () => {
  captureWarn(() => {
    signalsMod.emitSignal({ subsystem: "x", kind: "audit-emit-failed" });
    signalsMod.emitSignal({ subsystem: "y", kind: "route-failed", detail: undefined });
  });
  // If any throw · this test file would fail with an uncaught error.
  assert.ok(true);
});

test("S3 · emitSignal truncates over-long detail (security: bounded log output)", () => {
  const longDetail = "x".repeat(500);
  const out = captureWarn(() => {
    signalsMod.emitSignal({ subsystem: "x", kind: "row-dropped", detail: longDetail });
  });
  const line = out[0];
  // The detail block must NOT include the full 500-char string.
  assert.ok(line.length < 500, `line length ${line.length} · expected truncation`);
  assert.match(line, /\.\.\."/);
});

test("S4 · emitSignal escapes double quotes in detail (log parsability)", () => {
  const out = captureWarn(() => {
    signalsMod.emitSignal({ subsystem: "x", kind: "audit-emit-dropped", detail: `evil "quote" injection` });
  });
  const line = out[0];
  // The double-quote in detail is replaced with a single-quote so the
  // detail="..." wrapper stays parsable.
  assert.doesNotMatch(line, /detail="evil "quote"/);
  assert.match(line, /detail="evil 'quote' injection"/);
});

// ── validate.ts ────────────────────────────────────────────────────

// validate.ts imports counters + signals · use them as-is so the test
// exercises the full stack.
const validate = await (async () => {
  const src = readFileSync(join(REPO, "src/lib/nex/observability/validate.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { validateOrDrop };`,
  )(mod, process, mod.exports, (id) => {
    if (id === "./counters") return counters;
    if (id === "./signals")  return signalsMod;
    return requireFromHere(id);
  });
  return mod.exports;
})();

test("V-VAL1 · all rows valid → returns full array, dropped=0", () => {
  counters._resetAllCountersForTests();
  const captured = captureWarn(() => {
    const r = validate.validateOrDrop(
      [1, 2, 3, 4, 5],
      (n) => Number.isInteger(n) ? { ok: true, value: n } : { ok: false, reason: "not-int" },
      { subsystem: "test", counter: "validate.row_dropped", signal_kind: "row-dropped" },
    );
    assert.deepEqual(r.valid, [1, 2, 3, 4, 5]);
    assert.equal(r.dropped, 0);
    assert.equal(r.reasons.size, 0);
  });
  assert.equal(captured.length, 0, "no signals when all valid");
  assert.equal(counters.read("validate.row_dropped").count, 0);
});

test("V-VAL2 · mixed valid/invalid · valid returned · invalid dropped + counted + signalled", () => {
  counters._resetAllCountersForTests();
  const captured = captureWarn(() => {
    const r = validate.validateOrDrop(
      [1, "bad", 3, null, 5, "worse"],
      (row) => Number.isInteger(row) ? { ok: true, value: row } : { ok: false, reason: typeof row === "string" ? "not-a-number" : "null-row" },
      { subsystem: "unit", counter: "validate.row_dropped", signal_kind: "row-dropped" },
    );
    assert.deepEqual(r.valid, [1, 3, 5]);
    assert.equal(r.dropped, 3);
    assert.equal(r.reasons.get("not-a-number"), 2);
    assert.equal(r.reasons.get("null-row"), 1);
  });
  // 3 dropped · default max_signals=5 · so 3 signals emitted (all shown).
  assert.equal(captured.length, 3);
  assert.equal(counters.read("validate.row_dropped").count, 3);
});

test("V-VAL3 · aggregate signal fires when drops exceed max_signals", () => {
  counters._resetAllCountersForTests();
  const captured = captureWarn(() => {
    const r = validate.validateOrDrop(
      new Array(10).fill("bad"),
      () => ({ ok: false, reason: "always-bad" }),
      { subsystem: "unit", counter: "validate.line_dropped", signal_kind: "line-dropped", max_signals: 2 },
    );
    assert.equal(r.dropped, 10);
  });
  // 2 per-row signals + 1 aggregate = 3 emissions
  assert.equal(captured.length, 3, `expected 3 emissions · got ${captured.length}`);
  assert.match(captured[2], /code=aggregate/);
  assert.match(captured[2], /dropped=10/);
});

test("V-VAL4 · positive path AND failure signal both testable in isolation", () => {
  counters._resetAllCountersForTests();
  // Positive path
  const captured1 = captureWarn(() => {
    const r = validate.validateOrDrop(
      [{ id: "a" }, { id: "b" }],
      (row) => typeof row?.id === "string" ? { ok: true, value: row } : { ok: false, reason: "missing-id" },
      { subsystem: "unit", counter: "validate.row_dropped", signal_kind: "row-dropped" },
    );
    assert.equal(r.dropped, 0);
    assert.equal(r.valid.length, 2);
  });
  assert.equal(captured1.length, 0);

  // Failure path
  const captured2 = captureWarn(() => {
    const r = validate.validateOrDrop(
      [{ id: "a" }, { no_id_here: 1 }],
      (row) => typeof row?.id === "string" ? { ok: true, value: row } : { ok: false, reason: "missing-id" },
      { subsystem: "unit", counter: "validate.row_dropped", signal_kind: "row-dropped" },
    );
    assert.equal(r.dropped, 1);
    assert.equal(r.reasons.get("missing-id"), 1);
  });
  assert.equal(captured2.length, 1);
});
