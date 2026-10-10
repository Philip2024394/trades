// src/lib/nex/product-lifecycle/candidate-store.ts
//
// UWI · Wave 8.C · Product Candidate store
// Founder-authorised programme (Rule 5o.T §8 · §17 lifecycle · §24 M22).
//
// Mirrors Wave 5 OpportunityStore discipline for the Product Candidate
// stage:
//   §18 gates enforced at insert (assertProductCandidateGates)
//   §19 measurability triad enforced at insert (assertFalsifiable via readiness)
//   M22 user_relevance + nex_relevance kept SEPARATE (never averaged)
//   M23 valid initial state (PROPOSED) + status transitions validated
//   M18 typed EntityRef edges preserved
//   M19 event log append (state=projection · history=truth)

import type {
  NexProductCandidate,
  ProductCandidateStatus,
  ProductLifecycleEvent,
  ProductLifecycleEventKind,
  NexRouteReference,
  ProductCandidateGates,
} from "./types";
import { assertProductCandidateReadiness } from "./candidate-validator";
import { RelevanceAveragingProhibitedError, type EntityRef, type FalsifiabilityCheck, type RelevancePair } from "../research-memory/types";

// ─── Product-lifecycle event log (append-only) ───────────────────────
export class ProductLifecycleLog {
  private events: ProductLifecycleEvent[] = [];

  append(event: Omit<ProductLifecycleEvent, "event_id">): ProductLifecycleEvent {
    const with_id: ProductLifecycleEvent = {
      ...event,
      event_id: `pev-${this.events.length + 1}-${Date.now().toString(36)}`,
    };
    this.events.push(with_id);
    return with_id;
  }
  forCandidate(candidate_id: string): ReadonlyArray<ProductLifecycleEvent> {
    return this.events.filter(e => e.candidate_id === candidate_id);
  }
  size(): number { return this.events.length; }
  _resetForTests(): void { this.events = []; }
}

// ─── State transitions (respects M23 distinct absorbing states) ──────
type Transition = { readonly from: ProductCandidateStatus; readonly to: ProductCandidateStatus; };

const VALID_TRANSITIONS: ReadonlyArray<Transition> = [
  // Forward path
  { from: "PROPOSED", to: "VALIDATING" },
  { from: "PROPOSED", to: "REJECTED" },
  { from: "PROPOSED", to: "PARKED" },
  { from: "PROPOSED", to: "MERGED" },
  { from: "PROPOSED", to: "SUPERSEDED" },
  { from: "PROPOSED", to: "ARCHIVED" },
  { from: "VALIDATING", to: "VALIDATED" },
  { from: "VALIDATING", to: "REJECTED" },
  { from: "VALIDATING", to: "PARKED" },
  { from: "VALIDATING", to: "SUPERSEDED" },
  { from: "VALIDATED", to: "READY_FOR_ENGINEERING" },
  { from: "VALIDATED", to: "REJECTED" },
  { from: "VALIDATED", to: "PARKED" },
  { from: "VALIDATED", to: "SUPERSEDED" },
  { from: "READY_FOR_ENGINEERING", to: "BUILDING" },
  { from: "READY_FOR_ENGINEERING", to: "REJECTED" },
  { from: "READY_FOR_ENGINEERING", to: "PARKED" },
  { from: "BUILDING", to: "LIVE" },
  { from: "BUILDING", to: "REJECTED" },
  { from: "BUILDING", to: "PARKED" },
  { from: "LIVE", to: "MONITORING" },
  { from: "LIVE", to: "SUPERSEDED" },
  { from: "MONITORING", to: "LIVE" },
  { from: "MONITORING", to: "SUPERSEDED" },
  { from: "MONITORING", to: "ARCHIVED" },
  // PARKED is reversible (M23 doctrine)
  { from: "PARKED", to: "PROPOSED" },
  { from: "PARKED", to: "VALIDATING" },
  { from: "PARKED", to: "ARCHIVED" },
];

