// scripts/nex-canonical/rule-5m-proof-5-rule5j-soft-gates.test.ts
//
// Rule 5m · Proof 5 · Rule-5j SOFT gates on the eval corpus.
//
// SEALED CLAIM:
//   On the eval corpus, the resolver's measurement satisfies BOTH SOFT
//   gates:
//     · recall                        ≥ 70%
//     · abstention_rate_on_ambiguous  ≥ 80%
//   Failure of a SOFT gate per Rule 5j triggers MEASURED CORPUS EXPANSION
//   rather than threshold relaxation.
//
// EVIDENCE BINDING:
//   See `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md` · Proof 5.
//
// WHAT THIS PROOF ACTUALLY RUNS
//   The resolver is run against the sampled-from-real-data eval corpus.
//   The gate booleans come from the sealed `eval-measurement-runner`.
//
//   The AMBIGUOUS corpus is constructed by `_rule-5m-fixture-builder.mjs`
//   from food seeds · each ambiguous pair drops osm_id/phone/website and
//   keeps only name + city + coordinates. For these to measure as
//   AMBIGUOUS by the resolver, the pair must land in the
//   [AMBIGUOUS_THRESHOLD=0.55, MATCH_THRESHOLD=0.85) score band OR force
//   a too-close-to-second runner-up.
//
//   HONESTY · if abstention on the ambiguous corpus is below 80%, that's
//   a REAL finding: either (a) the resolver's abstention logic drifts,
//   or (b) the fixture's ambiguous pairs are mis-synthesised. Both
//   require founder/admin attention; the test does not relax its
//   assertions.

import { describe, expect, test } from "vitest";
import { runRule5mMeasurement } from "./rule-5m-measurement-runner";

const FIXED_NOW_ISO = "2026-10-09T00:00:00.000Z";

// ═════════════════════════════════════════════════════════════════════
// §1 · SOFT gates
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 5 · SOFT gate · recall ≥ 70%", () => {
  test("resolver measurement reports recall ≥ 0.70", () => {
    const artefact = runRule5mMeasurement(FIXED_NOW_ISO);
    expect(artefact.metrics.recall).toBeGreaterThanOrEqual(0.70);
    expect(artefact.rule_5j_gates.recall_ge_70pct).toBe(true);
  });
});

describe("Rule 5m · Proof 5 · SOFT gate · abstention_rate_on_ambiguous ≥ 80%", () => {
  test("resolver measurement reports abstention_rate_on_ambiguous ≥ 0.80", () => {
    const artefact = runRule5mMeasurement(FIXED_NOW_ISO);
    expect(artefact.metrics.abstention_rate_on_ambiguous).toBeGreaterThanOrEqual(0.80);
    expect(artefact.rule_5j_gates.abstention_ge_80pct).toBe(true);
  });
});

describe("Rule 5m · Proof 5 · SOFT gates · all_gates_pass is true", () => {
  test("sealed runner derives all_gates_pass from all four gates", () => {
    const artefact = runRule5mMeasurement(FIXED_NOW_ISO);
    expect(artefact.all_gates_pass).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Honest surfacing of the abstention mechanism
// ═════════════════════════════════════════════════════════════════════
//
// The resolver's `isAnswered(AMBIGUOUS)` and `abstained(reason)` are two
// DIFFERENT paths. The measurement runner counts "abstained_amb" when
// the IntelligenceResult is `isAbstained` AND when it is answered with
// kind=AMBIGUOUS (both land in the abstained_amb bucket per §3 of
// `eval-measurement-runner.ts`). This proof asserts the resulting
// abstention rate, which is the composite of both.

describe("Rule 5m · Proof 5 · ambiguous corpus is non-empty · gate is non-vacuous", () => {
  test("ambiguous pair count is ≥ 10 so the 80% gate is meaningful", () => {
    const artefact = runRule5mMeasurement(FIXED_NOW_ISO);
    expect(artefact.pairs_measured.ambiguous).toBeGreaterThanOrEqual(10);
  });
});
