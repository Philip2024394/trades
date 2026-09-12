// src/lib/nex/truth-engine/runner/fixture-runner.ts
//
// Truth Engine Fixture Runner · Stage 1a sub-step 1a.7 · pure logic.
//
// Founder-authorised sub-step 1a.7 · 2026-09-11.
// Doctrine:
//   - Pure library · no DB · no filesystem · no network
//   - Uses existing verifier · Guardian · rule modules unchanged
//   - Never manufactures or infers pending policy · pending rules stay UNKNOWN
//   - Deterministic classification of every fixture result
//   - Report can be diffed byte-identically across N runs

import { Verifier } from "../verifier/verifier";
import type { RuleModule, VerdictEnvelope, VerdictKind, VerifierInput } from "../verifier/types";
import { Guardian } from "../guardian/guardian";
import type { GuardianDecision } from "../guardian/types";
import type {
  FixtureClassification,
  FixtureExpected,
  FixtureResult,
  FixtureRow,
  RunnerReport,
  DeterminismComparison,
} from "./types";

/**
 * Rules whose founder-authored policy values are known-pending at Stage 1a.
 * When a fixture for one of these rules expects PASS · REJECT ·
 * CANDIDATE_FLAG · or CONTRADICTION_RECORDED but the rule produces
 * UNKNOWN with a canonical `_pending_` reason · the divergence is
 * classified as INTENTIONAL_PENDING_POLICY.
 *
 * This list matches sub-step 1a.4 pending-status rules verbatim.
 */
const PENDING_POLICY_RULES: ReadonlySet<string> = new Set([
  "R-03",  // voice mandate values pending
  "R-05",  // external authority registry pending
  "R-07",  // connection criteria pending
  "R-12",  // classification taxonomy enums pending
  "R-20",  // contradiction rule specifications pending
  "cross_substrate", // no rule module authored yet · Stage 1b
]);

/**
 * R-13 extensions (Bridge/Activity extensions) are pending founder authoring
 * per ADR-0314a.2.l. When a fail-closed R-13 fixture expects UNKNOWN with
 * `relationship_vocabulary_version=pending` but the current rule module
 * produces FAIL `unregistered_relation_kind` (baseline 8-value enforcement),
 * that divergence is intentional pending-policy.
 */
const R13_EXTENSION_PENDING_MARKER = "relationship_vocabulary_version=pending";

/**
 * Fixtures for rules that have no runnable rule module today. These are
 * skipped with actual_verdict = NOT_RUNNABLE. Not counted as unexpected.
 */
const NON_RUNNABLE_RULES: ReadonlySet<string> = new Set(["cross_substrate"]);

/**
 * Map fixture-level expected_verdict language (`REJECT`) to verifier-level
 * `RuleVerdict.verdict` values (`FAIL`). This is a translation-only map ·
 * it does not convert or promote verdicts. Guardian still enforces §7.7 H1
 * distinctions upstream.
 */
function normaliseExpectedVerdict(expected: string): VerdictKind | null {
  if (expected === "PASS") return "PASS";
  if (expected === "REJECT") return "FAIL";
  if (expected === "UNKNOWN") return "UNKNOWN";
  if (expected === "CANDIDATE_FLAG") return "CANDIDATE_FLAG";
  if (expected === "CONTRADICTION_RECORDED") return "CONTRADICTION_RECORDED";
  return null;
}

/**
 * Build a VerifierInput from a FixtureRow. R-18 fixtures need special
 * handling because R-18 reads from top-level VerifierInput fields
 * (objectSnapshotRef · evidenceRefs) not from context. All other rules
 * read from context.*.
 */
