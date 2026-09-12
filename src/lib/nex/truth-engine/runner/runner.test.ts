// src/lib/nex/truth-engine/runner/runner.test.ts
//
// Truth Engine Fixture Runner · Stage 1a sub-step 1a.7 · unit tests.
//
// Pure library tests. No DB access. Uses hand-built fixtures + real
// verifier + real Guardian + real ALL_RULES.

import { describe, it, expect } from "vitest";
import { Verifier } from "../verifier/verifier";
import { createStage1aGuardian } from "../guardian/guardian";
import { ALL_RULES } from "../verifier/rules/index";
import {
  classifyResult,
  compareRunsForDeterminism,
  formatRunnerReport,
  indexExpected,
  runFixture,
  runSuite,
} from "./fixture-runner";
import type { FixtureExpected, FixtureRow } from "./types";

const GUARDIAN_VERSION = "guardian.v1.0.0-stage-1a";
const FIXED_CLOCK = () => "2026-09-11T08:00:00.000Z";

function makeVerifier() {
  return new Verifier(
    {
      verifierInstanceId: "runner-test-verifier-instance",
      guardianVersion: GUARDIAN_VERSION,
      rules: ALL_RULES,
    },
    "all_must_pass",
    FIXED_CLOCK,
  );
}

function makeGuardian() {
  return createStage1aGuardian(GUARDIAN_VERSION);
}

function makeFixture(
  id: string,
  rRule: string,
  purpose: FixtureRow["fixture_purpose"],
  inputShape: Record<string, unknown>,
): FixtureRow {
  return {
    fixture_id: id,
    fixture_set_version: "fixture_set.v1.0.0",
    r_rule: rRule,
    fixture_purpose: purpose,
    input_row_shape: inputShape,
    domain: null,
    cross_rule_interactions: [],
    founder_authored: true,
    authored_by: "Philip",
    notes: null,
  };
}

function makeExpected(
  id: string,
  rRule: string,
  expectedVerdict: FixtureExpected["expected_verdict"],
  expectedReason: string | null = null,
): FixtureExpected {
  return {
    fixture_id: id,
    r_rule: rRule,
    expected_verdict: expectedVerdict,
    expected_reason: expectedReason,
    expected_confidence_band: null,
    expected_threshold_version: null,
  };
}

