// src/lib/nex/programmer-improvement/candidate.ts
//
// NEX Programmer Agent · Phase F · learning-candidate factory + validators
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §6 §9 §17 §22 §23
//
// This module owns:
//   · createCandidate         · deterministic candidate construction
//   · validateCandidate       · evidence sufficiency (§6)
//   · isDuplicateCandidate    · dedup guard (§23)
//   · advanceLifecycle        · state-machine transitions (§9)
//
// It has NO side effects and NO IO. Persistence lives in history.ts.
// Evaluation lives in evaluator-adapter.ts. Promotion lives in promoter.ts.
// This separation preserves §22 anti-self-reinforcement — creation cannot
// influence promotion.

import { createHash, randomUUID } from "node:crypto";
import type {
  CandidateStatus,
  CandidateKind,
  LearningCandidate,
} from "./types";
import { CANDIDATE_LIFECYCLE_ORDER, CANDIDATE_FAILURE_STATUSES } from "./types";
import type {
  KnowledgeItem,
  SkillItem,
  ExperienceItem,
  Provenance,
} from "@/lib/nex/programmer-learning/types";

// ─── Candidate content hashing ─────────────────────────────────

/** Deterministic content hash. Two candidates with identical semantic
 *  content produce the same hash regardless of created_at / id. */
