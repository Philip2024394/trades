// src/lib/nex/truth-engine/verifier/rules/rules.test.ts
//
// Truth Engine Verifier · Stage 1a sub-step 1a.4 · rule module unit tests.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Test scope: individual rule modules · deterministic behaviour · verbatim
// founder-authored values · pending-policy UNKNOWN fail-closed · anti-
// substitution invariants. No database access. No production writes.

import { describe, it, expect } from "vitest";
import {
  ALL_RULES,
  LEVENSHTEIN_INITIAL_THRESHOLD,
  R01_THRESHOLDS,
  R11_BANDS,
  R13_BASELINE,
  RULE_R01,
  RULE_R03,
  RULE_R05,
  RULE_R07,
  RULE_R11,
  RULE_R12,
  RULE_R13,
  RULE_R17,
  RULE_R18,
  RULE_R20,
  deriveBand,
  evaluateR01,
  evaluateR03,
  evaluateR05,
  evaluateR07,
  evaluateR11,
  evaluateR12,
  evaluateR13,
  evaluateR17,
  evaluateR18,
  evaluateR20,
  levenshtein,
  normalisedLevenshtein,
  shouldVersion,
} from "./index";
import { createVerifier } from "../index";
import type { VerifierInput } from "../index";

const BASE_INPUT: VerifierInput = {
  objectSnapshotRef: "fixture-1",
  objectSnapshot: {},
  evidenceRefs: [],
};

function withCtx(context: Record<string, unknown>): VerifierInput {
  return { ...BASE_INPUT, context };
}

describe("R-01 · Plausibility (populated · 14 founder-authored thresholds · ADR-0314a.2.n)", () => {
  it("preserves the 14 founder-authored thresholds verbatim (anti-drift)", () => {
    expect(R01_THRESHOLDS).toHaveLength(14);
    const byKey = new Map(
      R01_THRESHOLDS.map((t) => [`${t.domain}.${t.attribute}`, t]),
    );
    expect(byKey.get("accommodation.star_rating")).toMatchObject({ min: 1, max: 5, zeroAllowed: false });
    expect(byKey.get("accommodation.rooms")).toMatchObject({ min: 1, max: 2000, zeroAllowed: false });
    expect(byKey.get("accommodation.price_per_night_idr")).toMatchObject({ min: 25000, max: 50000000, zeroAllowed: false });
    expect(byKey.get("food.table_count")).toMatchObject({ min: 1, max: 1000 });
    expect(byKey.get("food.price_per_meal_idr")).toMatchObject({ min: 5000, max: 5000000 });
    expect(byKey.get("commerce.mp_product.price_idr")).toMatchObject({ min: 100, max: 1000000000 });
    expect(byKey.get("commerce.mp_product.stock")).toMatchObject({ min: 0, max: 1000000, zeroAllowed: true });
    expect(byKey.get("services.chair_count")).toMatchObject({ min: 1, max: 5000 });
    expect(byKey.get("services.sq_m")).toMatchObject({ min: 4, max: 100000 });
    expect(byKey.get("transport.seats")).toMatchObject({ min: 1, max: 1500 });
    expect(byKey.get("transport.distance")).toMatchObject({ min: 0, max: 20000, zeroAllowed: true });
    expect(byKey.get("business.employee_count")).toMatchObject({ min: 1, max: 1000000 });
    expect(byKey.get("travel.trip_days")).toMatchObject({ min: 1, max: 365 });
    expect(byKey.get("attractions.admission_fee")).toMatchObject({ min: 0, max: 5000000, zeroAllowed: true });
  });

  it("PASS on in-range value (accommodation.star_rating=4)", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "accommodation", attribute: "star_rating", value: 4 } }),
    );
    expect(v.verdict).toBe("PASS");
    expect(v.thresholdVersion).toBe("plausibility_threshold.v1.0.0");
  });

  it("FAIL when value below min (star_rating=0 is unknown-proxy · forbidden)", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "accommodation", attribute: "star_rating", value: 0 } }),
    );
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toBe("zero_as_unknown_proxy_forbidden");
  });

  it("PASS on stock=0 (zero explicitly valid per Section 4)", () => {
    expect(
      evaluateR01(
        withCtx({ plausibility: { domain: "commerce", attribute: "mp_product.stock", value: 0 } }),
      ).verdict,
    ).toBe("PASS");
  });

  it("PASS on admission_fee=0 (free attractions exist)", () => {
    expect(
      evaluateR01(
        withCtx({ plausibility: { domain: "attractions", attribute: "admission_fee", value: 0 } }),
      ).verdict,
    ).toBe("PASS");
  });

  it("FAIL on value above max (rooms=999999)", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "accommodation", attribute: "rooms", value: 999999 } }),
    );
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toBe("plausibility_check_failed");
  });

  it("UNKNOWN on null value (never converted to very_low per §7.7 H1)", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "accommodation", attribute: "star_rating", value: null } }),
    );
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("plausibility_check_disabled_pending_thresholds");
  });

  it("UNKNOWN on unlisted attribute (Rule 9 · no inference)", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "accommodation", attribute: "made_up_attr", value: 5 } }),
    );
    expect(v.verdict).toBe("UNKNOWN");
  });

  it("UNKNOWN on unlisted domain (Rule 9 · no cross-domain inheritance)", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "not_a_domain", attribute: "star_rating", value: 4 } }),
    );
    expect(v.verdict).toBe("UNKNOWN");
  });

  it("FAIL on NaN / non-finite value", () => {
    const v = evaluateR01(
      withCtx({ plausibility: { domain: "accommodation", attribute: "star_rating", value: Number.NaN } }),
    );
    expect(v.verdict).toBe("FAIL");
  });

  it("PASS when no plausibility request supplied (nothing to evaluate)", () => {
    expect(evaluateR01(BASE_INPUT).verdict).toBe("PASS");
  });
});

