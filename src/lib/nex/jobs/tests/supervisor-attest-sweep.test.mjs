#!/usr/bin/env node
// supervisor-attest-sweep.test.mjs
//
// Wave 2 · Phase 6 · Path A contract tests (A1-A6) + preconditions (T1).
// Governed by W-C-COMPANION-PHASE-6-DESIGN.md §3, §16.
//
// Strategy: load supervisor.ts + supervisor-stuck-detector.ts via esbuild
// transform (matches require-cron-token.test.mjs pattern). Inject in-memory
// fakes for BrainStore + fs-store surface so tests never touch the real DB
// or jobs.jsonl. That preserves the 10 real stuck fixtures absolutely.

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

// ── loader · esbuild transform + injected require stub ────────────────
// Follows the require-cron-token.test.mjs pattern: append explicit
// `module.exports = { ...names }` so the loaded module surfaces the
// identifiers we want. The `esbuild` CJS output alone leaves top-level
// declarations unbound after we strip the `export` keyword.
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

// ── fake fs-store ─────────────────────────────────────────────────────
function makeFsStoreFake(seedJobs) {
  const jobs = new Map(seedJobs.map((j) => [j.job_id, { ...j }]));
  return {
    async getJob(id) { return jobs.get(id) ?? null; },
    async listJobs(_opts = {}) { return Array.from(jobs.values()); },
    async updateJob(id, patch) {
      const cur = jobs.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
      jobs.set(id, next);
      return next;
    },
    _dump: () => Array.from(jobs.values()),
  };
}

// ── fake BrainStore surface ────────────────────────────────────────────
function makeStoreFake({ workerJobs = [], workerResults = [], auditRows = [] } = {}) {
  const wj = [...workerJobs];
  const wr = [...workerResults];
  const audit = [...auditRows];
  const transitionAudit = [];
  return {
    async listWorkerJobsByInputRef(input_refs, _opts) {
      const set = new Set(input_refs);
      return wj.filter((w) => set.has(w.input_ref));
    },
    async listWorkerResultsByIds(result_ids, _opts) {
      const set = new Set(result_ids);
      return wr.filter((r) => set.has(r.id));
    },
    async writeKnowledgeJobTransitionAudit(input) {
      transitionAudit.push({ ...input, _at: new Date().toISOString() });
    },
    async insertAudit(input) {
      const row = { ...input, id: `audit-${audit.length + 1}`, created_at: new Date().toISOString() };
      audit.push(row);
      return row;
    },
    async listAudit(filter = {}) {
      return audit.filter((r) =>
        (!filter.entity_id || r.entity_id === filter.entity_id) &&
        (!filter.since     || new Date(r.created_at).toISOString() >= filter.since),
      ).slice(0, filter.limit ?? 50);
    },
    _transitionAudit: transitionAudit,
    _audit: audit,
  };
}

// ── stuck-fixture factory (burner data only · never touches real KJs) ─
function stuckKj({ job_id, inbox_item_id = `inbox-${job_id}`, updated_at }) {
  return {
    job_id,
    inbox_item_id,
    status: "claimed",
    progress: 0,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updated_at: updated_at ?? new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
    completion_result: null,
    source: "burner",
    knowledge_type: null,
    owner: "test",
  };
}
function workerJob({ id, input_ref, worker_type, status = "completed", result_id = null }) {
  return { id, input_ref, worker_type, status, result_id, input_payload: {}, updated_at: new Date().toISOString(), created_at: new Date().toISOString(), attempts: 1, priority: 5, input_kind: "inbox_item" };
}
function workerResult({ id, output_kind = "record_draft", draft_record_ids = ["r1"] }) {
  return { id, output_kind, output_payload: { draft_record_ids }, created_at: new Date().toISOString() };
}

// ── Load the modules under test ───────────────────────────────────────
// Stub external imports the supervisor pulls in.
const stubs = {
  "./fs-store":                 { getJob: null, updateJob: null, listJobs: null }, // supervisor injects; these unused
  "./terminal-transition":      { applyTerminalKnowledgeJobTransition: null }, // will inject via opts
  "./supervisor-stuck-detector": null, // loaded separately
  "@/lib/nex/brain/storage":    {}, // types-only
  "@/lib/nex/brain/types":      {}, // types-only
  "@/lib/nex/observability/counters": { incr: () => {} },
  "@/lib/nex/observability/signals":  { emitSignal: () => {} },
  "@/lib/nex/observability/logger":   { logger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }) },
};

// Detector is pure, load first
const detectorMod = await loadModule("src/lib/nex/jobs/supervisor-stuck-detector.ts", ["detectStuck", "readStuckDetectorConfig"], { ...stubs });
stubs["./supervisor-stuck-detector"] = detectorMod.exports;
// NEW-1 · load the pure classifier the orchestrator delegates to.
const classifierMod = await loadModule("src/lib/nex/jobs/kjob-supervisor.ts", ["classifyStuckKJ"], {});
stubs["./kjob-supervisor"] = classifierMod.exports;

const supMod = await loadModule("src/lib/nex/jobs/supervisor.ts", ["runSupervisorSweep"], { ...stubs });
const { runSupervisorSweep } = supMod.exports;