export class InvalidProductStatusTransitionError extends Error {
  constructor(from: ProductCandidateStatus, to: ProductCandidateStatus) {
    super(`Invalid product-candidate transition ${from} → ${to} · violates Rule 5o.T §17 lifecycle + Wave 5 M23 distinct-absorbing-states discipline`);
    this.name = "InvalidProductStatusTransitionError";
  }
}

function assertValidProductTransition(from: ProductCandidateStatus, to: ProductCandidateStatus): void {
  const ok = VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
  if (!ok) throw new InvalidProductStatusTransitionError(from, to);
}

// ─── Public candidate-store API ─────────────────────────────────────
export interface ProductCandidateCreateInput {
  readonly product_name: string;
  readonly product_category: string;
  readonly problem_solved: string;
  readonly target_user: string;
  readonly capability_origin: ReadonlyArray<EntityRef>;
  readonly source_provenance: ReadonlyArray<{ ecosystem: string; source_url: string; resource_id: string }>;
  readonly evidence: ReadonlyArray<{ kind: string; detail: string; ref?: EntityRef }>;
  readonly useful_underlying_technique: string;
  readonly nex_interpretation: string;
  readonly proposed_nex_experience: string;
  readonly proposed_inputs: ReadonlyArray<string>;
  readonly proposed_outputs: ReadonlyArray<string>;
  readonly dependencies_summary: { readonly notable: ReadonlyArray<string>; readonly total_direct: number; readonly total_transitive: number; };
  readonly licence: { readonly spdx_identifier: string | null; readonly copyleft_class: string; readonly nex_compatible: boolean; readonly requires_legal_review: boolean; };
  readonly security: { readonly risk_level: "low" | "medium" | "high" | "critical"; readonly notes: ReadonlyArray<string>; };
  readonly runtime_purity: { readonly is_pure_for_nex_runtime: boolean; readonly notable_external_deps: ReadonlyArray<string>; };
  readonly direct_reuse_verdict: { readonly appropriate: boolean; readonly reason: string; };
  readonly clean_rebuild_verdict: { readonly possible: boolean; readonly reason: string; };
  readonly novelty_assessment: { readonly novelty_score: number; readonly rationale: string; };
  readonly user_relevance: number;
  readonly nex_relevance: number;
  readonly validation_gates: ProductCandidateGates;
  readonly measurable_success: FalsifiabilityCheck;
  readonly routes?: {
    readonly product?: NexRouteReference;
    readonly page?: NexRouteReference;
    readonly design?: NexRouteReference;
    readonly engineering?: NexRouteReference;
  };
  readonly provenance?: Readonly<Record<string, unknown>>;
  readonly actor: string;
}

const NOT_YET_CREATED_ROUTE: NexRouteReference = {
  status: "not_yet_created",
  path: null,
  last_verified_at_iso: null,
};

export class ProductCandidateStore {
  private candidates = new Map<string, NexProductCandidate>();
  private next_seq = 1;

  constructor(public readonly history: ProductLifecycleLog) {}