describe("R-03 · Voice Mandate (pending · ADR-0317 · returns UNKNOWN)", () => {
  it("returns deterministic UNKNOWN with canonical reason", () => {
    const v = evaluateR03(BASE_INPUT);
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("voice_check_disabled_pending_mandate");
    expect(v.ruleVersion).toBe("R-03.v1.0.0");
    expect(v.thresholdVersion).toBe("voice_mandate.v1.0.0");
  });

  it("does not invoke an LLM (deterministic · same input → same verdict)", () => {
    const a = evaluateR03(BASE_INPUT);
    const b = evaluateR03(BASE_INPUT);
    expect(a).toEqual(b);
  });
});

describe("R-05 · External Authority Registry (pending · ADR-0314a.2.p · returns UNKNOWN)", () => {
  it("returns deterministic UNKNOWN with canonical reason", () => {
    const v = evaluateR05(BASE_INPUT);
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("authority_check_disabled_pending_registry");
  });

  it("registry membership is evidence-eligibility only · no verdict bypass", () => {
    // No registry authored → R-05 does not promote regardless of input claims.
    const withAuthority = evaluateR05(withCtx({ claimedAuthority: "gov.uk" }));
    expect(withAuthority.verdict).toBe("UNKNOWN");
  });
});

describe("R-07 · Connection Plausibility (pending · ADR-0314a.2.q · returns UNKNOWN)", () => {
  it("returns deterministic UNKNOWN with canonical reason", () => {
    const v = evaluateR07(BASE_INPUT);
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("plausibility_check_disabled_pending_criteria");
  });

  it("no graph evidence → UNKNOWN (never FAIL · missing evidence ≠ implausibility)", () => {
    expect(evaluateR07(BASE_INPUT).verdict).not.toBe("FAIL");
    expect(evaluateR07(BASE_INPUT).verdict).not.toBe("CONTRADICTION_RECORDED");
  });
});

