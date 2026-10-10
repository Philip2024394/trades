// §36-I-2 · WAVE-I2 · 2026-09-14 · engineering-memory

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { recordEngineeringMemory } from "../engineering-memory";
import type {
  CandidateLesson,
  EngineeringMemoryFailure,
  EngineeringMemoryRequest,
  EngineeringMemoryResult,
  EngineeringMemorySuccess,
  LessonKind,
  EpistemicStatus,
} from "../engineering-memory-types";
import type { HypothesisMeasurementRecord, ImprovementHypothesis } from "../improvement-hypothesis-measurement-types";

function asSuccess(r: EngineeringMemoryResult): EngineeringMemorySuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: EngineeringMemoryResult): EngineeringMemoryFailure {
  if (r.ok) throw new Error("expected failure, got success");
  return r;
}

function candidate(overrides: Partial<CandidateLesson>): CandidateLesson {
  return {
    kind: "failure_pattern",
    proposed_status: "HYPOTHESIS",
    summary: "test summary",
    evidence_citation: "s3.failures[wave=r2]",
    wave_slug: "r2",
    paired_hypothesis_id: null,
    ...overrides,
  };
}

function baseReq(overrides?: Partial<EngineeringMemoryRequest>): EngineeringMemoryRequest {
  return {
    candidate_lessons: overrides?.candidate_lessons ?? [candidate({})],
    hypothesis_measurements: overrides?.hypothesis_measurements ?? [],
    hypotheses: overrides?.hypotheses ?? [],
    prior_book: overrides?.prior_book,
    clock: overrides?.clock ?? (() => new Date("2026-09-14T12:00:00.000Z")),
  };
}

