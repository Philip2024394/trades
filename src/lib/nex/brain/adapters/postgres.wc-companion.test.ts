// Wave 11 · Phase 5 · W-C-COMPANION Storage-contract extension.
// Contract tests for the 5 new BrainStore methods against the
// PostgresBrainStore adapter (target of Phase 3 · currently our shadow
// PG17 environment). Mirrors filesystem.wc-companion.test.ts case-for-case
// so cross-adapter behavior parity is machine-checkable.
// See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md
//     WORLD-CLASS-OPS-W-C-CONTRACT-TEST-DESIGN.md  §2.4 · §2.5
//
// Isolation strategy:
//   Every seeded row carries a per-run TAG in its input_ref
//   ("wcphase5pg_<uuid>_..."). afterAll DELETEs all worker_jobs,
//   worker_results, and audit_log rows whose fields contain the TAG.
//   No global truncation · no interference with other suites or dev data.
//
// Env gate · OPT-IN by design:
//   Set WC_PG_TEST=1 AND provide NEX_POSTGRES_URL pointing at a
//   non-production database. Default behaviour is SKIP silently — the
//   default vitest run must never write to any real Postgres, even
//   the local dev one, without an explicit operator action. Rationale:
//   Wave 11 · Phase 5 keeps the "no risky auto-execution" rule intact.
//
// Guardrails:
//   · Never touches production Supabase.
//   · Row-scoped cleanup only · uses the same nex_brain_app role the
//     adapter runs under (via the adapter's own withTx path).
//   · Contract mirrors the filesystem test surface exactly · any
//     behavioural divergence between adapters surfaces here first.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PostgresBrainStore } from "./postgres";
import { withClient } from "@/lib/nex/db";
import type { WorkerJob, WorkerResult, WorkerType } from "../types";

