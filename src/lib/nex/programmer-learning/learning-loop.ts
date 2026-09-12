// src/lib/nex/programmer-learning/learning-loop.ts
//
// NEX Programmer Agent · Phase B · Learning-loop orchestrator
// Philip 2026-09-05 · AUTHORIZE · PHASE B
//
// Ties Phase A stores + Phase B verifier + Phase B application harness
// into the full lifecycle:
//
//   CAPABILITY GAP → LEARNING QUESTION → SOURCE DISCOVERY →
//   AUTHORITATIVE SOURCE → EVIDENCE CAPTURE → CANDIDATE KNOWLEDGE →
//   INDEPENDENT VERIFICATION → VERIFIED KNOWLEDGE → SKILL DERIVATION →
//   SAFE APPLICATION → EXPERIENCE → LESSON → RETRIEVABLE NEX LEARNING
//
// Every stage records evidence. No stage self-declares health.
// LearningRun.final_status always null (Op-Truth §OP.5).

import {
  appendLearningRun,
  generateId,
  newProvenance,
  readKnowledge,
} from "./store";
import {
  captureEngineeringEvent,
  captureSkill,
  ingestExternalSource,
} from "./ingestion";
import {
  verifyKnowledge,
} from "./verification";
import type {
  AuthorityTier,
  KnowledgeItem,
  LearningRun,
  SkillItem,
  SkillPromotionState,
  Provenance,
} from "./types";
import type { VerificationEvidence } from "./independent-verifier";

// ─── Learning question ──────────────────────────────────────────
//
// A learning question is a bounded, technically-testable question tied
// to an engineering capability gap. §4 rejects vague forms like "Learn
// Node.js" — the validator enforces bounded structure at creation time.

export type LearningQuestion = {
  question_id: string;
  gap_statement: string;      // "NEX doesn't have proven knowledge of X"
  question: string;           // the bounded, testable question
  technology: string;
  domain: string;
  scope_bound: string;        // one-sentence description of the boundary
  testable_via: "subprocess_probe" | "deterministic_test" | "cross_source" | "mixed";
  created_at: string;
};

export type NewLearningQuestionInput = Omit<LearningQuestion, "question_id" | "created_at">;

/** Validate and create a LearningQuestion. Throws on vague inputs. */
export function newLearningQuestion(input: NewLearningQuestionInput): LearningQuestion {
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount(input.question) < 6) {
    throw new Error("newLearningQuestion: question too short · needs at least 6 words · reject vague forms like 'Learn X'");
  }
  if (!input.technology?.trim()) throw new Error("newLearningQuestion: technology required");
  if (!input.domain?.trim()) throw new Error("newLearningQuestion: domain required");
  if (!input.scope_bound?.trim()) throw new Error("newLearningQuestion: scope_bound required");
  if (!/\?$/.test(input.question.trim())) {
    throw new Error("newLearningQuestion: question must end with '?' — bounded interrogative form");
  }
  return {
    ...input,
    question_id: generateId("run"),
    created_at: new Date().toISOString(),
  };
}

// ─── Source authority helpers ───────────────────────────────────

/** Preferred authority tier per source (per §5). */
export function authorityTierForUrl(url: string): AuthorityTier {
  if (!url) return "TIER_5";
  const lower = url.toLowerCase();
  // Tier 1: official language/runtime/framework docs, standards bodies
  if (/^https?:\/\/(www\.)?(nodejs\.org|typescriptlang\.org|postgresql\.org|w3\.org|whatwg\.org|developer\.mozilla\.org|owasp\.org|ietf\.org|rfc-editor\.org)\b/i.test(lower)) return "TIER_1";
  // Tier 2: official project repositories / recognized specifications
  if (/^https?:\/\/(github\.com\/(microsoft|nodejs|postgres|whatwg|w3c|torvalds|openai)\/[^/]+)\b/i.test(lower)) return "TIER_2";
  // Tier 3: reputable secondary technical sources
  if (/^https?:\/\/(www\.)?(stackoverflow\.com|developer\.chrome\.com|web\.dev)\b/i.test(lower)) return "TIER_3";
  return "TIER_4";
}

// ─── Skill promotion (per §10 · §18-D §18-E) ────────────────────

/** Rules for promoting a Skill:
 *   OBSERVED  → PRACTICED  requires ≥1 supporting_experiences with outcome ∈ {success, partial_success}
 *   PRACTICED → VERIFIED   requires ≥1 supporting_experiences AND all knowledge_dependencies VERIFIED
 *  Never auto-promotes. Caller must invoke this explicitly with the
 *  intended target state. Returns the promoted state (or the input's
 *  current state if promotion is refused with reason). */
export type SkillPromotionAttempt =
  | { promoted: true; new_state: SkillPromotionState; reason: string }
  | { promoted: false; current_state: SkillPromotionState; reason: string };