export function buildVerifierInput(fixture: FixtureRow): VerifierInput {
  const shape = fixture.input_row_shape as Record<string, unknown>;
  const envelopeCtx = (shape["envelope"] as Record<string, unknown> | undefined) ?? {};

  // Determine objectSnapshotRef: R-18 fixtures may encode empty strings
  // intentionally. Preserve the encoded value; otherwise fall back to
  // fixture_id (which is a valid UUID).
  const encodedRef = envelopeCtx["objectSnapshotRef"];
  const objectSnapshotRef =
    typeof encodedRef === "string" ? encodedRef : fixture.fixture_id;

  // Determine evidenceRefs: R-18 fixtures may encode null intentionally
  // to trigger the missing-rule_set_version path. Preserve the encoded
  // value (even null) so R-18 evaluates it faithfully.
  const encodedEvidence = envelopeCtx["evidenceRefs"];
  const evidenceRefs =
    Array.isArray(encodedEvidence) ? (encodedEvidence as string[]) :
    encodedEvidence === undefined ? [] :
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (encodedEvidence as any); // preserve null/other for R-18 to detect

  return {
    objectSnapshotRef,
    objectSnapshot: {},
    evidenceRefs: evidenceRefs as readonly string[],
    context: shape,
  };
}

/**
 * Classify a fixture result. Deterministic.
 */
export function classifyResult(
  fixture: FixtureRow,
  expected: FixtureExpected,
  actualVerdict: VerdictKind | "NOT_RUNNABLE",
  actualReason: string | null,
): FixtureClassification {
  if (actualVerdict === "NOT_RUNNABLE") return "NOT_RUNNABLE";

  const expectedNormalised = normaliseExpectedVerdict(expected.expected_verdict);
  if (expectedNormalised === null) return "UNEXPECTED"; // malformed expected

  const verdictMatches = actualVerdict === expectedNormalised;
  const reasonMatches =
    expected.expected_reason === null ||
    expected.expected_reason === actualReason;

  if (verdictMatches && reasonMatches) return "MATCH";

  // Divergence detected · check if intentional pending-policy
  if (PENDING_POLICY_RULES.has(fixture.r_rule)) {
    // For pending-policy rules · positive/negative/candidate/contradiction
    // fixtures produce UNKNOWN at current-state. That's intentional.
    if (actualVerdict === "UNKNOWN" && expectedNormalised !== "UNKNOWN") {
      return "INTENTIONAL_PENDING_POLICY";
    }
    // For pending-policy fail-closed fixtures · expected IS UNKNOWN. If
    // actual is also UNKNOWN but reason differs · we still count as
    // INTENTIONAL_PENDING_POLICY (reason mismatch on pending path).
    if (actualVerdict === "UNKNOWN" && expectedNormalised === "UNKNOWN") {
      return "INTENTIONAL_PENDING_POLICY";
    }
  }

  // R-13 fail-closed fixture: expected UNKNOWN `relationship_vocabulary_version=pending`
  // but current-state produces FAIL `unregistered_relation_kind` because
  // baseline 8-value enforcement is populated · extensions are pending.
  if (
    fixture.r_rule === "R-13" &&
    fixture.fixture_purpose === "fail_closed_unknown" &&
    expected.expected_reason === R13_EXTENSION_PENDING_MARKER &&
    actualVerdict === "FAIL"
  ) {
    return "INTENTIONAL_PENDING_POLICY";
  }

  return "UNEXPECTED";
}

/**
 * Execute one fixture through the verifier + Guardian pipeline. Pure.
 * Never mutates the verifier · Guardian · or fixture inputs.
 */
export function runFixture(
  fixture: FixtureRow,
  expected: FixtureExpected,
  verifier: Verifier,
  guardian: Guardian,
): FixtureResult {
  // Non-runnable rules (no rule module) short-circuit.
  if (NON_RUNNABLE_RULES.has(fixture.r_rule)) {
    return {
      fixture_id: fixture.fixture_id,
      r_rule: fixture.r_rule,
      fixture_purpose: fixture.fixture_purpose,
      expected_verdict: expected.expected_verdict,
      expected_reason: expected.expected_reason,
      actual_verdict: "NOT_RUNNABLE",
      actual_reason: null,
      classification: "NOT_RUNNABLE",
      guardian_accepted: false,
      guardian_rejection_codes: [],
      envelope: null,
      guardian_decision: null,
    };
  }

  const input = buildVerifierInput(fixture);
  const envelope: VerdictEnvelope = verifier.verify(input);

  // Find the specific rule's verdict in the envelope
  const ruleVerdict = envelope.perRuleVerdicts.find((v) => v.ruleId === fixture.r_rule);
  const actualVerdict: VerdictKind = ruleVerdict ? ruleVerdict.verdict : "UNKNOWN";
  const actualReason: string | null = ruleVerdict ? ruleVerdict.reason : null;

  // Guardian inspection · envelope-only action
  const guardianDecision: GuardianDecision = guardian.inspectEnvelopeOnly(envelope);
  const rejectionCodes = guardianDecision.accepted
    ? []
    : guardianDecision.rejections.map((r) => r.code);

  const classification = classifyResult(fixture, expected, actualVerdict, actualReason);

  return {
    fixture_id: fixture.fixture_id,
    r_rule: fixture.r_rule,
    fixture_purpose: fixture.fixture_purpose,
    expected_verdict: expected.expected_verdict,
    expected_reason: expected.expected_reason,
    actual_verdict: actualVerdict,
    actual_reason: actualReason,
    classification,
    guardian_accepted: guardianDecision.accepted,
    guardian_rejection_codes: rejectionCodes,
    envelope,
    guardian_decision: guardianDecision,
  };
}