describe("R-11 · Confidence + Band (populated · ADR-0314a.2.j · 6-band)", () => {
  it("preserves the 6-band founder-authored table verbatim", () => {
    expect(R11_BANDS).toHaveLength(6);
    expect(R11_BANDS.find((b) => b.band === "very_high")).toMatchObject({ min: 99, max: 100 });
    expect(R11_BANDS.find((b) => b.band === "high")).toMatchObject({ min: 95, max: 98 });
    expect(R11_BANDS.find((b) => b.band === "good")).toMatchObject({ min: 85, max: 94 });
    expect(R11_BANDS.find((b) => b.band === "moderate")).toMatchObject({ min: 70, max: 84 });
    expect(R11_BANDS.find((b) => b.band === "low")).toMatchObject({ min: 50, max: 69 });
    expect(R11_BANDS.find((b) => b.band === "very_low")).toMatchObject({ min: 0, max: 49 });
  });

  it("deriveBand · exact boundary values", () => {
    expect(deriveBand(100)).toBe("very_high");
    expect(deriveBand(99)).toBe("very_high");
    expect(deriveBand(98)).toBe("high");
    expect(deriveBand(95)).toBe("high");
    expect(deriveBand(94)).toBe("good");
    expect(deriveBand(85)).toBe("good");
    expect(deriveBand(84)).toBe("moderate");
    expect(deriveBand(70)).toBe("moderate");
    expect(deriveBand(69)).toBe("low");
    expect(deriveBand(50)).toBe("low");
    expect(deriveBand(49)).toBe("very_low");
    expect(deriveBand(0)).toBe("very_low");
  });

  it("deriveBand · null score → UNKNOWN (never very_low)", () => {
    expect(deriveBand(null)).toBe("unknown");
    // §7.7 H1 discipline: null NEVER silently converted to very_low
    expect(deriveBand(null)).not.toBe("very_low");
  });

  it("deriveBand · out-of-range → UNKNOWN", () => {
    expect(deriveBand(-1)).toBe("unknown");
    expect(deriveBand(101)).toBe("unknown");
    expect(deriveBand(Number.NaN)).toBe("unknown");
  });

  it("UNKNOWN score cannot promote (Guardian rejects · Stage 2 R-10 · verified here)", () => {
    const v = evaluateR11(withCtx({ confidence: { numericScore: null } }));
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("unknown_score_cannot_promote");
  });

  it("FAIL on out-of-range score", () => {
    expect(evaluateR11(withCtx({ confidence: { numericScore: 150 } })).verdict).toBe("FAIL");
    expect(evaluateR11(withCtx({ confidence: { numericScore: -5 } })).verdict).toBe("FAIL");
  });

  it("band drift → FAIL (G-2 non-bypass)", () => {
    // score 87 derives `good` · declared `high` → drift
    const v = evaluateR11(withCtx({ confidence: { numericScore: 87, declaredBand: "high" } }));
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toBe("band_drift_detected");
  });

  it("PASS when declared band matches derived band", () => {
    expect(
      evaluateR11(withCtx({ confidence: { numericScore: 87, declaredBand: "good" } })).verdict,
    ).toBe("PASS");
  });

  it("PASS when only numericScore supplied and in range", () => {
    expect(evaluateR11(withCtx({ confidence: { numericScore: 100 } })).verdict).toBe("PASS");
  });
});

describe("R-12 · Classification Taxonomy (pending · ADR-0314a.2.k · returns UNKNOWN)", () => {
  it("returns deterministic UNKNOWN with canonical reason", () => {
    const v = evaluateR12(BASE_INPUT);
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("classification_taxonomy_version=pending");
  });

  it("fails closed for unknown / unrecognised classification values", () => {
    // Regardless of any claimed classification · until per-Domain enums are
    // populated · R-12 fails-closed.
    const v = evaluateR12(withCtx({ classification: { value: "any_value_at_all" } }));
    expect(v.verdict).toBe("UNKNOWN");
  });
});

describe("R-13 · Relationship Vocabulary (populated · ADR-0314a.2.l · 8-value baseline)", () => {
  it("preserves the 8 founder-ratified baseline values verbatim", () => {
    expect(R13_BASELINE).toEqual([
      "synonym",
      "antonym",
      "hypernym",
      "hyponym",
      "related",
      "domain_of",
      "derived_from",
      "part_of",
    ]);
  });

  it("PASS on every one of the 8 baseline values", () => {
    for (const kind of R13_BASELINE) {
      expect(evaluateR13(withCtx({ relationship: { relationKind: kind } })).verdict).toBe("PASS");
    }
  });

  it("FAIL on an unregistered relation_kind (vocabulary not expanded)", () => {
    const v = evaluateR13(withCtx({ relationship: { relationKind: "invented_kind" } }));
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toBe("unregistered_relation_kind");
  });

  it("PASS when no relationship supplied (nothing to evaluate)", () => {
    expect(evaluateR13(BASE_INPUT).verdict).toBe("PASS");
  });
});

