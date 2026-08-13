#!/usr/bin/env node
// worker-logger-adoption.test.mjs · Wave 3 H2.c drift-catcher
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H2-CID-LOGGER.md
//
// Locks the F4 logger adoption invariants for worker files. Any future
// PR that regresses adoption fails CI.
//
// Assertions:
//   W1 · every .ts file in src/lib/nex/brain/workers/ imports the F4 logger
//        from @/lib/nex/observability/logger
//   W2 · every worker instantiates `const log = logger("worker.<name>")`
//        (subsystem prefix is enforced so log aggregators can filter by it)
//   W3 · no .ts file in the workers dir contains bare console.log|warn|error
//        outside a whitelisted set (currently: none · all migrated)
//   W4 · every job-processing worker (the 6 workers that call claimNextJob)
//        also calls enterJobCorrelationScope(job) after the claim so the
//        job's CID inherits into every log line + audit + downstream enqueue
//
// The drift-catcher does NOT enforce specific log fields or call counts —
// those are the caller's judgment. It only enforces the ADOPTION invariant.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKERS_DIR = join(__dirname, "..");

// Files under workers/ that are worker files. Excludes:
//   · tests/ subdir (test files may use console.* for diagnostics)
//   · this file itself
//   · _finalize.ts is treated as a worker (shared helper · has its own logger)
function listWorkerFiles() {
  return readdirSync(WORKERS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(WORKERS_DIR, f));
}

// The 6 job-processing workers (identified by presence of claimNextJob).
// llm-retry + memory-guardian are batch workers · they don't call claimNextJob
// and therefore don't need enterJobCorrelationScope on that path.
const JOB_PROCESSING_WORKERS = [
  "knowledge-context.ts",
  "voice-context.ts",
  "learning-context.ts",
  "knowledge-extractor.ts",
  "image-analyst.ts",
  "quality-checker.ts",
];

function read(p) { return readFileSync(p, "utf8"); }

test("W1 · every worker file imports the F4 logger from @/lib/nex/observability/logger", () => {
  const missing = [];
  for (const p of listWorkerFiles()) {
    const src = read(p);
    const hasImport = /import\s*\{[^}]*\blogger\b[^}]*\}\s*from\s*["']@\/lib\/nex\/observability\/logger["']/.test(src);
    if (!hasImport) missing.push(basename(p));
  }
  assert.equal(missing.length, 0,
    `H2.b regression · these worker files do not import the F4 logger: ${missing.join(" · ")}`);
});

test("W2 · every worker instantiates `const log = logger(\"worker.<name>\")`", () => {
  const missing = [];
  for (const p of listWorkerFiles()) {
    const src = read(p);
    // Match `const log = logger("worker.<subsystem>")` — the subsystem name is
    // free-form (we just require the "worker." prefix).
    const hasInstantiation = /const\s+log\s*=\s*logger\s*\(\s*["']worker\.[a-zA-Z0-9_-]+["']\s*\)/.test(src);
    if (!hasInstantiation) missing.push(basename(p));
  }
  assert.equal(missing.length, 0,
    `H2.b regression · these worker files lack a \`const log = logger("worker.<name>")\` instantiation: ${missing.join(" · ")}`);
});

test("W3 · no worker file contains a bare console.log|warn|error", () => {
  const offenders = [];
  for (const p of listWorkerFiles()) {
    const src = read(p);
    // Strip line + block comments before scanning so commentary about
    // console.* in doc-comments doesn't false-positive.
    const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
    const noLine  = noBlock.replace(/\/\/[^\n]*/g, "");
    const matches = noLine.match(/\bconsole\.(log|warn|error)\b/g) ?? [];
    if (matches.length > 0) offenders.push(`${basename(p)} (${matches.length})`);
  }
  assert.equal(offenders.length, 0,
    `H2.b regression · these worker files still use console.* directly (must use \`log.*\`): ${offenders.join(" · ")}`);
});

test("W4 · every job-processing worker calls enterJobCorrelationScope(job) after claimNextJob", () => {
  const missing = [];
  for (const w of JOB_PROCESSING_WORKERS) {
    const src = read(join(WORKERS_DIR, w));
    const hasClaim = /await\s+store\.claimNextJob\s*\(/.test(src);
    const hasScope = /enterJobCorrelationScope\s*\(\s*job\s*\)/.test(src);
    if (!hasClaim) {
      missing.push(`${w} (expected claimNextJob call not found)`);
      continue;
    }
    if (!hasScope) {
      missing.push(`${w} (claimNextJob found but no enterJobCorrelationScope(job) call)`);
    }
  }
  assert.equal(missing.length, 0,
    `H2.b regression · these job-processing workers do not scope CID from the claimed job: ${missing.join(" · ")}`);
});
