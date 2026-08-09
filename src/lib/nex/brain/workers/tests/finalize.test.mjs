#!/usr/bin/env node
// finalize.test.mjs · Wave 11 · Step 8 · F35 remediation
//
// Two suites:
//   1. Contract tests for finalizeWorkerJob + failWorkerJob (FZ1-FZ10)
//   2. Adoption drift-catcher · every worker consumes the shared
//      helpers · no worker still calls insertResult+completeJob
//      directly (FZA1-FZA4)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..", "..");
const requireFromHere = createRequire(import.meta.url);

const SRC = readFileSync(join(REPO, "src/lib/nex/brain/workers/_finalize.ts"), "utf8");
const stripped = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `\nmodule.exports = { finalizeWorkerJob, failWorkerJob };`,
)(mod, process, mod.exports, (id) => {
  // W-OBS-1 Path A · _finalize.ts imports getCorrelationId from
  // @/lib/nex/observability/correlation for child-job CID inheritance.
  // These unit tests don't exercise the CID inheritance path (no ALS
  // scope is established) · null-stub preserves original test semantics
  // (parentCid is null → nextJob passes through unchanged).
  if (id === "@/lib/nex/observability/correlation") {
    return { getCorrelationId: () => null };
  }
  return {};
});
const { finalizeWorkerJob, failWorkerJob } = mod.exports;

// Fake BrainStore that records every finalization call so the tests
// can verify ordering, count, and payload.
function makeFakeStore() {
  const calls = [];
  return {
    calls,
    insertResult: async (input) => {
      calls.push({ method: "insertResult", input });
      return { id: "fake-result-id", created_at: "iso", ...input };
    },
    enqueueJob: async (input) => {
      calls.push({ method: "enqueueJob", input });
      return { id: "fake-job-id", status: "queued", attempts: 0, created_at: "iso", updated_at: "iso", ...input };
    },
    insertAudit: async (input) => {
      calls.push({ method: "insertAudit", input });
      return { id: "fake-audit-id", created_at: "iso", ...input };
    },
    completeJob: async (jobId, resultId) => {
      calls.push({ method: "completeJob", jobId, resultId });
    },
    failJob: async (jobId, message) => {
      calls.push({ method: "failJob", jobId, message });
    },
  };
}

const fakeJob = { id: "fake-job-1", worker_type: "knowledge-context", status: "assigned" };
const baseResultInput = {
  worker_type: "knowledge-context",
  worker_id: "w-1",
  output_kind: "context_bundle",
  output_payload: { x: 1 },
  overall_confidence: 0.5,
  llm_provider: "no-llm",
  llm_model: null,
  llm_tokens_in: null,
  llm_tokens_out: null,
  llm_ms: null,
  flags: [],
};

// ── FZ1-FZ7 · finalizeWorkerJob contract ───────────────────────────

test("FZ1 · minimal call fires insertResult → completeJob in order · returns result", async () => {
  const s = makeFakeStore();
  const r = await finalizeWorkerJob(s, { job: fakeJob, resultInput: baseResultInput });
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[0].method, "insertResult");
  assert.equal(s.calls[1].method, "completeJob");
  assert.equal(s.calls[1].jobId, "fake-job-1");
  assert.equal(s.calls[1].resultId, "fake-result-id");
  assert.equal(r.id, "fake-result-id");
});

test("FZ2 · full call fires insertResult → enqueueJob → insertAudit → completeJob in exact order", async () => {
  const s = makeFakeStore();
  await finalizeWorkerJob(s, {
    job: fakeJob,
    resultInput: baseResultInput,
    nextJob: {
      worker_type: "voice-context", priority: 1, input_kind: "inbox_item", input_ref: "nx1", input_payload: {},
    },
    finalAudit: {
      entity_type: "worker_jobs", entity_id: "nx1", action: "context-assembled",
      actor: "w-1", before_state: null, after_state: {}, notes: "ok",
    },
  });
  assert.equal(s.calls.length, 4);
  assert.equal(s.calls[0].method, "insertResult");
  assert.equal(s.calls[1].method, "enqueueJob");
  assert.equal(s.calls[2].method, "insertAudit");
  assert.equal(s.calls[3].method, "completeJob");
});