export function candidateContentHash(input: {
  kind: CandidateKind;
  what_was_learned: string;
  affects_capability: string;
  proposed_knowledge?: KnowledgeItem;
  proposed_skill?: SkillItem;
  proposed_experience?: ExperienceItem;
  supporting_evidence: readonly string[];
}): string {
  const canonical = JSON.stringify({
    kind: input.kind,
    what: input.what_was_learned.trim(),
    affects: input.affects_capability.trim(),
    knowledge: input.proposed_knowledge
      ? {
          statement: input.proposed_knowledge.statement.trim(),
          domain: input.proposed_knowledge.domain.trim(),
          technology: input.proposed_knowledge.technology ?? null,
        }
      : null,
    skill: input.proposed_skill
      ? {
          name: input.proposed_skill.name.trim(),
          domain: input.proposed_skill.domain.trim(),
        }
      : null,
    experience: input.proposed_experience
      ? {
          task: input.proposed_experience.task.trim(),
          initial: input.proposed_experience.initial_hypothesis.trim(),
          action: input.proposed_experience.action_taken.trim(),
          outcome: input.proposed_experience.outcome,
        }
      : null,
    evidence: [...input.supporting_evidence].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

// ─── createCandidate ───────────────────────────────────────────

export type CreateCandidateInput = {
  kind: CandidateKind;
  source_event_id: string | null;
  what_was_learned: string;
  affects_capability: string;
  previous_state_id?: string | null;
  proposed_knowledge?: KnowledgeItem;
  proposed_skill?: SkillItem;
  proposed_experience?: ExperienceItem;
  supporting_evidence: readonly string[];
  meta?: Record<string, unknown>;
  provenance: Provenance;
  now?: string;                 // for deterministic test time
  candidate_id_override?: string;
};

/** Construct a LearningCandidate. Does not validate — call validateCandidate
 *  before advancing the lifecycle. §9 forbids OBSERVED→PROMOTED direct
 *  transitions, but createCandidate returns status="CANDIDATE" (not
 *  PROMOTED), so that rule is enforced by the state machine, not here. */
export function createCandidate(input: CreateCandidateInput): LearningCandidate {
  const created_at = input.now ?? new Date().toISOString();
  const content_hash = candidateContentHash(input);
  return {
    candidate_id: input.candidate_id_override ?? `cand_${randomUUID()}`,
    kind: input.kind,
    source_event_id: input.source_event_id,
    what_was_learned: input.what_was_learned,
    affects_capability: input.affects_capability,
    previous_state_id: input.previous_state_id ?? null,
    proposed_knowledge: input.proposed_knowledge,
    proposed_skill: input.proposed_skill,
    proposed_experience: input.proposed_experience,
    supporting_evidence: [...input.supporting_evidence],
    meta: input.meta,
    provenance: input.provenance,
    created_at,
    content_hash,
  };
}

// ─── validateCandidate (§6 evidence requirement) ───────────────

/** Result of candidate structural validation. Semantic validation
 *  (defect-class thresholds, drift analysis) lives in later stages. */
export type CandidateValidation =
  | { ok: true }
  | { ok: false; reason: "no_source_evidence" | "insufficient_evidence" | "kind_content_mismatch" | "provenance_missing"; detail: string };

export function validateCandidate(c: LearningCandidate): CandidateValidation {
  // §6 — must state source evidence
  if (c.source_event_id === null && c.supporting_evidence.length === 0) {
    return { ok: false, reason: "no_source_evidence", detail: "candidate has neither source_event_id nor supporting_evidence" };
  }
  if (c.supporting_evidence.length === 0) {
    return { ok: false, reason: "insufficient_evidence", detail: "supporting_evidence must be non-empty" };
  }
  // §4 — kind ↔ payload alignment
  const hasKnowledge = c.proposed_knowledge != null;
  const hasSkill = c.proposed_skill != null;
  const hasExperience = c.proposed_experience != null;
  const payloadCount = Number(hasKnowledge) + Number(hasSkill) + Number(hasExperience);
  if (payloadCount !== 1) {
    return { ok: false, reason: "kind_content_mismatch", detail: `expected exactly one proposed_* payload, got ${payloadCount}` };
  }
  if (c.kind === "knowledge" && !hasKnowledge) {
    return { ok: false, reason: "kind_content_mismatch", detail: "kind=knowledge but no proposed_knowledge" };
  }
  if (c.kind === "skill" && !hasSkill) {
    return { ok: false, reason: "kind_content_mismatch", detail: "kind=skill but no proposed_skill" };
  }
  if (c.kind === "experience" && !hasExperience) {
    return { ok: false, reason: "kind_content_mismatch", detail: "kind=experience but no proposed_experience" };
  }
  // Provenance sanity — must have a source label + tier + evidence pointer
  const p = c.provenance;
  if (!p || !p.source || !p.authority_tier || !p.evidence_pointer) {
    return { ok: false, reason: "provenance_missing", detail: "provenance requires source, authority_tier, evidence_pointer" };
  }
  return { ok: true };
}

// ─── isDuplicateCandidate (§23) ────────────────────────────────

/** True when a prior candidate carries the same content hash. Callers
 *  supply the priors list (usually read from history). Empty list → false. */
export function isDuplicateCandidate(candidate: LearningCandidate, priors: readonly LearningCandidate[]): boolean {
  return priors.some((p) => p.content_hash === candidate.content_hash && p.candidate_id !== candidate.candidate_id);
}

// ─── State machine (§9) ───────────────────────────────────────

/** Legal forward transitions. No status may transition backwards. No
 *  status may skip more than one step forward except into a failure
 *  state (which is always reachable from any active-lifecycle state). */
const LEGAL_TRANSITIONS: Record<CandidateStatus, readonly CandidateStatus[]> = {
  OBSERVED:     ["CANDIDATE", ...CANDIDATE_FAILURE_STATUSES],
  CANDIDATE:    ["EVALUATING", ...CANDIDATE_FAILURE_STATUSES],
  EVALUATING:   ["REVIEWED", ...CANDIDATE_FAILURE_STATUSES],
  REVIEWED:     ["BENCHMARKED", ...CANDIDATE_FAILURE_STATUSES],
  BENCHMARKED:  ["STABLE", ...CANDIDATE_FAILURE_STATUSES],
  STABLE:       ["PROMOTED", ...CANDIDATE_FAILURE_STATUSES],
  PROMOTED:     [],
  REJECTED:     [],
  CONFLICTED:   [],
  REGRESSED:    [],
  UNPROVEN:     [],
  FAILED:       [],
};

/** Enforce §9: no OBSERVED→PROMOTED shortcut. Returns null when the
 *  transition is illegal so callers must handle refusal explicitly. */
export function advanceLifecycle(from: CandidateStatus, to: CandidateStatus): { ok: true } | { ok: false; reason: string } {
  const legal = LEGAL_TRANSITIONS[from];
  if (!legal.includes(to)) {
    return { ok: false, reason: `illegal_transition:${from}->${to}` };
  }
  return { ok: true };
}

/** True when a status is a terminal (failure or promoted) leaf. */
export function isTerminal(s: CandidateStatus): boolean {
  return s === "PROMOTED" || (CANDIDATE_FAILURE_STATUSES as readonly string[]).includes(s);
}

/** Ordered position in the forward lifecycle. Failure states return -1. */
export function lifecycleIndex(s: CandidateStatus): number {
  return CANDIDATE_LIFECYCLE_ORDER.indexOf(s);
}
