// src/lib/nex/truth-engine/guardian/guardian.test.ts
//
// Truth Engine Guardian · Stage 1a sub-step 1a.5 · focused tests.
//
// Founder-authorised sub-step 1a.5 · 2026-09-11.
// Test scope covers the 10 founder-specified minimum checks + additional
// invariants:
//   1.  valid verifier result accepted
//   2.  rule ID mismatch rejected
//   3.  rule version mismatch rejected
//   4.  missing UNKNOWN/FAIL reason rejected (§7.7 H1)
//   5.  invalid/unknown classification rejected
//   6.  attempted promotion rejected
//   7.  attempted R-10 authorisation rejected
//   8.  attempted production persistence rejected
//   9.  malformed envelope rejected
//   10. deterministic repeated evaluation

import { describe, it, expect } from "vitest";
import {
  Guardian,
  createGuardian,
  createStage1aGuardian,
  createStage1aGuardianWithAllowlist,
  inspectAggregate,
  inspectEnvelopeStructure,
  inspectRuleVerdicts,
  isAccepted,
} from "./index";
import type {
  GuardianConfig,
  GuardianDecision,
  GuardianInspectionRequest,
} from "./index";
import { Verifier } from "../verifier/verifier";
import type { RuleModule, VerdictEnvelope, VerifierConfig } from "../verifier/index";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  passVerdict,
  unknownVerdict,
} from "../verifier/fail-closed";
import { ALL_RULES } from "../verifier/rules/index";

const GUARDIAN_VERSION = "guardian.v1.0.0-stage-1a";
const VERIFIER_INSTANCE = "verifier-instance-stage-1a-test";
const FIXED_CLOCK = () => "2026-09-11T08:00:00.000Z";

const BASE_VERIFIER_CONFIG: VerifierConfig = {
  verifierInstanceId: VERIFIER_INSTANCE,
  guardianVersion: GUARDIAN_VERSION,
  rules: [],
};

const BASE_INPUT = {
  objectSnapshotRef: "fixture-guardian-1",
  objectSnapshot: {},
  evidenceRefs: [],
};

const makePassRule = (id: string): RuleModule => ({
  ruleId: id,
  ruleVersion: `${id}.v1.0.0`,
  evaluate: () => passVerdict(id, `${id}.v1.0.0`),
});

function makeEnvelope(rules: readonly RuleModule[]): VerdictEnvelope {
  const verifier = new Verifier(
    { ...BASE_VERIFIER_CONFIG, rules },
    "all_must_pass",
    FIXED_CLOCK,
  );
  return verifier.verify(BASE_INPUT);
}

describe("Guardian construction", () => {
  it("requires non-empty guardianVersion", () => {
    expect(() => new Guardian({ guardianVersion: "", nexTestWritesPermitted: false })).toThrow(
      /guardianVersion/i,
    );
  });

  it("createStage1aGuardian produces guardian with nex_test writes forbidden", () => {
    const g = createStage1aGuardian(GUARDIAN_VERSION);
    expect(g.version()).toBe(GUARDIAN_VERSION);
    expect(g.nexTestWritesPermitted()).toBe(false);
  });

  it("createStage1aGuardianWithAllowlist binds to specific verifier instances", () => {
    const g = createStage1aGuardianWithAllowlist(GUARDIAN_VERSION, [VERIFIER_INSTANCE]);
    expect(g.nexTestWritesPermitted()).toBe(false);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = g.inspectEnvelopeOnly(env);
    expect(decision.accepted).toBe(true);
  });
});

