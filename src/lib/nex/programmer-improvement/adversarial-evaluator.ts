// src/lib/nex/programmer-improvement/adversarial-evaluator.ts
//
// Phase 9 · Independent evaluation · adversarial audit for improvement claims
// Philip 2026-09-08 · AUTHORIZE Phase 9
//
// Given a claim of the form "candidate X improved corpus Y by Δ", this
// module re-evaluates the claim under 5 deterministic mutations and
// reports whether the original claim SURVIVES each mutation.
//
// The mutations are chosen to test ORTHOGONAL properties of a robust
// improvement:
//
//   M1 · case-order-reverse       → delta must be identical
//                                    (verifies evaluator is stateless)
//   M2 · irrelevant-knowledge     → delta must be unchanged
//                                    (verifies domain-relevance gates hold)
//   M3 · extra-evidence-in-req    → delta must be unchanged
//                                    (verifies improvement isn't fragile
//                                     to neutral filler text in requests)
//   M4 · verification-downgrade   → delta must be 0
//                                    (verifies VERIFIED gate holds:
//                                     downgrading to UNVERIFIED should
//                                     silence the taught knowledge)
//   M5 · confidence-downgrade     → delta must be 0
//                                    (verifies confidence gate holds:
//                                     0.5 confidence should not fire)
//
// A claim that survives all 5 mutations = ROBUST.
// A claim that fails M1/M2/M3 = FRAGILE (still may be genuine but not
//                                          robust to adversarial perturbation).
// A claim that fails M4/M5 = GATE_BROKEN (safety architecture violation).

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { KnowledgeItem, SkillItem } from "@/lib/nex/programmer-learning/types";

// ─── Types ──────────────────────────────────────────────────────

export type AdversarialClaim = {
  claim_id: string;
  candidate_id: string;
  candidate_kind: "knowledge" | "skill" | "experience";
  domain_label: string;
  original_delta: number;
  /** Function that runs the corpus against a knowledge-store directory
   *  and returns the number of cases that passed. The evaluator MUST
   *  respect NEX_PROGRAMMER_LEARNING_DIR so the harness can inject
   *  mutated stores per mutation. */
  evaluate: (rootDir: string, opts?: { extra_summary_prefix?: string; reverse_case_order?: boolean }) => number;
  /** The original injection that produced the delta. Mutations modify a
   *  COPY of this · never the original. */
  original_knowledge?: KnowledgeItem;
  original_skill?: SkillItem;
  /** Baseline pass count with an empty store · used to compute delta
   *  under each mutation. */
  baseline_passed: number;
};

export type MutationResult = {
  mutation_id: string;
  description: string;
  expected_delta: number;
  observed_delta: number;
  survived: boolean;
  interpretation: string;
};

export type AdversarialAudit = {
  claim_id: string;
  candidate_id: string;
  domain_label: string;
  original_delta: number;
  mutations: MutationResult[];
  overall_verdict: "ROBUST" | "FRAGILE" | "GATE_BROKEN";
  reasons: string[];
  generated_at_iso: string;
};

// ─── Helpers ──────────────────────────────────────────────

function tempStore(): string {
  const d = mkdtempSync(path.join(tmpdir(), "nex-p9-adv-"));
  mkdirSync(d, { recursive: true });
  return d;
}

function writeStore(dir: string, opts: { knowledge?: KnowledgeItem[]; skills?: SkillItem[] }): void {
  if (opts.knowledge && opts.knowledge.length > 0) {
    writeFileSync(path.join(dir, "knowledge.jsonl"), opts.knowledge.map((k) => JSON.stringify(k)).join("\n") + "\n", "utf8");
  }
  if (opts.skills && opts.skills.length > 0) {
    writeFileSync(path.join(dir, "skills.jsonl"), opts.skills.map((s) => JSON.stringify(s)).join("\n") + "\n", "utf8");
  }
}

function runWithStore(rootDir: string, evaluate: () => number): number {
  const prior = process.env.NEX_PROGRAMMER_LEARNING_DIR;
  process.env.NEX_PROGRAMMER_LEARNING_DIR = rootDir;
  try {
    return evaluate();
  } finally {
    if (prior === undefined) delete process.env.NEX_PROGRAMMER_LEARNING_DIR;
    else process.env.NEX_PROGRAMMER_LEARNING_DIR = prior;
  }
}

