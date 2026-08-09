// Wave 11 · Phase 5 · W-C-COMPANION Storage-contract extension.
// Contract tests for the 5 new BrainStore methods against the
// filesystem adapter (the deterministic reference implementation).
// See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md
//     WORLD-CLASS-OPS-W-C-CONTRACT-TEST-DESIGN.md
//
// Isolation strategy: each test chdir's into a fresh tmp directory
// so FilesystemStore's FS_ROOT (`<cwd>/data/nex-brain`) does not
// collide across tests or with real dev data. Vitest runs the file
// sequentially · chdir side-effects stay bounded.
//
// This file exercises the FILESYSTEM adapter behaviour. Cross-adapter
// method-parity is enforced statically by AI9 in adapter-isolation.test.mjs.
// Live Postgres/Supabase behaviour parity is a Phase 6 concern (supervisor
// integration test) · not required at Phase 5 to prove the contract.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { FilesystemStore } from "./filesystem";
import type { WorkerJob, WorkerResult, WorkerType } from "../types";

let originalCwd: string;
let tmp: string;
let store: FilesystemStore;

beforeEach(() => {
  originalCwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), "wc-phase5-fs-"));
  process.chdir(tmp);
  store = new FilesystemStore();
});

afterEach(() => {
  process.chdir(originalCwd);
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── Fixtures ─────────────────────────────────────────────────────────

const TAG = `wcphase5_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

async function seedWorkerJob(overrides: Partial<Pick<WorkerJob, "worker_type" | "priority" | "input_kind" | "input_ref" | "input_payload">> = {}): Promise<WorkerJob> {
  return await store.enqueueJob({
    worker_type: overrides.worker_type ?? "knowledge-context",
    priority: overrides.priority ?? 5,
    input_kind: overrides.input_kind ?? "inbox_item",
    input_ref: overrides.input_ref ?? `nx_${TAG}_a`,
    input_payload: overrides.input_payload ?? null,
  });
}

async function seedResultForJob(job: WorkerJob, overrides: Partial<Pick<WorkerResult, "worker_id" | "output_kind" | "output_payload" | "overall_confidence" | "flags">> = {}): Promise<WorkerResult> {
  return await store.insertResult({
    job_id: job.id,
    worker_type: job.worker_type,
    worker_id: overrides.worker_id ?? `worker-${TAG}`,
    output_kind: overrides.output_kind ?? "record_draft",
    output_payload: overrides.output_payload ?? { draft_record_ids: ["draft_x_1"] },
    overall_confidence: overrides.overall_confidence ?? 0.9,
    llm_provider: null,
    llm_model: null,
    llm_tokens_in: null,
    llm_tokens_out: null,
    llm_ms: null,
    flags: overrides.flags ?? [],
  });
}

// ═════════════════════════════════════════════════════════════════════

describe("filesystem adapter · getWorkerJob", () => {
  it("returns the seeded row by id", async () => {
    const j = await seedWorkerJob();
    const got = await store.getWorkerJob(j.id);
    expect(got).not.toBeNull();
    expect(got!.id).toBe(j.id);
    expect(got!.worker_type).toBe("knowledge-context");
  });

  it("returns null for a missing id · does not throw", async () => {
    const got = await store.getWorkerJob("00000000-0000-4000-8000-000000000000");
    expect(got).toBeNull();
  });

  it("returns null for a malformed / SQL-injection-shaped id", async () => {
    const got = await store.getWorkerJob("'; DROP TABLE --");
    expect(got).toBeNull();
  });
});

describe("filesystem adapter · listWorkerJobsByInputRef", () => {
  const inbox1 = `nx_${TAG}_a`;
  const inbox2 = `nx_${TAG}_b`;

  it("returns rows for a single matching input_ref", async () => {
    const a1 = await seedWorkerJob({ input_ref: inbox1, worker_type: "knowledge-context" });
    const a2 = await seedWorkerJob({ input_ref: inbox1, worker_type: "voice-context" });
    const b1 = await seedWorkerJob({ input_ref: inbox2, worker_type: "knowledge-context" });
    const got = await store.listWorkerJobsByInputRef([inbox1]);
    expect(got).toHaveLength(2);
    const ids = got.map((w) => w.id).sort();
    expect(ids).toEqual([a1.id, a2.id].sort());
    expect(ids).not.toContain(b1.id);
  });

  it("returns rows for a batch of input_refs", async () => {
    await seedWorkerJob({ input_ref: inbox1 });
    await seedWorkerJob({ input_ref: inbox2 });
    await seedWorkerJob({ input_ref: `${inbox2}_extra` });
    const got = await store.listWorkerJobsByInputRef([inbox1, inbox2]);
    expect(got).toHaveLength(2);
  });

  it("empty input array short-circuits to []", async () => {
    await seedWorkerJob({ input_ref: inbox1 });
    const got = await store.listWorkerJobsByInputRef([]);
    expect(got).toEqual([]);
  });

  it("limit truncates results", async () => {
    for (let i = 0; i < 6; i++) {
      await seedWorkerJob({ input_ref: inbox1 });
    }
    const got = await store.listWorkerJobsByInputRef([inbox1], { limit: 3 });
    expect(got).toHaveLength(3);
  });

  it("orders results by created_at ASC", async () => {
    const first  = await seedWorkerJob({ input_ref: inbox1 });
    await new Promise((r) => setTimeout(r, 20));
    const second = await seedWorkerJob({ input_ref: inbox1 });
    const got = await store.listWorkerJobsByInputRef([inbox1]);
    expect(got[0].id).toBe(first.id);
    expect(got[1].id).toBe(second.id);
  });
});

describe("filesystem adapter · findWorkerJobsByKnowledgeJobId", () => {
  const inbox1 = `nx_${TAG}_a`;
  const kjid1 = `kjid1_${TAG}`;
  const kjid2 = `kjid2_${TAG}`;

  it("returns only rows whose input_payload.knowledge_job_id matches", async () => {
    const withKj  = await seedWorkerJob({
      worker_type: "knowledge-context",
      input_ref: inbox1,
      input_payload: { knowledge_job_id: kjid1 },
    });
    const extractor = await seedWorkerJob({
      worker_type: "knowledge-extractor",
      input_ref: inbox1,
      input_payload: { some_other_key: "value" }, // Phase-1 finding: no kjid
    });
    const other = await seedWorkerJob({
      worker_type: "knowledge-context",
      input_ref: inbox1,
      input_payload: { knowledge_job_id: kjid2 },
    });
    const got = await store.findWorkerJobsByKnowledgeJobId(kjid1);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe(withKj.id);
    expect(got.some((w) => w.id === extractor.id)).toBe(false);
    expect(got.some((w) => w.id === other.id)).toBe(false);
  });

  it("returns [] for an unknown kjid", async () => {
    await seedWorkerJob({ input_payload: { knowledge_job_id: kjid1 } });
    const got = await store.findWorkerJobsByKnowledgeJobId(`no-such-${TAG}`);
    expect(got).toEqual([]);
  });

  it("returns [] for empty kjid input", async () => {
    const got = await store.findWorkerJobsByKnowledgeJobId("");
    expect(got).toEqual([]);
  });
});

describe("filesystem adapter · listWorkerResultsByIds", () => {
  it("returns matching results by id set", async () => {
    const j1 = await seedWorkerJob({ worker_type: "knowledge-extractor" });
    const j2 = await seedWorkerJob({ worker_type: "knowledge-extractor" });
    const r1 = await seedResultForJob(j1);
    const r2 = await seedResultForJob(j2);
    const got = await store.listWorkerResultsByIds([r1.id, r2.id]);
    expect(got).toHaveLength(2);
    expect(got.map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
  });

  it("returns partial matches · missing ids silently skipped", async () => {
    const j1 = await seedWorkerJob();
    const r1 = await seedResultForJob(j1);
    const got = await store.listWorkerResultsByIds([r1.id, "00000000-0000-4000-8000-000000000001"]);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe(r1.id);
  });

  it("empty input → []", async () => {
    const got = await store.listWorkerResultsByIds([]);
    expect(got).toEqual([]);
  });
});

describe("filesystem adapter · writeKnowledgeJobTransitionAudit", () => {
  const kjid = `kjid_${TAG}`;

  it("writes a knowledge_jobs audit row visible via listAudit", async () => {
    await store.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: kjid,
      from_status: "claimed",
      to_status: "completed",
      actor: "supervisor:companion",
      reason: "supervisor-attested-completion",
      correlation_id: `cid-${TAG}`,
      worker_job_id: `worker-${TAG}`,
      metadata: { extractor_result_ids: ["r1", "r2"] },
    });
    const rows = await store.listAudit({ entity_id: kjid });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.entity_type).toBe("knowledge_jobs");
    expect(row.entity_id).toBe(kjid);
    expect(row.action).toBe("completed");
    expect(row.actor).toBe("supervisor:companion");
    expect(row.before_state).toEqual({ status: "claimed" });
    expect(row.after_state).toEqual({ status: "completed" });
    const notes = JSON.parse(row.notes ?? "{}");
    expect(notes.reason).toBe("supervisor-attested-completion");
    expect(notes.correlation_id).toBe(`cid-${TAG}`);
    expect(notes.worker_job_id).toBe(`worker-${TAG}`);
    expect(notes.metadata).toEqual({ extractor_result_ids: ["r1", "r2"] });
  });

  it("is append-only · repeated writes create separate rows (dedup is caller concern)", async () => {
    for (let i = 0; i < 3; i++) {
      await store.writeKnowledgeJobTransitionAudit({
        knowledge_job_id: kjid,
        from_status: "claimed",
        to_status: "completed",
        actor: `actor-${i}`,
      });
    }
    const rows = await store.listAudit({ entity_id: kjid });
    expect(rows).toHaveLength(3);
  });

  it("accepts the minimum required fields", async () => {
    await store.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: kjid,
      from_status: "claimed",
      to_status: "failed",
      actor: "test",
    });
    const rows = await store.listAudit({ entity_id: kjid });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("failed");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Cross-method integration · the Cohort A attest-and-finalize path
// ═════════════════════════════════════════════════════════════════════

describe("filesystem adapter · Cohort A attest integration", () => {
  it("supervisor query chain resolves inbox → workers → extractor results → drafts", async () => {
    const inbox = `nx_${TAG}_cohortA`;
    const kjid  = `kjid_${TAG}_cohortA`;

    // Seed the shape Phase-1 forensic proved:
    // For one inbox_item · 5 rounds × 4 workers = 20 WorkerJobs.
    // Only knowledge-context in rounds 1-4 carries kjid in payload.
    for (let round = 0; round < 5; round++) {
      const kc = await seedWorkerJob({
        worker_type: "knowledge-context",
        input_ref:   inbox,
        input_payload: round === 0 ? null : { knowledge_job_id: kjid },
      });
      const kcResult = await seedResultForJob(kc, { output_kind: "context_bundle" });
      await store.completeJob(kc.id, kcResult.id);

      await seedWorkerJob({ worker_type: "voice-context",    input_ref: inbox });
      await seedWorkerJob({ worker_type: "learning-context", input_ref: inbox });

      const ex = await seedWorkerJob({
        worker_type: "knowledge-extractor",
        input_ref:   inbox,
        // Phase-1 finding · extractor payload does NOT carry kjid.
        input_payload: { url: "test", kind: "text" },
      });
      const exResult = await seedResultForJob(ex, {
        output_kind: "record_draft",
        output_payload: { draft_record_ids: [`draft_r${round}`] },
      });
      await store.completeJob(ex.id, exResult.id);
    }

    // Exercise the supervisor's query chain (Path A · V2 §4.1):
    const wjs = await store.listWorkerJobsByInputRef([inbox]);
    expect(wjs.length).toBeGreaterThanOrEqual(20);
    const extractors = wjs.filter((w) => w.worker_type === "knowledge-extractor");
    expect(extractors).toHaveLength(5);
    expect(extractors.every((w) => w.status === "completed")).toBe(true);

    const resultIds = extractors.map((w) => w.result_id).filter(Boolean) as string[];
    expect(resultIds).toHaveLength(5);
    const results = await store.listWorkerResultsByIds(resultIds);
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.output_kind === "record_draft")).toBe(true);
    expect(
      results.every(
        (r) =>
          Array.isArray((r.output_payload as { draft_record_ids?: string[] }).draft_record_ids) &&
          (r.output_payload as { draft_record_ids: string[] }).draft_record_ids.length > 0,
      ),
    ).toBe(true);

    // kjid lookup returns only the 4 kc-with-kjid rows (rounds 1-4).
    // The extractor rows and the round-0 kc row (no kjid) must be excluded.
    const byKjid = await store.findWorkerJobsByKnowledgeJobId(kjid);
    expect(byKjid).toHaveLength(4);
    expect(byKjid.every((w) => w.worker_type === "knowledge-context")).toBe(true);
  });
});

// Type-only guard · assert WorkerType still enumerates the workers the
// integration test seeds. If the union shrinks, tsc will fail this file.
const _t: WorkerType[] = ["knowledge-context", "voice-context", "learning-context", "knowledge-extractor"];
void _t;