describe("R-17 · Versioning + Levenshtein (populated · ADR-0314a.2.m · 30% initial)", () => {
  it("locks the founder-authored initial threshold at 30%", () => {
    expect(LEVENSHTEIN_INITIAL_THRESHOLD).toBe(0.3);
  });

  it("levenshtein · deterministic edit-distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("normalisedLevenshtein · returns 0 for identical strings", () => {
    expect(normalisedLevenshtein("hello", "hello")).toBe(0);
  });

  it("shouldVersion · body change > 30% fires · ≤ 30% does not", () => {
    // "hello world" → "hello world" (0% change) · does NOT fire
    expect(shouldVersion({ oldBody: "hello world", newBody: "hello world" })).toBe(false);
    // "hello world" → "hello earth" (5 char change / 11 chars ≈ 45%) · fires
    expect(shouldVersion({ oldBody: "hello world", newBody: "hello earth" })).toBe(true);
  });

  it("shouldVersion · claim delta always fires (no threshold)", () => {
    expect(shouldVersion({ claimDelta: true })).toBe(true);
  });

  it("shouldVersion · authority / status / domain-reclass always fire", () => {
    expect(shouldVersion({ authorityChange: true })).toBe(true);
    expect(shouldVersion({ statusTransition: true })).toBe(true);
    expect(shouldVersion({ domainReclassification: true })).toBe(true);
  });

  it("shouldVersion · founder-declared significance overrides thresholds", () => {
    // Even with sub-threshold body change · founder-declared fires
    expect(
      shouldVersion({
        oldBody: "hello world",
        newBody: "hello world",
        founderDeclaredSignificance: true,
      }),
    ).toBe(true);
  });

  it("evaluateR17 · PASS with candidateFlagPayload.versionShouldFire", () => {
    const v = evaluateR17(
      withCtx({ versioning: { oldBody: "hello world", newBody: "hello earth" } }),
    );
    expect(v.verdict).toBe("PASS");
    expect(v.candidateFlagPayload?.versionShouldFire).toBe(true);
    expect(v.candidateFlagPayload?.thresholdApplied).toBe(0.3);
  });

  it("evaluateR17 · FAIL on wrong-typed body input", () => {
    const v = evaluateR17(withCtx({ versioning: { oldBody: 42 as unknown as string } }));
    expect(v.verdict).toBe("FAIL");
  });
});

describe("R-18 · Verifier Envelope Audit (populated · ADR-0314e)", () => {
  it("PASS with a valid input snapshot reference", () => {
    expect(evaluateR18(BASE_INPUT).verdict).toBe("PASS");
  });

  it("FAIL when objectSnapshotRef is empty", () => {
    const v = evaluateR18({ ...BASE_INPUT, objectSnapshotRef: "" });
    expect(v.verdict).toBe("FAIL");
    expect(v.reason).toBe("missing_verifier_instance_id");
  });

  it("is NOT a promotion mechanism · PASS does not carry AUTHORITATIVE authority", () => {
    // R-18 PASS is envelope-integrity attestation only. The verdict carries
    // no field that could authorise AUTHORITATIVE promotion.
    const v = evaluateR18(BASE_INPUT);
    expect(v.verdict).toBe("PASS");
    // Only the RuleVerdict-shape fields are present · no `promoted`,
    // `authoritative`, `authorised`, `policy_ref`, or similar signal.
    const allowedKeys = new Set([
      "ruleId",
      "ruleVersion",
      "verdict",
      "reason",
      "evidenceRefs",
      "thresholdVersion",
      "candidateFlagPayload",
    ]);
    for (const k of Object.keys(v)) {
      expect(allowedKeys.has(k)).toBe(true);
    }
    // No implicit promotion field
    expect((v as Record<string, unknown>).authoritative).toBeUndefined();
    expect((v as Record<string, unknown>).promoted).toBeUndefined();
    expect((v as Record<string, unknown>).authorisation_policy_ref).toBeUndefined();
  });
});

describe("R-20 · Contradiction (pending · ADR-0314a.2.r · returns UNKNOWN)", () => {
  it("returns deterministic UNKNOWN with canonical reason (never CONTRADICTION_RECORDED)", () => {
    const v = evaluateR20(BASE_INPUT);
    expect(v.verdict).toBe("UNKNOWN");
    expect(v.reason).toBe("cross_record_detection_pending_rules");
    // §7.7 H1: unknown NEVER silently becomes contradiction
    expect(v.verdict).not.toBe("CONTRADICTION_RECORDED");
  });

  it("difference / missing / wording / scope do NOT trigger contradiction", () => {
    // No matter what delta is presented, R-20 fails-closed to UNKNOWN
    // until founder authors per-attribute rules.
    const scenarios = [
      { delta: "wording difference: 'hotel' vs 'inn'" },
      { delta: "missing field: null star_rating" },
      { delta: "scope difference: room count 100 vs total 100+" },
      { delta: "value difference: 4 vs 5 stars" },
    ];
    for (const s of scenarios) {
      const v = evaluateR20(withCtx({ delta: s.delta }));
      expect(v.verdict).toBe("UNKNOWN");
      expect(v.verdict).not.toBe("CONTRADICTION_RECORDED");
    }
  });
});