// Deterministic irrelevant knowledge items for M2 (never match any real domain)
function irrelevantKnowledgeSet(): KnowledgeItem[] {
  return [
    {
      knowledge_id: "adv_irrelevant_astronomy",
      statement: "PATTERNS: [\"\\\\bandromeda\\\\s+galaxy\\\\b\", \"\\\\bmust\\\\s+include\\\\s+telescope\\\\s+aperture\\\\b\"]",
      domain: "astronomy",
      technology: "astronomy.observation",
      provenance: { source: "adv_test_irrelevant", source_type: "external_documentation", source_url: null, authority_tier: "TIER_3", retrieved_at: new Date().toISOString(), evidence_pointer: "adv_test", observed_by: "system" },
      verification_status: "VERIFIED",
      confidence: 0.9,
      content_hash: "adv_irrelevant_1",
      created_at: new Date().toISOString(),
    },
    {
      knowledge_id: "adv_irrelevant_cuisine",
      statement: "PATTERNS: [\"\\\\bmust\\\\s+include\\\\s+chopsticks\\\\b\", \"\\\\bmust\\\\s+include\\\\s+tempura\\\\b\"]",
      domain: "cuisine",
      technology: "cuisine.japanese",
      provenance: { source: "adv_test_irrelevant", source_type: "external_documentation", source_url: null, authority_tier: "TIER_3", retrieved_at: new Date().toISOString(), evidence_pointer: "adv_test", observed_by: "system" },
      verification_status: "VERIFIED",
      confidence: 0.9,
      content_hash: "adv_irrelevant_2",
      created_at: new Date().toISOString(),
    },
    {
      knowledge_id: "adv_irrelevant_geology",
      statement: "For plate tectonics the analysis must include subduction zone identification.",
      domain: "geology",
      technology: "geology.plate_tectonics",
      provenance: { source: "adv_test_irrelevant", source_type: "external_documentation", source_url: null, authority_tier: "TIER_3", retrieved_at: new Date().toISOString(), evidence_pointer: "adv_test", observed_by: "system" },
      verification_status: "VERIFIED",
      confidence: 0.9,
      content_hash: "adv_irrelevant_3",
      created_at: new Date().toISOString(),
    },
  ];
}

function withMutatedKnowledge(k: KnowledgeItem, patch: Partial<KnowledgeItem>): KnowledgeItem {
  return { ...k, ...patch };
}
function withMutatedSkill(s: SkillItem, patch: Partial<SkillItem>): SkillItem {
  return { ...s, ...patch };
}

// ─── The adversarial audit ─────────────────────────────────

