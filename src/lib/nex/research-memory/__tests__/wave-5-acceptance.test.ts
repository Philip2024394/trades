// src/lib/nex/research-memory/__tests__/wave-5-acceptance.test.ts
//
// UWI · Wave 5 · Acceptance suite
// Founder-authorised programme.
//
// Proves M18-M24 disciplines under the founder-locked doctrine.

import { describe, it, expect, beforeEach } from "vitest";
import {
  assessFalsifiability,
  assertFalsifiable,
  NotFalsifiableError,
  isValidTransition,
  isSoftAbsorbing,
  isTerminalAbsorbing,
  assertValidTransition,
  outboundTransitions,
  InvalidTransitionError,
  evaluateCadence,
  scheduleNextReview,
  scheduleExponentialDecayReview,
  LifecycleHistoryLog,
  makeEvent,
  OpportunityStore,
  RelevanceAveragingProhibitedError,
  type EntityRef,
} from "..";

// ═══ M20 · Falsifiability discipline ═══════════════════════════════
describe("M20 · Falsifiability discipline", () => {
  it("passes when all three elements are meaningful", () => {
    const v = assessFalsifiability({
      predicted_effect: "user retention for the affected cohort increases by ≥5%",
      measurable_outcome: "measured via 30-day retention curve after intervention",
      refutation_condition: "retention curve shows ≤0% increase over 30 days · 3 cohorts",
    });
    expect(v.is_falsifiable).toBe(true);
    expect(v.missing_elements).toHaveLength(0);
    expect(v.downgrade_recommendation).toBe("keep_as_hypothesis");
  });

  it("flags missing predicted_effect", () => {
    const v = assessFalsifiability({
      predicted_effect: "",
      measurable_outcome: "measured retention",
      refutation_condition: "retention shows no change",
    });
    expect(v.is_falsifiable).toBe(false);
    expect(v.missing_elements).toContain("predicted_effect");
    expect(v.downgrade_recommendation).toBe("downgrade_to_observation");
  });

  it("flags vacuous placeholders", () => {
    const v = assessFalsifiability({
      predicted_effect: "TBD",
      measurable_outcome: "N/A",
      refutation_condition: "will happen",
    });
    expect(v.is_falsifiable).toBe(false);
    expect(v.missing_elements).toContain("predicted_effect");
    expect(v.missing_elements).toContain("measurable_outcome");
    expect(v.missing_elements).toContain("refutation_condition");
  });

  it("assertFalsifiable throws on invalid input", () => {
    expect(() => assertFalsifiable({ predicted_effect: "", measurable_outcome: "", refutation_condition: "" }, "test")).toThrow(NotFalsifiableError);
  });
});

// ═══ M23 · Opportunity state machine · distinct absorbing states ══
describe("M23 · Opportunity state machine · distinct absorbing states", () => {
  it("valid forward transitions", () => {
    expect(isValidTransition("DISCOVERED", "EVIDENCE_GATHERING")).toBe(true);
    expect(isValidTransition("EVIDENCE_GATHERING", "VALIDATING")).toBe(true);
    expect(isValidTransition("VALIDATING", "ACTIVE")).toBe(true);
    expect(isValidTransition("ACTIVE", "MONITORING")).toBe(true);
    expect(isValidTransition("MONITORING", "ACTIVE")).toBe(true); // re-activate
  });

  it("invalid transitions rejected", () => {
    expect(isValidTransition("DISCOVERED", "PROMOTED")).toBe(false);
    expect(isValidTransition("ARCHIVED", "DISCOVERED")).toBe(false);
    expect(() => assertValidTransition("DISCOVERED", "PROMOTED")).toThrow(InvalidTransitionError);
  });

  it("PARKED is reversible → MONITORING (wake from park)", () => {
    expect(isValidTransition("PARKED", "MONITORING")).toBe(true);
    expect(isSoftAbsorbing("PARKED")).toBe(true);
  });

  it("ARCHIVED is terminal", () => {
    expect(isTerminalAbsorbing("ARCHIVED")).toBe(true);
    expect(outboundTransitions("ARCHIVED")).toHaveLength(0);
  });

  it("REJECTED · MERGED · SUPERSEDED are DISTINCT soft-absorbing states (not collapsed)", () => {
    expect(isSoftAbsorbing("REJECTED")).toBe(true);
    expect(isSoftAbsorbing("MERGED")).toBe(true);
    expect(isSoftAbsorbing("SUPERSEDED")).toBe(true);
    // Each has its own transitions to ARCHIVED (not collapsed into single "ended")
    expect(isValidTransition("REJECTED", "ARCHIVED")).toBe(true);
    expect(isValidTransition("MERGED", "ARCHIVED")).toBe(true);
    expect(isValidTransition("SUPERSEDED", "ARCHIVED")).toBe(true);
    // But not directly convertible to each other (they mean different things)
    expect(isValidTransition("REJECTED", "MERGED")).toBe(false);
    expect(isValidTransition("MERGED", "REJECTED")).toBe(false);
  });
});

