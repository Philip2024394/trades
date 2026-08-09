#!/usr/bin/env node
// correlation.test.mjs · W-OBS-1 Path A Layer 1 · contract tests CID1-CID10
//
// Locks the correlation-ID module contract. No external deps beyond
// node:test + node:assert + node:async_hooks (already used by the
// module under test). Zero PG requirement. Zero network.
//
// Assertion legend (matching WORLD-CLASS-OPS-W-OBS-1-PATH-A-PLAN.md §14):
//   CID1 · getCorrelationId returns null outside any scope
//   CID2 · runWithCorrelationId establishes scope
//   CID3 · nested scopes · inner wins inside · outer restored outside
//   CID4 · parallel Promise.all inside scope · each read sees same CID
//   CID5 · setTimeout callback scheduled inside scope reads correct CID
//   CID6 · emitSignal without explicit CID picks up ALS CID (integration)
//   CID7 · emitSignal with explicit CID uses explicit not ALS (compat)
//   CID8 · runFromRequest with valid header + trustInbound adopts it
//   CID9 · runFromRequest with malformed header regenerates
//   CID10 · trust matrix · public route ignores inbound · cron accepts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

// Load correlation.ts standalone (no @/ alias resolution needed).
async function loadCorrelation() {
  const src = readFileSync(join(REPO, "src/lib/nex/observability/correlation.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "exports", "require",
    transformed.code + `
    module.exports = {
      getCorrelationId, runWithCorrelationId, runFromRequest,
      isValidCorrelationId, _hasCorrelationScopeForTests,
    };`,
  )(mod, mod.exports, (id) => {
    if (id === "node:async_hooks") return require("node:async_hooks");
    if (id === "node:crypto") return require("node:crypto");
    return {};
  });
  return mod.exports;
}

const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);

const corr = await loadCorrelation();
const { getCorrelationId, runWithCorrelationId, runFromRequest, isValidCorrelationId } = corr;

// Helper · fake request object matching the Next.js NextRequest shape
// enough for the module (only headers.get is used).
function fakeReq(headers = {}) {
  return {
    headers: {
      get(name) {
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === lower) return v;
        }
        return null;
      },
    },
  };
}

// ── CID1 ────────────────────────────────────────────────────────────

test("CID1 · getCorrelationId returns null outside any scope", () => {
  assert.equal(getCorrelationId(), null,
    "baseline · calling without a scope must not throw and must return null");
});

// ── CID2 ────────────────────────────────────────────────────────────

test("CID2 · runWithCorrelationId establishes scope · inner read returns the CID", () => {
  const CID = "abcdefghijklmnop-XYZ-12345";
  assert.ok(isValidCorrelationId(CID), "fixture must be a valid CID");
  const read = runWithCorrelationId(CID, () => getCorrelationId());
  assert.equal(read, CID);
  // Outside the scope · null again
  assert.equal(getCorrelationId(), null,
    "scope must end when fn returns · outer read reverts to null");
});

// ── CID3 ────────────────────────────────────────────────────────────

test("CID3 · nested scopes · inner wins inside · outer restored outside", () => {
  const OUTER = "aaaaaaaaaaaaaaaaOUTER";
  const INNER = "bbbbbbbbbbbbbbbbINNER";
  runWithCorrelationId(OUTER, () => {
    assert.equal(getCorrelationId(), OUTER, "outer scope active before nest");
    runWithCorrelationId(INNER, () => {
      assert.equal(getCorrelationId(), INNER, "inner overrides outer for reads inside it");
    });
    assert.equal(getCorrelationId(), OUTER, "outer restored automatically after inner returns");
  });
});

// ── CID4 ────────────────────────────────────────────────────────────

test("CID4 · parallel Promise.all inside scope · each read sees same CID", async () => {
  const CID = "parallel-cid-1234567890X";
  await runWithCorrelationId(CID, async () => {
    const results = await Promise.all([
      Promise.resolve().then(() => getCorrelationId()),
      Promise.resolve().then(() => getCorrelationId()),
      Promise.resolve().then(() => getCorrelationId()),
      new Promise((r) => setImmediate(() => r(getCorrelationId()))),
    ]);
    for (const r of results) assert.equal(r, CID, "every parallel branch sees the same CID");
  });
});

// ── CID5 ────────────────────────────────────────────────────────────

test("CID5 · setTimeout callback scheduled inside scope reads correct CID", async () => {
  const CID = "timer-cid-1234567890XY";
  const observed = await runWithCorrelationId(CID, () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(getCorrelationId()), 5);
    });
  });
  assert.equal(observed, CID, "timer callback inherits ALS context");
});

