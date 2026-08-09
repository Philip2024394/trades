// Wave 11 · Phase 6 · Companion Supervisor · sub-gate 6.b
//
// Unit tests for the pure classifier in kjob-supervisor.ts.
// Zero I/O · zero store · zero fs-store · synthetic fixtures only.
//
// Every branch of §4.1 in the V2 design has an assertion here:
//   Path A · attest-eligible
//   Path B · no-extractor
//   Path B · extractor-incomplete
//   Path B · no-drafts (multiple shapes)
//   Cohort A shape (4 extractors · completed · drafts)
//   Aggregation across multiple extractors
//   Edge cases (null result_id · empty inputs)
//
// See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md §4.1
//     WORLD-CLASS-OPS-W-C-CONTRACT-TEST-DESIGN.md              §3.2

import { describe, it, expect } from "vitest";
import { classifyStuckKJ } from "./kjob-supervisor";
import type { JobStatus, WorkerJob, WorkerResult, WorkerType } from "@/lib/nex/brain/types";

// Minimal fixture builders — every field the classifier reads is
// exposed via `over`; the rest use safe defaults.

function wj(over: {
  id: string;
  worker_type: WorkerType;
  status: JobStatus;
  result_id?: string | null;
}): WorkerJob {
  return {
    id: over.id,
    worker_type: over.worker_type,
    status: over.status,
    result_id: over.result_id ?? null,
    priority: 5,
    input_kind: "inbox_item",
    input_ref: "nx_test",
    input_payload: null,
    attempts: 0,
    created_at: "2026-08-09T00:00:00.000Z",
    updated_at: "2026-08-09T00:00:00.000Z",
  };
}

function wr(over: {
  id: string;
  job_id: string;
  output_kind: string;
  output_payload?: Record<string, unknown>;
}): WorkerResult {
  return {
    id: over.id,
    job_id: over.job_id,
    output_kind: over.output_kind,
    output_payload: over.output_payload ?? {},
    worker_type: "knowledge-extractor",
    worker_id: "w-test",
    overall_confidence: 0.9,
    llm_provider: null,
    llm_model: null,
    llm_tokens_in: null,
    llm_tokens_out: null,
    llm_ms: null,
    flags: [],
    created_at: "2026-08-09T00:00:00.000Z",
  };
}

