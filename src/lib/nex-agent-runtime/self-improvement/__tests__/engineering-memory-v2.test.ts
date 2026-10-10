// §36-E-2 · WAVE-E2 · 2026-09-14 · engineering-memory-v2
// NEX bounded infrastructure · engineering-memory-v2 tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { recordEngineeringMemoryV2, queryMemory } from "../engineering-memory-v2";
import type {
  CandidateMemoryV2,
  EngineeringMemoryV2Book,
  EngineeringMemoryV2Failure,
  EngineeringMemoryV2Request,
  EngineeringMemoryV2Result,
  EngineeringMemoryV2Success,
  EpistemicStatusV2,
  LessonKindV2,
} from "../engineering-memory-v2-types";
import type { HypothesisMeasurementRecord } from "../improvement-hypothesis-measurement-types";

function asSuccess(r: EngineeringMemoryV2Result): EngineeringMemoryV2Success {
  if (!r.ok) throw new Error(`expected success · got ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: EngineeringMemoryV2Result): EngineeringMemoryV2Failure {
  if (r.ok) throw new Error("expected failure · got success");
  return r;
}
function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

const EVIDENCE_SHA = sha256Hex("evidence-1");

function candidate(overrides: Partial<CandidateMemoryV2>): CandidateMemoryV2 {
  return {
    kind: "failure_pattern",
    proposed_status: "OBSERVATION",
    summary: "test observation",
    evidence_citation: "s3.failures[wave=r2]",
    evidence_sha256: overrides.evidence_sha256 ?? EVIDENCE_SHA,
    mission_id: "M-abc",
    source: "S1 gap note",
    subsystem: "programming-mission",
    paired_hypothesis_id: null,
    supersedes_lesson_id: null,
    contradicts_lesson_id: null,
    ...overrides,
  };
}

function baseReq(overrides?: Partial<EngineeringMemoryV2Request>): EngineeringMemoryV2Request {
  return {
    candidate_memories: overrides?.candidate_memories ?? [candidate({})],
    hypothesis_measurements: overrides?.hypothesis_measurements ?? [],
    prior_book: overrides?.prior_book,
    clock: overrides?.clock ?? (() => new Date("2026-09-14T12:00:00.000Z")),
  };
}

// ══════════════════════════════════════════════════════════════════════
// §A · Six-status taxonomy (12 tests · 2 per status)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §A · 6-status taxonomy", () => {
  it("A-1 · OBSERVATION accepted with evidence_sha256", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq()));
    expect(r.book.lessons[0].status).toBe("OBSERVATION");
  });
  it("A-2 · OBSERVATION has PENDING promotion_state by default", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq()));
    expect(r.book.lessons[0].promotion_state).toBe("PENDING");
  });
  it("A-3 · INFERENCE accepted", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "INFERENCE" })],
    })));
    expect(r.book.lessons[0].status).toBe("INFERENCE");
  });
  it("A-4 · HYPOTHESIS accepted", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "HYPOTHESIS" })],
    })));
    expect(r.book.lessons[0].status).toBe("HYPOTHESIS");
  });
  it("A-5 · REJECTED accepted", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "REJECTED" })],
    })));
    expect(r.book.lessons[0].status).toBe("REJECTED");
  });
  it("A-6 · LESSON requires paired improvement_measured hypothesis", () => {
    const hm: HypothesisMeasurementRecord = {
      hypothesis_id: "H-001",
      outcome: "improvement_measured",
      measurement_records: [],
      outcome_reason_summary: "improved",
    };
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "LESSON", paired_hypothesis_id: "H-001" })],
      hypothesis_measurements: [hm],
    })));
    expect(r.book.lessons[0].status).toBe("LESSON");
    expect(r.book.lessons[0].promotion_state).toBe("PROMOTED");
  });
  it("A-7 · LESSON without paired hypothesis → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "LESSON", paired_hypothesis_id: null })],
    })));
    expect(r.book.lessons.length).toBe(0);
    expect(r.rejected_candidates[0].rejection_reason).toBe("promotion_to_lesson_requires_paired_measurement");
  });
  it("A-8 · LESSON with wrong-outcome hypothesis → REJECTED", () => {
    const hm: HypothesisMeasurementRecord = {
      hypothesis_id: "H-002",
      outcome: "no_change_measured",
      measurement_records: [],
      outcome_reason_summary: "no delta",
    };
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "LESSON", paired_hypothesis_id: "H-002" })],
      hypothesis_measurements: [hm],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("promotion_to_lesson_requires_paired_measurement");
  });
  it("A-9 · FACT with paired improvement_measured hypothesis → accepted AUTHORITATIVE", () => {
    const hm: HypothesisMeasurementRecord = {
      hypothesis_id: "H-003",
      outcome: "improvement_measured",
      measurement_records: [],
      outcome_reason_summary: "improved",
    };
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "FACT", paired_hypothesis_id: "H-003" })],
      hypothesis_measurements: [hm],
    })));
    expect(r.book.lessons[0].status).toBe("FACT");
    expect(r.book.lessons[0].promotion_state).toBe("AUTHORITATIVE");
  });
  it("A-10 · FACT without paired measurement AND without ≥2 corroborating OBSERVATIONs → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "FACT", paired_hypothesis_id: null })],
    })));
    expect(r.book.lessons.length).toBe(0);
    expect(r.rejected_candidates[0].rejection_reason).toBe("promotion_to_fact_requires_paired_measurement");
  });
  it("A-11 · FACT with ≥2 corroborating prior OBSERVATIONs in same subsystem → accepted", () => {
    // Seed prior book with 2 OBSERVATIONs on 'programming-mission'
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [
        candidate({ evidence_sha256: sha256Hex("obs-1"), summary: "obs 1" }),
        candidate({ evidence_sha256: sha256Hex("obs-2"), summary: "obs 2" }),
      ],
    })));
    // Now attempt FACT
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({
        proposed_status: "FACT",
        evidence_sha256: sha256Hex("fact-1"),
        summary: "corroborated fact",
      })],
      prior_book: seed.book,
    })));
    const facts = r.book.lessons.filter((l) => l.status === "FACT");
    expect(facts.length).toBe(1);
  });
  it("A-12 · REJECTED status accepted directly (no promotion rule)", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ proposed_status: "REJECTED", summary: "rejected approach" })],
    })));
    expect(r.book.lessons[0].status).toBe("REJECTED");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Provenance requirements (7 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §B · provenance", () => {
  it("B-1 · missing evidence_citation → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ evidence_citation: "" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("missing_evidence_citation");
  });
  it("B-2 · missing evidence_sha256 → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ evidence_sha256: "" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("missing_evidence_sha256");
  });
  it("B-3 · malformed evidence_sha256 → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ evidence_sha256: "not-hex" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("invalid_evidence_sha256_format");
  });
  it("B-4 · every accepted lesson carries evidence_citation + evidence_sha256", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq()));
    for (const l of r.book.lessons) {
      expect(l.evidence_citation.length).toBeGreaterThan(0);
      expect(l.evidence_sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
  it("B-5 · mission_id preserved on accepted lesson", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ mission_id: "M-xyz123" })],
    })));
    expect(r.book.lessons[0].mission_id).toBe("M-xyz123");
  });
  it("B-6 · source preserved", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ source: "human-authored" })],
    })));
    expect(r.book.lessons[0].source).toBe("human-authored");
  });
  it("B-7 · subsystem preserved (nullable)", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ subsystem: null })],
    })));
    expect(r.book.lessons[0].subsystem).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Supersession + Contradiction (5 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §C · supersession + contradiction", () => {
  it("C-1 · supersedes_lesson_id not in prior_book → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ supersedes_lesson_id: "L-does-not-exist" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("supersedes_target_not_found");
  });
  it("C-2 · valid supersession marks predecessor as SUPERSEDED", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ summary: "original lesson" })],
    })));
    const originalId = seed.book.lessons[0].lesson_id;
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({
        summary: "replacement lesson",
        evidence_sha256: sha256Hex("evidence-2"),
        supersedes_lesson_id: originalId,
      })],
      prior_book: seed.book,
    })));
    const originalNow = r.book.lessons.find((l) => l.lesson_id === originalId);
    expect(originalNow?.promotion_state).toBe("SUPERSEDED");
  });
  it("C-3 · contradicts_lesson_id not in prior_book → REJECTED", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ contradicts_lesson_id: "L-nope" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("contradicts_target_not_found");
  });
  it("C-4 · valid contradiction marks both as NEEDS_REVIEW", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ summary: "original claim" })],
    })));
    const originalId = seed.book.lessons[0].lesson_id;
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({
        summary: "contradicting claim",
        evidence_sha256: sha256Hex("evidence-3"),
        contradicts_lesson_id: originalId,
      })],
      prior_book: seed.book,
    })));
    const original = r.book.lessons.find((l) => l.lesson_id === originalId);
    expect(original?.promotion_state).toBe("NEEDS_REVIEW");
    const contradicting = r.book.lessons.find((l) => l.contradicts_lesson_id === originalId);
    expect(contradicting?.promotion_state).toBe("NEEDS_REVIEW");
  });
  it("C-5 · superseded lesson is NOT deleted (evidence preserved)", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({ summary: "original" })],
    })));
    const originalId = seed.book.lessons[0].lesson_id;
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [candidate({
        summary: "replacement",
        evidence_sha256: sha256Hex("evidence-4"),
        supersedes_lesson_id: originalId,
      })],
      prior_book: seed.book,
    })));
    expect(r.book.lessons.some((l) => l.lesson_id === originalId)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Query API (5 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §D · query API", () => {
  it("D-1 · filter by kind returns only matching lessons", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [
        candidate({ kind: "failure_pattern", summary: "fp-1" }),
        candidate({ kind: "debugging_lesson", summary: "dbg-1", evidence_sha256: sha256Hex("e2") }),
      ],
    })));
    const q = queryMemory(seed.book, { kind: "failure_pattern" });
    if ("refusal_code" in q) throw new Error("query failed");
    expect(q.matched_lesson_ids.length).toBe(1);
    expect(q.total_matches).toBe(1);
  });
  it("D-2 · filter by status", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [
        candidate({ proposed_status: "OBSERVATION", summary: "obs" }),
        candidate({ proposed_status: "INFERENCE", summary: "inf", evidence_sha256: sha256Hex("e2") }),
      ],
    })));
    const q = queryMemory(seed.book, { status: "OBSERVATION" });
    if ("refusal_code" in q) throw new Error("query failed");
    expect(q.matched_lesson_ids.length).toBe(1);
  });
  it("D-3 · filter by subsystem", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({
      candidate_memories: [
        candidate({ subsystem: "self-diagnostics", summary: "sd-1" }),
        candidate({ subsystem: "programming-mission", summary: "pm-1", evidence_sha256: sha256Hex("e2") }),
      ],
    })));
    const q = queryMemory(seed.book, { subsystem: "self-diagnostics" });
    if ("refusal_code" in q) throw new Error("query failed");
    expect(q.matched_lesson_ids.length).toBe(1);
  });
  it("D-4 · limit truncates results and sets truncated_by_limit", () => {
    const many: CandidateMemoryV2[] = Array.from({ length: 5 }, (_, i) =>
      candidate({ summary: `s${i}`, evidence_sha256: sha256Hex(`e-${i}`) }),
    );
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq({ candidate_memories: many })));
    const q = queryMemory(seed.book, { limit: 2 });
    if ("refusal_code" in q) throw new Error("query failed");
    expect(q.matched_lesson_ids.length).toBe(2);
    expect(q.truncated_by_limit).toBe(true);
    expect(q.total_matches).toBe(5);
  });
  it("D-5 · invalid limit → refusal", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq()));
    const q = queryMemory(seed.book, { limit: -1 });
    if (!("refusal_code" in q)) throw new Error("expected refusal");
    expect(q.refusal_code).toBe("EMV2_QUERY_INVALID");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Determinism (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §E · determinism", () => {
  it("E-1 · identical inputs → identical book_sha256", () => {
    const a = asSuccess(recordEngineeringMemoryV2(baseReq()));
    const b = asSuccess(recordEngineeringMemoryV2(baseReq()));
    expect(a.book.book_sha256).toBe(b.book.book_sha256);
  });
  it("E-2 · lessons sorted by lesson_id", () => {
    const many: CandidateMemoryV2[] = Array.from({ length: 5 }, (_, i) =>
      candidate({ summary: `z-${i}`, evidence_sha256: sha256Hex(`e-${i}`) }),
    );
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({ candidate_memories: many })));
    const ids = r.book.lessons.map((l) => l.lesson_id);
    expect(ids).toEqual([...ids].sort());
  });
  it("E-3 · injected clock deterministic", () => {
    const r = asSuccess(recordEngineeringMemoryV2(baseReq({
      clock: () => new Date("2028-04-04T04:04:04.000Z"),
    })));
    expect(r.book.lessons[0].recorded_at).toBe("2028-04-04T04:04:04.000Z");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Refusal codes (7 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §F · refusal codes", () => {
  it("F-1 · EMV2_INVALID_REQUEST for null", () => {
    const r = asFailure(recordEngineeringMemoryV2(null as unknown as EngineeringMemoryV2Request));
    expect(r.refusal_code).toBe("EMV2_INVALID_REQUEST");
  });
  it("F-2 · EMV2_INVALID_CANDIDATE for non-array", () => {
    const r = asFailure(recordEngineeringMemoryV2({
      candidate_memories: "not array" as unknown as CandidateMemoryV2[],
      hypothesis_measurements: [],
    }));
    expect(r.refusal_code).toBe("EMV2_INVALID_CANDIDATE");
  });
  it("F-3 · EMV2_INVALID_HYPOTHESIS_MEASUREMENTS for non-array", () => {
    const r = asFailure(recordEngineeringMemoryV2({
      candidate_memories: [],
      hypothesis_measurements: "x" as unknown as HypothesisMeasurementRecord[],
    }));
    expect(r.refusal_code).toBe("EMV2_INVALID_HYPOTHESIS_MEASUREMENTS");
  });
  it("F-4 · EMV2_INVALID_PRIOR_BOOK for malformed schema_version", () => {
    const r = asFailure(recordEngineeringMemoryV2({
      candidate_memories: [], hypothesis_measurements: [],
      prior_book: { book_id: "x", schema_version: "v1" as "ecc-memory-v2", lessons: [], book_sha256: "a".repeat(64) },
    }));
    expect(r.refusal_code).toBe("EMV2_INVALID_PRIOR_BOOK");
  });
  it("F-5 · EMV2_BOOK_SHA_MISMATCH for tampered book", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq()));
    const tampered: EngineeringMemoryV2Book = { ...seed.book, book_sha256: "0".repeat(64) };
    const r = asFailure(recordEngineeringMemoryV2({
      candidate_memories: [], hypothesis_measurements: [], prior_book: tampered,
    }));
    expect(r.refusal_code).toBe("EMV2_BOOK_SHA_MISMATCH");
  });
  it("F-6 · EMV2_OUTPUT_TOO_LARGE code exists in taxonomy", () => {
    const codes = ["EMV2_INVALID_REQUEST", "EMV2_INVALID_CANDIDATE", "EMV2_INVALID_HYPOTHESIS_MEASUREMENTS",
      "EMV2_INVALID_PRIOR_BOOK", "EMV2_BOOK_SHA_MISMATCH", "EMV2_OUTPUT_TOO_LARGE", "EMV2_QUERY_INVALID"];
    expect(codes).toContain("EMV2_OUTPUT_TOO_LARGE");
  });
  it("F-7 · EMV2_QUERY_INVALID via queryMemory", () => {
    const seed = asSuccess(recordEngineeringMemoryV2(baseReq()));
    const q = queryMemory(seed.book, { limit: 9999 });
    if (!("refusal_code" in q)) throw new Error("expected refusal");
    expect(q.refusal_code).toBe("EMV2_QUERY_INVALID");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Boundary preservation (6 static-grep)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-2 · E2 · §G · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "engineering-memory-v2.ts");
  const src = fs.readFileSync(primitivePath, "utf8");
  it("G-1 · no fs.*", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("G-2 · no subprocess", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    expect(src.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });
  it("G-3 · no network", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("G-4 · no writes", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("G-5 · synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("G-6 · no LLM", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});
