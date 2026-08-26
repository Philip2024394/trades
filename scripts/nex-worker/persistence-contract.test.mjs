// Regression tests for scripts/nex-worker/persistence-contract.mjs
// Philip 2026-08-26 P6 · lock in the P5 PROVIDER_ERROR saturation-fix behavior.

import { describe, it, expect } from "vitest";
import { isSaturationCountable } from "./persistence-contract.mjs";

describe("isSaturationCountable · P5 saturation-counter filter (Philip 2026-08-26)", () => {
  describe("outcomes that COUNT toward consecutive_zero_new_cycles", () => {
    it("PRODUCTIVE counts (would break the streak anyway via records_new>0)", () => {
      expect(isSaturationCountable("PRODUCTIVE")).toBe(true);
    });
    it("PARTIAL counts", () => {
      expect(isSaturationCountable("PARTIAL")).toBe(true);
    });
    it("ALL_DEDUPED counts · genuine zero-result signal", () => {
      expect(isSaturationCountable("ALL_DEDUPED")).toBe(true);
    });
    it("PROVIDER_EMPTY counts · genuine zero (provider returned nothing)", () => {
      expect(isSaturationCountable("PROVIDER_EMPTY")).toBe(true);
    });
    it("NO_NEW_CANDIDATES counts · genuine zero", () => {
      expect(isSaturationCountable("NO_NEW_CANDIDATES")).toBe(true);
    });
    it("ALL_REJECTED counts · walker chose to reject each candidate", () => {
      expect(isSaturationCountable("ALL_REJECTED")).toBe(true);
    });
    it("null counts · legacy pre-Phase-1 cycles have no cycle_outcome", () => {
      expect(isSaturationCountable(null)).toBe(true);
    });
    it("undefined counts · same legacy safety", () => {
      expect(isSaturationCountable(undefined)).toBe(true);
    });
    it("unknown outcome value counts · fails safe (don't silently ignore)", () => {
      expect(isSaturationCountable("SOMETHING_NEW_WE_ADDED_LATER")).toBe(true);
    });
  });

  describe("outcomes that DO NOT count (infrastructural noise)", () => {
    it("PROVIDER_ERROR does NOT count · upstream outage isn't a saturation signal", () => {
      expect(isSaturationCountable("PROVIDER_ERROR")).toBe(false);
    });
    it("FATAL does NOT count · walker crashed, not an honest zero-result", () => {
      expect(isSaturationCountable("FATAL")).toBe(false);
    });
    it("BUDGET_EXHAUSTED does NOT count · we didn't search, we have no evidence (P8)", () => {
      expect(isSaturationCountable("BUDGET_EXHAUSTED")).toBe(false);
    });
  });

  describe("nationwide-scale invariant (Philip's P4 finding)", () => {
    it("50 consecutive PROVIDER_ERROR cycles should produce 0 saturation credit", () => {
      const outcomes = Array(50).fill("PROVIDER_ERROR");
      const counted = outcomes.filter(isSaturationCountable).length;
      expect(counted).toBe(0);
    });
    it("mixed batch: 3 ALL_DEDUPED + 20 PROVIDER_ERROR → 3 counted", () => {
      const outcomes = [
        ...Array(3).fill("ALL_DEDUPED"),
        ...Array(20).fill("PROVIDER_ERROR"),
      ];
      const counted = outcomes.filter(isSaturationCountable).length;
      expect(counted).toBe(3);
    });
    it("mixed batch: 3 ALL_DEDUPED + 5 BUDGET_EXHAUSTED → 3 counted (P8)", () => {
      const outcomes = [
        ...Array(3).fill("ALL_DEDUPED"),
        ...Array(5).fill("BUDGET_EXHAUSTED"),
      ];
      const counted = outcomes.filter(isSaturationCountable).length;
      expect(counted).toBe(3);
    });
  });
});
