// src/lib/nex/capability-graph/capability-relationship-store.ts
//
// UWI · Wave 8.G.1 · CapabilityRelationship store
// Founder-authorised programme (Rule 5o.T §15-§16 · M18 vocabulary extension).
//
// Enforces at insert-time:
//   • Evidence-required (fail closed on vacuous/missing per founder rule)
//   • Bounded per-cycle emission (default 20 · founder-approved)
//   • Deterministic dedup (Wave 4 discipline · exact signature match for v1)
//   • M21 supporting/contradicting SEPARATE (never netted)
//   • M22 user_relevance + nex_relevance SEPARATE (never averaged)
//   • M23 distinct absorbing states (SUPERSEDED · MERGED · PARKED · ARCHIVED · REJECTED)
//   • M19 append-only relationship-history log (state=projection · history=truth)
//
// **NOT included in Wave 8.G.1 (per founder scope):**
//   × CompositionCandidateEmitter (Wave 8.G.2)
//   × Automatic promotion to NEX_PRODUCT_CANDIDATE (Wave 8.G.2 with §18 gates)
//   × Additional edge kinds beyond functional_pipeline (Wave 8.G.3+)
//   × Composition-of-composition (deferred)
//   × UI (Wave 9+)

import type {
  CapabilityRelationship,
  CapabilityRelationshipStatus,
  CapabilityNode,
  FunctionalPipelineEvidence,
  RelationshipLifecycleEvent,
  RelationshipLifecycleEventKind,
} from "./types";
import {
  DuplicateRelationshipError,
  EmissionCeilingReachedError,
  nodeId,
} from "./types";
import { assertFunctionalPipelineEvidence, computeFunctionalPipelineDedupSignature } from "./functional-pipeline-validator";
import { RelevanceAveragingProhibitedError, type RelevancePair } from "../research-memory/types";

// ─── Founder-approved default emission ceiling ──────────────────────
export const DEFAULT_MAX_EMISSIONS_PER_CYCLE = 20;

// ─── Append-only relationship-history log (M19 pattern reused) ──────
export class RelationshipLifecycleLog {
  private events: RelationshipLifecycleEvent[] = [];

  append(event: Omit<RelationshipLifecycleEvent, "event_id">): RelationshipLifecycleEvent {
    const with_id: RelationshipLifecycleEvent = {
      ...event,
      event_id: `rev-${this.events.length + 1}-${Date.now().toString(36)}`,
    };
    this.events.push(with_id);
    return with_id;
  }

  forRelationship(id: string): ReadonlyArray<RelationshipLifecycleEvent> {
    return this.events.filter(e => e.relationship_id === id);
  }
  size(): number { return this.events.length; }
  _resetForTests(): void { this.events = []; }
}

// ─── Valid status transitions (M23 preserved · PARKED reversible) ───
const VALID_TRANSITIONS: ReadonlyArray<[CapabilityRelationshipStatus, CapabilityRelationshipStatus]> = [
  ["DISCOVERED", "VALIDATING"],
  ["DISCOVERED", "REJECTED"],
  ["DISCOVERED", "PARKED"],
  ["DISCOVERED", "ARCHIVED"],
  ["DISCOVERED", "SUPERSEDED"],
  ["DISCOVERED", "MERGED"],
  ["VALIDATING", "VALIDATED"],
  ["VALIDATING", "REJECTED"],
  ["VALIDATING", "PARKED"],
  ["VALIDATING", "SUPERSEDED"],
  ["VALIDATED", "SUPERSEDED"],
  ["VALIDATED", "MERGED"],
  ["VALIDATED", "ARCHIVED"],
  ["VALIDATED", "REJECTED"],
  ["PARKED", "DISCOVERED"],
  ["PARKED", "VALIDATING"],
  ["PARKED", "ARCHIVED"],
];

