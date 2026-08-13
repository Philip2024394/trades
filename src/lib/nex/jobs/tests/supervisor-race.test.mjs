#!/usr/bin/env node
// supervisor-race.test.mjs
//
// Wave 2 · Phase 6 · Race + batch cap + route entrypoint tests.
// Governed by W-C-COMPANION-PHASE-6-DESIGN.md §6, §8, §11.
//
// Covers:
//   N1 · Batch cap enforcement (MAX_PER_TICK)
//   N2 · Race between sweep and Path C cascade (helper wins)
//   E1-E5 · Cron entrypoint static-shape checks
//   D1 · Stuck detector filter correctness

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const requireReal = createRequire(import.meta.url);

async function loadModule(relPath, exportsNames = [], extraStubs = {}) {
  const src = readFileSync(join(REPO, relPath), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  const stubRequire = (id) => {
    if (id.startsWith("node:")) return requireReal(id);
    if (extraStubs[id]) return extraStubs[id];
    return {};
  };
  const suffix = exportsNames.length > 0 ? `\nmodule.exports = { ${exportsNames.join(", ")} };` : "";
  new Function("module", "process", "exports", "require", "console",
    t.code + suffix,
  )(mod, process, mod.exports, stubRequire, console);
  return mod;
}

// ── D1 · Stuck detector correctness ───────────────────────────────────
const detectorMod = await loadModule("src/lib/nex/jobs/supervisor-stuck-detector.ts", ["detectStuck", "readStuckDetectorConfig"], {});
const { detectStuck, readStuckDetectorConfig } = detectorMod.exports;

test("D1 · detectStuck filters exactly by (status='claimed' AND progress=0 AND updated<threshold)", () => {
  const now = new Date();
  const stuck1 = { job_id: "s1", status: "claimed", progress: 0, updated_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() };
  const stuck2 = { job_id: "s2", status: "claimed", progress: 0, updated_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString() };
  const stuck3 = { job_id: "s3", status: "claimed", progress: 0, updated_at: new Date(now.getTime() - 31 * 60 * 1000).toISOString() };
  const recent = { job_id: "recent", status: "claimed", progress: 0, updated_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString() };
  const progressing = { job_id: "prog", status: "claimed", progress: 50, updated_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() };
  const other = { job_id: "other", status: "processing", progress: 0, updated_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() };
  const cfg = { stuck_after_minutes: 30, max_per_tick: 100 };
  const result = detectStuck([stuck1, stuck2, stuck3, recent, progressing, other], cfg, now);
  assert.equal(result.length, 3);
  const ids = result.map((r) => r.job_id).sort();
  assert.deepEqual(ids, ["s1", "s2", "s3"]);
});

test("D1b · readStuckDetectorConfig defaults + env override", () => {
  const c1 = readStuckDetectorConfig({});
  assert.equal(c1.stuck_after_minutes, 30);
  assert.equal(c1.max_per_tick, 25);
  const c2 = readStuckDetectorConfig({ NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN: "45", NEX_KJOB_SUPERVISOR_MAX_PER_TICK: "10" });
  assert.equal(c2.stuck_after_minutes, 45);
  assert.equal(c2.max_per_tick, 10);
  const c3 = readStuckDetectorConfig({ NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN: "-5", NEX_KJOB_SUPERVISOR_MAX_PER_TICK: "notanumber" });
  assert.equal(c3.stuck_after_minutes, 30); // falls back
  assert.equal(c3.max_per_tick, 25);
});

// ── N1 · Batch cap · stuck detector slices at MAX_PER_TICK ────────────
test("N1 · MAX_PER_TICK=3 · 5 stuck jobs → detector returns exactly 3", () => {
  const now = new Date();
  const past = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const stuck = Array.from({ length: 5 }, (_, i) => ({
    job_id: `n1-${i}`, status: "claimed", progress: 0, updated_at: past,
  }));
  const result = detectStuck(stuck, { stuck_after_minutes: 30, max_per_tick: 3 }, now);
  assert.equal(result.length, 3);
});

// ── N2 · Race between sweep and Path C cascade (helper idempotency wins)
test("N2 · Path C cascade fires mid-sweep · sweep sees status=completed on re-fetch · no-op", async () => {
  process.env.NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN = "30";
  const classifierMod = await loadModule("src/lib/nex/jobs/kjob-supervisor.ts", ["classifyStuckKJ"], {});
  const supMod = await loadModule("src/lib/nex/jobs/supervisor.ts", ["runSupervisorSweep"], {
    "./fs-store": {},
    "./terminal-transition": { applyTerminalKnowledgeJobTransition: null },
    "./supervisor-stuck-detector": detectorMod.exports,
    "./kjob-supervisor":           classifierMod.exports,
    "@/lib/nex/brain/storage": {},
    "@/lib/nex/brain/types": {},
    "@/lib/nex/observability/counters": { incr: () => {} },
    "@/lib/nex/observability/signals":  { emitSignal: () => {} },
    "@/lib/nex/observability/logger":   { logger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }) },
  });
  const { runSupervisorSweep } = supMod.exports;

  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  // Start "stuck", but flip to completed between listJobs and getJob.
  let getJobCallCount = 0;
  const seedKj = { job_id: "n2", inbox_item_id: "inbox-n2", status: "claimed", progress: 0, updated_at: past, created_at: past };
  const jobs = new Map([[seedKj.job_id, { ...seedKj }]]);

  const kjStore = {
    getJob: async (id) => {
      getJobCallCount += 1;
      // First re-fetch inside sweep: simulate cascade already terminated it.
      if (getJobCallCount === 1) {
        return { ...jobs.get(id), status: "completed" };
      }
      return jobs.get(id) ?? null;
    },
    listJobs: async () => Array.from(jobs.values()),
    updateJob: async () => { throw new Error("updateJob must NOT be called when race is detected"); },
  };
  let auditWritten = 0;
  const store = {
    listWorkerJobsByInputRef: async () => [],
    listWorkerResultsByIds:   async () => [],
    writeKnowledgeJobTransitionAudit: async () => { auditWritten += 1; },
    insertAudit: async (i) => { throw new Error("insertAudit must NOT fire · race avoidance"); },
    listAudit: async () => [],
  };
  const apply = async () => { throw new Error("apply must not be called when race is detected"); };

  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(result.attested.length, 0);
  assert.equal(result.reviewed_via_path_b.length, 0);
  assert.equal(auditWritten, 0);
});

// ── E1-E5 · route static-shape checks ────────────────────────────────
const ROUTE_PATH = "src/app/api/nex/brain/supervisor-sweep/route.ts";
const routeSrc = readFileSync(join(REPO, ROUTE_PATH), "utf8");

test("E1 · route calls checkCronAuth with scope='supervisor'", () => {
  assert.match(routeSrc, /checkCronAuth\([^)]*\{\s*scope:\s*["']supervisor["']\s*\}/);
});
test("E2 · route returns disabled:true when env unset", () => {
  assert.match(routeSrc, /disabled:\s*true/);
  assert.match(routeSrc, /NEX_KJOB_SUPERVISOR_ENABLED/);
});
test("E3 · route returns skipped_concurrent:true when lock not acquired", () => {
  assert.match(routeSrc, /skipped_concurrent:\s*true/);
});
test("E4 · route increments supervisor.error on sweep throw + returns 500", () => {
  assert.match(routeSrc, /incr\(["']supervisor\.error["']\)/);
  assert.match(routeSrc, /sweep_failed/);
});
test("E5 · route wraps handler in runFromRequest (CADP1)", () => {
  assert.match(routeSrc, /runFromRequest/);
});