export function attemptSkillPromotion(input: {
  skill: SkillItem;
  target_state: SkillPromotionState;
  supporting_experiences: string[];
  knowledge_dependencies: KnowledgeItem[];
}): SkillPromotionAttempt {
  const { skill, target_state, supporting_experiences, knowledge_dependencies } = input;
  const ranks: Record<SkillPromotionState, number> = { OBSERVED: 0, PRACTICED: 1, VERIFIED: 2 };
  if (ranks[target_state] < ranks[skill.promotion_state]) {
    return { promoted: false, current_state: skill.promotion_state, reason: `refuse_demotion: target ${target_state} < current ${skill.promotion_state}` };
  }
  if (target_state === "PRACTICED") {
    if (supporting_experiences.length < 1) {
      return { promoted: false, current_state: skill.promotion_state, reason: "cannot_promote_to_PRACTICED: requires >=1 supporting experience (§10.3)" };
    }
    return { promoted: true, new_state: "PRACTICED", reason: `promoted_to_PRACTICED: ${supporting_experiences.length} supporting experience(s)` };
  }
  if (target_state === "VERIFIED") {
    if (supporting_experiences.length < 1) {
      return { promoted: false, current_state: skill.promotion_state, reason: "cannot_promote_to_VERIFIED: requires >=1 supporting experience (§18-E)" };
    }
    const unverifiedDeps = knowledge_dependencies.filter((k) => k.verification_status !== "VERIFIED");
    if (unverifiedDeps.length > 0) {
      return { promoted: false, current_state: skill.promotion_state, reason: `cannot_promote_to_VERIFIED: ${unverifiedDeps.length} unverified knowledge_dependencies (§18-D)` };
    }
    return { promoted: true, new_state: "VERIFIED", reason: `promoted_to_VERIFIED: all knowledge deps VERIFIED + ${supporting_experiences.length} supporting experience(s)` };
  }
  if (target_state === "OBSERVED") {
    return { promoted: true, new_state: "OBSERVED", reason: "no-op: already observed" };
  }
  return { promoted: false, current_state: skill.promotion_state, reason: `unknown_target: ${target_state}` };
}

// ─── Verification bridge · verifier evidence → knowledge promotion ─

/** Bridge Phase-B independent-verifier evidence into Phase-A
 *  verifyKnowledge, which appends a NEW record at VERIFIED (or REJECTED)
 *  with the verification's evidence_pointer. Enforces:
 *   · passed=true → status VERIFIED
 *   · passed=false → status REJECTED (rejection = valid outcome, not silent)
 *   · self-reference guard already enforced in Phase A verifyKnowledge */
export function applyVerificationToKnowledge(input: {
  candidate: KnowledgeItem;
  verification: VerificationEvidence;
  reason?: string;
}): KnowledgeItem {
  const newStatus = input.verification.passed ? "VERIFIED" : "REJECTED";
  return verifyKnowledge({
    knowledge_id: input.candidate.knowledge_id,
    new_status: newStatus,
    independent_evidence_pointer: input.verification.evidence_pointer,
    independent_evidence_source: `verifier:${input.verification.method}`,
    reason: input.reason ?? `${input.verification.method} → ${newStatus} · ${input.verification.observed_output.slice(0, 120)}`,
  });
}

// ─── LearningRun lifecycle ──────────────────────────────────────

export type LearningRunBuilder = {
  run: LearningRun;
  addEvent(pointer: string): void;
  count(counter: keyof Pick<LearningRun, "events_captured" | "knowledge_ingested" | "skills_touched" | "experiences_created" | "external_sources_read">, by?: number): void;
  addError(message: string): void;
  complete(): LearningRun;
};

export function newLearningRun(question: LearningQuestion): LearningRunBuilder {
  const run: LearningRun = {
    run_id: generateId("run"),
    started_at: new Date().toISOString(),
    completed_at: null,
    triggered_by: "manual",
    events_captured: 0,
    knowledge_ingested: 0,
    skills_touched: 0,
    experiences_created: 0,
    external_sources_read: 0,
    errors: [],
    evidence_pointers: [`question:${question.question_id}:${question.question.slice(0, 80)}`],
    final_status: null,
  };
  return {
    run,
    addEvent(pointer: string) { run.evidence_pointers.push(pointer); },
    count(counter, by = 1) { (run as unknown as Record<string, number>)[counter] += by; },
    addError(message: string) { run.errors.push(message.slice(0, 500)); },
    complete() {
      run.completed_at = new Date().toISOString();
      appendLearningRun(run);
      return run;
    },
  };
}

// ─── Convenience: ingest + verify + capture events end-to-end ──

/** One-shot pipeline for a single knowledge item:
 *   ingestExternalSource → captureEvent(candidate) → verify → apply to knowledge.
 *  Callers wanting more control should compose these steps individually. */
