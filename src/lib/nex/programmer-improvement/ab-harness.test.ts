// src/lib/nex/programmer-improvement/ab-harness.test.ts
//
// Y-W5-1-b · Unpromoted-candidate A/B harness · contract tests
// Philip 2026-09-07 · AUTHORIZE Y-W5-1-b
//
// SEPARATE ATTRIBUTION: these tests test Y-W5-1-b ONLY (isolation +
// mechanism + attribution). They do NOT test the network-resilience
// corpus (that is Y-W5-1-a's own tests).
//
// The harness needs a corpus to evaluate, and to keep this test
// module standalone we build a minimal 2-case ad-hoc corpus inline
// rather than importing the Y-W5-1-a corpus.

import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate any accidental knowledge store writes to a temp dir.
process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(path.join(tmpdir(), "nex-yw51b-test-"));

import { freezeCorpus } from "@/lib/nex/programmer-benchmark/corpus";
import type { BenchmarkCase, BenchmarkCorpus } from "@/lib/nex/programmer-benchmark/types";
import type { KnowledgeItem } from "@/lib/nex/programmer-learning/types";
import { runABEvaluation, computeABDelta, computeAttribution } from "./ab-harness";

function tinyCorpus(): BenchmarkCorpus {
  const CV = "yw51b-test-v1";
  const cases: BenchmarkCase[] = [
    {
      case_id: "yw51b_t01",
      corpus_version: CV,
      defect_class: "reliability.missing_timeout",
      difficulty: "FOUNDATIONAL",
      requirement: "network helper should fetch remote data reliably.",
      request: {
        review_id: "yw51b_t01_req",
        requirement: "network helper should fetch remote data reliably.",
        implementation: { id: "impl_t01", files: ["net.ts"], summary: "network helper that fetches remote data and returns the payload from upstream.", claim: "fetches data", claimed_by: "claude" },
        tests: { files: ["net.test.ts"], passed: 1, failed: 0, summary: "checks that the network fetch returns payload on happy path.", known_gaps: [] },
        runtime_evidence: [],
        requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
        relevant_knowledge_ids: ["know_yw51b_test_inject"],
      },
      ground_truth: "DEFECTIVE",
      expected_verdict: "NEEDS_CHANGES",
      expected_finding_categories: ["insufficient_evidence"],
      ground_truth_evidence: [{ method: "authoritative_documentation", description: "Test-only defective network case (no resilience patterns evidenced).", pointer: "yw51b-test-inline" }],
      provenance: "yw51b-test-inline · 2026-09-07",
    },
    {
      case_id: "yw51b_t02",
      corpus_version: CV,
      defect_class: "reliability.missing_timeout",
      difficulty: "FOUNDATIONAL",
      requirement: "date-parser should parse ISO strings.",
      request: {
        review_id: "yw51b_t02_req",
        requirement: "date-parser should parse ISO strings.",
        implementation: { id: "impl_t02", files: ["dp.ts"], summary: "date parser that parses ISO strings and returns date object with fallback to null for invalid inputs across reasonable formats.", claim: "parses dates", claimed_by: "claude" },
        tests: { files: ["dp.test.ts"], passed: 3, failed: 0, summary: "checks that the date parser handles valid, malformed, and empty inputs.", known_gaps: [] },
        runtime_evidence: [],
        requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
        relevant_knowledge_ids: ["know_yw51b_test_inject"],
      },
      ground_truth: "CORRECT",
      expected_verdict: "ACCEPT",
      expected_finding_categories: [],
      ground_truth_evidence: [{ method: "authoritative_documentation", description: "Test-only CORRECT non-network domain (negative control).", pointer: "yw51b-test-inline-neg" }],
      provenance: "yw51b-test-inline · 2026-09-07",
    },
  ];
  return freezeCorpus({ version: CV, authored_by: "yw51b-test", cases });
}