describe("ALL_RULES composition", () => {
  it("exposes all 10 rules in canonical order", () => {
    expect(ALL_RULES).toHaveLength(10);
    expect(ALL_RULES.map((r) => r.ruleId)).toEqual([
      "R-01",
      "R-03",
      "R-05",
      "R-07",
      "R-11",
      "R-12",
      "R-13",
      "R-17",
      "R-18",
      "R-20",
    ]);
  });

  it("all rules carry a v1.0.0 version identifier", () => {
    for (const r of ALL_RULES) {
      expect(r.ruleVersion).toMatch(/^R-\d{2}\.v1\.0\.0(-baseline)?$/);
    }
  });

  it("plugs into createVerifier without error", () => {
    const v = createVerifier({
      verifierInstanceId: "rules-composition-test",
      guardianVersion: "guardian.v0.0.0-skeleton",
      rules: ALL_RULES,
    });
    expect(v.ruleCount()).toBe(10);
  });

  it("full pipeline · empty input · truth_engine_ok=false (pending rules block aggregate)", () => {
    const verifier = createVerifier({
      verifierInstanceId: "rules-composition-test",
      guardianVersion: "guardian.v0.0.0-skeleton",
      rules: ALL_RULES,
    });
    const env = verifier.verify(BASE_INPUT);
    expect(env.truthEngineOk).toBe(false);
    // Populated rules: R-01, R-11, R-13, R-17, R-18 → PASS
    // Pending rules: R-03, R-05, R-07, R-12, R-20 → UNKNOWN
    const unknowns = env.perRuleVerdicts.filter((v) => v.verdict === "UNKNOWN");
    const passes = env.perRuleVerdicts.filter((v) => v.verdict === "PASS");
    expect(unknowns.map((u) => u.ruleId).sort()).toEqual([
      "R-03",
      "R-05",
      "R-07",
      "R-12",
      "R-20",
    ]);
    expect(passes.map((p) => p.ruleId).sort()).toEqual([
      "R-01",
      "R-11",
      "R-13",
      "R-17",
      "R-18",
    ]);
    // Stage 1a invariant: authorisation_policy_ref always null
    expect(env.authorisationPolicyRef).toBeNull();
  });

  it("full pipeline is deterministic across repeated runs (reproducibility invariant)", () => {
    const verifier = createVerifier({
      verifierInstanceId: "rules-composition-test",
      guardianVersion: "guardian.v0.0.0-skeleton",
      rules: ALL_RULES,
    });
    const runs = [1, 2, 3, 4, 5].map(() =>
      verifier.verify(BASE_INPUT).perRuleVerdicts.map((v) => ({
        ruleId: v.ruleId,
        verdict: v.verdict,
        reason: v.reason,
      })),
    );
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]).toEqual(runs[0]);
    }
  });

  it("references and re-exports rules match verifier RuleModule shape", () => {
    for (const r of ALL_RULES) {
      expect(typeof r.evaluate).toBe("function");
      expect(typeof r.ruleId).toBe("string");
      expect(typeof r.ruleVersion).toBe("string");
    }
    // Individual imports match ALL_RULES entries
    expect(RULE_R01.ruleId).toBe("R-01");
    expect(RULE_R03.ruleId).toBe("R-03");
    expect(RULE_R05.ruleId).toBe("R-05");
    expect(RULE_R07.ruleId).toBe("R-07");
    expect(RULE_R11.ruleId).toBe("R-11");
    expect(RULE_R12.ruleId).toBe("R-12");
    expect(RULE_R13.ruleId).toBe("R-13");
    expect(RULE_R17.ruleId).toBe("R-17");
    expect(RULE_R18.ruleId).toBe("R-18");
    expect(RULE_R20.ruleId).toBe("R-20");
  });
});