test("FZ3 · nextJob absent · skips enqueueJob but still fires audit + completeJob", async () => {
  const s = makeFakeStore();
  await finalizeWorkerJob(s, {
    job: fakeJob,
    resultInput: baseResultInput,
    finalAudit: {
      entity_type: "worker_jobs", entity_id: "nx1", action: "quality-checked",
      actor: "w-1", before_state: null, after_state: {}, notes: "ok",
    },
  });
  assert.deepEqual(s.calls.map((c) => c.method), ["insertResult", "insertAudit", "completeJob"]);
});

test("FZ4 · finalAudit absent · skips insertAudit but still fires completeJob (image-analyst pattern)", async () => {
  const s = makeFakeStore();
  await finalizeWorkerJob(s, {
    job: fakeJob,
    resultInput: baseResultInput,
  });
  assert.deepEqual(s.calls.map((c) => c.method), ["insertResult", "completeJob"]);
});

test("FZ5 · betweenNextJobAndFinalAudit hook fires AFTER enqueueJob and BEFORE finalAudit (learning-context pattern)", async () => {
  const s = makeFakeStore();
  let hookRanAtCall = -1;
  await finalizeWorkerJob(s, {
    job: fakeJob,
    resultInput: baseResultInput,
    nextJob: {
      worker_type: "knowledge-extractor", priority: 1, input_kind: "inbox_item", input_ref: "nx1", input_payload: {},
    },
    betweenNextJobAndFinalAudit: async () => {
      hookRanAtCall = s.calls.length;
      s.calls.push({ method: "hook", tag: "learning-feedback-applied" });
    },
    finalAudit: {
      entity_type: "worker_jobs", entity_id: "nx1", action: "learning-bundle-assembled",
      actor: "w-1", before_state: null, after_state: {}, notes: "ok",
    },
  });
  assert.equal(hookRanAtCall, 2, "hook must fire AFTER insertResult + enqueueJob (indexes 0+1) · ran at call #" + hookRanAtCall);
  assert.deepEqual(
    s.calls.map((c) => c.method),
    ["insertResult", "enqueueJob", "hook", "insertAudit", "completeJob"],
  );
});

test("FZ6 · betweenNextJobAndFinalAudit throw propagates · completeJob does NOT fire", async () => {
  const s = makeFakeStore();
  let caught = null;
  try {
    await finalizeWorkerJob(s, {
      job: fakeJob,
      resultInput: baseResultInput,
      betweenNextJobAndFinalAudit: async () => { throw new Error("hook-fail"); },
      finalAudit: {
        entity_type: "worker_jobs", entity_id: "nx1", action: "x",
        actor: "w-1", before_state: null, after_state: {}, notes: "",
      },
    });
  } catch (e) { caught = e; }
  assert.equal(caught?.message, "hook-fail");
  const methods = s.calls.map((c) => c.method);
  assert.deepEqual(methods, ["insertResult"], "only insertResult fires · hook throw aborts before audit + completeJob");
});

test("FZ7 · caller must NOT pass job_id in resultInput (helper injects it)", async () => {
  const s = makeFakeStore();
  await finalizeWorkerJob(s, {
    job: fakeJob,
    resultInput: baseResultInput,
  });
  const inserted = s.calls[0].input;
  assert.equal(inserted.job_id, "fake-job-1", "helper must inject job.id as job_id");
});

// ── FZ8-FZ10 · failWorkerJob contract ──────────────────────────────

test("FZ8 · failWorkerJob calls store.failJob with err.message · returns the message", async () => {
  const s = makeFakeStore();
  const captured = [];
  const orig = console.error; console.error = (...a) => captured.push(a.join(" "));
  const msg = await failWorkerJob(s, fakeJob, new Error("boom"), "test-worker");
  console.error = orig;
  assert.equal(msg, "boom");
  assert.equal(s.calls[0].method, "failJob");
  assert.equal(s.calls[0].jobId, "fake-job-1");
  assert.equal(s.calls[0].message, "boom");
  assert.match(captured[0], /\[test-worker\] failed:/);
});

