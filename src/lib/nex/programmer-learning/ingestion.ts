// src/lib/nex/programmer-learning/ingestion.ts
//
// NEX Programmer Agent · Phase A · public capture API
// Philip 2026-09-05 · AUTHORIZE
//
// Every capture function enforces the KNOWLEDGE / SKILL / EXPERIENCE
// separation and the Op-Truth discipline that "Claude says X" ≠
// "X is true". Every function returns the persisted record's id so
// callers can chain records via related_event_ids / evidence.

import {
  appendEvent,
  appendKnowledge,
  appendSkill,
  appendExperience,
  storeSourceSnapshot,
  stableHash,
  generateId,
  newProvenance,
  readKnowledge,
} from "./store";
import type {
  EngineeringEvent,
  EngineeringEventKind,
  KnowledgeItem,
  SkillItem,
  ExperienceItem,
  ExperienceOutcome,
  AuthorityTier,
  SourceType,
  VerificationState,
  SkillPromotionState,
  Provenance,
} from "./types";

// ─── Generic engineering-event capture (§3.A) ─────────────────────

export type CaptureEventInput = {
  kind: EngineeringEventKind;
  description: string;
  source: string;
  source_type: SourceType;
  evidence_pointer: string;
  project?: string;
  task?: string;
  related_event_ids?: string[];
  meta?: Record<string, unknown>;
  /** Defaults to DISCOVERED · captured records are not verified by
   *  default. Callers doing independent verification pass CHECKED
   *  or VERIFIED with corresponding evidence. */
  status?: VerificationState;
};

export function captureEngineeringEvent(input: CaptureEventInput): EngineeringEvent {
  const now = new Date().toISOString();
  const event: EngineeringEvent = {
    event_id: generateId("evt"),
    kind: input.kind,
    timestamp: now,
    source: input.source,
    source_type: input.source_type,
    project: input.project,
    task: input.task,
    description: input.description,
    evidence_pointer: input.evidence_pointer,
    status: input.status ?? "DISCOVERED",
    related_event_ids: input.related_event_ids,
    meta: input.meta,
  };
  appendEvent(event);
  return event;
}

// ─── Claude-as-source discipline (§7) ────────────────────────────

/**
 * Capture a Claude engineering action. THIS DOES NOT STORE THE ACTION
 * AS SUCCESS. Even if Claude says "fix complete", the resulting event
 * is captured as `implementation_attempt` with status=DISCOVERED. The
 * caller must chain test/typecheck/runtime evidence events and finally
 * emit an ExperienceItem whose outcome is derived from that evidence.
 *
 * This function encodes the doctrine:
 *   NO SELF-REPORTED SUCCESS IS AUTHORITATIVE.
 */
export type CaptureClaudeAttemptInput = {
  task: string;
  claude_claim: string;      // what Claude asserted (never treated as truth)
  action_summary: string;    // what Claude actually did (files/commands)
  evidence_pointer: string;  // pointer to diff/log/artifact
  project?: string;
  related_event_ids?: string[];
  meta?: Record<string, unknown>;
};

export function captureClaudeAttempt(input: CaptureClaudeAttemptInput): EngineeringEvent {
  // Two events emitted: (1) claim (never authoritative), (2) attempt (observed).
  // Both start at DISCOVERED and can be promoted only via chained evidence.
  const now = new Date().toISOString();
  const claimEvent: EngineeringEvent = {
    event_id: generateId("evt"),
    kind: "observation",
    timestamp: now,
    source: "claude",
    source_type: "claude_claim",
    project: input.project,
    task: input.task,
    description: `CLAUDE_CLAIM: ${input.claude_claim}`,
    evidence_pointer: input.evidence_pointer,
    status: "DISCOVERED",     // NEVER auto-VERIFIED · doctrine-locked
    related_event_ids: input.related_event_ids,
    meta: { ...input.meta, doctrine: "op_truth.no_self_reported_success" },
  };
  appendEvent(claimEvent);
  const attemptEvent: EngineeringEvent = {
    event_id: generateId("evt"),
    kind: "implementation_attempt",
    timestamp: new Date().toISOString(),
    source: "claude",
    source_type: "claude_action",
    project: input.project,
    task: input.task,
    description: input.action_summary,
    evidence_pointer: input.evidence_pointer,
    status: "DISCOVERED",
    related_event_ids: [claimEvent.event_id, ...(input.related_event_ids ?? [])],
    meta: input.meta,
  };
  appendEvent(attemptEvent);
  return attemptEvent;
}