export class InvalidRelationshipStatusTransitionError extends Error {
  constructor(from: CapabilityRelationshipStatus, to: CapabilityRelationshipStatus) {
    super(`Invalid capability-relationship transition ${from} → ${to} · violates Rule 5o.T + Wave 5 M23 distinct-absorbing-states discipline`);
    this.name = "InvalidRelationshipStatusTransitionError";
  }
}

function assertValidTransition(from: CapabilityRelationshipStatus, to: CapabilityRelationshipStatus): void {
  const ok = VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
  if (!ok) throw new InvalidRelationshipStatusTransitionError(from, to);
}

// ─── Store API ──────────────────────────────────────────────────────
export interface CreateFunctionalPipelineInput {
  readonly left_node: CapabilityNode;
  readonly right_node: CapabilityNode;
  readonly evidence: FunctionalPipelineEvidence;
  readonly supporting_signals?: ReadonlyArray<string>;
  readonly contradicting_signals?: ReadonlyArray<string>;
  readonly user_relevance: number;   // M22 · SEPARATE
  readonly nex_relevance: number;    // M22 · SEPARATE
  readonly confidence: number;
  readonly novelty_score: number;
  readonly cycle_id: string;
  readonly actor: string;
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export class CapabilityRelationshipStore {
  private relationships = new Map<string, CapabilityRelationship>();
  private signature_index = new Map<string, string>();    // dedup_signature → relationship_id
  private per_cycle_emission_count = new Map<string, number>();
  private next_seq = 1;
  private readonly max_emissions_per_cycle: number;

  constructor(
    public readonly history: RelationshipLifecycleLog,
    max_emissions_per_cycle: number = DEFAULT_MAX_EMISSIONS_PER_CYCLE,
  ) {
    this.max_emissions_per_cycle = max_emissions_per_cycle;
  }

  /** Create a functional_pipeline relationship. Enforces founder-locked
   *  disciplines at insert · fails closed on any violation. */
  createFunctionalPipeline(input: CreateFunctionalPipelineInput, now_iso: string = new Date().toISOString()): CapabilityRelationship {
    // ─── Evidence-required check (founder rule · absolute) ────────
    assertFunctionalPipelineEvidence(input.evidence, "CapabilityRelationshipStore.createFunctionalPipeline");

    // ─── M22 · relevance range sanity ─────────────────────────────
    if (input.user_relevance < 0 || input.user_relevance > 1) throw new Error("user_relevance must be 0..1");
    if (input.nex_relevance < 0 || input.nex_relevance > 1) throw new Error("nex_relevance must be 0..1");
    if (input.confidence < 0 || input.confidence > 1) throw new Error("confidence must be 0..1");
    if (input.novelty_score < 0 || input.novelty_score > 1) throw new Error("novelty_score must be 0..1");

    // ─── Dedup check ──────────────────────────────────────────────
    const left_id = nodeId(input.left_node);
    const right_id = nodeId(input.right_node);
    const dedup_signature = computeFunctionalPipelineDedupSignature(left_id, right_id);
    const existing_id = this.signature_index.get(dedup_signature);
    if (existing_id) {
      throw new DuplicateRelationshipError(dedup_signature, existing_id);
    }

    // ─── Bounded per-cycle emission ceiling ───────────────────────
    const current_count = this.per_cycle_emission_count.get(input.cycle_id) ?? 0;
    if (current_count >= this.max_emissions_per_cycle) {
      throw new EmissionCeilingReachedError(input.cycle_id, this.max_emissions_per_cycle);
    }

    // ─── Compose entity ───────────────────────────────────────────
    const id = `crel-${this.next_seq++}`;
    const relationship: CapabilityRelationship = {
      relationship_id: id,
      created_at_iso: now_iso,
      kind: "functional_pipeline",
      status: "DISCOVERED",
      left_node: input.left_node,
      right_node: input.right_node,
      dedup_signature,
      evidence: input.evidence,
      supporting_signals: [...(input.supporting_signals ?? [])],
      contradicting_signals: [...(input.contradicting_signals ?? [])],
      user_relevance: input.user_relevance,   // M22 SEPARATE
      nex_relevance: input.nex_relevance,     // M22 SEPARATE
      confidence: input.confidence,
      novelty_score: input.novelty_score,
      created_in_cycle: input.cycle_id,
      provenance: input.provenance ?? {},
    };

    // ─── Commit ───────────────────────────────────────────────────
    this.relationships.set(id, relationship);
    this.signature_index.set(dedup_signature, id);
    this.per_cycle_emission_count.set(input.cycle_id, current_count + 1);

    // ─── M19 · append-only history ────────────────────────────────
    this.history.append({
      relationship_id: id,
      kind: "created",
      actor: input.actor,
      at_iso: now_iso,
      to_status: "DISCOVERED",
      detail: {
        left: left_id,
        right: right_id,
        dedup_signature,
        cycle_id: input.cycle_id,
      },
    });

    return relationship;
  }

  transitionStatus(id: string, to: CapabilityRelationshipStatus, actor: string, event_kind: RelationshipLifecycleEventKind, now_iso: string = new Date().toISOString()): CapabilityRelationship {
    const prior = this.mustGet(id);
    assertValidTransition(prior.status, to);
    const updated: CapabilityRelationship = { ...prior, status: to };
    this.relationships.set(id, updated);
    this.history.append({
      relationship_id: id,
      kind: event_kind,
      actor,
      at_iso: now_iso,
      from_status: prior.status,
      to_status: to,
    });
    return updated;
  }

  addSupportingSignal(id: string, signal: string, actor: string, now_iso: string = new Date().toISOString()): CapabilityRelationship {
    const prior = this.mustGet(id);
    const updated: CapabilityRelationship = { ...prior, supporting_signals: [...prior.supporting_signals, signal] };
    this.relationships.set(id, updated);
    this.history.append({
      relationship_id: id, kind: "supporting_signal_added",
      actor, at_iso: now_iso, detail: { signal },
    });
    return updated;
  }

  addContradictingSignal(id: string, signal: string, actor: string, now_iso: string = new Date().toISOString()): CapabilityRelationship {
    const prior = this.mustGet(id);
    const updated: CapabilityRelationship = { ...prior, contradicting_signals: [...prior.contradicting_signals, signal] };
    this.relationships.set(id, updated);
    this.history.append({
      relationship_id: id, kind: "contradicting_signal_added",
      actor, at_iso: now_iso, detail: { signal },
    });
    return updated;
  }

  relevancePair(id: string): RelevancePair {
    const r = this.mustGet(id);
    return { user_relevance: r.user_relevance, nex_relevance: r.nex_relevance };
  }

  /** Explicit refusal of any averaging attempt (M22 discipline · same
   *  as OpportunityStore + ProductCandidateStore). */
  averageRelevance(_id: string): never {
    throw new RelevanceAveragingProhibitedError("CapabilityRelationshipStore.averageRelevance");
  }

  get(id: string): CapabilityRelationship | null { return this.relationships.get(id) ?? null; }
  mustGet(id: string): CapabilityRelationship {
    const r = this.relationships.get(id);
    if (!r) throw new Error(`capability relationship not found: ${id}`);
    return r;
  }

  all(): ReadonlyArray<CapabilityRelationship> { return Array.from(this.relationships.values()); }
  size(): number { return this.relationships.size; }
  perCycleCount(cycle_id: string): number { return this.per_cycle_emission_count.get(cycle_id) ?? 0; }
  maxEmissionsPerCycle(): number { return this.max_emissions_per_cycle; }

  /** Query helper: find a relationship by its dedup signature. */
  findBySignature(signature: string): CapabilityRelationship | null {
    const id = this.signature_index.get(signature);
    return id ? this.relationships.get(id) ?? null : null;
  }

  _resetForTests(): void {
    this.relationships.clear();
    this.signature_index.clear();
    this.per_cycle_emission_count.clear();
    this.next_seq = 1;
  }
}