// Injectable applyTerminalTransition · records calls · calls the fake fs-store.
function makeApplyTransition(kjStore, opts = {}) {
  return async function apply(store, input) {
    const cur = await kjStore.getJob(input.kjid);
    if (!cur) return { changed: false, snapshot: null };
    if (cur.status === input.patch.status) return { changed: false, snapshot: cur };
    const next = await kjStore.updateJob(input.kjid, input.patch);
    await store.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: input.kjid,
      from_status: cur.status,
      to_status: input.patch.status,
      actor: input.actor,
      reason: input.reason,
      worker_job_id: input.worker_job_id,
      correlation_id: input.correlation_id,
      metadata: input.metadata,
    });
    return { changed: true, snapshot: next };
  };
}

// ── Test suite ────────────────────────────────────────────────────────
test("A1 · stuck KJ + completed extractor + record_draft → Path A attests", async () => {
  const kj = stuckKj({ job_id: "burner-a1-1" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake({
    workerJobs: [workerJob({ id: "w1", input_ref: kj.inbox_item_id, worker_type: "knowledge-extractor", status: "completed", result_id: "res1" })],
    workerResults: [workerResult({ id: "res1" })],
  });
  const apply = makeApplyTransition(kjStore);
  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(result.attested.length, 1);
  assert.equal(result.attested[0], "burner-a1-1");
  assert.equal(result.reviewed_via_path_b.length, 0);
  assert.equal(result.errors.length, 0);
  const attested = kjStore._dump().find((j) => j.job_id === "burner-a1-1");
  assert.equal(attested.status, "completed");
  assert.equal(store._transitionAudit.length, 1);
  assert.equal(store._transitionAudit[0].to_status, "completed");
  assert.equal(store._transitionAudit[0].reason, "attested-from-worker-results");
});

test("A2 · two stuck KJs in one sweep → both attested", async () => {
  const k1 = stuckKj({ job_id: "burner-a2-1" });
  const k2 = stuckKj({ job_id: "burner-a2-2" });
  const kjStore = makeFsStoreFake([k1, k2]);
  const store = makeStoreFake({
    workerJobs: [
      workerJob({ id: "w1", input_ref: k1.inbox_item_id, worker_type: "knowledge-extractor", status: "completed", result_id: "res1" }),
      workerJob({ id: "w2", input_ref: k2.inbox_item_id, worker_type: "knowledge-extractor", status: "completed", result_id: "res2" }),
    ],
    workerResults: [workerResult({ id: "res1" }), workerResult({ id: "res2" })],
  });
  const apply = makeApplyTransition(kjStore);
  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(result.attested.length, 2);
});

test("A3 · stuck KJ with NO worker jobs → Path A falls through to Path B", async () => {
  const kj = stuckKj({ job_id: "burner-a3" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake();
  const apply = makeApplyTransition(kjStore);
  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(result.attested.length, 0);
  assert.equal(result.reviewed_via_path_b.length, 1);
  const auditRow = store._audit.find((r) => r.entity_id === "burner-a3");
  assert.ok(auditRow);
  assert.equal(auditRow.action, "supervisor-review-required");
  assert.equal(auditRow.after_state.recommended_action, "requeue");
});

test("A4 · extractor exists but not completed → falls through", async () => {
  const kj = stuckKj({ job_id: "burner-a4" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake({
    workerJobs: [workerJob({ id: "w1", input_ref: kj.inbox_item_id, worker_type: "knowledge-extractor", status: "running", result_id: null })],
  });
  const apply = makeApplyTransition(kjStore);
  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(result.attested.length, 0);
  assert.equal(result.reviewed_via_path_b.length, 1);
  const auditRow = store._audit.find((r) => r.entity_id === "burner-a4");
  assert.equal(auditRow.after_state.recommended_action, "manual_investigate");
});

test("A5 · extractor completed but result output_kind ≠ record_draft → falls through with mark_failed", async () => {
  const kj = stuckKj({ job_id: "burner-a5" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake({
    workerJobs: [workerJob({ id: "w1", input_ref: kj.inbox_item_id, worker_type: "knowledge-extractor", status: "completed", result_id: "res1" })],
    workerResults: [workerResult({ id: "res1", output_kind: "something_else", draft_record_ids: [] })],
  });
  const apply = makeApplyTransition(kjStore);
  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(result.attested.length, 0);
  const auditRow = store._audit.find((r) => r.entity_id === "burner-a5");
  assert.equal(auditRow.after_state.recommended_action, "mark_failed");
});

test("A6 · running sweep twice in a row → second run is idempotent no-op", async () => {
  const kj = stuckKj({ job_id: "burner-a6" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake({
    workerJobs: [workerJob({ id: "w1", input_ref: kj.inbox_item_id, worker_type: "knowledge-extractor", status: "completed", result_id: "res1" })],
    workerResults: [workerResult({ id: "res1" })],
  });
  const apply = makeApplyTransition(kjStore);
  const first = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(first.attested.length, 1);
  const second = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  // Second sweep sees KJ already completed → detectStuck filters it out.
  assert.equal(second.candidates_scanned, 0);
  assert.equal(second.attested.length, 0);
  assert.equal(store._transitionAudit.length, 1); // no duplicate audit
});

// ── T1 · precondition · extractor writes output_kind='record_draft' with draft_record_ids[] ──
test("T1 · extractor source code writes output_kind='record_draft' with draft_record_ids", () => {
  const src = readFileSync(join(REPO, "src/lib/nex/brain/workers/knowledge-extractor.ts"), "utf8");
  assert.match(src, /output_kind:\s*["']record_draft["']/);
  assert.match(src, /draft_record_ids:/);
});