function tinyInjectedKnowledge(): KnowledgeItem {
  return {
    knowledge_id: "know_yw51b_test_inject",
    statement: "For network calls the implementation must include retry and must include timeout and must include circuit breaker.",
    domain: "network",
    technology: "network.resilience",
    provenance: {
      source: "yw51b-test-inline-injection",
      source_type: "external_documentation",
      source_url: null,
      authority_tier: "TIER_1",
      retrieved_at: "2026-09-07T00:00:00.000Z",
      evidence_pointer: "yw51b-test-inline",
      observed_by: "system",
    },
    verification_status: "VERIFIED",
    confidence: 0.9,
    content_hash: "hash_yw51b_test",
    created_at: "2026-09-07T00:00:00.000Z",
  };
}

describe("Y-W5-1-b · A/B harness · mechanism", () => {
  it("runABEvaluation produces a BEFORE and AFTER run against the same frozen corpus", () => {
    const corpus = tinyCorpus();
    const injected = tinyInjectedKnowledge();
    const res = runABEvaluation({ corpus, injected_knowledge: injected, candidate_id: "cand_yw51b_test" });
    try {
      expect(res.before.results.length).toBe(corpus.case_count);
      expect(res.after.results.length).toBe(corpus.case_count);
      // Same corpus · same case ids across BEFORE/AFTER
      const beforeIds = new Set(res.before.results.map((r) => r.case_id));
      const afterIds = new Set(res.after.results.map((r) => r.case_id));
      expect(beforeIds).toEqual(afterIds);
    } finally { res.cleanup(); }
  });
});

describe("Y-W5-1-b · A/B harness · production isolation", () => {
  it("global knowledge.jsonl bytes are unchanged before and after the A/B run", () => {
    const corpus = tinyCorpus();
    const res = runABEvaluation({ corpus, injected_knowledge: tinyInjectedKnowledge(), candidate_id: "cand_yw51b_test" });
    try {
      expect(res.global_knowledge_bytes).toBe(res.global_knowledge_bytes_post);
    } finally { res.cleanup(); }
  });

  it("BEFORE and AFTER knowledge stores are in distinct temp dirs", () => {
    const corpus = tinyCorpus();
    const res = runABEvaluation({ corpus, injected_knowledge: tinyInjectedKnowledge(), candidate_id: "cand_yw51b_test" });
    try {
      expect(res.before_root).not.toBe(res.after_root);
      expect(res.before_root).toContain("nex-yw51b-before");
      expect(res.after_root).toContain("nex-yw51b-after");
    } finally { res.cleanup(); }
  });
});

describe("Y-W5-1-b · A/B harness · delta + attribution", () => {
  it("delta computation matches manual per-case comparison and is causally attributable", () => {
    const corpus = tinyCorpus();
    const injected = tinyInjectedKnowledge();
    const res = runABEvaluation({ corpus, injected_knowledge: injected, candidate_id: "cand_yw51b_test" });
    try {
      const delta = computeABDelta(res);
      expect(delta.per_case.length).toBe(corpus.case_count);
      // The defective network case should improve (WRONG_TO_CORRECT)
      const t01 = delta.per_case.find((p) => p.case_id === "yw51b_t01")!;
      expect(t01.transition).toBe("WRONG_TO_CORRECT");
      // The non-network CORRECT case should remain unchanged (negative control)
      const t02 = delta.per_case.find((p) => p.case_id === "yw51b_t02")!;
      expect(t02.transition).toBe("unchanged");

      // Attribution proof: the improved case's AFTER response includes the injected knowledge_id in knowledge_used
      const attribution = computeAttribution(res, delta);
      const t01Attr = attribution.find((a) => a.case_id === "yw51b_t01")!;
      expect(t01Attr.attribution_ok).toBe(true);
      expect(t01Attr.attribution_source).toContain("know_yw51b_test_inject");
    } finally { res.cleanup(); }
  });
});