const HAS_PG = process.env.WC_PG_TEST === "1" && Boolean(process.env.NEX_POSTGRES_URL);
const TAG = `wcphase5pg_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

let store: PostgresBrainStore;

beforeAll(() => {
  store = new PostgresBrainStore();
});

afterAll(async () => {
  if (!HAS_PG) return;
  // Row-scoped cleanup: input_ref carries the per-run tag; audit_log
  // rows carry a tagged actor. Order matters — results FK to jobs.
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_brain_app");
      await c.query(
        `DELETE FROM nex.worker_results
           WHERE job_id IN (
             SELECT id FROM nex.worker_jobs WHERE input_ref LIKE $1
           )`,
        [`${TAG}%`],
      );
      await c.query(
        `DELETE FROM nex.worker_jobs WHERE input_ref LIKE $1`,
        [`${TAG}%`],
      );
      await c.query(
        `DELETE FROM nex.audit_log
           WHERE entity_type = 'knowledge_jobs' AND entity_id LIKE $1`,
        [`${TAG}%`],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
});

// ── Fixtures ─────────────────────────────────────────────────────────

async function seedWorkerJob(
  overrides: Partial<Pick<WorkerJob, "worker_type" | "priority" | "input_kind" | "input_ref" | "input_payload">> = {},
): Promise<WorkerJob> {
  return await store.enqueueJob({
    worker_type: overrides.worker_type ?? "knowledge-context",
    priority: overrides.priority ?? 5,
    input_kind: overrides.input_kind ?? "inbox_item",
    input_ref: overrides.input_ref ?? `${TAG}_a`,
    input_payload: overrides.input_payload ?? null,
  });
}

async function seedResultForJob(
  job: WorkerJob,
  overrides: Partial<Pick<WorkerResult, "worker_id" | "output_kind" | "output_payload" | "overall_confidence" | "flags">> = {},
): Promise<WorkerResult> {
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

describe.skipIf(!HAS_PG)("postgres adapter · getWorkerJob", () => {
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

  it("returns null for a malformed / SQL-injection-shaped id (22P02 guard)", async () => {
    const got = await store.getWorkerJob("'; DROP TABLE --");
    expect(got).toBeNull();
  });

  it("returns null for an empty id · does not round-trip", async () => {
    const got = await store.getWorkerJob("");
    expect(got).toBeNull();
  });
});

describe.skipIf(!HAS_PG)("postgres adapter · listWorkerJobsByInputRef", () => {
  const inbox1 = `${TAG}_lwj_a`;
  const inbox2 = `${TAG}_lwj_b`;

  it("returns rows for a single matching input_ref", async () => {
    const a1 = await seedWorkerJob({ input_ref: inbox1, worker_type: "knowledge-context" });
    const a2 = await seedWorkerJob({ input_ref: inbox1, worker_type: "voice-context" });
    const b1 = await seedWorkerJob({ input_ref: inbox2, worker_type: "knowledge-context" });
    const got = await store.listWorkerJobsByInputRef([inbox1]);
    const ids = got.map((w) => w.id).sort();
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
    expect(ids).not.toContain(b1.id);
  });

  it("returns rows for a batch of input_refs", async () => {
    const inbox3 = `${TAG}_lwj_c`;
    const inbox4 = `${TAG}_lwj_d`;
    const j3 = await seedWorkerJob({ input_ref: inbox3 });
    const j4 = await seedWorkerJob({ input_ref: inbox4 });
    const got = await store.listWorkerJobsByInputRef([inbox3, inbox4]);
    const ids = got.map((w) => w.id);
    expect(ids).toContain(j3.id);
    expect(ids).toContain(j4.id);
  });

  it("empty input array short-circuits to []", async () => {
    await seedWorkerJob({ input_ref: inbox1 });
    const got = await store.listWorkerJobsByInputRef([]);
    expect(got).toEqual([]);
  });

  it("limit truncates results", async () => {
    const inbox5 = `${TAG}_lwj_e`;
    for (let i = 0; i < 6; i++) {
      await seedWorkerJob({ input_ref: inbox5 });
    }
    const got = await store.listWorkerJobsByInputRef([inbox5], { limit: 3 });
    expect(got).toHaveLength(3);
  });

  it("orders results by created_at ASC", async () => {
    const inbox6 = `${TAG}_lwj_f`;
    const first = await seedWorkerJob({ input_ref: inbox6 });
    await new Promise((r) => setTimeout(r, 25));
    const second = await seedWorkerJob({ input_ref: inbox6 });
    const got = await store.listWorkerJobsByInputRef([inbox6]);
    // Filter to just the two we seeded so the assertion is deterministic
    // even if the same inbox6 tag was ever reused.
    const seededOnly = got.filter((w) => w.id === first.id || w.id === second.id);
    expect(seededOnly[0].id).toBe(first.id);
    expect(seededOnly[1].id).toBe(second.id);
  });

  it("returns [] for an input_ref with no matches", async () => {
    const got = await store.listWorkerJobsByInputRef([`${TAG}_none_${randomUUID()}`]);
    expect(got).toEqual([]);
  });
});

describe.skipIf(!HAS_PG)("postgres adapter · findWorkerJobsByKnowledgeJobId", () => {
  const kjid1 = `${TAG}_kjid_1`;
  const kjid2 = `${TAG}_kjid_2`;
  const inbox = `${TAG}_kjid_inbox`;

  it("returns only rows whose input_payload.knowledge_job_id matches", async () => {
    const withKj = await seedWorkerJob({
      worker_type: "knowledge-context",
      input_ref: inbox,
      input_payload: { knowledge_job_id: kjid1 },
    });
    const extractor = await seedWorkerJob({
      worker_type: "knowledge-extractor",
      input_ref: inbox,
      input_payload: { some_other_key: "value" }, // Phase-1 finding: no kjid on extractor
    });
    const other = await seedWorkerJob({
      worker_type: "knowledge-context",
      input_ref: inbox,
      input_payload: { knowledge_job_id: kjid2 },
    });
    const got = await store.findWorkerJobsByKnowledgeJobId(kjid1);
    const ids = got.map((w) => w.id);
    expect(ids).toContain(withKj.id);
    expect(ids).not.toContain(extractor.id);
    expect(ids).not.toContain(other.id);
    // Guardrail against Cohort A gotcha: extractor is never matched by
    // knowledge_job_id, only knowledge-context carries that payload key.
    expect(got.every((w) => w.worker_type !== "knowledge-extractor")).toBe(true);
  });

  it("returns [] for an unknown kjid", async () => {
    const got = await store.findWorkerJobsByKnowledgeJobId(`no-such-${TAG}_${randomUUID()}`);
    expect(got).toEqual([]);
  });

  it("returns [] for empty kjid input · no round-trip", async () => {
    const got = await store.findWorkerJobsByKnowledgeJobId("");
    expect(got).toEqual([]);
  });
});

describe.skipIf(!HAS_PG)("postgres adapter · listWorkerResultsByIds", () => {
  it("returns matching results by id set", async () => {
    const j1 = await seedWorkerJob({ worker_type: "knowledge-extractor", input_ref: `${TAG}_lwr_a` });
    const j2 = await seedWorkerJob({ worker_type: "knowledge-extractor", input_ref: `${TAG}_lwr_b` });
    const r1 = await seedResultForJob(j1);
    const r2 = await seedResultForJob(j2);
    const got = await store.listWorkerResultsByIds([r1.id, r2.id]);
    const ids = got.map((r) => r.id).sort();
    expect(ids).toEqual([r1.id, r2.id].sort());
  });

  it("returns partial matches · missing ids silently skipped", async () => {
    const j = await seedWorkerJob({ input_ref: `${TAG}_lwr_c` });
    const r = await seedResultForJob(j);
    const got = await store.listWorkerResultsByIds([r.id, "00000000-0000-4000-8000-000000000001"]);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe(r.id);
  });

  it("empty input → [] · no round-trip", async () => {
    const got = await store.listWorkerResultsByIds([]);
    expect(got).toEqual([]);
  });

  it("malformed uuid in the input list → [] (22P02 guard)", async () => {
    const got = await store.listWorkerResultsByIds(["not-a-uuid", "'; DROP TABLE --"]);
    expect(got).toEqual([]);
  });

  it("limit truncates result set", async () => {
    const j = await seedWorkerJob({ worker_type: "knowledge-extractor", input_ref: `${TAG}_lwr_d` });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await seedResultForJob(j, { output_payload: { draft_record_ids: [`draft_${i}`] } });
      ids.push(r.id);
    }
    const got = await store.listWorkerResultsByIds(ids, { limit: 3 });
    expect(got).toHaveLength(3);
  });
});

describe.skipIf(!HAS_PG)("postgres adapter · writeKnowledgeJobTransitionAudit", () => {
  const kjid = `${TAG}_kj_audit`;

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
    expect(rows.length).toBeGreaterThanOrEqual(1);
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

  it("is append-only · repeated writes create separate rows", async () => {
    const kj2 = `${TAG}_kj_audit_append`;
    for (let i = 0; i < 3; i++) {
      await store.writeKnowledgeJobTransitionAudit({
        knowledge_job_id: kj2,
        from_status: "claimed",
        to_status: "completed",
        actor: `actor-${i}`,
      });
    }
    const rows = await store.listAudit({ entity_id: kj2 });
    expect(rows.filter((r) => r.entity_id === kj2)).toHaveLength(3);
  });

  it("accepts the minimum required fields", async () => {
    const kj3 = `${TAG}_kj_audit_min`;
    await store.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: kj3,
      from_status: "claimed",
      to_status: "failed",
      actor: "test",
    });
    const rows = await store.listAudit({ entity_id: kj3 });
    expect(rows.filter((r) => r.entity_id === kj3)).toHaveLength(1);
    expect(rows[0].action).toBe("failed");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Cross-method integration · the Cohort A attest-and-finalize path.
// Mirrors the filesystem test so any adapter drift surfaces immediately.
// ═════════════════════════════════════════════════════════════════════

describe.skipIf(!HAS_PG)("postgres adapter · Cohort A attest integration", () => {
  it("supervisor query chain resolves inbox → workers → extractor results → drafts", async () => {
    const inbox = `${TAG}_cohortA`;
    const kjid = `${TAG}_kj_cohortA`;

    // Seed the Phase-1 forensic shape: 5 rounds × 4 workers per inbox_item.
    // Only knowledge-context in rounds 1-4 carries kjid in payload.
    for (let round = 0; round < 5; round++) {
      const kc = await seedWorkerJob({
        worker_type: "knowledge-context",
        input_ref: inbox,
        input_payload: round === 0 ? null : { knowledge_job_id: kjid },
      });
      const kcResult = await seedResultForJob(kc, { output_kind: "context_bundle" });
      await store.completeJob(kc.id, kcResult.id);

      await seedWorkerJob({ worker_type: "voice-context", input_ref: inbox });
      await seedWorkerJob({ worker_type: "learning-context", input_ref: inbox });

      const ex = await seedWorkerJob({
        worker_type: "knowledge-extractor",
        input_ref: inbox,
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
    expect(extractors.length).toBeGreaterThanOrEqual(5);
    expect(extractors.every((w) => w.status === "completed")).toBe(true);

    const resultIds = extractors.map((w) => w.result_id).filter(Boolean) as string[];
    expect(resultIds.length).toBeGreaterThanOrEqual(5);
    const results = await store.listWorkerResultsByIds(resultIds);
    expect(results.length).toBe(resultIds.length);
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
    expect(byKjid.length).toBeGreaterThanOrEqual(4);
    expect(byKjid.every((w) => w.worker_type === "knowledge-context")).toBe(true);
  });
});

// Type-only guard · asserts WorkerType still enumerates the workers the
// integration test seeds. If the union shrinks, tsc fails this file.
const _t: WorkerType[] = ["knowledge-context", "voice-context", "learning-context", "knowledge-extractor"];
void _t;