/**
 * Execute the full fixture suite. Deterministic · pure. Same fixtures +
 * same verifier + same guardian → same report.
 */
export function runSuite(
  fixtures: readonly FixtureRow[],
  expectedMap: ReadonlyMap<string, FixtureExpected>,
  verifier: Verifier,
  guardian: Guardian,
  runId: string,
): RunnerReport {
  const perFixture: FixtureResult[] = [];
  for (const fixture of fixtures) {
    const expected = expectedMap.get(`${fixture.fixture_id}::${fixture.r_rule}`);
    if (!expected) {
      perFixture.push({
        fixture_id: fixture.fixture_id,
        r_rule: fixture.r_rule,
        fixture_purpose: fixture.fixture_purpose,
        expected_verdict: "MISSING",
        expected_reason: null,
        actual_verdict: "NOT_RUNNABLE",
        actual_reason: "expected_not_found",
        classification: "UNEXPECTED",
        guardian_accepted: false,
        guardian_rejection_codes: [],
        envelope: null,
        guardian_decision: null,
      });
      continue;
    }
    perFixture.push(runFixture(fixture, expected, verifier, guardian));
  }

  // Aggregate
  const currentStateCounts = {
    PASS: 0,
    FAIL: 0,
    UNKNOWN: 0,
    CANDIDATE_FLAG: 0,
    CONTRADICTION_RECORDED: 0,
    NOT_RUNNABLE: 0,
  };
  const intentionalDivergencesByRule: Record<string, number> = {};
  const unexpectedByRule: Record<string, string[]> = {};
  let matches = 0;
  let intentionalDivergences = 0;
  let unexpectedDivergences = 0;
  let notRunnable = 0;

  for (const r of perFixture) {
    if (r.actual_verdict === "NOT_RUNNABLE") {
      currentStateCounts.NOT_RUNNABLE += 1;
      notRunnable += 1;
    } else {
      currentStateCounts[r.actual_verdict] =
        (currentStateCounts[r.actual_verdict] ?? 0) + 1;
    }
    if (r.classification === "MATCH") matches += 1;
    else if (r.classification === "INTENTIONAL_PENDING_POLICY") {
      intentionalDivergences += 1;
      intentionalDivergencesByRule[r.r_rule] =
        (intentionalDivergencesByRule[r.r_rule] ?? 0) + 1;
    } else if (r.classification === "UNEXPECTED") {
      unexpectedDivergences += 1;
      if (!unexpectedByRule[r.r_rule]) unexpectedByRule[r.r_rule] = [];
      unexpectedByRule[r.r_rule].push(r.fixture_id);
    } else if (r.classification === "NOT_RUNNABLE") {
      intentionalDivergencesByRule[r.r_rule] =
        (intentionalDivergencesByRule[r.r_rule] ?? 0) + 1;
      intentionalDivergences += 1;
    }
  }

  return {
    runId,
    fixturesEvaluated: perFixture.length,
    matches,
    intentionalDivergences,
    unexpectedDivergences,
    notRunnable,
    currentStateCounts,
    intentionalDivergencesByRule: Object.freeze({ ...intentionalDivergencesByRule }),
    unexpectedByRule: Object.freeze(
      Object.fromEntries(
        Object.entries(unexpectedByRule).map(([k, v]) => [k, Object.freeze([...v])]),
      ),
    ),
    perFixture,
  };
}

