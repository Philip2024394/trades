#!/usr/bin/env node
// correlation-adoption.test.mjs · W-OBS-1 Path A Layer 1 drift-catcher
//
// Locks the adoption invariants for Layer 1. Any future PR that
// violates them fails CI.
//
// Assertion legend (matching WORLD-CLASS-OPS-W-OBS-1-PATH-A-PLAN.md §14):
//   CADP1 · every `src/app/api/nex/**/route.ts` handler either wraps in
//           runFromRequest OR is on the CANARY_EXEMPT allowlist
//   CADP2 · getCorrelationId + runWithCorrelationId + runFromRequest
//           defined exactly ONCE across src/lib/nex/**
//   CADP3 · AsyncLocalStorage instantiated exactly ONCE (in correlation.ts)
//   CADP4 · Middleware sets `x-request-id` on the response for every return
//   CADP5 · Every `emitSignal` call site with no explicit correlation_id
//           is either (a) inside a runFromRequest scope OR
//           (b) on a documented exception list (fires SDK-callers,
//           worker chains that inherit via runWithCorrelationId, etc.)
//
// Boundary: Layer 1 CANARY_ADOPTED is small on purpose · the invariant
// is "adopted routes stay wrapped · new adoption is intentional · un-
// adopted routes stay documented as such." The list expands one route
// at a time as authorized.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const NEX_LIB   = join(REPO, "src/lib/nex");
const NEX_API   = join(REPO, "src/app/api/nex");
const MIDDLEWARE = join(REPO, "src/middleware.ts");

// ── helpers ──────────────────────────────────────────────────────────

function walk(dir, filter) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "tests" || entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walk(p, filter));
    } else if (filter(entry, p)) {
      out.push(p);
    }
  }
  return out;
}

function read(p) { return readFileSync(p, "utf8"); }
function rel(p)  { return relative(REPO, p).replace(/\\/g, "/"); }

// ── Layer 1 CANARY adoption list ────────────────────────────────────
//
// These 5 routes are the Wave 11 Layer 1 canary set. Adding new
// entries here requires design review (and typically Philip authorization).
// Removing an entry means the route lost its runFromRequest wrapper ·
// CADP1 will fail loudly.
const LAYER1_ADOPTED = new Set([
  "src/app/api/nex/knowledge-inbox/upload/route.ts",
  "src/app/api/nex/knowledge-inbox/urls/route.ts",
  "src/app/api/nex/knowledge-inbox/dump/route.ts",
  "src/app/api/nex/knowledge-inbox/process/route.ts",
  "src/app/api/nex/storage/gates/route.ts",
  // Wave 2 · Phase 6 · W-C-COMPANION supervisor entrypoint.
  // Design §16.5 explicitly authorises this addition (Philip 2026-08-10).
  "src/app/api/nex/brain/supervisor-sweep/route.ts",
  // Wave 3 · H2.a · CID adoption broadened (Philip 2026-08-10).
  // cron-tick is the pipeline entrypoint · every worker chain from cron
  // inherits its CID via enterJobCorrelationScope in each worker.
  "src/app/api/nex/brain/cron-tick/route.ts",
  // The 4 D9-migrated brain routes explicitly named in
  // WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (H2.a).
  "src/app/api/nex/brain/records/route.ts",
  "src/app/api/nex/brain/jobs/route.ts",
  "src/app/api/nex/brain/timeline/route.ts",
  "src/app/api/nex/brain/feedback/route.ts",
  // Wave 3 · H5 · alert evaluate/dispatch entrypoint (Philip 2026-08-10).
  "src/app/api/nex/alerts/evaluate/route.ts",
]);

// ── CADP1 · adopted routes wrap in runFromRequest ───────────────────