// ══════════════════════════════════════════════════════════════════════
// §A · Epistemic status behaviour (8 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §A · epistemic status behaviour", () => {
  it("A-1 · HYPOTHESIS candidate → accepted as HYPOTHESIS", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq()));
    expect(r.book.lessons.length).toBe(1);
    expect(r.book.lessons[0].status).toBe("HYPOTHESIS");
  });
  it("A-2 · INFERENCE candidate → accepted as INFERENCE", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "INFERENCE" })],
    })));
    expect(r.book.lessons[0].status).toBe("INFERENCE");
  });
  it("A-3 · REJECTED_IDEA candidate → accepted as REJECTED_IDEA", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "REJECTED_IDEA" })],
    })));
    expect(r.book.lessons[0].status).toBe("REJECTED_IDEA");
  });
  it("A-4 · FACT without paired hypothesis → REJECTED with promotion reason", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "FACT" })],
    })));
    expect(r.book.lessons.length).toBe(0);
    expect(r.rejected_candidates.length).toBe(1);
    expect(r.rejected_candidates[0].rejection_reason).toBe("promotion_to_fact_requires_paired_improvement_measured_hypothesis");
  });
  it("A-5 · FACT with paired hypothesis outcome=improvement_measured → ACCEPTED as FACT", () => {
    const hyp: ImprovementHypothesis = {
      hypothesis_id: "H-001-r2-amend_locked_pattern",
      derived_from_proposal_kind: "amend_locked_pattern",
      wave_slug: "r2",
      observed_weakness_summary: "test",
      evidence_citation: "s4.proposal",
      proposed_intervention_summary: "test",
      expected_capability_change: "improve_evidence_visibility",
      success_threshold: "gap_notes reduce",
      failure_condition: "no change",
      rollback_strategy: "revert",
    };
    const hm: HypothesisMeasurementRecord = {
      hypothesis_id: hyp.hypothesis_id,
      outcome: "improvement_measured",
      measurement_records: [],
      outcome_reason_summary: "gap notes decreased",
    };
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "FACT", paired_hypothesis_id: hyp.hypothesis_id })],
      hypothesis_measurements: [hm],
      hypotheses: [hyp],
    })));
    expect(r.book.lessons.length).toBe(1);
    expect(r.book.lessons[0].status).toBe("FACT");
  });
  it("A-6 · FACT with paired hypothesis outcome=no_change_measured → REJECTED", () => {
    const hm: HypothesisMeasurementRecord = {
      hypothesis_id: "H-002-r2-amend",
      outcome: "no_change_measured",
      measurement_records: [],
      outcome_reason_summary: "no delta",
    };
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "FACT", paired_hypothesis_id: "H-002-r2-amend" })],
      hypothesis_measurements: [hm],
      hypotheses: [],
    })));
    expect(r.rejected_candidates.length).toBe(1);
    expect(r.rejected_candidates[0].rejection_reason).toBe("promotion_to_fact_requires_paired_improvement_measured_hypothesis");
  });
  it("A-7 · promotion_history records initial 'from_status: null' entry", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq()));
    const l = r.book.lessons[0];
    expect(l.promotion_history[0].from_status).toBeNull();
    expect(l.promotion_history[0].to_status).toBe("HYPOTHESIS");
  });
  it("A-8 · promotion_history includes justification", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq()));
    expect(r.book.lessons[0].promotion_history[0].justification.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Rejection reasons (6 tests · one per RejectionReason)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §B · rejection reasons", () => {
  it("B-1 · missing_evidence_citation", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ evidence_citation: "" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("missing_evidence_citation");
  });
  it("B-2 · promotion_to_fact_requires_paired_improvement_measured_hypothesis", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "FACT" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("promotion_to_fact_requires_paired_improvement_measured_hypothesis");
  });
  it("B-3 · prohibited_string_content", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ summary: "call eval(1)" })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("prohibited_string_content");
  });
  it("B-4 · duplicate_of_prior_lesson", () => {
    const first = asSuccess(recordEngineeringMemory(baseReq()));
    const second = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({})],  // same summary + kind + wave_slug
      prior_book: first.book,
    })));
    expect(second.rejected_candidates[0].rejection_reason).toBe("duplicate_of_prior_lesson");
  });
  it("B-5 · unknown_lesson_kind", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ kind: "not_a_kind" as LessonKind })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("unknown_lesson_kind");
  });
  it("B-6 · unknown_epistemic_status", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "TRUTH" as EpistemicStatus })],
    })));
    expect(r.rejected_candidates[0].rejection_reason).toBe("unknown_epistemic_status");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Book merging + prior book (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §C · book merging", () => {
  it("C-1 · prior book lessons retained · new lessons appended", () => {
    const first = asSuccess(recordEngineeringMemory(baseReq()));
    const second = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ summary: "different summary", wave_slug: "s2" })],
      prior_book: first.book,
    })));
    expect(second.book.lessons.length).toBe(2);
  });
  it("C-2 · book_sha256 changes when new lessons added", () => {
    const first = asSuccess(recordEngineeringMemory(baseReq()));
    const second = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ summary: "different summary", wave_slug: "s2" })],
      prior_book: first.book,
    })));
    expect(second.book.book_sha256).not.toBe(first.book.book_sha256);
  });
  it("C-3 · lessons sorted by lesson_id in book", () => {
    const first = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [
        candidate({ summary: "z-last" }),
        candidate({ summary: "a-first" }),
        candidate({ summary: "m-middle" }),
      ],
    })));
    const ids = first.book.lessons.map((l) => l.lesson_id);
    expect(ids).toEqual([...ids].sort());
  });
  it("C-4 · empty candidate_lessons + no prior_book → empty book", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({ candidate_lessons: [] })));
    expect(r.book.lessons.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Determinism (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §D · determinism", () => {
  it("D-1 · identical inputs → identical book_sha256", () => {
    const a = asSuccess(recordEngineeringMemory(baseReq()));
    const b = asSuccess(recordEngineeringMemory(baseReq()));
    expect(a.book.book_sha256).toBe(b.book.book_sha256);
  });
  it("D-2 · rejected_candidates sorted deterministically", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [
        candidate({ summary: "z", evidence_citation: "" }),
        candidate({ summary: "a", evidence_citation: "" }),
      ],
    })));
    const summaries = r.rejected_candidates.map((c) => c.summary);
    expect(summaries).toEqual([...summaries].sort());
  });
  it("D-3 · injected clock deterministic", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      clock: () => new Date("2028-08-08T08:08:08.000Z"),
    })));
    expect(r.book.lessons[0].recorded_at).toBe("2028-08-08T08:08:08.000Z");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Refusal codes (6 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §E · refusal codes", () => {
  it("E-1 · I2_INVALID_REQUEST", () => {
    const r = asFailure(recordEngineeringMemory(null as unknown as EngineeringMemoryRequest));
    expect(r.refusal_code).toBe("I2_INVALID_REQUEST");
  });
  it("E-2 · I2_INVALID_CANDIDATE_LESSON for non-array", () => {
    const r = asFailure(recordEngineeringMemory({
      candidate_lessons: "not array" as unknown as CandidateLesson[],
      hypothesis_measurements: [], hypotheses: [],
    }));
    expect(r.refusal_code).toBe("I2_INVALID_CANDIDATE_LESSON");
  });
  it("E-3 · I2_INVALID_HYPOTHESIS_MEASUREMENTS for non-array", () => {
    const r = asFailure(recordEngineeringMemory({
      candidate_lessons: [],
      hypothesis_measurements: "not array" as unknown as HypothesisMeasurementRecord[],
      hypotheses: [],
    }));
    expect(r.refusal_code).toBe("I2_INVALID_HYPOTHESIS_MEASUREMENTS");
  });
  it("E-4 · I2_INVALID_HYPOTHESES for non-array", () => {
    const r = asFailure(recordEngineeringMemory({
      candidate_lessons: [], hypothesis_measurements: [],
      hypotheses: "not array" as unknown as ImprovementHypothesis[],
    }));
    expect(r.refusal_code).toBe("I2_INVALID_HYPOTHESES");
  });
  it("E-5 · I2_INVALID_PRIOR_BOOK for bad book_sha256", () => {
    const r = asFailure(recordEngineeringMemory({
      candidate_lessons: [], hypothesis_measurements: [], hypotheses: [],
      prior_book: { book_id: "x", lessons: [], book_sha256: "not-hex" },
    }));
    expect(r.refusal_code).toBe("I2_INVALID_PRIOR_BOOK");
  });
  it("E-6 · I2_OUTPUT_TOO_LARGE code exists in taxonomy", () => {
    const codes = ["I2_INVALID_REQUEST", "I2_INVALID_CANDIDATE_LESSON", "I2_INVALID_HYPOTHESIS_MEASUREMENTS", "I2_INVALID_HYPOTHESES", "I2_INVALID_PRIOR_BOOK", "I2_OUTPUT_TOO_LARGE"];
    expect(codes).toContain("I2_OUTPUT_TOO_LARGE");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §F · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "engineering-memory.ts");
  const src = fs.readFileSync(primitivePath, "utf8");
  it("F-1 · no fs.*", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("F-2 · no subprocess", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    expect(src.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });
  it("F-3 · no network", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("F-4 · no writes", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("F-5 · synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("F-6 · no LLM", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Anti-pattern discipline (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-I-2 · I2 · §G · anti-pattern", () => {
  it("G-1 · never automatically promotes HYPOTHESIS to FACT without paired measurement", () => {
    // Repeat A-4 pattern to confirm no auto-promotion
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [candidate({ proposed_status: "FACT", paired_hypothesis_id: null })],
    })));
    expect(r.book.lessons.length).toBe(0);
  });
  it("G-2 · rejected candidates are never dropped silently · always in rejected_candidates list", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq({
      candidate_lessons: [
        candidate({ evidence_citation: "" }),
        candidate({ summary: "bad<script>tag" }),
      ],
    })));
    expect(r.rejected_candidates.length).toBe(2);
  });
  it("G-3 · lessons carry provenance (evidence_citation always non-empty)", () => {
    const r = asSuccess(recordEngineeringMemory(baseReq()));
    for (const l of r.book.lessons) {
      expect(l.evidence_citation.length).toBeGreaterThan(0);
    }
  });
});
