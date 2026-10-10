// src/lib/nex/research-memory/types.ts
//
// UWI · Wave 5 · Memory + lifecycle vocabulary.
// Founder-authorised programme.
//
// Founder-locked 8 non-collapsing entities (CRII synthesis §22):
//   RAW_EVIDENCE → SOURCE_RECORD → RESEARCH_EVENT → FINDING →
//   HYPOTHESIS → OPPORTUNITY → IDEA → DECISION
//
// Never merged into a single "content" table. Typed edges only. No
// overloaded fields.
//
// Rule 5k substrate check: 4 entities already exist in NEX substrate —
// this module implements the 4 NEW entities (FINDING · OPPORTUNITY ·
// IDEA · DECISION-record) and their integration edges to the existing 4:
//
//   RAW_EVIDENCE     ← Wave 3 discovery `EvidenceRecord` (already shipped)
//   SOURCE_RECORD    ← existing SOURCE_RELIABILITY registry + Wave 4 source-reliability-ledger
//   RESEARCH_EVENT   ← existing `worker_audit_events` (migration 004)
//   HYPOTHESIS       ← existing `capability-hypothesis-store.ts` (Section 10 compliance)

// ─── Entity identity ────────────────────────────────────────────────
export type EntityKind =
  | "RAW_EVIDENCE"
  | "SOURCE_RECORD"
  | "RESEARCH_EVENT"
  | "FINDING"
  | "HYPOTHESIS"
  | "OPPORTUNITY"
  | "IDEA"
  | "DECISION";

/** Typed reference to an entity of a specific kind (never generic pointer). */
export interface EntityRef {
  readonly kind: EntityKind;
  readonly id: string;
}

// ─── FINDING · interpreted claim derived from raw evidence ──────────
export interface Finding {
  readonly finding_id: string;
  readonly created_at_iso: string;
  /** Typed FK to RAW_EVIDENCE records this claim is derived from. */
  readonly evidence_refs: ReadonlyArray<EntityRef>;
  /** Typed FK to SOURCE_RECORDs. */
  readonly source_refs: ReadonlyArray<EntityRef>;
  /** Human-readable statement of the interpreted claim. */
  readonly claim: string;
  /** How this claim was derived from the evidence (deterministic rule / template ref). */
  readonly derivation_method: string;
  /** Confidence in the claim on [0, 1]. */
  readonly confidence: number;
  /** Free-form provenance envelope. */
  readonly provenance: Readonly<Record<string, unknown>>;
}

// ─── OPPORTUNITY · why it matters to NEX / users ────────────────────
export type OpportunityStatus =
  | "DISCOVERED"          // just created
  | "EVIDENCE_GATHERING"
  | "VALIDATING"
  | "ACTIVE"
  | "MONITORING"
  | "DECLINING"           // evidence-driven decay
  // ─── ABSORBING STATES (never collapse into single "ended") ────────
  | "PROMOTED"            // graduated to IDEA / build track
  | "SUPERSEDED"          // strictly better opportunity replaces it
  | "MERGED"              // absorbed into another opportunity
  | "PARKED"              // waiting on external condition · reversible
  | "ARCHIVED"            // no longer of interest · terminal
  | "REJECTED";           // decided against · terminal

export interface Opportunity {
  readonly opportunity_id: string;
  readonly created_at_iso: string;
  readonly title: string;
  /** Falsifiable phrasing enforced at insert-time (see falsifiability.ts). */
  readonly summary_hypothesis: string;
  readonly status: OpportunityStatus;
  /** Typed FKs. */
  readonly hypothesis_refs: ReadonlyArray<EntityRef>;
  readonly finding_refs: ReadonlyArray<EntityRef>;
  readonly source_refs: ReadonlyArray<EntityRef>;
  /** Signal-class labels (per Wave 4 M15 typology). */
  readonly signal_classes: ReadonlyArray<string>;
  /** Distinct affected NEX capabilities. */
  readonly affected_capabilities: ReadonlyArray<string>;
  /** Related opportunities · typed edges. */
  readonly related_opportunity_ids: ReadonlyArray<{
    readonly opportunity_id: string;
    readonly relation: "parent" | "child" | "sibling" | "duplicate_of" | "supersedes";
  }>;
  /** Prerequisite opportunities. */
  readonly dependencies: ReadonlyArray<string>;
  /** Falsifiability discipline: kept SEPARATE — never numerically netted. */
  readonly supporting_signals: ReadonlyArray<string>;
  readonly contradicting_signals: ReadonlyArray<string>;
  /** Two relevance scores kept SEPARATE — never averaged. */
  readonly user_relevance: number;   // 0-1
  readonly nex_relevance: number;    // 0-1
  /** Cadence primitives (Wave 5 M24). */
  readonly last_reviewed_at_iso: string;
  readonly next_review_at_iso: string | null;
  readonly decay_window_ms: number | null;
  readonly cost_cap_units: number | null;
  readonly cool_down_until_iso: string | null;
  /** Score derived from evidence-set (deterministic; scoring function stored in provenance). */
  readonly confidence: number;   // 0-1
  readonly novelty_score: number; // 0-1 (from Wave 4 dedup cascade)
  readonly provenance: Readonly<Record<string, unknown>>;
}