describe("classifyStuckKJ · Path A attest-eligible", () => {
  it("classifies a Cohort A shape (extractors completed with drafts) as A-attest", () => {
    // 4 extractors matches the real Cohort A fixture (Phase-1 forensic).
    const kjid = "kj_cohort_a";
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const e2 = wj({ id: "e2", worker_type: "knowledge-extractor", status: "completed", result_id: "r2" });
    const e3 = wj({ id: "e3", worker_type: "knowledge-extractor", status: "completed", result_id: "r3" });
    const e4 = wj({ id: "e4", worker_type: "knowledge-extractor", status: "completed", result_id: "r4" });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1"] } });
    const r2 = wr({ id: "r2", job_id: "e2", output_kind: "record_draft", output_payload: { draft_record_ids: ["d2"] } });
    const r3 = wr({ id: "r3", job_id: "e3", output_kind: "record_draft", output_payload: { draft_record_ids: ["d3"] } });
    const r4 = wr({ id: "r4", job_id: "e4", output_kind: "record_draft", output_payload: { draft_record_ids: ["d4"] } });
    const c = classifyStuckKJ({ kjid, workers: [e1, e2, e3, e4], results: [r1, r2, r3, r4] });
    expect(c.path).toBe("A-attest");
    if (c.path === "A-attest") {
      expect(c.kjid).toBe(kjid);
      expect(c.extractor_worker_ids).toEqual(["e1", "e2", "e3", "e4"]);
      expect(c.result_ids).toEqual(["r1", "r2", "r3", "r4"]);
      expect(c.draft_record_ids).toEqual(["d1", "d2", "d3", "d4"]);
    }
  });

  it("ignores non-extractor workers when computing eligibility", () => {
    // Real inbox flows have knowledge-context + voice-context + learning-context
    // + knowledge-extractor. Only extractors count for attest-eligibility.
    const kc = wj({ id: "kc1", worker_type: "knowledge-context", status: "completed", result_id: "rk1" });
    const vc = wj({ id: "vc1", worker_type: "voice-context", status: "completed", result_id: "rv1" });
    const lc = wj({ id: "lc1", worker_type: "learning-context", status: "completed", result_id: "rl1" });
    const ex = wj({ id: "ex1", worker_type: "knowledge-extractor", status: "completed", result_id: "re1" });
    const rk = wr({ id: "rk1", job_id: "kc1", output_kind: "context_bundle" });
    const rv = wr({ id: "rv1", job_id: "vc1", output_kind: "voice_bundle" });
    const rl = wr({ id: "rl1", job_id: "lc1", output_kind: "learning_bundle" });
    const re = wr({ id: "re1", job_id: "ex1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1"] } });
    const c = classifyStuckKJ({ kjid: "kj_mixed", workers: [kc, vc, lc, ex], results: [rk, rv, rl, re] });
    expect(c.path).toBe("A-attest");
    if (c.path === "A-attest") {
      expect(c.extractor_worker_ids).toEqual(["ex1"]);
      expect(c.result_ids).toEqual(["re1"]);
      expect(c.draft_record_ids).toEqual(["d1"]);
    }
  });

  it("aggregates draft_record_ids across multiple extractors deterministically", () => {
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const e2 = wj({ id: "e2", worker_type: "knowledge-extractor", status: "completed", result_id: "r2" });
    const e3 = wj({ id: "e3", worker_type: "knowledge-extractor", status: "completed", result_id: "r3" });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1a", "d1b"] } });
    const r2 = wr({ id: "r2", job_id: "e2", output_kind: "record_draft", output_payload: { draft_record_ids: ["d2a"] } });
    const r3 = wr({ id: "r3", job_id: "e3", output_kind: "record_draft", output_payload: { draft_record_ids: ["d3a", "d3b", "d3c"] } });
    const c = classifyStuckKJ({ kjid: "kj_agg", workers: [e1, e2, e3], results: [r1, r2, r3] });
    expect(c.path).toBe("A-attest");
    if (c.path === "A-attest") {
      expect(c.draft_record_ids).toEqual(["d1a", "d1b", "d2a", "d3a", "d3b", "d3c"]);
    }
  });
});