describe("Founder-specified minimum test 1 · valid verifier result accepted", () => {
  it("accepts a well-formed all-pass envelope with envelope_only action", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01"), makePassRule("R-03")]);
    const decision = guardian.inspectEnvelopeOnly(env);
    expect(decision.accepted).toBe(true);
    if (decision.accepted) expect(decision.rejections).toEqual([]);
  });

  it("accepts an all-UNKNOWN envelope · pending-policy rules · truthEngineOk=false", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope(ALL_RULES);
    // ALL_RULES yields 5 PASS + 5 UNKNOWN → truthEngineOk=false. Guardian accepts.
    const decision = guardian.inspectEnvelopeOnly(env);
    expect(decision.accepted).toBe(true);
    expect(env.truthEngineOk).toBe(false);
    expect(env.perRuleVerdicts.filter((v) => v.verdict === "UNKNOWN")).toHaveLength(5);
  });
});

describe("Founder-specified minimum test 2 · rule ID mismatch rejected", () => {
  it("rejects when rule verdict has empty ruleId", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    // Mutate perRuleVerdicts to have empty ruleId
    const corrupted: VerdictEnvelope = {
      ...env,
      perRuleVerdicts: [{ ...env.perRuleVerdicts[0], ruleId: "" }],
    };
    const decision = guardian.inspectEnvelopeOnly(corrupted);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "rule_id_mismatch")).toBe(true);
    }
  });

  it("rejects when a rule id is duplicated across verdicts", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01"), makePassRule("R-03")]);
    // Duplicate R-01
    const corrupted: VerdictEnvelope = {
      ...env,
      perRuleVerdicts: [...env.perRuleVerdicts, env.perRuleVerdicts[0]],
    };
    const decision = guardian.inspectEnvelopeOnly(corrupted);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "rule_id_duplicated_in_verdicts")).toBe(true);
    }
  });
});

describe("Founder-specified minimum test 3 · rule version mismatch rejected", () => {
  it("rejects when rule verdict has empty ruleVersion", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const corrupted: VerdictEnvelope = {
      ...env,
      perRuleVerdicts: [{ ...env.perRuleVerdicts[0], ruleVersion: "" }],
    };
    const decision = guardian.inspectEnvelopeOnly(corrupted);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "rule_version_mismatch")).toBe(true);
    }
  });
});

describe("Founder-specified minimum test 4 · missing UNKNOWN/FAIL reason rejected (§7.7 H1)", () => {
  it("rejects UNKNOWN with null reason", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [
        {
          ruleId: "R-01",
          ruleVersion: "R-01.v1.0.0",
          verdict: "UNKNOWN",
          reason: null, // §7.7 H1 violation
          evidenceRefs: [],
        },
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "unknown_verdict_missing_reason")).toBe(true);
    }
  });

  it("rejects FAIL with null reason", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [
        {
          ruleId: "R-01",
          ruleVersion: "R-01.v1.0.0",
          verdict: "FAIL",
          reason: null,
          evidenceRefs: [],
        },
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "fail_verdict_missing_reason")).toBe(true);
    }
  });

  it("rejects UNKNOWN with non-canonical reason (fabricated string)", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [
        {
          ruleId: "R-01",
          ruleVersion: "R-01.v1.0.0",
          verdict: "UNKNOWN",
          reason: "I made this up · not canonical",
          evidenceRefs: [],
        },
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "reason_not_canonical")).toBe(true);
    }
  });

  it("accepts UNKNOWN with a canonical reason (R-05 pending)", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const goodEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [
        unknownVerdict(
          "R-05",
          "R-05.v1.0.0",
          CANONICAL_FAIL_CLOSED_REASONS.AUTHORITY_CHECK_DISABLED_PENDING_REGISTRY,
        ),
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(goodEnv);
    expect(decision.accepted).toBe(true);
  });
});

describe("Founder-specified minimum test 5 · invalid/unknown verdict kind rejected", () => {
  it("rejects an invalid verdict kind", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [
        {
          ruleId: "R-12",
          ruleVersion: "R-12.v1.0.0",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          verdict: "INVENTED_VERDICT_KIND" as any,
          reason: "irrelevant",
          evidenceRefs: [],
        },
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "verdict_kind_invalid")).toBe(true);
    }
  });
});

