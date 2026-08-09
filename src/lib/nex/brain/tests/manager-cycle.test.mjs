#!/usr/bin/env node
// manager-cycle.test.mjs · Wave 11 remediation · closes part of F26 (runOneCycle coverage)
//
// runOneCycle() is the orchestrator that fires every worker in the
// correct order and returns a CycleReport. If it silently skips a
// stage or mis-orders workers, the pipeline stalls with no test
// signal.
//
// Assertions:
//   MC1  · runOneCycle exported with options + return-type contract
//   MC2  · exercises FIVE named workers in the expected order
//   MC3  · primes standby heartbeats BEFORE draining (P12.3 invariant)
//   MC4  · uses withAuditEvents wrapper around every worker (audit contract)
//   MC5  · each stage respects its batch cap
//   MC6  · returns a CycleReport with duration_ms field
//   MC7  · every "break" on empty outcome is present (short-circuit invariant)
//   MC8  · llm-retry drain fires alongside or inside the cycle

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");

const FROM = SRC.slice(SRC.indexOf("export async function runOneCycle"));
const NEXT = FROM.slice(50).search(/^export /m);
const BLOCK = NEXT === -1 ? FROM : FROM.slice(0, 50 + NEXT);

test("MC1 · runOneCycle exported with options + CycleReport return", () => {
  assert.notEqual(BLOCK.length, 0, "runOneCycle must exist");
  assert.match(BLOCK, /context_batch\?:\s*number/);
  assert.match(BLOCK, /voice_batch\?:\s*number/);
  assert.match(BLOCK, /learning_batch\?:\s*number/);
  assert.match(BLOCK, /extractor_batch\?:\s*number/);
  assert.match(BLOCK, /checker_batch\?:\s*number/);
  assert.match(BLOCK, /Promise<CycleReport>/);
});

test("MC2 · exercises FIVE workers in the expected order: context → voice → learning → extractor → checker", () => {
  // Find the offsets of each worker name in the runOneCycle body.
  const positions = [
    ["knowledge-context",   BLOCK.indexOf('"knowledge-context"')],
    ["voice-context",       BLOCK.indexOf('"voice-context"')],
    ["learning-context",    BLOCK.indexOf('"learning-context"')],
    ["knowledge-extractor", BLOCK.indexOf('"knowledge-extractor"')],
    ["quality-checker",     BLOCK.indexOf('"quality-checker"')],
  ];
  for (const [name, pos] of positions) {
    assert.notEqual(pos, -1, `worker ${name} must appear in runOneCycle`);
  }
  // Assert strictly monotonic increasing offsets · that proves order.
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      positions[i][1] > positions[i - 1][1],
      `worker order violated: ${positions[i][0]} appears before ${positions[i - 1][0]}`,
    );
  }
});

test("MC3 · primes standby heartbeats BEFORE draining", () => {
  const primeIdx = BLOCK.indexOf("primeStandbyHeartbeats");
  const firstWorkerIdx = BLOCK.indexOf('"knowledge-context"');
  assert.notEqual(primeIdx, -1, "primeStandbyHeartbeats must be called");
  assert.ok(
    primeIdx < firstWorkerIdx,
    `primeStandbyHeartbeats must fire BEFORE the first worker · prime=${primeIdx} first=${firstWorkerIdx}`,
  );
});

test("MC4 · every worker call is wrapped in withAuditEvents", () => {
  // withAuditEvents(<worker-name>, runX) is the required call shape.
  const workers = ["knowledge-context", "voice-context", "learning-context", "knowledge-extractor", "quality-checker"];
  for (const w of workers) {
    const re = new RegExp(`withAuditEvents\\("${w}"`);
    assert.match(BLOCK, re, `withAuditEvents must wrap ${w}`);
  }
});

test("MC5 · each stage respects its batch cap (loop bound is the batch var)", () => {
  // Loop shape: `for (let i = 0; i < <batch>Batch; i += 1)`
  const batchLoops = BLOCK.match(/for \(let i = 0; i < \w+Batch; i \+= 1\)/g) ?? [];
  assert.ok(batchLoops.length >= 5, `expected ≥5 batch loops (one per worker) · got ${batchLoops.length}`);
});

test("MC6 · returns a CycleReport including duration_ms", () => {
  // Find the return in this function's body only.
  const returnMatch = BLOCK.match(/return \{[\s\S]{0,2000}duration_ms[\s\S]{0,2000}\};/);
  assert.ok(returnMatch, "runOneCycle return must include duration_ms field");
});

test("MC7 · short-circuits on empty outcome (break statements present per stage)", () => {
  // Each stage has `if (!outcome.job) break;` so an empty queue stops
  // that stage without wasting further iterations.
  const breaks = BLOCK.match(/if \(!outcome\.job\) break;/g) ?? [];
  assert.ok(breaks.length >= 5, `expected ≥5 short-circuit breaks · got ${breaks.length}`);
});

test("MC8 · drainLlmRetryQueue is invoked inside or immediately after the main workers", () => {
  assert.match(BLOCK, /drainLlmRetryQueue/, "llm-retry drain must be part of the cycle");
});
