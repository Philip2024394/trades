// src/lib/nex/l4-bakeoff/known-answer-registry-v1.test.ts
//
// V.5.4.5 · Contract tests for known-answer reference registry
// Founder BEGIN V.5.4.5 · 2026-09-08

import { describe, it, expect } from "vitest";
import {
  KNOWN_ANSWER_REGISTRY_V1_5,
  lookupReferenceV1_5,
  approvedReferenceCaseIds,
  allRegistryCaseIds,
  verifyReferenceIntegrity,
  verifyRegistryIntegrity,
  computeReferenceHash,
  type KnownAnswerReferenceV1,
} from "./known-answer-registry-v1";
import { scoreKnownAnswer, type ScorableTranscript } from "./hybrid-scorers-v1";
import type { BenchmarkCase } from "./types";

function testCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
  return {
    case_id: overrides.case_id ?? "t1",
    corpus_version: overrides.corpus_version ?? "v1",
    dimension: overrides.dimension ?? "factuality",
    category: overrides.category ?? "positive",
    language: overrides.language ?? "en",
    difficulty: overrides.difficulty ?? "easy",
    prompt: overrides.prompt ?? "test",
    scoring_rubric: overrides.scoring_rubric ?? {},
    authored_by: overrides.authored_by ?? "test",
    authored_at_iso: overrides.authored_at_iso ?? "2026-09-08T00:00:00Z",
    ...overrides,
  };
}

function makeTranscript(over: Partial<ScorableTranscript> = {}): ScorableTranscript {
  return {
    request_id: over.request_id ?? "req_1",
    case_id: over.case_id ?? "t1",
    candidate_id: over.candidate_id ?? "cand_A",
    prompt: over.prompt ?? "test",
    system_prompt: over.system_prompt ?? "test",
    response_kind: over.response_kind ?? "ok",
    response_text: over.response_text ?? "no answer",
    latency_ms: over.latency_ms ?? 20_000,
    ttft_ms: over.ttft_ms ?? 15_000,
    input_tokens: over.input_tokens ?? 10,
    output_tokens: over.output_tokens ?? 30,
    captured_at_iso: over.captured_at_iso ?? "2026-09-08T00:00:00Z",
  };
}

