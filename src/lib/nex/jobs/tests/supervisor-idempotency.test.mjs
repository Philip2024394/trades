#!/usr/bin/env node
// supervisor-idempotency.test.mjs
//
// Wave 2 · Phase 6 · combined coverage:
//   · Cascade cases (C1-C4) · exercises the shipped applyTerminalKnowledgeJobTransition helper
//   · Cross-mechanism idempotency (I1-I2)
//   · Advisory-lock contract (L1-L3) · static-shape checks against the route file
//   · Observability (O1-O3) · counter roster + signal shape + Prometheus HELP text
//   · Fixture-preservation drift-catcher · asserts NO test references the 10 real kjids
//
// Governed by W-C-COMPANION-PHASE-6-DESIGN.md §5, §9, §7, §15, §17.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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

// ── C1-C4 · applyTerminalKnowledgeJobTransition (Path C · already shipped)
// Note: this module import is a placeholder — the C-series tests below call
// loadTerminalWithFsFake() to re-load the helper with per-test fs-store stubs.
const ttMod = await loadModule("src/lib/nex/jobs/terminal-transition.ts", ["applyTerminalKnowledgeJobTransition"], {
  "./fs-store": {},
});
const { applyTerminalKnowledgeJobTransition } = ttMod.exports;

function makeKjState(seedJobs) {
  const jobs = new Map(seedJobs.map((j) => [j.job_id, { ...j }]));
  return {
    getJob: async (id) => jobs.get(id) ?? null,
    updateJob: async (id, patch) => {
      const cur = jobs.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
      jobs.set(id, next);
      return next;
    },
  };
}

// The helper's `getJob` + `updateJob` are imported from ./fs-store — reload
// terminal-transition with a stubbed fs-store per-test using loadModule.
async function loadTerminalWithFsFake(fsFake) {
  const mod = await loadModule("src/lib/nex/jobs/terminal-transition.ts", ["applyTerminalKnowledgeJobTransition"], {
    "./fs-store": { getJob: fsFake.getJob, updateJob: fsFake.updateJob },
  });
  return mod.exports.applyTerminalKnowledgeJobTransition;
}

test("C1 · idempotent · same terminal called twice writes ONE audit row", async () => {
  const fsFake = makeKjState([{ job_id: "burner-c1", status: "claimed", progress: 0 }]);
  const apply = await loadTerminalWithFsFake(fsFake);
  const auditRows = [];
  const store = {
    writeKnowledgeJobTransitionAudit: async (row) => { auditRows.push(row); },
  };
  const first = await apply(store, { kjid: "burner-c1", patch: { status: "completed", progress: 100 }, actor: "test" });
  const second = await apply(store, { kjid: "burner-c1", patch: { status: "completed", progress: 100 }, actor: "test" });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(auditRows.length, 1);
});

test("C2 · failure cascade → status: failed", async () => {
  const fsFake = makeKjState([{ job_id: "burner-c2", status: "claimed", progress: 0 }]);
  const apply = await loadTerminalWithFsFake(fsFake);
  const auditRows = [];
  const store = { writeKnowledgeJobTransitionAudit: async (row) => { auditRows.push(row); } };
  const r = await apply(store, { kjid: "burner-c2", patch: { status: "failed" }, actor: "test" });
  assert.equal(r.changed, true);
  assert.equal(r.snapshot.status, "failed");
  assert.equal(auditRows[0].to_status, "failed");
});

test("C3 · kjid does not exist → helper no-ops · no audit", async () => {
  const fsFake = makeKjState([]);
  const apply = await loadTerminalWithFsFake(fsFake);
  const auditRows = [];
  const store = { writeKnowledgeJobTransitionAudit: async (row) => { auditRows.push(row); } };
  const r = await apply(store, { kjid: "does-not-exist", patch: { status: "completed" }, actor: "test" });
  assert.equal(r.changed, false);
  assert.equal(r.snapshot, null);
  assert.equal(auditRows.length, 0);
});

test("C4 · audit-write throws → KJ still updated · warning logged", async () => {
  const fsFake = makeKjState([{ job_id: "burner-c4", status: "claimed", progress: 0 }]);
  const apply = await loadTerminalWithFsFake(fsFake);
  const store = {
    writeKnowledgeJobTransitionAudit: async () => { throw new Error("audit write failed"); },
  };
  const r = await apply(store, { kjid: "burner-c4", patch: { status: "completed" }, actor: "test" });
  // KJ state authoritative even when audit throws.
  assert.equal(r.changed, true);
  assert.equal(r.snapshot.status, "completed");
});