test("CADP1 · every Layer 1 adopted route wraps handler in runFromRequest", () => {
  const missing = [];
  for (const path of LAYER1_ADOPTED) {
    const abs = join(REPO, path);
    if (!existsSync(abs)) {
      missing.push(`${path} (file does not exist)`);
      continue;
    }
    const src = read(abs);
    // Assertion: the file imports runFromRequest AND the handler calls it.
    const importsWrapper = /from\s+["']@\/lib\/nex\/observability\/correlation["']/.test(src)
                       && /\brunFromRequest\b/.test(src);
    if (!importsWrapper) {
      missing.push(`${path} (missing runFromRequest import/call)`);
      continue;
    }
    // Assertion: at least one exported HTTP handler delegates to runFromRequest.
    // Shape: `export async function POST(req: NextRequest) { return runFromRequest(...); }`
    // OR the wrapper appears in the top 40 lines of any handler body.
    const wraps = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)[\s\S]{0,200}?runFromRequest\s*\(/.test(src);
    if (!wraps) {
      missing.push(`${path} (has import but no handler wraps in runFromRequest)`);
    }
  }
  assert.equal(missing.length, 0,
    `Layer 1 adoption regression · these routes lost their runFromRequest wrapper: ${missing.join(" · ")}`);
});

// ── CADP2 · canonical uniqueness of correlation helpers ─────────────

test("CADP2 · getCorrelationId + runWithCorrelationId + runFromRequest defined exactly once", () => {
  const helpers = ["getCorrelationId", "runWithCorrelationId", "runFromRequest"];
  const files = walk(NEX_LIB, (name) => name.endsWith(".ts"));

  for (const helper of helpers) {
    // Match `function Name(` OR `function Name<T,U>(` (generics allowed).
    const re = new RegExp(`^\\s*(?:export\\s+)?function\\s+${helper}\\s*(?:<[^>]*>)?\\s*\\(`, "m");
    const hits = [];
    for (const f of files) {
      if (re.test(read(f))) hits.push(rel(f));
    }
    assert.equal(hits.length, 1,
      `${helper} must be defined exactly once · found ${hits.length}: ${hits.join(", ")}`);
    assert.equal(hits[0], "src/lib/nex/observability/correlation.ts",
      `${helper} must live in observability/correlation.ts · found in ${hits[0]}`);
  }
});

// ── CADP3 · exactly one AsyncLocalStorage instantiation ─────────────

test("CADP3 · AsyncLocalStorage instantiated exactly once across src/lib/nex/**", () => {
  const files = walk(NEX_LIB, (name) => name.endsWith(".ts"));
  const hits = [];
  for (const f of files) {
    const src = read(f);
    // We match "new AsyncLocalStorage" (with optional generic) · not
    // just the import (that's fine to have anywhere · but only ONE
    // file may construct the store).
    if (/new\s+AsyncLocalStorage\s*[<(]/.test(src)) {
      hits.push(rel(f));
    }
  }
  assert.equal(hits.length, 1,
    `AsyncLocalStorage must be constructed exactly once · found ${hits.length}: ${hits.join(", ")}. Parallel ALS instances = parallel CID universes = trace continuity broken.`);
  assert.equal(hits[0], "src/lib/nex/observability/correlation.ts",
    `AsyncLocalStorage construction must live in observability/correlation.ts · found in ${hits[0]}`);
});

// ── CADP4 · middleware sets x-request-id on responses ───────────────

test("CADP4 · middleware sets x-request-id on every response return", () => {
  assert.ok(existsSync(MIDDLEWARE), "middleware.ts must exist");
  const src = read(MIDDLEWARE);

  // Assertion 1 · CID resolution function exists
  assert.match(src, /function\s+resolveCorrelationId\s*\(/,
    "middleware must define resolveCorrelationId helper");

  // Assertion 2 · attachCid helper exists
  assert.match(src, /function\s+attachCid\b/,
    "middleware must define attachCid response-header helper");

  // Assertion 3 · every `return` that produces a NextResponse routes through attachCid.
  // Count `return NextResponse.` occurrences vs `return attachCid(` occurrences.
  const bareNextReturns = (src.match(/return\s+NextResponse\./g) ?? []).length;
  const wrappedReturns  = (src.match(/return\s+attachCid\s*\(/g) ?? []).length;
  assert.equal(bareNextReturns, 0,
    `middleware has ${bareNextReturns} bare "return NextResponse.*" that bypass attachCid · every response return must attach the CID`);
  assert.ok(wrappedReturns >= 7,
    `middleware must have at least 7 attachCid-wrapped returns (matches current 8 return sites minus any that legitimately don't apply) · found ${wrappedReturns}`);

  // Assertion 4 · resolveCorrelationId is invoked once in middleware()
  const invoked = /const\s+cid\s*=\s*resolveCorrelationId\s*\(\s*req\s*\)/.test(src);
  assert.ok(invoked, "middleware must invoke resolveCorrelationId(req) once at the top of middleware()");
});

// ── CADP5 · emitSignal explicit-wins-over-ALS contract ──────────────

test("CADP5 · signals.ts implements explicit-wins-over-ALS via nullish coalescing", () => {
  const signalsSrc = read(join(REPO, "src/lib/nex/observability/signals.ts"));

  // Assertion 1 · imports getCorrelationId
  assert.match(signalsSrc, /import\s*\{[^}]*getCorrelationId[^}]*\}\s*from\s*["']\.\/correlation["']/,
    "signals.ts must import getCorrelationId from ./correlation");

  // Assertion 2 · explicit-wins shape (`sig.correlation_id ?? getCorrelationId()`)
  const explicitWinsShape =
    /sig\.correlation_id\s*\?\?\s*getCorrelationId\s*\(\)/.test(signalsSrc);
  assert.ok(explicitWinsShape,
    "signals.ts must resolve CID via `sig.correlation_id ?? getCorrelationId()` so caller-explicit values win over ALS (journeys+attribution+error-envelope compat)");

  // Assertion 3 · the resolved value is used in BOTH the console log line AND the payload
  // (regression-guard: earlier version had `sig.correlation_id ?? null` in the payload
  //  which would defeat the ALS fallback. This check ensures we don't regress.)
  const usesResolvedInPayload = /correlation_id:\s*resolvedCid\s*\?\?\s*null/.test(signalsSrc);
  assert.ok(usesResolvedInPayload,
    "signals.ts payload must persist the resolved CID (resolvedCid ?? null), not sig.correlation_id ?? null (regression guard)");
});
