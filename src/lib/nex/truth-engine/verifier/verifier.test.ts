// src/lib/nex/truth-engine/verifier/verifier.test.ts
//
// Truth Engine Verifier · Stage 1a · Skeleton smoke tests.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Test scope: verifier SKELETON only. Fixture-based rule tests are
// authored in sub-step 1a.6+ post-fixture-population. This test file
// verifies:
//   1. The skeleton compiles and instantiates without runtime error.
//   2. Envelope shape matches R-18 requirement.
//   3. authorisation_policy_ref is always null at Stage 1a.
//   4. Empty rule set produces truth_engine_ok=false (vacuously).
//   5. Duplicate rule registration throws.
//   6. UNKNOWN/FAIL without named reason throws (§7.7 H1 enforcement).
//   7. Rule-set version composition is deterministic.

import { describe, it, expect } from "vitest";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  Verifier,
  buildEnvelope,
  composeRuleSetVersion,
  computeTruthEngineOk,
  createVerifier,
  failVerdict,
  passVerdict,
  unknownVerdict,
} from "./index";
import type { RuleModule, VerifierConfig, VerifierInput } from "./index";

const FIXED_CLOCK = () => "2026-09-11T08:00:00.000Z";

const BASE_CONFIG: VerifierConfig = {
  verifierInstanceId: "test-instance-00000000-0000-4000-8000-000000000000",
  guardianVersion: "guardian.v0.0.0-skeleton-test",
  rules: [],
};

const BASE_INPUT: VerifierInput = {
  objectSnapshotRef: "fixture-test-ref-1",
  objectSnapshot: {},
  evidenceRefs: [],
};

function makePassRule(id: string, version = "v1.0.0"): RuleModule {
  return {
    ruleId: id,
    ruleVersion: `${id}.${version}`,
    evaluate: () => passVerdict(id, `${id}.${version}`),
  };
}

function makeUnknownRule(id: string, version = "v1.0.0"): RuleModule {
  return {
    ruleId: id,
    ruleVersion: `${id}.${version}`,
    evaluate: () =>
      unknownVerdict(
        id,
        `${id}.${version}`,
        CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_DISABLED_PENDING_THRESHOLDS,
      ),
  };
}