// ─── External source ingestion (§8 · §9) ─────────────────────────

export type IngestExternalSourceInput = {
  url: string;
  source_title: string;
  authority_tier: AuthorityTier;
  technology: string;             // "typescript" · "postgres" · "nodejs"
  domain: string;                 // "language" · "database" · "runtime"
  statement: string;              // the factual claim we're extracting
  raw_content: string;            // full snapshot to store alongside
  content_type?: string;
  /** Optional related knowledge for cross-reference. */
  related_knowledge?: string[];
};

/**
 * Ingest an authoritative external source into the knowledge store.
 * Two artifacts written:
 *   1. Raw source snapshot under sources/{hash}.txt (reproducibility)
 *   2. KnowledgeItem in knowledge.jsonl with provenance pointing at
 *      that snapshot + the URL + retrieved_at.
 *
 * The knowledge item is created at status=CHECKED (structural integrity
 * confirmed by this ingest — URL was fetched, content was captured).
 * Promotion to VERIFIED requires an independent verifier to attest.
 *
 * Also emits an EngineeringEvent of kind=external_source_read so the
 * event stream captures the ingest.
 */
export function ingestExternalSource(input: IngestExternalSourceInput): {
  knowledge: KnowledgeItem;
  event: EngineeringEvent;
  snapshot_pointer: string;
} {
  if (!input.url || !input.raw_content) {
    throw new Error("ingestExternalSource: url and raw_content required");
  }
  const snapshot = storeSourceSnapshot({
    content: input.raw_content,
    url: input.url,
    content_type: input.content_type,
  });
  const provenance: Provenance = newProvenance({
    source: input.source_title,
    source_type: "external_documentation",
    source_url: input.url,
    authority_tier: input.authority_tier,
    evidence_pointer: snapshot.pointer,
    observed_by: "system",
  });
  const knowledge: KnowledgeItem = {
    knowledge_id: generateId("know"),
    statement: input.statement,
    domain: input.domain,
    technology: input.technology,
    provenance,
    // TIER-1/2 official docs get CHECKED on ingest (URL fetched, content stored).
    // Tier-4/5 stays at DISCOVERED · a verifier can later CHECK/VERIFY.
    verification_status:
      input.authority_tier === "TIER_1" || input.authority_tier === "TIER_2"
        ? "CHECKED"
        : "DISCOVERED",
    // Confidence derived from tier + verification (bounded formula).
    confidence: authorityBaseConfidence(input.authority_tier),
    superseded_by: null,
    related_knowledge: input.related_knowledge,
    content_hash: stableHash({ url: input.url, statement: input.statement }),
    created_at: new Date().toISOString(),
  };
  appendKnowledge(knowledge);
  const event = captureEngineeringEvent({
    kind: "external_source_read",
    description: `Ingested from ${input.source_title}: ${input.statement.slice(0, 160)}`,
    source: input.source_title,
    source_type: "external_documentation",
    evidence_pointer: snapshot.pointer,
    project: "nex",
    task: `learn:${input.technology}`,
    status: knowledge.verification_status,
    meta: { url: input.url, tier: input.authority_tier, bytes: snapshot.bytes },
  });
  return { knowledge, event, snapshot_pointer: snapshot.pointer };
}

function authorityBaseConfidence(tier: AuthorityTier): number {
  switch (tier) {
    case "TIER_1": return 0.90;
    case "TIER_2": return 0.80;
    case "TIER_3": return 0.65;
    case "TIER_4": return 0.45;
    case "TIER_5": return 0.25;
  }
}