describe("Founder-specified minimum test 6 · attempted promotion rejected", () => {
  it("rejects promote_to_authoritative action deterministically", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspect({
      envelope: env,
      action: { kind: "promote_to_authoritative", target: "nex.knowledge_records" },
    });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some(
          (r) => r.code === "promotion_attempted_authoritative_forbidden",
        ),
      ).toBe(true);
    }
  });
});

describe("Founder-specified minimum test 7 · attempted R-10 authorisation rejected", () => {
  it("rejects apply_r10_authorisation action deterministically", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspect({
      envelope: env,
      action: { kind: "apply_r10_authorisation", policyRef: "r10.policy.v1.accommodation.rating" },
    });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "r10_authorisation_attempted_stage_2_only"),
      ).toBe(true);
    }
  });

  it("rejects envelope with non-null authorisationPolicyRef (silent R-10 injection)", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: "r10.policy.smuggled", // Stage 2 forbidden at Stage 1a
      truthEngineOk: false,
      perRuleVerdicts: [passVerdict("R-01", "R-01.v1.0.0")],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some(
          (r) => r.code === "authorisation_policy_ref_non_null_at_stage_1a",
        ),
      ).toBe(true);
    }
  });
});

describe("Founder-specified minimum test 8 · attempted production persistence rejected", () => {
  it("rejects write to nex.* schema", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspect({
      envelope: env,
      action: { kind: "write_production", schema: "nex", table: "knowledge_records" },
    });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "production_nex_write_attempted")).toBe(
        true,
      );
    }
  });

  it("rejects write to nex_lab schema", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspect({
      envelope: env,
      action: { kind: "write_production", schema: "nex_lab", table: "candidate_data" },
    });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "nex_lab_write_attempted")).toBe(true);
    }
  });

  it("rejects write to nex_test schema at Stage 1a (fixture-only posture)", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspect({
      envelope: env,
      action: { kind: "write_production", schema: "nex_test", table: "verifier_verdict" },
    });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "nex_test_write_attempted_stage_1a")).toBe(
        true,
      );
    }
  });
});

describe("Founder-specified minimum test 9 · malformed envelope rejected", () => {
  it("rejects envelope with empty verifierInstanceId", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: "",
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "envelope_missing_verifier_instance_id"),
      ).toBe(true);
    }
  });

  it("rejects envelope with malformed verdictAt", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: false,
      perRuleVerdicts: [],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "not-a-date",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "envelope_verdict_at_malformed")).toBe(true);
    }
  });

  it("rejects envelope where truthEngineOk is claimed true but a verdict is UNKNOWN", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: true, // ← silent conversion attempt
      perRuleVerdicts: [
        unknownVerdict(
          "R-05",
          "R-05.v1.0.0",
          CANONICAL_FAIL_CLOSED_REASONS.AUTHORITY_CHECK_DISABLED_PENDING_REGISTRY,
        ),
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      // Both recompute-mismatch AND unknown-to-pass detected (defensive redundancy)
      expect(
        decision.rejections.some((r) => r.code === "truth_engine_ok_recompute_mismatch"),
      ).toBe(true);
      expect(
        decision.rejections.some((r) => r.code === "unknown_to_pass_conversion_detected"),
      ).toBe(true);
    }
  });

  it("rejects envelope where truthEngineOk is claimed true but a verdict is FAIL", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const badEnv: VerdictEnvelope = {
      verifierInstanceId: VERIFIER_INSTANCE,
      ruleSetVersion: "rule_set.test",
      guardianVersion: GUARDIAN_VERSION,
      authorisationPolicyRef: null,
      truthEngineOk: true,
      perRuleVerdicts: [
        {
          ruleId: "R-01",
          ruleVersion: "R-01.v1.0.0",
          verdict: "FAIL",
          reason: CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_FAILED,
          evidenceRefs: [],
        },
      ],
      objectSnapshotRef: "fx",
      evidenceRefs: [],
      verdictAt: "2026-09-11T08:00:00.000Z",
    };
    const decision = guardian.inspectEnvelopeOnly(badEnv);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "fail_to_pass_conversion_detected"),
      ).toBe(true);
    }
  });

  it("rejects envelope whose guardianVersion doesn't match the Guardian instance", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const spoofed: VerdictEnvelope = { ...env, guardianVersion: "guardian.spoofed.v99" };
    const decision = guardian.inspectEnvelopeOnly(spoofed);
    expect(decision.accepted).toBe(false);
  });
});

