#!/usr/bin/env node
// supervisor-review-queue.test.mjs
//
// Wave 2 · Phase 6 · Path B contract tests (B1-B5) + precondition T2.
// Governed by W-C-COMPANION-PHASE-6-DESIGN.md §4.

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

function makeFsStoreFake(seedJobs) {
  const jobs = new Map(seedJobs.map((j) => [j.job_id, { ...j }]));
  return {
    async getJob(id) { return jobs.get(id) ?? null; },
    async listJobs() { return Array.from(jobs.values()); },
    async updateJob(id, patch) {
      const cur = jobs.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
      jobs.set(id, next);
      return next;
    },
  };
}

function makeStoreFake({ workerJobs = [], workerResults = [], auditRows = [] } = {}) {
  const wj = [...workerJobs];
  const wr = [...workerResults];
  const audit = [...auditRows];
  const signals = [];
  return {
    async listWorkerJobsByInputRef(input_refs) {
      const set = new Set(input_refs);
      return wj.filter((w) => set.has(w.input_ref));
    },
    async listWorkerResultsByIds(result_ids) {
      const set = new Set(result_ids);
      return wr.filter((r) => set.has(r.id));
    },
    async writeKnowledgeJobTransitionAudit() { /* no-op for Path B tests */ },
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
    _audit: audit,
    _signals: signals,
    _pushSignal: (s) => signals.push(s),
  };
}

function stuckKj({ job_id, inbox_item_id = `inbox-${job_id}`, updated_at, ageHours = 1 }) {
  return {
    job_id,
    inbox_item_id,
    status: "claimed",
    progress: 0,
    created_at: new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString(),
    updated_at: updated_at ?? new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString(),
    completion_result: null,
    source: "burner",
    knowledge_type: null,
    owner: "test",
  };
}
function workerJob({ id, input_ref, worker_type, status = "completed", result_id = null }) {
  return { id, input_ref, worker_type, status, result_id, input_payload: {}, updated_at: new Date().toISOString(), created_at: new Date().toISOString(), attempts: 1, priority: 5, input_kind: "inbox_item" };
}

// Track signals for B5 escalation assertion. We patch the module via a stub.
const capturedSignals = [];
const detectorMod = await loadModule("src/lib/nex/jobs/supervisor-stuck-detector.ts", ["detectStuck", "readStuckDetectorConfig"], {});
const classifierMod = await loadModule("src/lib/nex/jobs/kjob-supervisor.ts", ["classifyStuckKJ"], {});
const supMod = await loadModule("src/lib/nex/jobs/supervisor.ts", ["runSupervisorSweep"], {
  "./fs-store":                 {},
  "./terminal-transition":      { applyTerminalKnowledgeJobTransition: async () => ({ changed: true, snapshot: null }) },
  "./supervisor-stuck-detector": detectorMod.exports,
  "./kjob-supervisor":           classifierMod.exports,
  "@/lib/nex/brain/storage":    {},
  "@/lib/nex/brain/types":      {},
  "@/lib/nex/observability/counters": { incr: () => {} },
  "@/lib/nex/observability/signals":  { emitSignal: (s) => capturedSignals.push(s) },
  "@/lib/nex/observability/logger":   { logger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }) },
});
const { runSupervisorSweep } = supMod.exports;

function makeApplyTransition(kjStore) {
  return async function apply(store, input) {
    const cur = await kjStore.getJob(input.kjid);
    if (!cur) return { changed: false, snapshot: null };
    if (cur.status === input.patch.status) return { changed: false, snapshot: cur };
    const next = await kjStore.updateJob(input.kjid, input.patch);
    return { changed: true, snapshot: next };
  };
}

test("B1 · zero WorkerJobs → recommended_action=requeue", async () => {
  capturedSignals.length = 0;
  const kj = stuckKj({ job_id: "burner-b1" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake();
  await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApplyTransition(kjStore) });
  const row = store._audit.find((r) => r.entity_id === "burner-b1");
  assert.ok(row);
  assert.equal(row.after_state.recommended_action, "requeue");
  // NEW-1 reconciliation · reason_code now comes from the classifier taxonomy.
  // Zero WorkerJobs is `no-extractor` per classifier (kjob-supervisor.ts).
  assert.equal(row.after_state.reason_code, "no-extractor");
});

test("B2 · partial chain (no completions) → recommended_action=manual_investigate", async () => {
  const kj = stuckKj({ job_id: "burner-b2" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake({
    workerJobs: [workerJob({ id: "w1", input_ref: kj.inbox_item_id, worker_type: "knowledge-context", status: "running" })],
  });
  await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApplyTransition(kjStore) });
  const row = store._audit.find((r) => r.entity_id === "burner-b2");
  assert.equal(row.after_state.recommended_action, "manual_investigate");
});

test("B3 · extractor completed but no drafts → recommended_action=mark_failed", async () => {
  const kj = stuckKj({ job_id: "burner-b3" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake({
    workerJobs: [workerJob({ id: "w1", input_ref: kj.inbox_item_id, worker_type: "knowledge-extractor", status: "completed", result_id: "res-empty" })],
    workerResults: [{ id: "res-empty", output_kind: "record_draft", output_payload: { draft_record_ids: [] }, created_at: new Date().toISOString() }],
  });
  await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApplyTransition(kjStore) });
  const row = store._audit.find((r) => r.entity_id === "burner-b3");
  assert.equal(row.after_state.recommended_action, "mark_failed");
});

test("B4 · second sweep does NOT duplicate the review-queue row (dedup)", async () => {
  const kj = stuckKj({ job_id: "burner-b4" });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake();
  await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApplyTransition(kjStore) });
  await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApplyTransition(kjStore) });
  const rows = store._audit.filter((r) => r.entity_id === "burner-b4");
  assert.equal(rows.length, 1);
});

test("B5 · KJ stuck > 72 h → escalation-required signal fires", async () => {
  capturedSignals.length = 0;
  const kj = stuckKj({ job_id: "burner-b5", ageHours: 80 });
  const kjStore = makeFsStoreFake([kj]);
  const store = makeStoreFake();
  await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApplyTransition(kjStore) });
  const escalation = capturedSignals.find((s) => s.kind === "escalation-required");
  assert.ok(escalation, "expected escalation-required signal");
  assert.equal(escalation.code, "72h");
});

// ── T2 · precondition · audit_log.action accepts free-form strings ────
test("T2 · nex.audit_log schema has NO CHECK constraint on action", () => {
  const src = readFileSync(join(REPO, "deploy/postgres/init/041_nex_brain_schema.sql"), "utf8");
  const auditSection = src.slice(src.indexOf("CREATE TABLE IF NOT EXISTS nex.audit_log"));
  const closingParen = auditSection.indexOf(");");
  const table = auditSection.slice(0, closingParen);
  // No CHECK constraint mentioning `action` should appear in the table body.
  assert.doesNotMatch(table, /CHECK\s*\([^)]*action[^)]*\)/, "unexpected CHECK constraint on action column");
});