test("FZ9 · failWorkerJob handles non-Error input via String(err) coercion", async () => {
  const s = makeFakeStore();
  const orig = console.error; console.error = () => {};
  const msg1 = await failWorkerJob(s, fakeJob, "just-a-string", "test-w");
  const msg2 = await failWorkerJob(s, fakeJob, { some: "object" }, "test-w");
  console.error = orig;
  assert.equal(msg1, "just-a-string");
  assert.equal(msg2, "[object Object]");
});

test("FZ10 · failWorkerJob NEVER calls completeJob (failure path is distinct)", async () => {
  const s = makeFakeStore();
  const orig = console.error; console.error = () => {};
  await failWorkerJob(s, fakeJob, new Error("x"), "w");
  console.error = orig;
  assert.equal(s.calls.filter((c) => c.method === "completeJob").length, 0);
});

// ── FZA1-FZA4 · Adoption drift-catcher ─────────────────────────────

const WORKERS = [
  "knowledge-context",
  "voice-context",
  "learning-context",
  "knowledge-extractor",
  "image-analyst",
  "quality-checker",
];

test("FZA1 · every worker imports finalizeWorkerJob + failWorkerJob from _finalize", () => {
  for (const w of WORKERS) {
    const src = readFileSync(join(REPO, `src/lib/nex/brain/workers/${w}.ts`), "utf8");
    assert.match(src, /import\s*\{[^}]*finalizeWorkerJob[^}]*failWorkerJob[^}]*\}\s*from\s*["']\.\/_finalize["']/,
      `${w}.ts must import finalizeWorkerJob AND failWorkerJob from ./_finalize`);
  }
});

test("FZA2 · no worker retains a direct store.insertResult call outside finalizeWorkerJob", () => {
  for (const w of WORKERS) {
    const src = readFileSync(join(REPO, `src/lib/nex/brain/workers/${w}.ts`), "utf8");
    // Match `await store.insertResult(` — the pre-remediation pattern.
    // After F35 this must be zero · the only insertResult call in the
    // pipeline lives inside finalizeWorkerJob.
    const direct = (src.match(/await\s+store\.insertResult\s*\(/g) ?? []).length;
    assert.equal(direct, 0, `${w}.ts still has ${direct} direct store.insertResult call(s) · migrate to finalizeWorkerJob`);
  }
});

test("FZA3 · no worker retains a direct store.completeJob(job.id, ...) call outside finalizeWorkerJob", () => {
  for (const w of WORKERS) {
    const src = readFileSync(join(REPO, `src/lib/nex/brain/workers/${w}.ts`), "utf8");
    const direct = (src.match(/await\s+store\.completeJob\s*\(/g) ?? []).length;
    assert.equal(direct, 0, `${w}.ts still has ${direct} direct store.completeJob call(s) · migrate to finalizeWorkerJob`);
  }
});

test("FZA4 · no worker retains a direct store.failJob(...) call outside failWorkerJob", () => {
  for (const w of WORKERS) {
    const src = readFileSync(join(REPO, `src/lib/nex/brain/workers/${w}.ts`), "utf8");
    const direct = (src.match(/await\s+store\.failJob\s*\(/g) ?? []).length;
    assert.equal(direct, 0, `${w}.ts still has ${direct} direct store.failJob call(s) · migrate to failWorkerJob`);
  }
});

test("FZA5 · genuine convergence proof · exactly ONE finalizeWorkerJob call per worker success path", () => {
  for (const w of WORKERS) {
    const src = readFileSync(join(REPO, `src/lib/nex/brain/workers/${w}.ts`), "utf8");
    const calls = (src.match(/await\s+finalizeWorkerJob\s*\(/g) ?? []).length;
    assert.equal(calls, 1, `${w}.ts must call finalizeWorkerJob EXACTLY ONCE · found ${calls}`);
    const failCalls = (src.match(/await\s+failWorkerJob\s*\(/g) ?? []).length;
    assert.equal(failCalls, 1, `${w}.ts must call failWorkerJob EXACTLY ONCE · found ${failCalls}`);
  }
});