  create(input: ProductCandidateCreateInput, now_iso: string = new Date().toISOString()): NexProductCandidate {
    // §18 gates + §19 measurability triad enforced at insert
    assertProductCandidateReadiness(input.validation_gates, input.measurable_success, "ProductCandidateStore.create");

    // M22 · relevance range sanity
    if (input.user_relevance < 0 || input.user_relevance > 1) throw new Error("user_relevance must be 0..1");
    if (input.nex_relevance < 0 || input.nex_relevance > 1) throw new Error("nex_relevance must be 0..1");
    if (input.novelty_assessment.novelty_score < 0 || input.novelty_assessment.novelty_score > 1) throw new Error("novelty_score must be 0..1");

    const id = `pcand-${this.next_seq++}`;
    const candidate: NexProductCandidate = {
      candidate_id: id,
      created_at_iso: now_iso,
      product_name: input.product_name,
      product_category: input.product_category,
      problem_solved: input.problem_solved,
      target_user: input.target_user,
      capability_origin: input.capability_origin,
      source_provenance: input.source_provenance,
      evidence: input.evidence,
      useful_underlying_technique: input.useful_underlying_technique,
      nex_interpretation: input.nex_interpretation,
      proposed_nex_experience: input.proposed_nex_experience,
      proposed_inputs: input.proposed_inputs,
      proposed_outputs: input.proposed_outputs,
      dependencies_summary: input.dependencies_summary,
      licence: input.licence,
      security: input.security,
      runtime_purity: input.runtime_purity,
      direct_reuse_verdict: input.direct_reuse_verdict,
      clean_rebuild_verdict: input.clean_rebuild_verdict,
      novelty_assessment: input.novelty_assessment,
      user_relevance: input.user_relevance,
      nex_relevance: input.nex_relevance,
      validation_gates: input.validation_gates,
      measurable_success: input.measurable_success,
      routes: {
        product: input.routes?.product ?? NOT_YET_CREATED_ROUTE,
        page: input.routes?.page ?? NOT_YET_CREATED_ROUTE,
        design: input.routes?.design ?? NOT_YET_CREATED_ROUTE,
        engineering: input.routes?.engineering ?? NOT_YET_CREATED_ROUTE,
      },
      status: "PROPOSED",
      provenance: input.provenance ?? {},
    };
    this.candidates.set(id, candidate);
    this.history.append({
      candidate_id: id,
      kind: "candidate_created",
      actor: input.actor,
      at_iso: now_iso,
      to_status: "PROPOSED",
      detail: {
        product_name: input.product_name,
        capability_origin_count: input.capability_origin.length,
        source_count: input.source_provenance.length,
      },
    });
    return candidate;
  }

  transitionStatus(id: string, to: ProductCandidateStatus, actor: string, event_kind: ProductLifecycleEventKind, now_iso: string = new Date().toISOString(), detail?: Record<string, unknown>): NexProductCandidate {
    const prior = this.mustGet(id);
    assertValidProductTransition(prior.status, to);
    const updated: NexProductCandidate = { ...prior, status: to };
    this.candidates.set(id, updated);
    this.history.append({
      candidate_id: id,
      kind: event_kind,
      actor,
      at_iso: now_iso,
      from_status: prior.status,
      to_status: to,
      detail,
    });
    return updated;
  }

  updateRoute(id: string, route_kind: "product" | "page" | "design" | "engineering", route: NexRouteReference, actor: string, now_iso: string = new Date().toISOString()): NexProductCandidate {
    const prior = this.mustGet(id);
    const updated: NexProductCandidate = { ...prior, routes: { ...prior.routes, [route_kind]: route } };
    this.candidates.set(id, updated);
    this.history.append({
      candidate_id: id,
      kind: "route_updated",
      actor,
      at_iso: now_iso,
      detail: { route_kind, status: route.status, path: route.path },
    });
    return updated;
  }

  relevancePair(id: string): RelevancePair {
    const c = this.mustGet(id);
    return { user_relevance: c.user_relevance, nex_relevance: c.nex_relevance };
  }

  averageRelevance(_id: string): never {
    throw new RelevanceAveragingProhibitedError("ProductCandidateStore.averageRelevance");
  }

  get(id: string): NexProductCandidate | null { return this.candidates.get(id) ?? null; }
  mustGet(id: string): NexProductCandidate {
    const v = this.candidates.get(id);
    if (!v) throw new Error(`product candidate not found: ${id}`);
    return v;
  }
  all(): ReadonlyArray<NexProductCandidate> { return Array.from(this.candidates.values()); }
  size(): number { return this.candidates.size; }
  _resetForTests(): void { this.candidates.clear(); this.next_seq = 1; }
}