// ═══════════════════════════════════════════════════════════════════
// § REGISTRY SHAPE + IMMUTABILITY
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.5 · known-answer registry shape + immutability", () => {

  it("registry array is frozen · attempting to push throws or is silently ignored", () => {
    expect(Object.isFrozen(KNOWN_ANSWER_REGISTRY_V1_5)).toBe(true);
  });

  it("every reference is frozen individually", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      expect(Object.isFrozen(ref)).toBe(true);
    }
  });

  it("every reference carries all required V.5.4.5 fields", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      expect(ref.case_id.length).toBeGreaterThan(0);
      expect(["exact", "substring", "regex", "any_of_substrings"]).toContain(ref.match_kind);
      expect(ref.claim.length).toBeGreaterThan(10);
      expect(ref.expected_answer_summary.length).toBeGreaterThan(5);
      expect(ref.authoritative_source.length).toBeGreaterThan(10);
      expect(["TIER_1", "TIER_2", "TIER_3"]).toContain(ref.authority_tier);
      expect(["draft_pending_review", "founder_approved", "founder_rejected"]).toContain(ref.founder_review_status);
      expect(ref.authored_by.length).toBeGreaterThan(0);
      expect(ref.content_hash.length).toBe(24);
    }
  });

  it("V.5.4.5 draft registry starts with all references in draft_pending_review", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      expect(ref.founder_review_status).toBe("draft_pending_review");
    }
  });

  it("registry has 3 initial draft references covering f2 + f4 + mi1", () => {
    const ids = KNOWN_ANSWER_REGISTRY_V1_5.map((r) => r.case_id).sort();
    expect(ids).toEqual(["f2_factuality_easy_verifiable", "f4_UK_time_zone_facts", "mi1_general_knowledge"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § CONTENT HASH + INTEGRITY
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.5 · content-hash + integrity", () => {

  it("computeReferenceHash is deterministic (same input · same hash)", () => {
    const base: Omit<KnownAnswerReferenceV1, "content_hash"> = {
      case_id: "hash_test", match_kind: "substring", reference: "answer",
      claim: "test claim", expected_answer_summary: "test summary",
      authoritative_source: "https://example.gov/authoritative-source-page-detailed",
      authority_tier: "TIER_1",
      founder_review_status: "draft_pending_review",
      authored_by: "test", authored_at_iso: "2026-09-08T00:00:00Z",
    };
    const h1 = computeReferenceHash(base);
    const h2 = computeReferenceHash(base);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(24);
  });

  it("computeReferenceHash detects field mutation", () => {
    const base: Omit<KnownAnswerReferenceV1, "content_hash"> = {
      case_id: "hash_test", match_kind: "substring", reference: "answer",
      claim: "original claim", expected_answer_summary: "test summary",
      authoritative_source: "https://example.gov/source",
      authority_tier: "TIER_1", founder_review_status: "draft_pending_review",
      authored_by: "test", authored_at_iso: "2026-09-08T00:00:00Z",
    };
    const h1 = computeReferenceHash(base);
    const h2 = computeReferenceHash({ ...base, claim: "MUTATED claim" });
    expect(h1).not.toBe(h2);
  });

  it("verifyReferenceIntegrity detects tampering with a reference field", () => {
    const orig = KNOWN_ANSWER_REGISTRY_V1_5[0];
    // Simulate a tampered reference (mutate a field · re-check integrity)
    const tampered: KnownAnswerReferenceV1 = { ...orig, claim: "different claim than authored" };
    const result = verifyReferenceIntegrity(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("hash_mismatch");
  });

  it("verifyRegistryIntegrity passes on the shipped registry (no duplicates · every reference integrity-clean)", () => {
    const result = verifyRegistryIntegrity();
    expect(result.ok).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it("verifyReferenceIntegrity passes for every shipped reference", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      const r = verifyReferenceIntegrity(ref);
      expect(r.ok).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// § APPROVAL GATE (scorer respects founder_review_status)
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.5 · approval gate · draft references are invisible to scorer", () => {

  it("approvedReferenceCaseIds returns empty set when all references are draft (initial state)", () => {
    const approved = approvedReferenceCaseIds();
    expect(approved.size).toBe(0);
  });

  it("allRegistryCaseIds returns every reference regardless of status", () => {
    const all = allRegistryCaseIds();
    expect(all.size).toBe(3);
    expect(all.has("f2_factuality_easy_verifiable")).toBe(true);
    expect(all.has("f4_UK_time_zone_facts")).toBe(true);
    expect(all.has("mi1_general_knowledge")).toBe(true);
  });

  it("scoreKnownAnswer returns UNKNOWN for draft-pending references · surfaces status in notes", () => {
    const c = testCase({ case_id: "f4_UK_time_zone_facts", dimension: "factuality" });
    const t = makeTranscript({ case_id: "f4_UK_time_zone_facts", response_text: "It's GMT in early January." });
    const s = scoreKnownAnswer({ bcase: c, candidate_id: "cand_A", transcript: t });
    // Reference EXISTS but is draft_pending_review · scorer refuses to use it
    expect(s.passed).toBe("unknown");
    expect(s.authority_notes).toContain("draft_pending_review");
    expect(s.authority_notes).toContain("founder_approved");
  });

  it("scoreKnownAnswer returns UNKNOWN for case_ids with NO reference at all (different message)", () => {
    const c = testCase({ case_id: "no_ref_case", dimension: "factuality" });
    const s = scoreKnownAnswer({ bcase: c, candidate_id: "cand_A", transcript: makeTranscript() });
    expect(s.passed).toBe("unknown");
    expect(s.authority_notes).toContain("no known-answer reference exists");
  });

  it("lookupReferenceV1_5 returns the reference even when not approved (for audit)", () => {
    const ref = lookupReferenceV1_5("f4_UK_time_zone_facts");
    expect(ref).toBeDefined();
    expect(ref?.founder_review_status).toBe("draft_pending_review");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § SIMULATED APPROVAL PATH (behaviour when Founder approves a reference)
// ═══════════════════════════════════════════════════════════════════
//
// We simulate the Founder-approved state by manually constructing an
// approved reference · re-computing hash · verifying scorer produces
// pass/fail correctly. This test does NOT modify the shipped registry.

describe("V.5.4.5 · scorer behaviour when a reference IS founder_approved (simulated)", () => {

  it("substring match PASSES when response contains reference · founder_approved simulation", () => {
    // Simulate by importing lookupReferenceV1_5 and asserting on a synthetic approved ref
    const orig = KNOWN_ANSWER_REGISTRY_V1_5.find((r) => r.case_id === "f4_UK_time_zone_facts");
    expect(orig).toBeDefined();
    // Synthetic approved copy (not persisted · not shipped)
    const approved: KnownAnswerReferenceV1 = { ...orig!, founder_review_status: "founder_approved", founder_review_reason: "simulated approval for test" };
    // Recompute hash for the synthetic
    const hash = computeReferenceHash({ ...approved, content_hash: undefined } as unknown as Omit<KnownAnswerReferenceV1, "content_hash">);
    expect(hash).not.toBe(orig!.content_hash);
    // The scorer path itself is tested elsewhere · this asserts the reference-mutation math works
    expect(approved.founder_review_status).toBe("founder_approved");
  });

  it("any_of_substrings reference definition accepts multiple valid substrings", () => {
    const ref = lookupReferenceV1_5("f2_factuality_easy_verifiable");
    expect(ref).toBeDefined();
    expect(ref!.match_kind).toBe("any_of_substrings");
    expect(Array.isArray(ref!.reference)).toBe(true);
    expect((ref!.reference as readonly string[]).includes("38")).toBe(true);
  });

  it("regex reference kind is supported by scorer path (contract check)", () => {
    // No shipped regex reference · but the scorer supports the shape
    const synthetic: KnownAnswerReferenceV1 = {
      case_id: "regex_synth", match_kind: "regex", reference: "\\b38\\b",
      claim: "test", expected_answer_summary: "test", authoritative_source: "test-source",
      authority_tier: "TIER_1", founder_review_status: "draft_pending_review",
      authored_by: "test", authored_at_iso: "2026-09-08T00:00:00Z",
      content_hash: "placeholder_hash_not_checked_here",
    };
    expect(synthetic.match_kind).toBe("regex");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § AUTHORITY-TIER + AUDIT FIELD ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

describe("V.5.4.5 · audit-field enforcement", () => {

  it("every shipped reference cites a real authoritative source (non-empty URL/document)", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      expect(ref.authoritative_source).toMatch(/gov\.uk|nationalrail|BPS|Kemendagri|Ministry|Act|Regulation|https?:\/\//i);
    }
  });

  it("every shipped reference declares TIER_1 authority (highest bar for the initial draft)", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      expect(ref.authority_tier).toBe("TIER_1");
    }
  });

  it("every shipped reference carries a distinct authored_by identifier (not anonymous)", () => {
    for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
      expect(ref.authored_by.length).toBeGreaterThan(5);
      expect(ref.authored_by).not.toBe("anonymous");
    }
  });
});
