#!/usr/bin/env node
// supervisor-safety-boundary.test.mjs
//
// Phase 6 post-incident safety-boundary contract tests.
// Uses in-memory fakes only · NEVER touches the real store.
//
// Governs the guard added 2026-08-10 in response to the preservation
// incident — see:
//   docs/headquarters-production-readiness/PHASE-6-PRESERVATION-INCIDENT-FORENSIC-REPORT.md
//   docs/headquarters-production-readiness/PHASE-6-PRESERVATION-INCIDENT-RESOLUTION.md
//
// Contract:
//   probe_mode=true + non-empty only_kjids  → sweep filters at discovery boundary
//   probe_mode=true + only_kjids=undefined  → THROW (fail closed)
//   probe_mode=true + only_kjids=[]         → THROW (fail closed)
//   probe_mode=false + no only_kjids        → full sweep (backward compat)
//   probe_mode=false + only_kjids provided  → filter applied (operator override)

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
  "@/lib/nex/observability/signals":  { emitSignal: () => {} },
  "@/lib/nex/observability/logger":   { logger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }) },
});
const { runSupervisorSweep } = supMod.exports;

// ── Fakes ─────────────────────────────────────────────────────────────
function stuckKj(job_id) {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return {
    job_id, inbox_item_id: `inbox-${job_id}`, status: "claimed", progress: 0,
    updated_at: past, created_at: past, completion_result: null,
    source: "test", knowledge_type: null, owner: "test",
  };
}
function makeKjStore(jobsArray) {
  const jobs = new Map(jobsArray.map((j) => [j.job_id, { ...j }]));
  return {
    getJob: async (id) => jobs.get(id) ?? null,
    listJobs: async () => Array.from(jobs.values()),
    updateJob: async (id, patch) => {
      const cur = jobs.get(id); if (!cur) return null;
      const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
      jobs.set(id, next); return next;
    },
  };
}
function makeStore({ workerJobs = [], workerResults = [] } = {}) {
  const wj = [...workerJobs];
  const wr = [...workerResults];
  const audit = [];
  const transitionAudit = [];
  return {
    listWorkerJobsByInputRef: async (input_refs) => wj.filter((w) => input_refs.includes(w.input_ref)),
    listWorkerResultsByIds:   async (ids) => wr.filter((r) => ids.includes(r.id)),
    writeKnowledgeJobTransitionAudit: async (row) => { transitionAudit.push(row); },
    insertAudit: async (input) => { const row = { ...input, id: `a${audit.length + 1}`, created_at: new Date().toISOString() }; audit.push(row); return row; },
    listAudit: async () => [],
    _audit: audit,
    _transitionAudit: transitionAudit,
  };
}
function makeApply(kjStore) {
  return async function apply(s, input) {
    const cur = await kjStore.getJob(input.kjid);
    if (!cur || cur.status === input.patch.status) return { changed: false, snapshot: cur };
    const next = await kjStore.updateJob(input.kjid, input.patch);
    await s.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: input.kjid, from_status: cur.status, to_status: input.patch.status,
      actor: input.actor, reason: input.reason, worker_job_id: input.worker_job_id, metadata: input.metadata,
    });
    return { changed: true, snapshot: next };
  };
}

// ── SB1 · probe_mode=true + only_kjids=undefined → throws ────────────
test("SB1 · probe_mode=true + only_kjids=undefined → throws synchronously", async () => {
  const kjStore = makeKjStore([stuckKj("kj-should-not-be-touched")]);
  const store = makeStore();
  await assert.rejects(
    () => runSupervisorSweep(store, kjStore, { probe_mode: true, applyTerminalTransition: makeApply(kjStore) }),
    /probe_mode=true requires opts.only_kjids to be defined/,
  );
  // Confirm no discovered KJ was touched.
  const post = await kjStore.getJob("kj-should-not-be-touched");
  assert.equal(post.status, "claimed");
});

// ── SB2 · probe_mode=true + only_kjids=[] → throws ────────────────────
test("SB2 · probe_mode=true + only_kjids=[] → throws synchronously", async () => {
  const kjStore = makeKjStore([stuckKj("kj-should-not-be-touched-2")]);
  const store = makeStore();
  await assert.rejects(
    () => runSupervisorSweep(store, kjStore, { probe_mode: true, only_kjids: [], applyTerminalTransition: makeApply(kjStore) }),
    /probe_mode=true requires opts.only_kjids to be non-empty/,
  );
  const post = await kjStore.getJob("kj-should-not-be-touched-2");
  assert.equal(post.status, "claimed");
});