// ─── Skill capture (§5) ──────────────────────────────────────────

export type CaptureSkillInput = {
  name: string;
  domain: string;
  description: string;
  prerequisites?: string[];
  knowledge_dependencies?: string[];
  verification_recipe?: string;
  benchmark_reference?: string;
  /** Default OBSERVED · promotion requires supporting experiences. */
  promotion_state?: SkillPromotionState;
  supporting_experiences?: string[];
};

export function captureSkill(input: CaptureSkillInput): SkillItem {
  const skill: SkillItem = {
    skill_id: generateId("skill"),
    name: input.name,
    domain: input.domain,
    description: input.description,
    prerequisites: input.prerequisites,
    knowledge_dependencies: input.knowledge_dependencies,
    verification_recipe: input.verification_recipe,
    benchmark_reference: input.benchmark_reference,
    // OBSERVED by default · never mastered because docs were read.
    promotion_state: input.promotion_state ?? "OBSERVED",
    supporting_experiences: input.supporting_experiences,
    confidence: skillBaseConfidence(input.promotion_state ?? "OBSERVED"),
    created_at: new Date().toISOString(),
  };
  appendSkill(skill);
  return skill;
}

function skillBaseConfidence(state: SkillPromotionState): number {
  switch (state) {
    case "OBSERVED": return 0.20;
    case "PRACTICED": return 0.50;
    case "VERIFIED": return 0.80;
  }
}

// ─── Experience capture (§6) ─────────────────────────────────────

export type CaptureExperienceInput = {
  task: string;
  initial_hypothesis: string;
  action_taken: string;
  files_involved: string[];
  expected_result: string;
  actual_result: string;
  evidence: string[];
  outcome: ExperienceOutcome;
  root_cause?: string | null;
  correction?: string | null;
  regression_result?: string | null;
  lessons: string[];
  related_knowledge?: string[];
  related_skill?: string | null;
  provenance: Provenance;
};

export function captureExperience(input: CaptureExperienceInput): ExperienceItem {
  // Failures MUST include root_cause · this is doctrine (§11) so we
  // enforce it at capture time.
  if (input.outcome === "failure" && !input.root_cause) {
    throw new Error("captureExperience: failure outcome requires root_cause");
  }
  const experience: ExperienceItem = {
    experience_id: generateId("exp"),
    task: input.task,
    initial_hypothesis: input.initial_hypothesis,
    action_taken: input.action_taken,
    files_involved: input.files_involved,
    expected_result: input.expected_result,
    actual_result: input.actual_result,
    evidence: input.evidence,
    outcome: input.outcome,
    root_cause: input.root_cause ?? null,
    correction: input.correction ?? null,
    regression_result: input.regression_result ?? null,
    lessons: input.lessons,
    related_knowledge: input.related_knowledge,
    related_skill: input.related_skill ?? null,
    timestamp: new Date().toISOString(),
    provenance: input.provenance,
  };
  appendExperience(experience);
  // Emit an experience_created event so the event stream reflects it.
  captureEngineeringEvent({
    kind: "experience_created",
    description: `Experience: ${experience.task} · outcome=${experience.outcome}`,
    source: experience.provenance.source,
    source_type: experience.provenance.source_type,
    evidence_pointer: experience.evidence[0] ?? "(no evidence pointer)",
    task: experience.task,
    status: "CHECKED",  // event captures a persisted record · structurally CHECKED
    meta: { experience_id: experience.experience_id, outcome: experience.outcome },
  });
  return experience;
}

// ─── Convenience: check if a knowledge fact is already present ──

/** Search for existing knowledge with an identical content hash. Used
 *  by dedup discipline · does NOT modify. Returns null if not present. */
export function findExistingKnowledgeByHash(content_hash: string): KnowledgeItem | null {
  for (const k of readKnowledge()) {
    if (k.content_hash === content_hash) return k;
  }
  return null;
}