export function runAdversarialAudit(claim: AdversarialClaim): AdversarialAudit {
  const mutations: MutationResult[] = [];
  const roots: string[] = [];
  try {
    const injectionKnowledge = claim.original_knowledge ? [claim.original_knowledge] : undefined;
    const injectionSkill = claim.original_skill ? [claim.original_skill] : undefined;

    // Sanity: confirm the claim's original delta reproduces
    const originalRoot = tempStore(); roots.push(originalRoot);
    writeStore(originalRoot, { knowledge: injectionKnowledge, skills: injectionSkill });
    const originalPassed = runWithStore(originalRoot, () => claim.evaluate(originalRoot));
    const originalObservedDelta = originalPassed - claim.baseline_passed;

    // M1 · case-order-reverse
    {
      const root = tempStore(); roots.push(root);
      writeStore(root, { knowledge: injectionKnowledge, skills: injectionSkill });
      const reversedPassed = runWithStore(root, () => claim.evaluate(root, { reverse_case_order: true }));
      const observedDelta = reversedPassed - claim.baseline_passed;
      const survived = observedDelta === claim.original_delta;
      mutations.push({
        mutation_id: "M1_case_order_reverse",
        description: "Reverse the corpus case order · evaluator must be stateless · delta identical",
        expected_delta: claim.original_delta,
        observed_delta: observedDelta,
        survived,
        interpretation: survived ? "PASS · evaluator is stateless" : "FAIL · case order affects result · evaluator has hidden state",
      });
    }

    // M2 · irrelevant-knowledge injection (add unrelated knowledge alongside)
    {
      const root = tempStore(); roots.push(root);
      const combined = [
        ...(injectionKnowledge ?? []),
        ...irrelevantKnowledgeSet(),
      ];
      writeStore(root, { knowledge: combined, skills: injectionSkill });
      const combinedPassed = runWithStore(root, () => claim.evaluate(root));
      const observedDelta = combinedPassed - claim.baseline_passed;
      const survived = observedDelta === claim.original_delta;
      mutations.push({
        mutation_id: "M2_irrelevant_knowledge",
        description: "Inject 3 irrelevant knowledge items in unrelated domains · delta must not shift",
        expected_delta: claim.original_delta,
        observed_delta: observedDelta,
        survived,
        interpretation: survived ? "PASS · domain-relevance gates hold under irrelevant-knowledge noise" : "FAIL · irrelevant knowledge affects verdicts · domain gates too loose",
      });
    }

    // M3 · extra-evidence-in-request prefix
    {
      const root = tempStore(); roots.push(root);
      writeStore(root, { knowledge: injectionKnowledge, skills: injectionSkill });
      const filler = "This module was written on 2026-09-08 and reviewed by 3 engineers using idiomatic patterns and passing linter checks. ";
      const passed = runWithStore(root, () => claim.evaluate(root, { extra_summary_prefix: filler }));
      const observedDelta = passed - claim.baseline_passed;
      const survived = observedDelta === claim.original_delta;
      mutations.push({
        mutation_id: "M3_extra_evidence_prefix",
        description: "Prepend neutral filler text to every request summary · delta must not shift",
        expected_delta: claim.original_delta,
        observed_delta: observedDelta,
        survived,
        interpretation: survived ? "PASS · improvement is not fragile to neutral surface features" : "FAIL · verdicts shifted from added-but-neutral text · fragile to surface features",
      });
    }

    // M4 · verification-gate downgrade
    let m4Survived = true;
    {
      const root = tempStore(); roots.push(root);
      const downgradedK = injectionKnowledge?.map((k) => withMutatedKnowledge(k, { verification_status: "DISCOVERED" }));
      const downgradedS = injectionSkill?.map((s) => withMutatedSkill(s, { promotion_state: "PRACTICED" }));
      writeStore(root, { knowledge: downgradedK, skills: downgradedS });
      const passed = runWithStore(root, () => claim.evaluate(root));
      const observedDelta = passed - claim.baseline_passed;
      m4Survived = observedDelta === 0;
      mutations.push({
        mutation_id: "M4_verification_downgrade",
        description: "Downgrade knowledge verification (VERIFIED→DISCOVERED · VERIFIED→PRACTICED) · delta must be 0 (gate holds)",
        expected_delta: 0,
        observed_delta: observedDelta,
        survived: m4Survived,
        interpretation: m4Survived ? "PASS · verification gate holds · unverified knowledge is silent" : "FAIL · unverified knowledge affects verdicts · GATE_BROKEN",
      });
    }

    // M5 · confidence-gate downgrade
    let m5Survived = true;
    {
      const root = tempStore(); roots.push(root);
      const downgradedK = injectionKnowledge?.map((k) => withMutatedKnowledge(k, { confidence: 0.5 }));
      const downgradedS = injectionSkill?.map((s) => withMutatedSkill(s, { confidence: 0.5 }));
      writeStore(root, { knowledge: downgradedK, skills: downgradedS });
      const passed = runWithStore(root, () => claim.evaluate(root));
      const observedDelta = passed - claim.baseline_passed;
      m5Survived = observedDelta === 0;
      mutations.push({
        mutation_id: "M5_confidence_downgrade",
        description: "Drop confidence to 0.5 · below 0.7 threshold · delta must be 0 (gate holds)",
        expected_delta: 0,
        observed_delta: observedDelta,
        survived: m5Survived,
        interpretation: m5Survived ? "PASS · confidence gate holds · low-confidence knowledge is silent" : "FAIL · low-confidence knowledge affects verdicts · GATE_BROKEN",
      });
    }

    // Overall verdict
    const anyFail = mutations.some((m) => !m.survived);
    const m4m5Failed = !m4Survived || !m5Survived;
    let verdict: AdversarialAudit["overall_verdict"];
    const reasons: string[] = [];
    if (m4m5Failed) {
      verdict = "GATE_BROKEN";
      reasons.push("verification and/or confidence gate failed · safety architecture violation");
    } else if (anyFail) {
      verdict = "FRAGILE";
      reasons.push("improvement did not survive one or more perturbation checks (M1/M2/M3) · verdict downgraded from IMPROVED to UNCERTAIN");
      for (const m of mutations) if (!m.survived) reasons.push(`- ${m.mutation_id}: ${m.interpretation}`);
    } else {
      verdict = "ROBUST";
      reasons.push(`survived all ${mutations.length} adversarial perturbations · original delta ${claim.original_delta} reproduced across all mutation dimensions`);
    }
    // Sanity check: if the observed original doesn't match the reported delta, note it
    if (originalObservedDelta !== claim.original_delta) {
      reasons.push(`NOTE: reproducing the claim itself yielded delta ${originalObservedDelta} (reported ${claim.original_delta}) · claim was not reproducible even before mutations`);
    }

    return {
      claim_id: claim.claim_id,
      candidate_id: claim.candidate_id,
      domain_label: claim.domain_label,
      original_delta: claim.original_delta,
      mutations,
      overall_verdict: verdict,
      reasons,
      generated_at_iso: new Date().toISOString(),
    };
  } finally {
    for (const r of roots) {
      try { rmSync(r, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