// ── CID6 · signal integration (post-emitSignal-amendment · this asserts the future contract) ──
// Verified by inspecting emitSignal source · the amendment lands in the emitSignal file.
// This test loads signals.ts (transformed) and asserts the ALS-fallback branch is present.

test("CID6 · emitSignal without explicit CID picks up ALS CID (contract present in source)", () => {
  const signalsSrc = readFileSync(join(REPO, "src/lib/nex/observability/signals.ts"), "utf8");
  // The contract: emitSignal must consult getCorrelationId when
  // correlation_id is not supplied by the caller. Post-amendment,
  // signals.ts imports getCorrelationId from ./correlation and
  // uses it as a fallback.
  const hasImport = /from\s+["']\.\/correlation["']/.test(signalsSrc);
  const usesGetter = /getCorrelationId\s*\(/.test(signalsSrc);
  assert.ok(hasImport,
    "signals.ts must import from ./correlation for CID6 fallback contract to hold");
  assert.ok(usesGetter,
    "signals.ts must call getCorrelationId() as fallback (CID6)");
});

// ── CID7 · explicit CID wins over ALS (journeys/attribution compat) ──

test("CID7 · emitSignal with explicit CID uses explicit not ALS", () => {
  const signalsSrc = readFileSync(join(REPO, "src/lib/nex/observability/signals.ts"), "utf8");
  // Contract: the emit function must consult sig.correlation_id first
  // and only fall through to ALS when it is null/undefined.
  // Encoded as a source-shape check: correlation_id ?? getCorrelationId()
  // OR equivalent nullish-coalescing / ternary pattern preserving
  // caller-explicit precedence.
  const explicitWinsShape =
    /sig\.correlation_id\s*\?\?\s*getCorrelationId\s*\(\)/.test(signalsSrc) ||
    /sig\.correlation_id\s*\|\|\s*getCorrelationId\s*\(\)/.test(signalsSrc) ||
    /correlation_id:\s*sig\.correlation_id\s*\?\?\s*getCorrelationId/.test(signalsSrc);
  assert.ok(explicitWinsShape,
    "signals.ts must use nullish-coalescing / ternary so explicit sig.correlation_id wins over ALS (CID7 · journeys+attribution compat)");
});

// ── CID8 ────────────────────────────────────────────────────────────

test("CID8 · runFromRequest with valid header + trustInbound=true adopts inbound", () => {
  const INBOUND = "abcdef1234567890-ABCDEF-1234";
  assert.ok(isValidCorrelationId(INBOUND), "fixture must be a valid CID");
  const req = fakeReq({ "x-request-id": INBOUND });
  const read = runFromRequest(req, { trustInbound: true }, () => getCorrelationId());
  assert.equal(read, INBOUND, "trusted valid inbound CID must be adopted verbatim");
});

// ── CID9 ────────────────────────────────────────────────────────────

test("CID9 · runFromRequest with malformed header regenerates fresh CID even when trusted", () => {
  const BAD_INBOUND = "!!";  // fails CID_PATTERN
  const req = fakeReq({ "x-request-id": BAD_INBOUND });
  const read = runFromRequest(req, { trustInbound: true }, () => getCorrelationId());
  assert.ok(isValidCorrelationId(read), "regenerated CID must be format-valid");
  assert.notEqual(read, BAD_INBOUND, "malformed inbound must NOT be adopted even when trusted");
});

// ── CID10 ───────────────────────────────────────────────────────────

test("CID10 · trust matrix · public route ignores inbound · cron route accepts", () => {
  const CANDIDATE = "cccccccccccccccc-CID-9999";
  assert.ok(isValidCorrelationId(CANDIDATE), "fixture must be a valid CID");

  // Public route · trustInbound omitted (default false) → regenerate
  const req = fakeReq({ "x-request-id": CANDIDATE });
  const publicRead = runFromRequest(req, () => getCorrelationId());
  assert.notEqual(publicRead, CANDIDATE,
    "public route (trustInbound defaulting to false) must ignore inbound and regenerate");
  assert.ok(isValidCorrelationId(publicRead), "regenerated CID must be format-valid");

  // Cron route · trustInbound: true → accept
  const cronRead = runFromRequest(req, { trustInbound: true }, () => getCorrelationId());
  assert.equal(cronRead, CANDIDATE,
    "cron route (trustInbound: true) must accept valid inbound CID");
});

// ── Sanity · module surface completeness ────────────────────────────

test("Sanity · module exports match plan §2 public API", () => {
  assert.equal(typeof getCorrelationId, "function");
  assert.equal(typeof runWithCorrelationId, "function");
  assert.equal(typeof runFromRequest, "function");
  assert.equal(typeof isValidCorrelationId, "function");
});