// ── SB3 · probe_mode=true + non-empty allow-list → only allowed KJs seen ─
test("SB3 · probe_mode=true + only_kjids=[burner] → discovered real KJs are rejected", async () => {
  const burner = "burner-sb3";
  const real1 = "real-sb3-1";
  const real2 = "real-sb3-2";
  const real3 = "real-sb3-3";
  const kjStore = makeKjStore([stuckKj(burner), stuckKj(real1), stuckKj(real2), stuckKj(real3)]);
  const store = makeStore({
    workerJobs: [{ id: "w1", input_ref: `inbox-${burner}`, worker_type: "knowledge-extractor", status: "completed", result_id: "r1", input_payload: {}, created_at: "", updated_at: "", attempts: 1, priority: 5, input_kind: "inbox_item" }],
    workerResults: [{ id: "r1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1"] }, created_at: "" }],
  });
  const result = await runSupervisorSweep(store, kjStore, {
    probe_mode: true,
    only_kjids: [burner],
    applyTerminalTransition: makeApply(kjStore),
  });
  // Only the burner should be attested; the three real kjids MUST be untouched.
  assert.equal(result.attested.length, 1);
  assert.equal(result.attested[0], burner);
  for (const id of [real1, real2, real3]) {
    const post = await kjStore.getJob(id);
    assert.equal(post.status, "claimed", `${id} should still be claimed but is ${post.status}`);
  }
});

// ── SB4 · multiple allowed KJs · zero escape ─────────────────────────
test("SB4 · probe_mode=true + only_kjids=[b1,b2] + 10 real KJs → only b1,b2 touched", async () => {
  const b1 = "burner-sb4-1";
  const b2 = "burner-sb4-2";
  const realIds = Array.from({ length: 10 }, (_, i) => `real-sb4-${i}`);
  const kjStore = makeKjStore([stuckKj(b1), stuckKj(b2), ...realIds.map(stuckKj)]);
  const store = makeStore();  // zero worker_jobs · everything falls to Path B
  const result = await runSupervisorSweep(store, kjStore, {
    probe_mode: true,
    only_kjids: [b1, b2],
    applyTerminalTransition: makeApply(kjStore),
  });
  // Path B queues both burners · zero real KJs touched.
  assert.deepEqual(new Set(result.reviewed_via_path_b).size, 2);
  assert.ok(result.reviewed_via_path_b.includes(b1));
  assert.ok(result.reviewed_via_path_b.includes(b2));
  for (const id of realIds) {
    const post = await kjStore.getJob(id);
    assert.equal(post.status, "claimed", `real ${id} was touched · allow-list broken`);
  }
  // Zero review-queue audit rows should have entity_id in realIds.
  for (const row of store._audit) {
    assert.ok(!realIds.includes(row.entity_id), `audit row written for real KJ ${row.entity_id} · allow-list broken`);
  }
});

// ── SB5 · probe_mode=false + no only_kjids → full sweep (backward compat) ─
test("SB5 · probe_mode omitted + only_kjids=undefined → full sweep (backward compat)", async () => {
  const a = "any-a";
  const b = "any-b";
  const kjStore = makeKjStore([stuckKj(a), stuckKj(b)]);
  const store = makeStore();
  const result = await runSupervisorSweep(store, kjStore, { applyTerminalTransition: makeApply(kjStore) });
  // Both KJs get queued to Path B (zero worker chain · falls through).
  assert.deepEqual(new Set(result.reviewed_via_path_b).size, 2);
});

// ── SB6 · probe_mode=false + only_kjids provided → filter applies (operator override) ─
test("SB6 · probe_mode=false + only_kjids=[a] → filter applies even without probe_mode", async () => {
  const a = "op-a";
  const b = "op-b";
  const kjStore = makeKjStore([stuckKj(a), stuckKj(b)]);
  const store = makeStore();
  const result = await runSupervisorSweep(store, kjStore, {
    only_kjids: [a],
    applyTerminalTransition: makeApply(kjStore),
  });
  assert.equal(new Set(result.reviewed_via_path_b).size, 1);
  assert.equal(result.reviewed_via_path_b[0], a);
  const postB = await kjStore.getJob(b);
  assert.equal(postB.status, "claimed"); // untouched
});

// ── SB7 · Preservation drift-catcher · source contains the guard ──────
test("SB7 · supervisor.ts source contains probe_mode + only_kjids guard", () => {
  const src = readFileSync(join(REPO, "src/lib/nex/jobs/supervisor.ts"), "utf8");
  assert.match(src, /probe_mode\s*===\s*true/);
  assert.match(src, /only_kjids/);
  assert.match(src, /requires opts\.only_kjids to be defined/);
  assert.match(src, /requires opts\.only_kjids to be non-empty/);
  assert.match(src, /opts\.only_kjids!?\.includes/);
});

// ── SB8 · Preserved-fixture list embedded · covered by fixture-preservation test ─
test("SB8 · the 10 preserved fixture kjids exist in the incident-report doc + drift-catcher scope", () => {
  const doc = readFileSync(join(REPO, "docs/headquarters-production-readiness/PHASE-6-PRESERVATION-INCIDENT-FORENSIC-REPORT.md"), "utf8");
  for (const prefix of ["b1772902", "1e09c119", "6381641c", "7e1fc4f9", "270865e6", "7fc668ef", "47e0cf43", "ab5835b8", "56e1da78", "46a8eb51"]) {
    assert.ok(doc.includes(prefix), `preserved fixture ${prefix} missing from incident report`);
  }
});
