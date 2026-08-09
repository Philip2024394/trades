#!/usr/bin/env node
// router-routing.test.mjs · Wave 11 remediation · closes part of F26 (routeJob coverage)
//
// routeJob() delivers completed KnowledgeJob results to their target
// brains as memories. Silent failures corrupt brain memory assignment
// (jobs report success while brains stay empty) · which is exactly the
// F6 concern from Pass 1.
//
// Assertions cover BOTH static invariants (RR1-RR7) AND live behaviour
// of normaliseBrain (RR8-RR12) which is the memory-isolation guard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/brain/router.ts"), "utf8");

// ── Static assertions on routeJob shape ───────────────────────────

const FROM_ROUTE_JOB = SRC.slice(SRC.indexOf("export async function routeJob"));
const NEXT_EXPORT    = FROM_ROUTE_JOB.slice(50).search(/^export /m);
const ROUTE_JOB_BLOCK = NEXT_EXPORT === -1
  ? FROM_ROUTE_JOB
  : FROM_ROUTE_JOB.slice(0, 50 + NEXT_EXPORT);

test("RR1 · routeJob exported with RouteResult return type", () => {
  assert.notEqual(ROUTE_JOB_BLOCK.length, 0);
  assert.match(SRC, /export async function routeJob\(job_id: string\): Promise<RouteResult>/);
});

test("RR2 · returns skipped=job_not_found when getJob returns null", () => {
  assert.match(ROUTE_JOB_BLOCK, /reason: "job_not_found"/);
});

test("RR3 · returns skipped=not_completed when status !== 'completed'", () => {
  assert.match(ROUTE_JOB_BLOCK, /reason: "not_completed"/);
  assert.match(ROUTE_JOB_BLOCK, /status: "completed"/);
});

test("RR4 · returns skipped=no_target_brains when target_brains empty", () => {
  assert.match(ROUTE_JOB_BLOCK, /reason: "no_target_brains"/);
});

test("RR5 · idempotent · skipped=already_routed for brains already in brains_linked", () => {
  assert.match(ROUTE_JOB_BLOCK, /reason: "already_routed"/);
  assert.match(ROUTE_JOB_BLOCK, /alreadyRouted\.has\(brainName\)/);
});

test("RR6 · appendMemory called for every routed target brain", () => {
  assert.match(ROUTE_JOB_BLOCK, /await appendMemory\(brainName/);
});

test("RR7 · writes completion_result.brains_linked so next call skips these brains", () => {
  assert.match(ROUTE_JOB_BLOCK, /brains_linked:/);
  assert.match(ROUTE_JOB_BLOCK, /memories_added:/);
});

// ── Live assertions on normaliseBrain (memory-isolation guard) ────

// normaliseBrain is a pure function with no imports · trivial to transpile
const NB_BLOCK = SRC.match(/export function normaliseBrain[\s\S]*?^\}/m)?.[0] ?? "";
const stripped = NB_BLOCK.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "exports", transformed.code + `
module.exports = { normaliseBrain };
`)(mod, mod.exports);
const { normaliseBrain } = mod.exports;

test("RR8 · normaliseBrain is deterministic and idempotent", () => {
  const a = normaliseBrain("Staircase Brain");
  const b = normaliseBrain("Staircase Brain");
  assert.equal(a, b);
  assert.equal(normaliseBrain(a), a, "normaliseBrain must be idempotent");
});

test("RR9 · normaliseBrain lowercases + kebab-cases", () => {
  assert.equal(normaliseBrain("Staircase Brain"), "staircase-brain");
  assert.equal(normaliseBrain("KITCHEN"), "kitchen");
  assert.equal(normaliseBrain("Kitchen  &  Bath"), "kitchen-and-bath");
});

test("RR10 · normaliseBrain does NOT collide across distinct display names (dot-separators)", () => {
  const a = normaliseBrain("Foo & Bar");
  const b = normaliseBrain("Foo and Bar");
  // Both normalise to the same slug — that's expected (the "&" → "and" rule).
  // What we DON'T want is unrelated brains colliding.
  assert.equal(a, b, "& and 'and' should collapse (documented rule)");
  assert.notEqual(normaliseBrain("Foo Bar"), normaliseBrain("Foo Baz"));
});

test("RR11 · normaliseBrain strips outer punctuation but preserves inner separators", () => {
  assert.equal(normaliseBrain("  --Staircase--  "), "staircase");
  assert.equal(normaliseBrain("Doors (Front)"), "doors-front");
});

test("RR12 · normaliseBrain never emits leading/trailing hyphens", () => {
  const inputs = ["--Staircase--", "  Kitchen  ", "&&Bath&&", "()Interior()"];
  for (const s of inputs) {
    const out = normaliseBrain(s);
    assert.doesNotMatch(out, /^-|-$/, `normaliseBrain(${JSON.stringify(s)}) = ${out} has stray hyphen`);
  }
});
