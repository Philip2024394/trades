// src/lib/nex/capability-graph/types.ts
//
// UWI · Wave 8.G.1 · Capability graph vocabulary
// Founder-authorised programme (Rule 5o.T §15-§16 · M18 vocabulary
// extension 8 → 9 · founder-approved 2026-09-21).
//
// Adds ONE new first-class entity to M18: `CAPABILITY_RELATIONSHIP`.
// The prior 8 entities remain unchanged:
//   RAW_EVIDENCE → SOURCE_RECORD → RESEARCH_EVENT → FINDING →
//   HYPOTHESIS → OPPORTUNITY → IDEA → DECISION
//
// CAPABILITY_RELATIONSHIP has its OWN evidence · lifecycle · provenance ·
// contradiction handling · dedup identity · SEPARATE relevance (M22) ·
// SEPARATE supporting/contradicting signals (M21) · distinct absorbing
// states (M23). NEVER merged into HYPOTHESIS (founder explicitly rejected).

import type { EntityRef } from "../research-memory/types";

// ─── Capability Node · typed lens over existing Wave 8.C findings ───
// Not persisted separately · read-only view onto (finding_id, capability_category).
export interface CapabilityNode {
  readonly finding_id: string;                  // EntityRef.id (FINDING kind)
  readonly capability_category: string;         // e.g. "video_timeline" · "webgl_rendering"
  readonly underlying_technique: string;        // human-readable
  readonly nex_rebuildable_natively: boolean;   // from Wave 8.C CapabilityExtractionReport
  readonly source_ecosystem: string;            // e.g. "hugging_face" · "github"
  readonly source_resource_id: string;          // e.g. "sindresorhus/type-fest"
}

/** Deterministic node identity for dedup + edge signatures. */
export function nodeId(node: CapabilityNode): string {
  return `${node.finding_id}#${node.capability_category}`;
}

// ─── Relationship kind · v1 has ONE kind: functional_pipeline ───────
// Additional kinds are Wave 8.G.3+ scope · not silently added to v1.
export type CapabilityRelationshipKind =
  | "functional_pipeline";   // A produces output that functionally feeds/enables B

/** Founder-explicit evidence semantics for functional_pipeline:
 *  "There is evidence that the output, capability, interface, data,
 *   or transformation produced by one capability can functionally feed
 *   or enable another capability."
 *  Explicitly NOT: semantic similarity · co-occurrence · category
 *  similarity · repository proximity · "sound useful together". */
export interface FunctionalPipelineEvidence {
  /** What capability A produces (output type / interface / data shape). */
  readonly source_capability_output: string;
  /** What capability B consumes (input type / interface / data shape). */
  readonly consumer_capability_input: string;
  /** How the two connect (e.g. "shared data type: PNG image", "shared
   *  interface: HTTP endpoint returning JSON"). */
  readonly pipeline_medium: string;
  /** Typed EntityRef to RAW_EVIDENCE proving the pipeline is real. */
  readonly source_evidence_ref: EntityRef;
  /** Optional additional evidence refs supporting the pipeline claim. */
  readonly additional_evidence_refs?: ReadonlyArray<EntityRef>;
}

// ─── Vacuous-evidence blocklist (mirrors Rule 5o.T §18 discipline) ──
export const VACUOUS_EVIDENCE_STRINGS: ReadonlyArray<string> = [
  "tbd", "todo", "unknown", "n/a", "na", "none", "-", "?", "",
  "to be determined", "we will see", "sounds useful", "sounds good",
  "seems related", "seems compatible", "co-occurred", "same repo",
  "same repository", "same category", "similar",
];

// ─── Lifecycle status (M23 · distinct absorbing states preserved) ───
export type CapabilityRelationshipStatus =
  | "DISCOVERED"          // just created · evidence accepted
  | "VALIDATING"          // under active verification
  | "VALIDATED"           // evidence + selectivity gates passed
  // ─── ABSORBING STATES (never collapse · M23) ────────────────────
  | "SUPERSEDED"          // stronger relationship replaces it · terminal
  | "MERGED"              // absorbed into another relationship · terminal
  | "PARKED"              // waiting on external condition · reversible
  | "ARCHIVED"            // no longer of interest · terminal
  | "REJECTED";           // decided against · terminal

