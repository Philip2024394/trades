// src/lib/nex/research-memory/opportunity-store.ts
//
// UWI · Wave 5 · M18 + M20 + M21 + M22 + M23 + M24 · Opportunity store
// Founder-authorised programme.
//
// This is the sanctioned entry point for creating / mutating opportunities.
// It enforces every founder-locked discipline at insert-time:
//   M20 · falsifiability of summary_hypothesis
//   M21 · supporting/contradicting arrays kept SEPARATE (never netted)
//   M22 · user_relevance + nex_relevance kept SEPARATE (never averaged)
//   M23 · state transitions validated against distinct-absorbing-states machine
//   M24 · cadence primitives recorded
//   M19 · every mutation appends to lifecycle-history

import type {
  EntityRef,
  Opportunity,
  OpportunityStatus,
  RelevancePair,
} from "./types";
import {
  RelevanceAveragingProhibitedError,
} from "./types";
import { assertFalsifiable } from "./falsifiability";
import { assertValidTransition } from "./opportunity-state-machine";
import { LifecycleHistoryLog, makeEvent } from "./lifecycle-history";
import type { FalsifiabilityCheck } from "./types";

export interface OpportunityCreateInput {
  readonly title: string;
  readonly summary_hypothesis: string;
  readonly falsifiability: FalsifiabilityCheck;
  readonly hypothesis_refs?: ReadonlyArray<EntityRef>;
  readonly finding_refs?: ReadonlyArray<EntityRef>;
  readonly source_refs?: ReadonlyArray<EntityRef>;
  readonly signal_classes?: ReadonlyArray<string>;
  readonly affected_capabilities?: ReadonlyArray<string>;
  readonly supporting_signals?: ReadonlyArray<string>;
  readonly contradicting_signals?: ReadonlyArray<string>;
  readonly user_relevance: number;
  readonly nex_relevance: number;
  readonly confidence: number;
  readonly novelty_score: number;
  readonly cadence: {
    readonly next_review_at_iso?: string | null;
    readonly decay_window_ms?: number | null;
    readonly cost_cap_units?: number | null;
    readonly cool_down_until_iso?: string | null;
  };
  readonly provenance?: Readonly<Record<string, unknown>>;
  readonly actor: string;
}

export class OpportunityStore {
  private opportunities = new Map<string, Opportunity>();
  private next_seq = 1;

  constructor(public readonly history: LifecycleHistoryLog) {}

  /** Create a new opportunity. Enforces M20 falsifiability at insert. */
  create(input: OpportunityCreateInput, now_iso: string = new Date().toISOString()): Opportunity {
    // M20 · falsifiability enforced or fail
    assertFalsifiable(input.falsifiability, "OpportunityStore.create");

    // M22 · relevance range sanity
    if (input.user_relevance < 0 || input.user_relevance > 1) throw new Error("user_relevance must be 0..1");
    if (input.nex_relevance < 0 || input.nex_relevance > 1) throw new Error("nex_relevance must be 0..1");

    const id = `opp-${this.next_seq++}`;
    const opp: Opportunity = {
      opportunity_id: id,
      created_at_iso: now_iso,
      title: input.title,
      summary_hypothesis: input.summary_hypothesis,
      status: "DISCOVERED",
      hypothesis_refs: input.hypothesis_refs ?? [],
      finding_refs: input.finding_refs ?? [],
      source_refs: input.source_refs ?? [],
      signal_classes: input.signal_classes ?? [],
      affected_capabilities: input.affected_capabilities ?? [],
      related_opportunity_ids: [],
      dependencies: [],
      supporting_signals: [...(input.supporting_signals ?? [])],
      contradicting_signals: [...(input.contradicting_signals ?? [])],
      user_relevance: input.user_relevance,
      nex_relevance: input.nex_relevance,
      last_reviewed_at_iso: now_iso,
      next_review_at_iso: input.cadence.next_review_at_iso ?? null,
      decay_window_ms: input.cadence.decay_window_ms ?? null,
      cost_cap_units: input.cadence.cost_cap_units ?? null,
      cool_down_until_iso: input.cadence.cool_down_until_iso ?? null,
      confidence: input.confidence,
      novelty_score: input.novelty_score,
      provenance: input.provenance ?? {},
    };
    this.opportunities.set(id, opp);
    this.history.append(makeEvent({
      opportunity_id: id,
      kind: "created",
      actor: input.actor,
      to_status: "DISCOVERED",
      at_iso: now_iso,
      detail: {
        title: input.title,
        confidence: input.confidence,
        novelty_score: input.novelty_score,
        user_relevance: input.user_relevance,
        nex_relevance: input.nex_relevance,
      },
    }));
    return opp;
  }

  /** Transition status (M23). Validates transition + appends event. */
  transitionStatus(id: string, to: OpportunityStatus, actor: string, now_iso: string = new Date().toISOString(), detail?: Record<string, unknown>): Opportunity {
    const prior = this.mustGet(id);
    assertValidTransition(prior.status, to);
    const updated: Opportunity = { ...prior, status: to, last_reviewed_at_iso: now_iso };
    this.opportunities.set(id, updated);
    this.history.append(makeEvent({
      opportunity_id: id,
      kind: "status_changed",
      actor,
      at_iso: now_iso,
      from_status: prior.status,
      to_status: to,
      detail,
    }));
    return updated;
  }

  /** Add supporting signal (M21). Kept SEPARATE from contradicting — never merged. */
  addSupportingSignal(id: string, signal: string, actor: string, now_iso: string = new Date().toISOString()): Opportunity {
    const prior = this.mustGet(id);
    const updated: Opportunity = { ...prior, supporting_signals: [...prior.supporting_signals, signal] };
    this.opportunities.set(id, updated);
    this.history.append(makeEvent({
      opportunity_id: id,
      kind: "supporting_signal_added",
      actor,
      at_iso: now_iso,
      detail: { signal },
    }));
    return updated;
  }

  /** Add contradicting signal (M21). Kept SEPARATE from supporting — never netted. */
  addContradictingSignal(id: string, signal: string, actor: string, now_iso: string = new Date().toISOString()): Opportunity {
    const prior = this.mustGet(id);
    const updated: Opportunity = { ...prior, contradicting_signals: [...prior.contradicting_signals, signal] };
    this.opportunities.set(id, updated);
    this.history.append(makeEvent({
      opportunity_id: id,
      kind: "contradicting_signal_added",
      actor,
      at_iso: now_iso,
      detail: { signal },
    }));
    return updated;
  }

  /** Return the SEPARATE pair — deliberately does NOT compute an average. */
  relevancePair(id: string): RelevancePair {
    const opp = this.mustGet(id);
    return { user_relevance: opp.user_relevance, nex_relevance: opp.nex_relevance };
  }

  /** Explicit refusal of any averaging attempt (M22 doctrine). */
  averageRelevance(_id: string): never {
    throw new RelevanceAveragingProhibitedError("OpportunityStore.averageRelevance");
  }

  get(id: string): Opportunity | null { return this.opportunities.get(id) ?? null; }
  mustGet(id: string): Opportunity {
    const v = this.opportunities.get(id);
    if (!v) throw new Error(`opportunity not found: ${id}`);
    return v;
  }
  all(): ReadonlyArray<Opportunity> { return Array.from(this.opportunities.values()); }
  size(): number { return this.opportunities.size; }
  _resetForTests(): void { this.opportunities.clear(); this.next_seq = 1; }
}
