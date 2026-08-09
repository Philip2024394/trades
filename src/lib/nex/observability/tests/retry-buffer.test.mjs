#!/usr/bin/env node
// retry-buffer.test.mjs · Wave 11 · GROUP B · closes F9
//
// Contract tests for the bounded audit-retry ring buffer.
// The buffer MUST:
//   RB1 · start empty
//   RB2 · enqueue up to CAPACITY without dropping
//   RB3 · evict OLDEST + fire audit-emit-dropped signal at overflow
//   RB4 · drain returns snapshot AND empties internal ring atomically
//   RB5 · retryBufferStatus reports size + capacity + oldest_at
//   RB6 · every enqueueForRetry increments audit.emit_failed counter
//   RB7 · never throws · never blocks · never leaks memory beyond CAPACITY

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
    if (id === "@/lib/nex/events/fs-store") return { emitEventSafe: () => Promise.resolve() };
    // W-OBS-1 Path A · signals.ts imports ./correlation for ALS fallback ·
    // this test file doesn't exercise ALS behavior · null-stub preserves
    // existing semantics (no ambient CID → explicit CID paths only).
    if (id === "./correlation") return { getCorrelationId: () => null };
    return requireFromHere(id);
  });
  return mod.exports;
}

const counters = await loadTs("src/lib/nex/observability/counters.ts",
  ["incr", "read", "snapshot", "_resetAllCountersForTests"]);
const signalsMod = await loadTs("src/lib/nex/observability/signals.ts", ["emitSignal"]);

// Load retry-buffer with real counters + signals
const bufMod = await (async () => {
  const src = readFileSync(join(REPO, "src/lib/nex/observability/retry-buffer.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { enqueueForRetry, drainRetryBuffer, retryBufferStatus, _resetRetryBufferForTests, _capacityForTests };`,
  )(mod, process, mod.exports, (id) => {
    if (id === "./counters") return counters;
    if (id === "./signals")  return signalsMod;
    return requireFromHere(id);
  });
  return mod.exports;
})();

function captureWarn(fn) {
  const orig = console.warn;
  const captured = [];
  console.warn = (...args) => captured.push(args.join(" "));
  try { fn(); } finally { console.warn = orig; }
  return captured;
}

test("RB1 · fresh buffer starts empty · status reports size=0 · oldest_at=null", () => {
  bufMod._resetRetryBufferForTests();
  const s = bufMod.retryBufferStatus();
  assert.equal(s.size, 0);
  assert.equal(s.oldest_at, null);
  assert.equal(s.capacity, bufMod._capacityForTests());
});

test("RB2 · enqueue up to CAPACITY without dropping · size tracks", () => {
  bufMod._resetRetryBufferForTests();
  counters._resetAllCountersForTests();
  const cap = bufMod._capacityForTests();
  captureWarn(() => {
    for (let i = 0; i < cap; i++) bufMod.enqueueForRetry({ i });
  });
  assert.equal(bufMod.retryBufferStatus().size, cap);
  assert.equal(counters.read("audit.emit_failed").count, cap);
  assert.equal(counters.read("audit.emit_dropped").count, 0);
});

test("RB3 · overflow evicts OLDEST + fires audit-emit-dropped signal", () => {
  bufMod._resetRetryBufferForTests();
  counters._resetAllCountersForTests();
  const cap = bufMod._capacityForTests();
  const captured = captureWarn(() => {
    // Fill to capacity
    for (let i = 0; i < cap; i++) bufMod.enqueueForRetry({ seq: i });
    // Overflow by 3
    bufMod.enqueueForRetry({ seq: cap });
    bufMod.enqueueForRetry({ seq: cap + 1 });
    bufMod.enqueueForRetry({ seq: cap + 2 });
  });
  assert.equal(bufMod.retryBufferStatus().size, cap);
  assert.equal(counters.read("audit.emit_dropped").count, 3, "3 evictions");
  // Every eviction fires the signal · count matches
  const dropped = captured.filter((l) => /kind=audit-emit-dropped/.test(l));
  assert.equal(dropped.length, 3, `expected 3 audit-emit-dropped signals · got ${dropped.length}`);
  assert.match(dropped[0], /code=buffer-full/);
});

test("RB4 · drain returns snapshot AND empties internal ring atomically", () => {
  bufMod._resetRetryBufferForTests();
  captureWarn(() => {
    bufMod.enqueueForRetry({ id: "a" });
    bufMod.enqueueForRetry({ id: "b" });
    bufMod.enqueueForRetry({ id: "c" });
  });
  assert.equal(bufMod.retryBufferStatus().size, 3);
  const snap = bufMod.drainRetryBuffer();
  assert.equal(snap.length, 3);
  assert.equal(snap[0].payload.id, "a");
  assert.equal(snap[2].payload.id, "c");
  // Buffer is now empty
  assert.equal(bufMod.retryBufferStatus().size, 0);
  // Second drain returns nothing (proves atomicity)
  const snap2 = bufMod.drainRetryBuffer();
  assert.equal(snap2.length, 0);
});

test("RB5 · retryBufferStatus reports oldest_at ISO after first enqueue", () => {
  bufMod._resetRetryBufferForTests();
  const before = new Date().toISOString();
  captureWarn(() => bufMod.enqueueForRetry({ x: 1 }));
  const s = bufMod.retryBufferStatus();
  assert.equal(s.size, 1);
  assert.notEqual(s.oldest_at, null);
  assert.ok(s.oldest_at >= before, `oldest_at ${s.oldest_at} must be >= ${before}`);
});

test("RB6 · every enqueueForRetry increments audit.emit_failed", () => {
  bufMod._resetRetryBufferForTests();
  counters._resetAllCountersForTests();
  captureWarn(() => {
    bufMod.enqueueForRetry({ x: 1 });
    bufMod.enqueueForRetry({ x: 2 });
    bufMod.enqueueForRetry({ x: 3 });
  });
  assert.equal(counters.read("audit.emit_failed").count, 3);
});

test("RB7 · enqueue NEVER throws on garbage input", () => {
  bufMod._resetRetryBufferForTests();
  captureWarn(() => {
    bufMod.enqueueForRetry(null);
    bufMod.enqueueForRetry(undefined);
    bufMod.enqueueForRetry({});
    bufMod.enqueueForRetry("string");
    bufMod.enqueueForRetry(42);
  });
  assert.equal(bufMod.retryBufferStatus().size, 5);
});

test("RB8 · CAPACITY is a bounded compile-time constant (not caller-tunable)", () => {
  const cap = bufMod._capacityForTests();
  assert.equal(typeof cap, "number");
  assert.ok(cap >= 100 && cap <= 10000, `capacity ${cap} must be in [100, 10000] · larger risks leak · smaller risks lossiness`);
});