describe("Founder-specified minimum test 10 · deterministic repeated evaluation", () => {
  it("produces identical decision across 5 successive inspections (reproducibility)", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope(ALL_RULES);
    const decisions: GuardianDecision[] = [];
    for (let i = 0; i < 5; i++) {
      decisions.push(guardian.inspectEnvelopeOnly(env));
    }
    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i]).toEqual(decisions[0]);
    }
  });

  it("recomputes truthEngineOk deterministically across runs", () => {
    const env = makeEnvelope(ALL_RULES);
    const a = inspectAggregate(env);
    const b = inspectAggregate(env);
    expect(a).toEqual(b);
  });
});

describe("Guardian anti-invention invariants", () => {
  it("has no method that could invent thresholds", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    // Guardian's public surface: inspect · inspectEnvelopeOnly · version · nexTestWritesPermitted
    const proto = Object.getPrototypeOf(guardian);
    const methods = Object.getOwnPropertyNames(proto).filter((k) => k !== "constructor");
    expect(methods.sort()).toEqual(
      ["inspect", "inspectEnvelopeOnly", "nexTestWritesPermitted", "version"].sort(),
    );
    // No method NAMES that START with an action verb (i.e. actively perform
    // mutation, promotion, or invention). Regex targets verb prefixes so it
    // catches methods like `setThreshold`, `updatePolicy`, `promoteRow`,
    // `authorise`, `createEntry` — while allowing read-only accessors whose
    // names contain those verbs as descriptors (e.g. `nexTestWritesPermitted`
    // is a read-only getter · not a writer).
    for (const m of methods) {
      expect(m).not.toMatch(/^(set|update|promote|authoris|create|invent|mutate|persist|apply|register|install)/i);
    }
    // Additionally · no method should include "Threshold" (which would imply
    // threshold mutation authority) or "Policy" (policy mutation authority).
    for (const m of methods) {
      expect(m).not.toMatch(/Threshold|Policy/);
    }
  });

  it("unknown action kind is rejected as policy-invention attempt", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspect({
      envelope: env,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: { kind: "smuggled_promotion" } as any,
    });
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "policy_invention_attempted")).toBe(true);
    }
  });
});

describe("Direct low-level inspection helpers", () => {
  it("inspectEnvelopeStructure returns rejections without side-effects", () => {
    const env = makeEnvelope([makePassRule("R-01")]);
    const rejections = inspectEnvelopeStructure(env);
    expect(rejections).toEqual([]);
  });

  it("inspectRuleVerdicts returns rejections without side-effects", () => {
    const env = makeEnvelope([makePassRule("R-01")]);
    const rejections = inspectRuleVerdicts(env);
    expect(rejections).toEqual([]);
  });

  it("isAccepted narrows the decision type", () => {
    const guardian = createStage1aGuardian(GUARDIAN_VERSION);
    const env = makeEnvelope([makePassRule("R-01")]);
    const decision = guardian.inspectEnvelopeOnly(env);
    expect(isAccepted(decision)).toBe(true);
  });
});

describe("Guardian with allowlist rejects unlisted verifier instance", () => {
  it("rejects an envelope from a verifier instance not in the allowlist", () => {
    const guardian = createStage1aGuardianWithAllowlist(GUARDIAN_VERSION, [
      "verifier-instance-A",
    ]);
    const env = makeEnvelope([makePassRule("R-01")]); // uses VERIFIER_INSTANCE
    const decision = guardian.inspectEnvelopeOnly(env);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "envelope_missing_verifier_instance_id"),
      ).toBe(true);
    }
  });
});