// ─── The 9th M18 entity ─────────────────────────────────────────────
export interface CapabilityRelationship {
  readonly relationship_id: string;
  readonly created_at_iso: string;
  readonly kind: CapabilityRelationshipKind;
  readonly status: CapabilityRelationshipStatus;
  /** Directional for functional_pipeline (left produces → right consumes). */
  readonly left_node: CapabilityNode;
  readonly right_node: CapabilityNode;
  /** Wave 4 dedup signature · deterministic · exact match for v1. */
  readonly dedup_signature: string;
  /** Kind-specific evidence payload. For functional_pipeline: FunctionalPipelineEvidence. */
  readonly evidence: FunctionalPipelineEvidence;
  /** M21 · supporting signals · kept SEPARATE from contradicting · never netted. */
  readonly supporting_signals: ReadonlyArray<string>;
  /** M21 · contradicting signals · kept SEPARATE from supporting. */
  readonly contradicting_signals: ReadonlyArray<string>;
  /** M22 · user relevance · SEPARATE from nex_relevance · never averaged. */
  readonly user_relevance: number;   // 0-1
  /** M22 · NEX relevance · SEPARATE from user_relevance. */
  readonly nex_relevance: number;    // 0-1
  /** Confidence in the relationship on [0, 1]. */
  readonly confidence: number;
  /** Novelty on [0, 1] · from Wave 4 novelty semantics (novelty of the RELATIONSHIP · not of source nodes). */
  readonly novelty_score: number;
  /** Cycle id when this relationship was created (used by bounded emission ceiling). */
  readonly created_in_cycle: string;
  /** Free-form provenance envelope. */
  readonly provenance: Readonly<Record<string, unknown>>;
}

// ─── Relationship lifecycle event (M19 · state=projection · history=truth) ─
export type RelationshipLifecycleEventKind =
  | "created"
  | "status_changed"
  | "supporting_signal_added"
  | "contradicting_signal_added"
  | "superseded_by"
  | "merged_into"
  | "parked"
  | "archived"
  | "rejected";

export interface RelationshipLifecycleEvent {
  readonly event_id: string;
  readonly relationship_id: string;
  readonly kind: RelationshipLifecycleEventKind;
  readonly at_iso: string;
  readonly actor: string;
  readonly from_status?: CapabilityRelationshipStatus | null;
  readonly to_status?: CapabilityRelationshipStatus | null;
  readonly detail?: Readonly<Record<string, unknown>>;
}

// ─── Errors ─────────────────────────────────────────────────────────
export class CompositionEdgeInsufficientEvidenceError extends Error {
  constructor(public readonly missing_or_vacuous: ReadonlyArray<string>, caller: string) {
    super(`Rule 5o.T §15 violation in '${caller}': functional_pipeline evidence is missing or vacuous [${missing_or_vacuous.join(", ")}]. Co-occurrence · category similarity · "sounds useful together" are NOT admissible evidence.`);
    this.name = "CompositionEdgeInsufficientEvidenceError";
  }
}

export class EmissionCeilingReachedError extends Error {
  constructor(public readonly cycle_id: string, public readonly ceiling: number) {
    super(`Bounded per-cycle emission ceiling reached · cycle_id='${cycle_id}' · ceiling=${ceiling}. Wave 8.G.1 v1 founder-approved default 20/cycle. Emit fewer edges or start a new cycle.`);
    this.name = "EmissionCeilingReachedError";
  }
}

export class DuplicateRelationshipError extends Error {
  constructor(public readonly dedup_signature: string, public readonly existing_id: string) {
    super(`Duplicate relationship refused · signature='${dedup_signature}' already stored as ${existing_id}. Wave 4 dedup discipline preserved.`);
    this.name = "DuplicateRelationshipError";
  }
}

/** Convert a capability_origin ref to an EntityRef of kind CAPABILITY_RELATIONSHIP.
 *  Used by downstream Wave 8.G.2 emitter (deferred) so composition-derived
 *  candidates can carry typed provenance back to their originating relationships. */
export function relationshipRef(id: string): EntityRef {
  return { kind: "SOURCE_RECORD", id: `capability_relationship:${id}` };
  // NOTE: EntityKind is a union of the original 8 · we use SOURCE_RECORD as the
  // typed carrier for capability_relationship references until the founder
  // decides whether to add CAPABILITY_RELATIONSHIP to the EntityKind union
  // itself. The M18 vocabulary is 9 entities · the EntityKind TS union may be
  // extended in a subsequent bounded wave that touches research-memory/types.ts.
  // Named as an honest limitation in the Wave 8.G.1 report.
}
