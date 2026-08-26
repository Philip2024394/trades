import { describe, it, expect } from "vitest";
import {
  REJECTION_REASONS,
  CYCLE_OUTCOMES,
  createRejectionCounter,
  computeCycleOutcome,
} from "./rejection-reasons.mjs";

describe("createRejectionCounter", () => {
  it("starts with all reasons at zero and produces empty object", () => {
    const c = createRejectionCounter();
    expect(c.total()).toBe(0);
    expect(c.toObject()).toEqual({});
  });

  it("increments known reasons and reports totals excluding MATCHED_EXISTING", () => {
    const c = createRejectionCounter();
    c.increment(REJECTION_REASONS.CONTACT_MISSING);
    c.increment(REJECTION_REASONS.CONTACT_MISSING);
    c.increment(REJECTION_REASONS.MALFORMED);
    c.increment(REJECTION_REASONS.MATCHED_EXISTING, 5);
    expect(c.get(REJECTION_REASONS.CONTACT_MISSING)).toBe(2);
    expect(c.get(REJECTION_REASONS.MALFORMED)).toBe(1);
    expect(c.get(REJECTION_REASONS.MATCHED_EXISTING)).toBe(5);
    expect(c.total()).toBe(3); // matched_existing NOT counted as rejection
    expect(c.toObject()).toEqual({
      CONTACT_MISSING: 2,
      MALFORMED: 1,
      MATCHED_EXISTING: 5,
    });
  });

  it("routes unknown reasons to OTHER (never throws)", () => {
    const c = createRejectionCounter();
    c.increment("SOMETHING_NEW");
    c.increment("ANOTHER_UNKNOWN", 3);
    expect(c.get(REJECTION_REASONS.OTHER)).toBe(4);
    expect(c.toObject()).toEqual({ OTHER: 4 });
  });
});

describe("computeCycleOutcome", () => {
  it("returns PROVIDER_EMPTY when nothing came back", () => {
    expect(computeCycleOutcome({ providerReturned: 0 })).toBe(CYCLE_OUTCOMES.PROVIDER_EMPTY);
    expect(computeCycleOutcome({})).toBe(CYCLE_OUTCOMES.PROVIDER_EMPTY);
  });

  it("returns PROVIDER_ERROR when provider errored and nothing processed", () => {
    expect(
      computeCycleOutcome({ providerErrored: 1, providerReturned: 0 }),
    ).toBe(CYCLE_OUTCOMES.PROVIDER_ERROR);
  });

  it("returns ALL_DEDUPED when every processed row matched existing", () => {
    expect(
      computeCycleOutcome({
        recordsProcessed: 10, recordsNew: 0, matchedExisting: 10, providerReturned: 10,
      }),
    ).toBe(CYCLE_OUTCOMES.ALL_DEDUPED);
  });

  it("returns ALL_REJECTED when every processed row hit a gate", () => {
    expect(
      computeCycleOutcome({
        recordsProcessed: 10, recordsNew: 0, recordsRejected: 10, providerReturned: 10,
      }),
    ).toBe(CYCLE_OUTCOMES.ALL_REJECTED);
  });

  it("returns ALL_DEDUPED for mixed dedupe+reject when nothing new survived", () => {
    expect(
      computeCycleOutcome({
        recordsProcessed: 10, recordsNew: 0, recordsRejected: 3, matchedExisting: 7, providerReturned: 10,
      }),
    ).toBe(CYCLE_OUTCOMES.ALL_DEDUPED);
  });

  it("returns PARTIAL when some new and some rejected/deduped", () => {
    expect(
      computeCycleOutcome({
        recordsProcessed: 10, recordsNew: 4, recordsRejected: 3, matchedExisting: 3, providerReturned: 10,
      }),
    ).toBe(CYCLE_OUTCOMES.PARTIAL);
  });

  it("returns PRODUCTIVE when everything survived cleanly", () => {
    expect(
      computeCycleOutcome({
        recordsProcessed: 10, recordsNew: 10, providerReturned: 10,
      }),
    ).toBe(CYCLE_OUTCOMES.PRODUCTIVE);
  });

  it("returns NO_NEW_CANDIDATES as fallback (processed but unaccounted)", () => {
    expect(
      computeCycleOutcome({
        recordsProcessed: 10, recordsNew: 0, providerReturned: 10,
      }),
    ).toBe(CYCLE_OUTCOMES.NO_NEW_CANDIDATES);
  });

  describe("P8 · BUDGET_EXHAUSTED short-circuit", () => {
    it("returns BUDGET_EXHAUSTED when budgetExhausted:true (even with no other inputs)", () => {
      expect(computeCycleOutcome({ budgetExhausted: true })).toBe(CYCLE_OUTCOMES.BUDGET_EXHAUSTED);
    });

    it("BUDGET_EXHAUSTED wins over provider error signals", () => {
      expect(
        computeCycleOutcome({
          budgetExhausted: true,
          providerErrored: 1,
          providerReturned: 0,
        }),
      ).toBe(CYCLE_OUTCOMES.BUDGET_EXHAUSTED);
    });

    it("BUDGET_EXHAUSTED wins over PARTIAL signals (walker never queried; counts are stale)", () => {
      expect(
        computeCycleOutcome({
          budgetExhausted: true,
          recordsProcessed: 10, recordsNew: 4, recordsRejected: 3, matchedExisting: 3,
          providerReturned: 10,
        }),
      ).toBe(CYCLE_OUTCOMES.BUDGET_EXHAUSTED);
    });

    it("budgetExhausted:false preserves classic behaviour (PRODUCTIVE path)", () => {
      expect(
        computeCycleOutcome({
          budgetExhausted: false,
          recordsProcessed: 10, recordsNew: 10, providerReturned: 10,
        }),
      ).toBe(CYCLE_OUTCOMES.PRODUCTIVE);
    });

    it("signature backward-compat · omitting budgetExhausted still yields PRODUCTIVE", () => {
      expect(
        computeCycleOutcome({
          recordsProcessed: 10, recordsNew: 10, providerReturned: 10,
        }),
      ).toBe(CYCLE_OUTCOMES.PRODUCTIVE);
    });
  });
});