describe("Verifier skeleton (Stage 1a sub-step 1a.3)", () => {
  it("instantiates with zero rules", () => {
    const v = createVerifier(BASE_CONFIG);
    expect(v.ruleCount()).toBe(0);
    expect(v.ruleIds()).toEqual([]);
  });

  it("throws on missing verifierInstanceId", () => {
    expect(
      () =>
        new Verifier({
          verifierInstanceId: "",
          guardianVersion: "g.v0",
          rules: [],
        }),
    ).toThrow(/verifierInstanceId/i);
  });

  it("throws on missing guardianVersion", () => {
    expect(
      () =>
        new Verifier({
          verifierInstanceId: "id",
          guardianVersion: "",
          rules: [],
        }),
    ).toThrow(/guardianVersion/i);
  });

  it("throws on duplicate ruleId", () => {
    const dup = [makePassRule("R-01"), makePassRule("R-01")];
    expect(() => createVerifier({ ...BASE_CONFIG, rules: dup })).toThrow(
      /duplicate ruleId/i,
    );
  });

  it("produces envelope with authorisation_policy_ref = null (Stage 1a invariant)", () => {
    const v = new Verifier(
      { ...BASE_CONFIG, rules: [makePassRule("R-01")] },
      "all_must_pass",
      FIXED_CLOCK,
    );
    const env = v.verify(BASE_INPUT);
    expect(env.authorisationPolicyRef).toBeNull();
  });

  it("empty rule set produces truth_engine_ok = false (vacuously uncertifiable)", () => {
    const v = new Verifier(BASE_CONFIG, "all_must_pass", FIXED_CLOCK);
    const env = v.verify(BASE_INPUT);
    expect(env.truthEngineOk).toBe(false);
    expect(env.perRuleVerdicts).toEqual([]);
  });

  it("all PASS rules produce truth_engine_ok = true", () => {
    const v = new Verifier(
      {
        ...BASE_CONFIG,
        rules: [makePassRule("R-01"), makePassRule("R-03"), makePassRule("R-11")],
      },
      "all_must_pass",
      FIXED_CLOCK,
    );
    const env = v.verify(BASE_INPUT);
    expect(env.truthEngineOk).toBe(true);
    expect(env.perRuleVerdicts).toHaveLength(3);
  });

  it("any UNKNOWN blocks truth_engine_ok (fail-closed per §7.7 H1)", () => {
    const v = new Verifier(
      { ...BASE_CONFIG, rules: [makePassRule("R-01"), makeUnknownRule("R-05")] },
      "all_must_pass",
      FIXED_CLOCK,
    );
    const env = v.verify(BASE_INPUT);
    expect(env.truthEngineOk).toBe(false);
    // UNKNOWN preserved · NOT silently converted to FAIL
    expect(env.perRuleVerdicts.some((v) => v.verdict === "UNKNOWN")).toBe(true);
    expect(env.perRuleVerdicts.some((v) => v.verdict === "FAIL")).toBe(false);
  });

  it("R-18 envelope carries verifier_instance_id + rule_set_version + guardian_version", () => {
    const v = new Verifier(
      { ...BASE_CONFIG, rules: [makePassRule("R-01")] },
      "all_must_pass",
      FIXED_CLOCK,
    );
    const env = v.verify(BASE_INPUT);
    expect(env.verifierInstanceId).toBe(BASE_CONFIG.verifierInstanceId);
    expect(env.guardianVersion).toBe(BASE_CONFIG.guardianVersion);
    expect(env.ruleSetVersion).toMatch(/^rule_set\./);
  });

  it("rule-set version composition is deterministic across identical rule sets", () => {
    const rules = [makePassRule("R-01"), makePassRule("R-03"), makePassRule("R-05")];
    const v1 = composeRuleSetVersion(rules);
    const v2 = composeRuleSetVersion(rules);
    expect(v1).toBe(v2);
  });

  it("rule-set version composition is deterministic regardless of registration order", () => {
    const a = [makePassRule("R-01"), makePassRule("R-03"), makePassRule("R-05")];
    const b = [makePassRule("R-05"), makePassRule("R-01"), makePassRule("R-03")];
    expect(composeRuleSetVersion(a)).toBe(composeRuleSetVersion(b));
  });

  it("throws when rule returns mismatched ruleId (Guardian violation)", () => {
    const badRule: RuleModule = {
      ruleId: "R-01",
      ruleVersion: "R-01.v1.0.0",
      evaluate: () => passVerdict("R-99", "R-99.v1.0.0"),
    };
    const v = new Verifier(
      { ...BASE_CONFIG, rules: [badRule] },
      "all_must_pass",
      FIXED_CLOCK,
    );
    expect(() => v.verify(BASE_INPUT)).toThrow(/mismatched ruleId/i);
  });

  it("throws when UNKNOWN/FAIL verdict lacks a named reason (§7.7 H1)", () => {
    const unnamedFailRule: RuleModule = {
      ruleId: "R-99",
      ruleVersion: "R-99.v1.0.0",
      evaluate: () => ({
        ruleId: "R-99",
        ruleVersion: "R-99.v1.0.0",
        verdict: "FAIL",
        reason: null,
        evidenceRefs: [],
      }),
    };
    const v = new Verifier(
      { ...BASE_CONFIG, rules: [unnamedFailRule] },
      "all_must_pass",
      FIXED_CLOCK,
    );
    expect(() => v.verify(BASE_INPUT)).toThrow(/§7\.7 H1/);
  });

  it("verdict timestamp comes from injected clock (deterministic across runs)", () => {
    const v = new Verifier(BASE_CONFIG, "all_must_pass", FIXED_CLOCK);
    const env = v.verify(BASE_INPUT);
    expect(env.verdictAt).toBe("2026-09-11T08:00:00.000Z");
  });
});

describe("computeTruthEngineOk aggregation semantics", () => {
  it("empty verdicts → false (cannot certify without evaluation)", () => {
    expect(computeTruthEngineOk([])).toBe(false);
  });

  it("CANDIDATE_FLAG passes the aggregate (subjective tier never blocks)", () => {
    expect(
      computeTruthEngineOk([
        passVerdict("R-01", "R-01.v1.0.0"),
        {
          ruleId: "R-07",
          ruleVersion: "R-07.v1.0.0",
          verdict: "CANDIDATE_FLAG",
          reason: null,
          evidenceRefs: [],
        },
      ]),
    ).toBe(true);
  });

  it("CONTRADICTION_RECORDED blocks the aggregate", () => {
    expect(
      computeTruthEngineOk([
        passVerdict("R-01", "R-01.v1.0.0"),
        {
          ruleId: "R-20",
          ruleVersion: "R-20.v1.0.0",
          verdict: "CONTRADICTION_RECORDED",
          reason: "cross_record_detection_deterministic",
          evidenceRefs: [],
        },
      ]),
    ).toBe(false);
  });
});

describe("buildEnvelope invariants", () => {
  it("authorisation_policy_ref is always null at Stage 1a regardless of inputs", () => {
    const env = buildEnvelope(
      BASE_INPUT,
      { ...BASE_CONFIG, rules: [makePassRule("R-01")] },
      [passVerdict("R-01", "R-01.v1.0.0")],
      "all_must_pass",
      FIXED_CLOCK,
    );
    expect(env.authorisationPolicyRef).toBeNull();
  });
});