// ═══ M24 · Cadence primitives ═══════════════════════════════════════
describe("M24 · Cadence primitives", () => {
  const base = {
    last_reviewed_at_iso: "2026-09-21T00:00:00.000Z",
    next_review_at_iso: null,
    decay_window_ms: null,
    cost_cap_units: null,
    cool_down_until_iso: null,
    last_supporting_evidence_at_iso: null,
    cost_spent_units: 0,
  };

  it("not_yet_due when no next_review scheduled", () => {
    const d = evaluateCadence(base);
    expect(d.action).toBe("not_yet_due");
  });

  it("review_due when scheduled review is past", () => {
    const d = evaluateCadence({ ...base, next_review_at_iso: "2026-09-20T00:00:00.000Z" });
    expect(d.action).toBe("review_due");
  });

  it("not_yet_due when scheduled review is future", () => {
    const d = evaluateCadence(
      { ...base, next_review_at_iso: "2026-09-22T00:00:00.000Z" },
      "2026-09-21T00:00:00.000Z",
    );
    expect(d.action).toBe("not_yet_due");
  });

  it("in_cool_down when cool_down_until is future", () => {
    const d = evaluateCadence(
      { ...base, cool_down_until_iso: "2026-09-22T00:00:00.000Z" },
      "2026-09-21T00:00:00.000Z",
    );
    expect(d.action).toBe("in_cool_down");
  });

  it("cost_cap_reached when spent >= cap", () => {
    const d = evaluateCadence({ ...base, cost_cap_units: 100, cost_spent_units: 100 });
    expect(d.action).toBe("cost_cap_reached");
  });

  it("decay_triggered when no supporting evidence in decay_window", () => {
    const d = evaluateCadence(
      {
        ...base,
        decay_window_ms: 1000,
        last_supporting_evidence_at_iso: "2026-09-20T00:00:00.000Z",
      },
      "2026-09-21T00:00:00.000Z", // > 1000ms after last supporting
    );
    expect(d.action).toBe("decay_triggered");
  });

  it("scheduleExponentialDecayReview doubles per cycle up to cap", () => {
    const now = "2026-09-21T00:00:00.000Z";
    const t1 = scheduleExponentialDecayReview(1000, 0, 10_000, now);
    const t2 = scheduleExponentialDecayReview(1000, 1, 10_000, now);
    const t3 = scheduleExponentialDecayReview(1000, 5, 10_000, now); // capped
    const d1 = Date.parse(t1) - Date.parse(now);
    const d2 = Date.parse(t2) - Date.parse(now);
    const d3 = Date.parse(t3) - Date.parse(now);
    expect(d1).toBe(1000);
    expect(d2).toBe(2000);
    expect(d3).toBe(10_000); // cap
  });
});

// ═══ M19 · Immutable lifecycle_history log ═════════════════════════
describe("M19 · Immutable lifecycle_history log", () => {
  let log: LifecycleHistoryLog;
  beforeEach(() => { log = new LifecycleHistoryLog(); });

  it("append + fold to current status", () => {
    log.append(makeEvent({ opportunity_id: "opp-1", kind: "created", actor: "test", to_status: "DISCOVERED" }));
    log.append(makeEvent({ opportunity_id: "opp-1", kind: "status_changed", actor: "test", from_status: "DISCOVERED", to_status: "EVIDENCE_GATHERING" }));
    log.append(makeEvent({ opportunity_id: "opp-1", kind: "status_changed", actor: "test", from_status: "EVIDENCE_GATHERING", to_status: "VALIDATING" }));
    expect(log.currentStatus("opp-1")).toBe("VALIDATING");
  });

  it("append supporting + contradicting signals kept separate", () => {
    log.append(makeEvent({ opportunity_id: "opp-1", kind: "supporting_signal_added", actor: "test", detail: { signal: "S1" } }));
    log.append(makeEvent({ opportunity_id: "opp-1", kind: "contradicting_signal_added", actor: "test", detail: { signal: "C1" } }));
    log.append(makeEvent({ opportunity_id: "opp-1", kind: "supporting_signal_added", actor: "test", detail: { signal: "S2" } }));
    expect(log.supportingSignals("opp-1")).toEqual(["S1", "S2"]);
    expect(log.contradictingSignals("opp-1")).toEqual(["C1"]);
  });

  it("isolated by opportunity_id", () => {
    log.append(makeEvent({ opportunity_id: "opp-a", kind: "created", actor: "test", to_status: "DISCOVERED" }));
    log.append(makeEvent({ opportunity_id: "opp-b", kind: "created", actor: "test", to_status: "DISCOVERED" }));
    expect(log.countFor("opp-a")).toBe(1);
    expect(log.countFor("opp-b")).toBe(1);
    expect(log.size()).toBe(2);
  });
});