export async function researchAndVerifyKnowledge(input: {
  url: string;
  source_title: string;
  technology: string;
  domain: string;
  statement: string;
  raw_content: string;
  verification: VerificationEvidence;
  run: LearningRunBuilder;
}): Promise<{ candidate: KnowledgeItem; verified: KnowledgeItem; verified_passed: boolean }> {
  const tier = authorityTierForUrl(input.url);
  const ingest = ingestExternalSource({
    url: input.url,
    source_title: input.source_title,
    authority_tier: tier,
    technology: input.technology,
    domain: input.domain,
    statement: input.statement,
    raw_content: input.raw_content,
    content_type: "text/markdown",
  });
  input.run.count("external_sources_read", 1);
  input.run.count("knowledge_ingested", 1);
  input.run.count("events_captured", 1);
  input.run.addEvent(`ingest:${ingest.knowledge.knowledge_id}`);

  const verifiedEvent = captureEngineeringEvent({
    kind: "verification",
    description: `Independent verification via ${input.verification.method} · candidate=${input.statement.slice(0, 80)}`,
    source: `verifier:${input.verification.method}`,
    source_type: "internal_artifact",
    evidence_pointer: input.verification.evidence_pointer,
    project: "nex",
    task: `verify:${input.technology}`,
    status: input.verification.passed ? "VERIFIED" : "REJECTED",
    meta: {
      verification_id: input.verification.verification_id,
      passed: input.verification.passed,
      duration_ms: input.verification.duration_ms,
    },
  });
  input.run.count("events_captured", 1);
  input.run.addEvent(`verification_event:${verifiedEvent.event_id}`);

  const verified = applyVerificationToKnowledge({
    candidate: ingest.knowledge,
    verification: input.verification,
  });
  input.run.count("knowledge_ingested", 1);
  input.run.addEvent(`verified_knowledge:${verified.knowledge_id}:${verified.verification_status}`);

  return { candidate: ingest.knowledge, verified, verified_passed: input.verification.passed };
}

// ─── Convenience: derive + persist a skill after knowledge is VERIFIED ─

export function deriveSkill(input: {
  name: string;
  domain: string;
  description: string;
  knowledge_dependencies: KnowledgeItem[];
  verification_recipe?: string;
  benchmark_reference?: string;
  run: LearningRunBuilder;
}): SkillItem {
  const knowledgeIds = input.knowledge_dependencies.map((k) => k.knowledge_id);
  const skill = captureSkill({
    name: input.name,
    domain: input.domain,
    description: input.description,
    knowledge_dependencies: knowledgeIds,
    verification_recipe: input.verification_recipe,
    benchmark_reference: input.benchmark_reference,
    promotion_state: "OBSERVED",
  });
  input.run.count("skills_touched", 1);
  input.run.addEvent(`skill_derived:${skill.skill_id}:OBSERVED`);
  return skill;
}

// ─── Convenience: promote skill after successful application ────

export function promoteSkillAfterApplication(input: {
  skill: SkillItem;
  supporting_experience_id: string;
  knowledge_dependencies: KnowledgeItem[];
  target_state: SkillPromotionState;
  run: LearningRunBuilder;
}): { attempt: SkillPromotionAttempt; new_skill_record?: SkillItem } {
  const attempt = attemptSkillPromotion({
    skill: input.skill,
    target_state: input.target_state,
    supporting_experiences: [input.supporting_experience_id],
    knowledge_dependencies: input.knowledge_dependencies,
  });
  if (!attempt.promoted) {
    input.run.addEvent(`skill_promotion_refused:${input.skill.skill_id}:${attempt.reason}`);
    return { attempt };
  }
  // Append a NEW skill record with the promoted state · append-only discipline
  const promoted = captureSkill({
    name: input.skill.name,
    domain: input.skill.domain,
    description: input.skill.description,
    knowledge_dependencies: input.skill.knowledge_dependencies,
    verification_recipe: input.skill.verification_recipe,
    benchmark_reference: input.skill.benchmark_reference,
    promotion_state: attempt.new_state,
    supporting_experiences: [input.supporting_experience_id, ...(input.skill.supporting_experiences ?? [])],
  });
  input.run.count("skills_touched", 1);
  input.run.addEvent(`skill_promoted:${promoted.skill_id}:${attempt.new_state}`);
  return { attempt, new_skill_record: promoted };
}

// ─── Retrieval helper for fresh-context reuse ────────────────────

/** Given a technology + optional statement fragment, return the current
 *  best-known verified knowledge (latest record wins). Used by the
 *  fresh-context retrieval runner to demonstrate learning survives. */
export function retrieveLatestVerifiedKnowledgeByTechnology(
  technology: string,
  statementContains?: string,
): KnowledgeItem | null {
  const candidates = readKnowledge()
    .filter((k) => k.technology === technology)
    .filter((k) => k.verification_status === "VERIFIED")
    .filter((k) => !statementContains || k.statement.toLowerCase().includes(statementContains.toLowerCase()));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return candidates[0];
}

// Re-export provenance helper for callers.
export { newProvenance };
export type { Provenance };
