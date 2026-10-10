// src/lib/nex/marketing/deliverability/__tests__/acceptance-matrix.test.ts
//
// NEX World Email Intelligence · A-Z Acceptance Matrix
// Founder-authorised programme · Session-11 · Part 14 · 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  CATEGORIES, buildAcceptanceMatrix,
  checkInvariantA, checkInvariantB, checkInvariantC,
  checkInvariantL_reputation, checkInvariantM_domainAuthNull,
  checkInvariantN_bounceClassifier, checkInvariantO_unsubscribeWeightZero,
  checkInvariantQ_recorderNoReverseSuppression,
  checkInvariantT_verifierDispatcher, checkInvariantV_readinessAggregator,
  checkInvariantX_dnsCheckerNotDefault, checkInvariantY_gatesStrictOn,
  checkInvariantZ_standingLine,
  _MATRIX_NEVER_CLAIMS_WORLD_PROOF_WITHOUT_GATES,
  _MATRIX_PURE_AGGREGATION,
} from "..";

describe("A-Z Acceptance Matrix · shape", () => {
  it("exactly 26 categories (A through Z)", () => {
    expect(CATEGORIES).toHaveLength(26);
  });
  it("category letters are A..Z contiguous · no duplicates", () => {
    const letters = CATEGORIES.map(c => c.letter);
    const expected = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    expect(letters).toEqual(expected);
  });
  it("every category has a proven_by pointer", () => {
    for (const c of CATEGORIES) {
      expect(typeof c.proven_by).toBe("string");
      expect(c.proven_by.length).toBeGreaterThan(0);
    }
  });
  it("every category has a session_of_record + non-empty invariant", () => {
    for (const c of CATEGORIES) {
      expect(c.session_of_record).toBeTruthy();
      expect(c.invariant.length).toBeGreaterThan(20);
    }
  });
});

describe("A-Z Acceptance Matrix · structural invariants (executable)", () => {
  it("(A) entity resolution · normalizeBusinessName present", () => expect(checkInvariantA().ok).toBe(true));
  it("(B) email classifier · classifyEmail present", () => expect(checkInvariantB().ok).toBe(true));
  it("(C) walker · NULL_FETCHER default present", () => expect(checkInvariantC().ok).toBe(true));
  it("(L) reputation classifier exported", () => expect(checkInvariantL_reputation().ok).toBe(true));
  it("(M) NULL_DOMAIN_CHECKER remains module default", () => expect(checkInvariantM_domainAuthNull().ok).toBe(true));
  it("(N) bounce classifier exported", () => expect(checkInvariantN_bounceClassifier().ok).toBe(true));
  it("(O) unsubscribe weight = 0 · healthy signal never counted against reputation", () => {
    const r = checkInvariantO_unsubscribeWeightZero();
    expect(r.ok).toBe(true);
    expect(r.note).toContain("healthy signal");
  });
  it("(Q) recorder exports NO reverse-suppression function", () => {
    const r = checkInvariantQ_recorderNoReverseSuppression();
    expect(r.ok).toBe(true);
    expect(r.note).toBe("no reverse-suppression function exported");
  });
  it("(T) verifier dispatcher exported", () => expect(checkInvariantT_verifierDispatcher().ok).toBe(true));
  it("(V) readiness aggregator exported", () => expect(checkInvariantV_readinessAggregator().ok).toBe(true));
  it("(X) DnsDomainAuthChecker code-ready · NULL still default", () => {
    const r = checkInvariantX_dnsCheckerNotDefault();
    expect(r.ok).toBe(true);
  });
  it("(Y) activation gates reject ambiguous 'true' · require exactly 'on'", () => {
    const r = checkInvariantY_gatesStrictOn();
    expect(r.ok).toBe(true);
  });
  it("(Z) standing marketing status line preserved", () => {
    const r = checkInvariantZ_standingLine();
    expect(r.ok).toBe(true);
  });
});

describe("A-Z Acceptance Matrix · roll-up", () => {
  it("green_under_test count = 25 · founder_decision_deferred = 1 (X · gate #3)", () => {
    const m = buildAcceptanceMatrix();
    expect(m.counts.total).toBe(26);
    expect(m.counts.green_under_test).toBe(25);
    expect(m.counts.founder_decision_deferred).toBe(1);
    expect(m.counts.red_missing).toBe(0);
    expect(m.counts.amber_partial).toBe(0);
  });
  it("world_proof_state = partially_proven (deferred categories exist)", () => {
    const m = buildAcceptanceMatrix();
    expect(m.world_proof_state).toBe("partially_proven");
  });
  it("standing marketing status line preserved verbatim", () => {
    const m = buildAcceptanceMatrix();
    expect(m.standing_marketing_status_line).toBe(
      "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.",
    );
  });
  it("gate_status_line reports 26/26 with 1 deferred", () => {
    const m = buildAcceptanceMatrix();
    expect(m.gate_status_line).toMatch(/26\/26/);
    expect(m.gate_status_line).toMatch(/1 deferred to Founder/);
  });
});

describe("A-Z Acceptance Matrix · governance canaries", () => {
  it("boundary markers exported", () => {
    expect(_MATRIX_NEVER_CLAIMS_WORLD_PROOF_WITHOUT_GATES).toContain("fully_proven_requires_zero");
    expect(_MATRIX_PURE_AGGREGATION).toContain("no_mutation");
  });
  it("matrix module exports NO mutating function", async () => {
    const mod: any = await import("../acceptance-matrix");
    expect(mod.updateCategory).toBeUndefined();
    expect(mod.markCategoryGreen).toBeUndefined();
    expect(mod.forceWorldProof).toBeUndefined();
    expect(mod.overrideState).toBeUndefined();
  });
  it("world_proof_state is a computed property · derived from counts", () => {
    const m = buildAcceptanceMatrix();
    // Structural derivation: if any deferred → not fully_proven
    if (m.counts.founder_decision_deferred > 0 || m.counts.red_missing > 0) {
      expect(m.world_proof_state).not.toBe("fully_proven");
    }
  });
});