// ═══ M18 + M20 + M21 + M22 + M23 · OpportunityStore integration ═════
describe("M18 + M20 + M21 + M22 · OpportunityStore integration", () => {
  let log: LifecycleHistoryLog;
  let store: OpportunityStore;
  const goodFalsifiability = {
    predicted_effect: "user retention increases by ≥5% after intervention",
    measurable_outcome: "measured via 30-day retention curve",
    refutation_condition: "no improvement over 30 days · 3 cohorts",
  };

  beforeEach(() => {
    log = new LifecycleHistoryLog();
    store = new OpportunityStore(log);
  });

  it("M20 · create throws NotFalsifiableError on bad summary", () => {
    expect(() => store.create({
      title: "test",
      summary_hypothesis: "we should try things",
      falsifiability: { predicted_effect: "TBD", measurable_outcome: "N/A", refutation_condition: "" },
      user_relevance: 0.5, nex_relevance: 0.5, confidence: 0.5, novelty_score: 0.5,
      cadence: {}, actor: "test",
    })).toThrow(NotFalsifiableError);
  });

  it("M18 · typed edges preserved on create", () => {
    const finding_ref: EntityRef = { kind: "FINDING", id: "f-1" };
    const source_ref: EntityRef = { kind: "SOURCE_RECORD", id: "src-1" };
    const opp = store.create({
      title: "test",
      summary_hypothesis: "hyp",
      falsifiability: goodFalsifiability,
      finding_refs: [finding_ref], source_refs: [source_ref],
      user_relevance: 0.5, nex_relevance: 0.5, confidence: 0.5, novelty_score: 0.5,
      cadence: {}, actor: "test",
    });
    expect(opp.finding_refs[0]).toEqual(finding_ref);
    expect(opp.source_refs[0]).toEqual(source_ref);
    // Refs carry KIND — not just a plain string pointer
    expect(opp.finding_refs[0].kind).toBe("FINDING");
    expect(opp.source_refs[0].kind).toBe("SOURCE_RECORD");
  });

  it("M21 · supporting + contradicting arrays kept SEPARATE (never netted)", () => {
    const opp = store.create({
      title: "test", summary_hypothesis: "hyp", falsifiability: goodFalsifiability,
      user_relevance: 0.5, nex_relevance: 0.5, confidence: 0.5, novelty_score: 0.5,
      cadence: {}, actor: "test",
    });
    store.addSupportingSignal(opp.opportunity_id, "S1", "test");
    store.addContradictingSignal(opp.opportunity_id, "C1", "test");
    store.addSupportingSignal(opp.opportunity_id, "S2", "test");

    const updated = store.mustGet(opp.opportunity_id);
    expect(updated.supporting_signals).toEqual(["S1", "S2"]);
    expect(updated.contradicting_signals).toEqual(["C1"]);
    // The store does NOT provide a `net_signals()` method by design.
    expect((store as any).net_signals).toBeUndefined();
    // Lifecycle log preserves both separately
    expect(log.supportingSignals(opp.opportunity_id)).toEqual(["S1", "S2"]);
    expect(log.contradictingSignals(opp.opportunity_id)).toEqual(["C1"]);
  });

  it("M22 · relevancePair returns SEPARATE scores · averageRelevance throws", () => {
    const opp = store.create({
      title: "test", summary_hypothesis: "hyp", falsifiability: goodFalsifiability,
      user_relevance: 0.8, nex_relevance: 0.3, confidence: 0.5, novelty_score: 0.5,
      cadence: {}, actor: "test",
    });
    const pair = store.relevancePair(opp.opportunity_id);
    expect(pair.user_relevance).toBe(0.8);
    expect(pair.nex_relevance).toBe(0.3);
    // The doctrine-violating method explicitly throws
    expect(() => store.averageRelevance(opp.opportunity_id)).toThrow(RelevanceAveragingProhibitedError);
  });

  it("M23 · valid transitions accepted · invalid transitions rejected · absorbing distinctness preserved", () => {
    const opp = store.create({
      title: "test", summary_hypothesis: "hyp", falsifiability: goodFalsifiability,
      user_relevance: 0.5, nex_relevance: 0.5, confidence: 0.5, novelty_score: 0.5,
      cadence: {}, actor: "test",
    });
    store.transitionStatus(opp.opportunity_id, "EVIDENCE_GATHERING", "test");
    store.transitionStatus(opp.opportunity_id, "VALIDATING", "test");
    // Invalid direct jump
    expect(() => store.transitionStatus(opp.opportunity_id, "BUILT" as any, "test")).toThrow();
    // Legal parking
    store.transitionStatus(opp.opportunity_id, "PARKED", "test");
    // Wake from park
    store.transitionStatus(opp.opportunity_id, "MONITORING", "test");
    // Distinct rejected (not merged / superseded / archived)
    store.transitionStatus(opp.opportunity_id, "REJECTED", "test");
    const final = store.mustGet(opp.opportunity_id);
    expect(final.status).toBe("REJECTED");
    // History log records all transitions
    const history = log.forOpportunity(opp.opportunity_id).map(e => e.to_status).filter(Boolean);
    expect(history).toContain("EVIDENCE_GATHERING");
    expect(history).toContain("VALIDATING");
    expect(history).toContain("PARKED");
    expect(history).toContain("REJECTED");
  });
});