describe("R-01 fixture execution (populated)", () => {
  it("R-01 positive · in-range → MATCH PASS", () => {
    const fx = makeFixture("f01p", "R-01", "positive", {
      plausibility: { domain: "accommodation", attribute: "star_rating", value: 4 },
    });
    const ex = makeExpected("f01p", "R-01", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("PASS");
    expect(r.classification).toBe("MATCH");
  });

  it("R-01 negative · out-of-range → MATCH FAIL (REJECT→FAIL translation)", () => {
    const fx = makeFixture("f01n", "R-01", "negative", {
      plausibility: { domain: "accommodation", attribute: "star_rating", value: 47 },
    });
    const ex = makeExpected("f01n", "R-01", "REJECT", "plausibility_check_failed");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("FAIL");
    expect(r.actual_reason).toBe("plausibility_check_failed");
    expect(r.classification).toBe("MATCH");
  });

  it("R-01 fail-closed · unauthored domain → MATCH UNKNOWN", () => {
    const fx = makeFixture("f01u", "R-01", "fail_closed_unknown", {
      plausibility: { domain: "unauthored_domain", attribute: "star_rating", value: 4 },
    });
    const ex = makeExpected(
      "f01u",
      "R-01",
      "UNKNOWN",
      "plausibility_check_disabled_pending_thresholds",
    );
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("UNKNOWN");
    expect(r.classification).toBe("MATCH");
  });
});

describe("Pending-policy rules produce INTENTIONAL_PENDING_POLICY divergences", () => {
  it("R-03 positive expects PASS · actual UNKNOWN → INTENTIONAL_PENDING_POLICY", () => {
    const fx = makeFixture("f03p", "R-03", "positive", { voice: { text: "compliant" } });
    const ex = makeExpected("f03p", "R-03", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("UNKNOWN");
    expect(r.classification).toBe("INTENTIONAL_PENDING_POLICY");
  });

  it("R-05 negative expects REJECT · actual UNKNOWN → INTENTIONAL_PENDING_POLICY", () => {
    const fx = makeFixture("f05n", "R-05", "negative", {
      authority: { source: "unregistered", registered: false },
    });
    const ex = makeExpected("f05n", "R-05", "REJECT", "unregistered_authority");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("UNKNOWN");
    expect(r.classification).toBe("INTENTIONAL_PENDING_POLICY");
  });

  it("R-07 negative expects CANDIDATE_FLAG · actual UNKNOWN → INTENTIONAL_PENDING_POLICY", () => {
    const fx = makeFixture("f07n", "R-07", "negative", {
      connection: { endpointA: null, endpointB: "concept:x", relation: "hypernym" },
    });
    const ex = makeExpected("f07n", "R-07", "CANDIDATE_FLAG");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("UNKNOWN");
    expect(r.classification).toBe("INTENTIONAL_PENDING_POLICY");
  });

  it("R-20 negative expects CONTRADICTION_RECORDED · actual UNKNOWN → INTENTIONAL_PENDING_POLICY", () => {
    const fx = makeFixture("f20n", "R-20", "negative", {
      contradiction: { delta: "authored", subject: "x" },
    });
    const ex = makeExpected("f20n", "R-20", "CONTRADICTION_RECORDED");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("UNKNOWN");
    expect(r.classification).toBe("INTENTIONAL_PENDING_POLICY");
  });
});

describe("R-11 · R-13 · R-17 · R-18 populated rules match", () => {
  it("R-11 positive → MATCH PASS", () => {
    const fx = makeFixture("f11p", "R-11", "positive", {
      confidence: { numericScore: 85, declaredBand: "good" },
    });
    const ex = makeExpected("f11p", "R-11", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.classification).toBe("MATCH");
  });

  it("R-13 positive · hypernym → MATCH PASS", () => {
    const fx = makeFixture("f13p", "R-13", "positive", {
      relationship: { relationKind: "hypernym" },
    });
    const ex = makeExpected("f13p", "R-13", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.classification).toBe("MATCH");
  });

  it("R-13 fail-closed · relationKind=null → INTENTIONAL_PENDING_POLICY (extensions pending)", () => {
    const fx = makeFixture("f13u", "R-13", "fail_closed_unknown", {
      relationship: { relationKind: null },
    });
    const ex = makeExpected(
      "f13u",
      "R-13",
      "UNKNOWN",
      "relationship_vocabulary_version=pending",
    );
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    // Current-state produces FAIL (baseline enforcement); aspirational expects UNKNOWN
    expect(r.actual_verdict).toBe("FAIL");
    expect(r.classification).toBe("INTENTIONAL_PENDING_POLICY");
  });

  it("R-17 positive → MATCH PASS", () => {
    const fx = makeFixture("f17p", "R-17", "positive", {
      versioning: {
        oldBody: "aaaaaaaaaaaaaaaaaaaa",
        newBody: "bbbbbbbbbbbbbbbbbbbb",
      },
    });
    const ex = makeExpected("f17p", "R-17", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.classification).toBe("MATCH");
  });

  it("R-18 positive · complete envelope → MATCH PASS", () => {
    const fx = makeFixture("f18p", "R-18", "positive", {
      envelope: { objectSnapshotRef: "fx-ref", evidenceRefs: ["ev-1"] },
    });
    const ex = makeExpected("f18p", "R-18", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.classification).toBe("MATCH");
  });

  it("R-18 negative · empty objectSnapshotRef → MATCH FAIL", () => {
    const fx = makeFixture("f18n", "R-18", "negative", {
      envelope: { objectSnapshotRef: "", evidenceRefs: ["ev-1"] },
    });
    const ex = makeExpected("f18n", "R-18", "REJECT", "missing_verifier_instance_id");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("FAIL");
    expect(r.actual_reason).toBe("missing_verifier_instance_id");
    expect(r.classification).toBe("MATCH");
  });

  it("R-18 fail-closed · evidenceRefs=null → MATCH FAIL (missing_rule_set_version)", () => {
    const fx = makeFixture("f18u", "R-18", "fail_closed_unknown", {
      envelope: { objectSnapshotRef: "fx", evidenceRefs: null },
    });
    const ex = makeExpected("f18u", "R-18", "REJECT", "missing_rule_set_version");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("FAIL");
    expect(r.actual_reason).toBe("missing_rule_set_version");
    expect(r.classification).toBe("MATCH");
  });
});

describe("cross_substrate is NOT_RUNNABLE (no rule module today)", () => {
  it("cross_substrate fixture short-circuits with NOT_RUNNABLE", () => {
    const fx = makeFixture("fcs", "cross_substrate", "positive", { crossSubstrate: {} });
    const ex = makeExpected("fcs", "cross_substrate", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.actual_verdict).toBe("NOT_RUNNABLE");
    expect(r.classification).toBe("NOT_RUNNABLE");
  });
});

describe("Guardian inspection runs on every fixture envelope", () => {
  it("valid envelope · guardian accepts", () => {
    const fx = makeFixture("f01p", "R-01", "positive", {
      plausibility: { domain: "accommodation", attribute: "star_rating", value: 4 },
    });
    const ex = makeExpected("f01p", "R-01", "PASS");
    const r = runFixture(fx, ex, makeVerifier(), makeGuardian());
    expect(r.guardian_accepted).toBe(true);
    expect(r.guardian_rejection_codes).toEqual([]);
  });
});

describe("Suite aggregation", () => {
  it("aggregates a small suite with mixed classifications", () => {
    const fixtures = [
      makeFixture("f01p", "R-01", "positive", {
        plausibility: { domain: "accommodation", attribute: "star_rating", value: 4 },
      }),
      makeFixture("f03p", "R-03", "positive", { voice: { text: "x" } }),
      makeFixture("fcs", "cross_substrate", "positive", { crossSubstrate: {} }),
    ];
    const expected = [
      makeExpected("f01p", "R-01", "PASS"),
      makeExpected("f03p", "R-03", "PASS"),
      makeExpected("fcs", "cross_substrate", "PASS"),
    ];
    const report = runSuite(
      fixtures,
      indexExpected(expected),
      makeVerifier(),
      makeGuardian(),
      "test-run",
    );
    expect(report.fixturesEvaluated).toBe(3);
    expect(report.matches).toBe(1); // R-01
    expect(report.intentionalDivergences).toBe(2); // R-03 + cross_substrate
    expect(report.unexpectedDivergences).toBe(0);
  });

  it("formatRunnerReport produces deterministic output", () => {
    const fixtures = [
      makeFixture("f01p", "R-01", "positive", {
        plausibility: { domain: "accommodation", attribute: "star_rating", value: 4 },
      }),
    ];
    const expected = [makeExpected("f01p", "R-01", "PASS")];
    const map = indexExpected(expected);
    const a = formatRunnerReport(runSuite(fixtures, map, makeVerifier(), makeGuardian(), "r"));
    const b = formatRunnerReport(runSuite(fixtures, map, makeVerifier(), makeGuardian(), "r"));
    expect(a).toBe(b);
  });
});

describe("Determinism · 5-run comparison", () => {
  it("5 identical runs → identical=true · divergingFixtures empty", () => {
    const fixtures = [
      makeFixture("f01p", "R-01", "positive", {
        plausibility: { domain: "accommodation", attribute: "star_rating", value: 4 },
      }),
      makeFixture("f03p", "R-03", "positive", { voice: { text: "x" } }),
      makeFixture("f11p", "R-11", "positive", {
        confidence: { numericScore: 85, declaredBand: "good" },
      }),
    ];
    const expected = [
      makeExpected("f01p", "R-01", "PASS"),
      makeExpected("f03p", "R-03", "PASS"),
      makeExpected("f11p", "R-11", "PASS"),
    ];
    const map = indexExpected(expected);
    const reports = [1, 2, 3, 4, 5].map((i) =>
      runSuite(fixtures, map, makeVerifier(), makeGuardian(), `run-${i}`),
    );
    const comparison = compareRunsForDeterminism(reports);
    expect(comparison.identical).toBe(true);
    expect(comparison.divergingFixtures).toEqual([]);
    expect(comparison.runs).toBe(5);
  });
});

describe("classifyResult · edge cases", () => {
  it("classifies missing expected as UNEXPECTED", () => {
    const fx = makeFixture("fmiss", "R-01", "positive", {});
    // Expected verdict = "NOT_A_REAL_VERDICT" · not normalisable
    const ex = makeExpected("fmiss", "R-01", "NOT_A_REAL_VERDICT" as never);
    const cls = classifyResult(fx, ex, "PASS", null);
    expect(cls).toBe("UNEXPECTED");
  });

  it("classifies pending-rule matching UNKNOWN reason as INTENTIONAL_PENDING_POLICY", () => {
    const fx = makeFixture("f03u", "R-03", "fail_closed_unknown", {});
    const ex = makeExpected("f03u", "R-03", "UNKNOWN", "voice_check_disabled_pending_mandate");
    // Actual is UNKNOWN but say reason differs (edge case)
    const cls = classifyResult(fx, ex, "UNKNOWN", "different_reason");
    expect(cls).toBe("INTENTIONAL_PENDING_POLICY");
  });
});