// ─── IDEA · proposed capability response to an opportunity ──────────
export type IdeaStatus =
  | "NEW"
  | "TRIAGED"
  | "SCORED"
  | "VALIDATED"
  | "PROMOTED"       // human-authority signed
  | "BUILT"
  // ─── ABSORBING STATES ────────────────────────────────────────────
  | "REJECTED"
  | "MERGED"
  | "SUPERSEDED"
  | "PARKED"
  | "ARCHIVED";

export interface Idea {
  readonly idea_id: string;
  readonly created_at_iso: string;
  readonly title: string;
  readonly proposed_response: string;
  readonly status: IdeaStatus;
  readonly opportunity_refs: ReadonlyArray<EntityRef>;
  /** Torres OST chain (schema constraint · outcome ← opportunity ← solution ← experiment). */
  readonly outcome_ref: string | null;
  readonly solution_kind: "capability_add" | "capability_extend" | "connective_line" | "workflow" | "policy" | "other";
  readonly experiment_refs: ReadonlyArray<string>;
  /** Scoring — multiple deterministic scoring functions may co-exist. */
  readonly ice_score: number | null;   // Impact × Confidence × Ease
  readonly rice_score: number | null;  // Reach × Impact × Confidence ÷ Effort
  /** Two relevance scores kept SEPARATE — never averaged. */
  readonly user_relevance: number;
  readonly nex_relevance: number;
  /** Cadence primitives. */
  readonly last_reviewed_at_iso: string;
  readonly next_review_at_iso: string | null;
  readonly cool_down_until_iso: string | null;
  readonly provenance: Readonly<Record<string, unknown>>;
}

// ─── DECISION · human/system decision + rationale · immutable ───────
export type DecisionKind = "authorise_build" | "reject" | "defer" | "merge" | "supersede" | "archive" | "park";

export interface Decision {
  readonly decision_id: string;
  readonly decided_at_iso: string;
  readonly kind: DecisionKind;
  readonly idea_refs: ReadonlyArray<EntityRef>;
  readonly opportunity_refs: ReadonlyArray<EntityRef>;
  readonly decided_by: string;                     // "founder" · "auto:cadence" · etc.
  /** HMAC-signed rationale for human-authority transitions (ADR-0304 §5 pattern). */
  readonly rationale: string;
  readonly hmac_signature: string | null;
  readonly provenance: Readonly<Record<string, unknown>>;
}

// ─── LIFECYCLE HISTORY · immutable event log per opportunity ────────
export type LifecycleEventKind =
  | "created"
  | "status_changed"
  | "evidence_added"
  | "hypothesis_linked"
  | "supporting_signal_added"
  | "contradicting_signal_added"
  | "user_relevance_updated"
  | "nex_relevance_updated"
  | "cadence_next_review_set"
  | "review_completed"
  | "decay_triggered"
  | "cost_cap_reached"
  | "promoted_to_idea"
  | "merged_into"
  | "superseded_by"
  | "parked"
  | "archived"
  | "rejected";

export interface LifecycleEvent {
  readonly event_id: string;
  readonly opportunity_id: string;
  readonly kind: LifecycleEventKind;
  readonly at_iso: string;
  readonly actor: string;                          // "founder" · "auto:cadence" · "worker:X"
  readonly from_status?: OpportunityStatus | null;
  readonly to_status?: OpportunityStatus | null;
  readonly detail?: Readonly<Record<string, unknown>>;
}

// ─── Falsifiability discipline (Wave 5 M20) ─────────────────────────
export interface FalsifiabilityCheck {
  readonly predicted_effect: string;
  readonly measurable_outcome: string;
  readonly refutation_condition: string;
}

export interface FalsifiabilityVerdict {
  readonly is_falsifiable: boolean;
  readonly missing_elements: ReadonlyArray<keyof FalsifiabilityCheck>;
  readonly downgrade_recommendation: "keep_as_hypothesis" | "downgrade_to_observation";
}

// ─── Two-relevance-scores discipline (Wave 5 M22) ───────────────────
export interface RelevancePair {
  readonly user_relevance: number;
  readonly nex_relevance: number;
}

/** Explicit refusal · attempting to average the two scores is a doctrine violation. */
export class RelevanceAveragingProhibitedError extends Error {
  constructor(caller: string) {
    super(`Rule 5-M22 violation: attempt to average user_relevance + nex_relevance in '${caller}'. Kept SEPARATE by doctrine — different constituencies with different weights.`);
    this.name = "RelevanceAveragingProhibitedError";
  }
}