describe("classifyStuckKJ · Path B fall-through cases", () => {
  it("no extractors present → B-review reason=no-extractor", () => {
    const kc = wj({ id: "kc1", worker_type: "knowledge-context", status: "completed" });
    const c = classifyStuckKJ({ kjid: "kj_noex", workers: [kc], results: [] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") {
      expect(c.reason).toBe("no-extractor");
      expect(c.extractor_worker_ids).toEqual([]);
    }
  });

  it("empty workers, empty results → B-review reason=no-extractor", () => {
    const c = classifyStuckKJ({ kjid: "kj_empty", workers: [], results: [] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") {
      expect(c.reason).toBe("no-extractor");
    }
  });

  it("any extractor not completed → B-review reason=extractor-incomplete", () => {
    // Even if one extractor completed AND produced drafts, if another is
    // still in-flight the sweep must not attest — the pipeline is still
    // legitimately advancing.
    const done = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const inflight = wj({ id: "e2", worker_type: "knowledge-extractor", status: "assigned" });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1"] } });
    const c = classifyStuckKJ({ kjid: "kj_incomplete", workers: [done, inflight], results: [r1] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") {
      expect(c.reason).toBe("extractor-incomplete");
      expect(c.extractor_worker_ids).toEqual(["e1", "e2"]);
    }
  });

  it("extractor in 'running' state → B-review reason=extractor-incomplete", () => {
    const running = wj({ id: "e1", worker_type: "knowledge-extractor", status: "running" });
    const c = classifyStuckKJ({ kjid: "kj_running", workers: [running], results: [] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("extractor-incomplete");
  });

  it("extractor failed → B-review reason=extractor-incomplete", () => {
    // Failed is not "completed" — sweep must not attest.
    const failed = wj({ id: "e1", worker_type: "knowledge-extractor", status: "failed" });
    const c = classifyStuckKJ({ kjid: "kj_failed", workers: [failed], results: [] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("extractor-incomplete");
  });

  it("all extractors completed but draft_record_ids empty array → no-drafts", () => {
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { draft_record_ids: [] } });
    const c = classifyStuckKJ({ kjid: "kj_empty_drafts", workers: [e1], results: [r1] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("no-drafts");
  });

  it("extractor completed but result row missing → no-drafts", () => {
    // Rare bug shape: extractor claimed a result_id but the row was
    // never inserted. Classifier must not attest.
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r-missing" });
    const c = classifyStuckKJ({ kjid: "kj_lost_result", workers: [e1], results: [] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("no-drafts");
  });

  it("output_kind other than record_draft doesn't count", () => {
    // Extractor produced a context_bundle-shaped result (wrong worker
    // logically · shouldn't happen, but defensive check).
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "context_bundle", output_payload: { draft_record_ids: ["d1"] } });
    const c = classifyStuckKJ({ kjid: "kj_wrong_kind", workers: [e1], results: [r1] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("no-drafts");
  });

  it("payload without draft_record_ids array → no-drafts", () => {
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { some_other_key: "v" } });
    const c = classifyStuckKJ({ kjid: "kj_no_field", workers: [e1], results: [r1] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("no-drafts");
  });

  it("payload draft_record_ids not-an-array → no-drafts (defensive)", () => {
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    // Intentionally malformed payload · classifier must not crash and must not attest.
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { draft_record_ids: "d1" as unknown as string[] } });
    const c = classifyStuckKJ({ kjid: "kj_malformed", workers: [e1], results: [r1] });
    expect(c.path).toBe("B-review");
    if (c.path === "B-review") expect(c.reason).toBe("no-drafts");
  });

  it("draft_record_ids array contains non-string entries · filters them out", () => {
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const r1 = wr({
      id: "r1",
      job_id: "e1",
      output_kind: "record_draft",
      output_payload: { draft_record_ids: [42, null, "", "valid-id"] as unknown as string[] },
    });
    const c = classifyStuckKJ({ kjid: "kj_mixed_types", workers: [e1], results: [r1] });
    expect(c.path).toBe("A-attest");
    if (c.path === "A-attest") {
      expect(c.draft_record_ids).toEqual(["valid-id"]);
    }
  });
});

describe("classifyStuckKJ · edge cases", () => {
  it("extractor with null result_id excluded from result lookup · path decided by remaining evidence", () => {
    const e1 = wj({ id: "e1", worker_type: "knowledge-extractor", status: "completed", result_id: "r1" });
    const e2 = wj({ id: "e2", worker_type: "knowledge-extractor", status: "completed", result_id: null });
    const r1 = wr({ id: "r1", job_id: "e1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1"] } });
    const c = classifyStuckKJ({ kjid: "kj_null_rid", workers: [e1, e2], results: [r1] });
    // e2 still counts as extractor_worker_ids (status is completed) even
    // though its result_id is null · the "no-drafts" branch fires only
    // if EVERY resolvable result lacks drafts. e1 has drafts, so attest.
    expect(c.path).toBe("A-attest");
    if (c.path === "A-attest") {
      expect(c.extractor_worker_ids).toEqual(["e1", "e2"]);
      expect(c.result_ids).toEqual(["r1"]);
    }
  });

  it("extra unrelated results in the input · silently ignored", () => {
    const ex = wj({ id: "ex1", worker_type: "knowledge-extractor", status: "completed", result_id: "re1" });
    const re = wr({ id: "re1", job_id: "ex1", output_kind: "record_draft", output_payload: { draft_record_ids: ["d1"] } });
    // Unrelated result the caller may have passed by accident:
    const noise = wr({ id: "r-noise", job_id: "other", output_kind: "record_draft", output_payload: { draft_record_ids: ["d-noise"] } });
    const c = classifyStuckKJ({ kjid: "kj_noise", workers: [ex], results: [re, noise] });
    expect(c.path).toBe("A-attest");
    if (c.path === "A-attest") {
      expect(c.result_ids).toEqual(["re1"]);
      expect(c.draft_record_ids).toEqual(["d1"]);
    }
  });

  it("kjid always echoed through unchanged", () => {
    const c = classifyStuckKJ({ kjid: "kj_echo_test_9987", workers: [], results: [] });
    expect(c.kjid).toBe("kj_echo_test_9987");
  });
});