/**
 * Deterministic-comparable projection of a run: sorted list of
 * (fixture_id, r_rule, actual_verdict, actual_reason, classification,
 *  guardian_accepted, guardian_rejection_codes). Envelope + guardian
 * decision are excluded because they contain per-run identifiers
 * (verifier_instance_id · verdictAt).
 */
export function projectRunForDeterminismCompare(
  report: RunnerReport,
): readonly string[] {
  const rows = report.perFixture.map((r) => {
    return JSON.stringify({
      fixture_id: r.fixture_id,
      r_rule: r.r_rule,
      actual_verdict: r.actual_verdict,
      actual_reason: r.actual_reason,
      classification: r.classification,
      guardian_accepted: r.guardian_accepted,
      guardian_rejection_codes: [...r.guardian_rejection_codes].sort(),
    });
  });
  return rows.sort();
}

/**
 * Compare N runs for byte-identical determinism.
 */
export function compareRunsForDeterminism(
  reports: readonly RunnerReport[],
): DeterminismComparison {
  if (reports.length === 0) {
    return { runs: 0, identical: true, divergingFixtures: [] };
  }
  const baseline = projectRunForDeterminismCompare(reports[0]);
  const diverging = new Set<string>();
  for (let i = 1; i < reports.length; i++) {
    const projected = projectRunForDeterminismCompare(reports[i]);
    if (projected.length !== baseline.length) {
      diverging.add("<row_count_mismatch>");
      continue;
    }
    for (let j = 0; j < baseline.length; j++) {
      if (projected[j] !== baseline[j]) {
        try {
          const parsed = JSON.parse(baseline[j]) as { fixture_id: string; r_rule: string };
          diverging.add(`${parsed.fixture_id}::${parsed.r_rule}`);
        } catch {
          diverging.add(baseline[j]);
        }
      }
    }
  }
  return {
    runs: reports.length,
    identical: diverging.size === 0,
    divergingFixtures: Object.freeze([...diverging].sort()),
  };
}

/**
 * Helper: build an expected-map indexed by `${fixture_id}::${r_rule}`.
 */
export function indexExpected(
  expected: readonly FixtureExpected[],
): ReadonlyMap<string, FixtureExpected> {
  const m = new Map<string, FixtureExpected>();
  for (const e of expected) {
    m.set(`${e.fixture_id}::${e.r_rule}`, e);
  }
  return m;
}

/**
 * Human-readable report line summary. Deterministic.
 */
export function formatRunnerReport(report: RunnerReport): string {
  const lines: string[] = [];
  lines.push(`RUN ${report.runId}`);
  lines.push(`fixtures evaluated: ${report.fixturesEvaluated}`);
  lines.push(`matches: ${report.matches}`);
  lines.push(`intentional pending-policy divergences: ${report.intentionalDivergences}`);
  lines.push(`unexpected divergences: ${report.unexpectedDivergences}`);
  lines.push(`not runnable: ${report.notRunnable}`);
  lines.push("");
  lines.push("current-state counts:");
  lines.push(`  PASS: ${report.currentStateCounts.PASS}`);
  lines.push(`  FAIL: ${report.currentStateCounts.FAIL}`);
  lines.push(`  UNKNOWN: ${report.currentStateCounts.UNKNOWN}`);
  lines.push(`  CANDIDATE_FLAG: ${report.currentStateCounts.CANDIDATE_FLAG}`);
  lines.push(`  CONTRADICTION_RECORDED: ${report.currentStateCounts.CONTRADICTION_RECORDED}`);
  lines.push(`  NOT_RUNNABLE: ${report.currentStateCounts.NOT_RUNNABLE}`);
  lines.push("");
  lines.push("intentional pending-policy divergence by rule:");
  const sortedRules = Object.keys(report.intentionalDivergencesByRule).sort();
  for (const r of sortedRules) {
    lines.push(`  ${r}: ${report.intentionalDivergencesByRule[r]}`);
  }
  if (report.unexpectedDivergences > 0) {
    lines.push("");
    lines.push("UNEXPECTED DIVERGENCES:");
    for (const [rule, fixtures] of Object.entries(report.unexpectedByRule)) {
      lines.push(`  ${rule}: ${fixtures.join(", ")}`);
    }
  }
  return lines.join("\n");
}