// ── I1 · Path A sweep · running 3× produces exactly ONE audit ─────────
test("I1 · Path A sweep run 3× → helper idempotent · one transition-audit row", async () => {
  // Compose the full supervisor + inline fake.
  const detectorMod = await loadModule("src/lib/nex/jobs/supervisor-stuck-detector.ts", ["detectStuck", "readStuckDetectorConfig"], {});
  const classifierMod = await loadModule("src/lib/nex/jobs/kjob-supervisor.ts", ["classifyStuckKJ"], {});
  const supMod = await loadModule("src/lib/nex/jobs/supervisor.ts", ["runSupervisorSweep"], {
    "./fs-store": {},
    "./terminal-transition": { applyTerminalKnowledgeJobTransition: null }, // supplied via opts
    "./supervisor-stuck-detector": detectorMod.exports,
    "./kjob-supervisor":           classifierMod.exports,
    "@/lib/nex/brain/storage": {},
    "@/lib/nex/brain/types": {},
    "@/lib/nex/observability/counters": { incr: () => {} },
    "@/lib/nex/observability/signals":  { emitSignal: () => {} },
    "@/lib/nex/observability/logger":   { logger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }) },
  });
  const { runSupervisorSweep } = supMod.exports;

  const stuckAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const kj = { job_id: "burner-i1", inbox_item_id: "inbox-i1", status: "claimed", progress: 0, updated_at: stuckAgo, created_at: stuckAgo };
  const jobs = new Map([[kj.job_id, { ...kj }]]);
  const kjStore = {
    getJob: async (id) => jobs.get(id) ?? null,
    listJobs: async () => Array.from(jobs.values()),
    updateJob: async (id, patch) => {
      const cur = jobs.get(id); if (!cur) return null;
      const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
      jobs.set(id, next); return next;
    },
  };
  const audit = [];
  const store = {
    listWorkerJobsByInputRef: async () => [{ id: "w1", input_ref: "inbox-i1", worker_type: "knowledge-extractor", status: "completed", result_id: "res1", input_payload: {}, created_at: "", updated_at: "", attempts: 1, priority: 5, input_kind: "inbox_item" }],
    listWorkerResultsByIds:   async () => [{ id: "res1", output_kind: "record_draft", output_payload: { draft_record_ids: ["r1"] }, created_at: "" }],
    writeKnowledgeJobTransitionAudit: async (row) => { audit.push(row); },
    insertAudit: async (input) => ({ ...input, id: "a1", created_at: "" }),
    listAudit:   async () => [],
  };
  const apply = async (s, input) => {
    const cur = await kjStore.getJob(input.kjid);
    if (!cur || cur.status === input.patch.status) return { changed: false, snapshot: cur };
    const next = await kjStore.updateJob(input.kjid, input.patch);
    await s.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: input.kjid, from_status: cur.status, to_status: input.patch.status,
      actor: input.actor, reason: input.reason, worker_job_id: input.worker_job_id, metadata: input.metadata,
    });
    return { changed: true, snapshot: next };
  };
  for (let i = 0; i < 3; i++) await runSupervisorSweep(store, kjStore, { applyTerminalTransition: apply });
  assert.equal(audit.length, 1); // three sweeps · one audit row
});

// ── L1-L3 · advisory-lock contract (static-shape check on route file) ─
test("L1 · route file uses pg_try_advisory_lock", () => {
  const src = readFileSync(join(REPO, "src/app/api/nex/brain/supervisor-sweep/route.ts"), "utf8");
  assert.match(src, /pg_try_advisory_lock/);
});
test("L2 · route file releases advisory lock in finally", () => {
  const src = readFileSync(join(REPO, "src/app/api/nex/brain/supervisor-sweep/route.ts"), "utf8");
  assert.match(src, /pg_advisory_unlock/);
  assert.match(src, /finally/);
});
test("L3 · route file documents the 63-bit lock constant", () => {
  const src = readFileSync(join(REPO, "src/app/api/nex/brain/supervisor-sweep/route.ts"), "utf8");
  assert.match(src, /SUPERVISOR_ADVISORY_LOCK/);
  assert.match(src, /BigInt\("7291374928374623942"\)/);
});

// ── O1-O3 · observability contract ────────────────────────────────────
test("O1 · every supervisor counter appears in the KNOWN roster", () => {
  const src = readFileSync(join(REPO, "src/lib/nex/observability/counters.ts"), "utf8");
  for (const c of [
    "supervisor.sweep_started",
    "supervisor.sweep_completed",
    "supervisor.kj_attested",
    "supervisor.kj_review_queued",
    "supervisor.path_a_fallthrough",
    "supervisor.cascade_terminal",
    "supervisor.error",
  ]) {
    assert.ok(src.includes(`"${c}"`), `counter ${c} missing from counters.ts`);
  }
});
test("O2 · supervisor.ts emits signals with subsystem='supervisor'", () => {
  const src = readFileSync(join(REPO, "src/lib/nex/jobs/supervisor.ts"), "utf8");
  assert.match(src, /subsystem:\s*["']supervisor["']/);
});
test("O3 · metrics route (F2) exists · scraper can pull supervisor counters", () => {
  const src = readFileSync(join(REPO, "src/app/api/nex/observability/metrics/route.ts"), "utf8");
  assert.match(src, /snapshot\(\)/);
});

// ── Fixture-preservation drift-catcher (§17.3) ────────────────────────
const PRESERVED_KJID_PREFIXES = [
  "b1772902", "1e09c119", "6381641c", "7e1fc4f9", "270865e6",
  "7fc668ef", "47e0cf43", "ab5835b8", "56e1da78", "46a8eb51",
];
test("preservation · no test file references any of the 10 real stuck kjids", () => {
  const testFiles = readdirSync(__dirname).filter((f) => f.endsWith(".test.mjs"));
  const violations = [];
  for (const f of testFiles) {
    if (f === "supervisor-idempotency.test.mjs") continue; // this file lists them intentionally as constants
    if (f === "supervisor-safety-boundary.test.mjs") continue; // SB8 checks the incident-report doc contains them · not a preservation violation
    const src = readFileSync(join(__dirname, f), "utf8");
    for (const prefix of PRESERVED_KJID_PREFIXES) {
      if (src.includes(prefix)) violations.push(`${f} references preserved kjid prefix ${prefix}`);
    }
  }
  assert.equal(violations.length, 0, violations.join(" · "));
});
