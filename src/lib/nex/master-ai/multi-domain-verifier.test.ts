// src/lib/nex/master-ai/multi-domain-verifier.test.ts
//
// Phase 8 · Multi-domain intelligence · contract tests
// Runs 3 real domains through the verifier and asserts:
//   1. Each domain improves under its own injection (mechanism works)
//   2. Zero cross-contamination across every off-diagonal pair
//
// Uses REAL corpora + REAL candidates from Phase 1/2/4 — no fabrication.

import { describe, it, expect } from "vitest";
import { verifyMultiDomain } from "./multi-domain-verifier";
import { freezeNetworkResilienceCorpusV1, CANDIDATE_PROPOSED_KNOWLEDGE_ID } from "@/lib/nex/programmer-benchmark/corpus-network-resilience-v1";
import { freezeP2SecInputValCorpus, PHASE2_SKILL_ID } from "@/lib/nex/programmer-benchmark/corpus-phase2-security-input-validation";
import { freezePhase4Corpus, phase4TaughtKnowledgePayload } from "@/lib/nex/agents/nex-speaking/corpus-phase4";
import { evaluateCorpus } from "@/lib/nex/programmer-benchmark/evaluator";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";
import type { KnowledgeItem, SkillItem } from "@/lib/nex/programmer-learning/types";

// ─── Real candidates per domain ─────────────────────────

function networkCandidate(): KnowledgeItem {
  return {
    knowledge_id: CANDIDATE_PROPOSED_KNOWLEDGE_ID,
    statement: "For failure mode 'internet_offline_or_unknown' the network client must include timeout with a bounded budget and must include retry with exponential backoff and jitter and must include circuit breaker that opens after N consecutive failures and must include fail closed on repeated failures and must include heartbeat health check discipline separating currently unavailable from permanently degraded.",
    domain: "network",
    technology: "network.resilience",
    provenance: {
      source: "phase8_multi_domain_hypothetical",
      source_type: "external_documentation",
      source_url: null,
      authority_tier: "TIER_1",
      retrieved_at: new Date().toISOString(),
      evidence_pointer: "candidate:cand_d032110b · simulated VERIFIED for A/B measurement · not promotion",
      observed_by: "system",
    },
    verification_status: "VERIFIED",
    confidence: 0.9,
    content_hash: "phase8_network",
    created_at: new Date().toISOString(),
  };
}

function securitySkill(): SkillItem {
  return {
    skill_id: PHASE2_SKILL_ID,
    name: "validate untrusted input against allowlist",
    domain: "security",
    description: "The skill of validating untrusted input by matching against an allowlist rather than a blocklist.",
    verification_recipe: "Skill requires the implementation must include allowlist matching and must include reject unknown inputs.",
    confidence: 0.9,
    promotion_state: "VERIFIED",
    supporting_experiences: [],
    created_at: new Date().toISOString(),
  };
}

describe("Phase 8 · Multi-domain intelligence · verifyMultiDomain", () => {
  // Freeze corpora once
  const netCorpus = freezeNetworkResilienceCorpusV1().corpus;
  const secCorpus = freezeP2SecInputValCorpus().corpus;
  const spkCorpus = freezePhase4Corpus().corpus;

  const injections = [
    { domain_label: "network", knowledge_items: [networkCandidate()] },
    { domain_label: "security", skill_items: [securitySkill()] },
    { domain_label: "speaking.life_safety", knowledge_items: [phase4TaughtKnowledgePayload()] },
  ];
  const benchmarks = [
    {
      domain_label: "network",
      corpus: netCorpus,
      case_count: netCorpus.case_count,
      evaluate: () => evaluateCorpus(netCorpus).results.filter((r) => r.match_status === "CORRECT").length,
    },
    {
      domain_label: "security",
      corpus: secCorpus,
      case_count: secCorpus.case_count,
      evaluate: () => evaluateCorpus(secCorpus).results.filter((r) => r.match_status === "CORRECT").length,
    },
    {
      domain_label: "speaking.life_safety",
      corpus: spkCorpus,
      case_count: spkCorpus.case_count,
      evaluate: () => evaluateSpeakingCorpus(spkCorpus).results.filter((r) => r.match_status === "CORRECT").length,
    },
  ];

  it("each domain independently improves under its own injection", () => {
    const v = verifyMultiDomain(injections, benchmarks);
    // Compute baseline (empty store) counts from cross-contamination matrix
    const baselineNet = v.cross_contamination_matrix.find((c) => c.benchmark_domain === "network")?.baseline_passed ?? 0;
    const baselineSec = v.cross_contamination_matrix.find((c) => c.benchmark_domain === "security")?.baseline_passed ?? 0;
    const baselineSpk = v.cross_contamination_matrix.find((c) => c.benchmark_domain === "speaking.life_safety")?.baseline_passed ?? 0;

    const netResult = v.own_domain_results.find((r) => r.domain_label === "network")!;
    const secResult = v.own_domain_results.find((r) => r.domain_label === "security")!;
    const spkResult = v.own_domain_results.find((r) => r.domain_label === "speaking.life_safety")!;

    expect(netResult.passed).toBeGreaterThan(baselineNet);
    expect(secResult.passed).toBeGreaterThan(baselineSec);
    expect(spkResult.passed).toBeGreaterThan(baselineSpk);
  });

  it("zero cross-contamination: every off-diagonal pair produces delta = 0", () => {
    const v = verifyMultiDomain(injections, benchmarks);
    // Expect 6 off-diagonal cells (3 domains × 2 others)
    expect(v.cross_contamination_matrix.length).toBe(6);
    for (const cell of v.cross_contamination_matrix) {
      expect(cell.delta, `injection=${cell.injection_domain} → benchmark=${cell.benchmark_domain} produced delta ${cell.delta} (baseline ${cell.baseline_passed} · with-injection ${cell.with_injection_passed})`).toBe(0);
      expect(cell.is_leakage).toBe(false);
    }
    expect(v.any_leakage_detected).toBe(false);
    expect(v.leakage_details).toEqual([]);
  });
});
