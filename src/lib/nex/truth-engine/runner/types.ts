// src/lib/nex/truth-engine/runner/types.ts
//
// Truth Engine Fixture Runner · Stage 1a sub-step 1a.7 · types.
//
// Founder-authorised sub-step 1a.7 · 2026-09-11.
// Doctrine: run the 33 baseline fixtures (ADR-0314a.1) through the
// existing verifier + Guardian pipeline and compare current-state
// results to fixture expectations. Distinguish INTENTIONAL pending-policy
// divergences from UNEXPECTED divergences.
//
// Runner is a PURE library. All DB I/O lives in the CLI wrapper.

import type { VerdictEnvelope, VerdictKind } from "../verifier/types";
import type { GuardianDecision } from "../guardian/types";

/** Fixture row as loaded from nex_test.fixture_row */
export interface FixtureRow {
  readonly fixture_id: string;
  readonly fixture_set_version: string;
  readonly r_rule: string;
  readonly fixture_purpose: "positive" | "negative" | "fail_closed_unknown" | string;
  readonly input_row_shape: Readonly<Record<string, unknown>>;
  readonly domain: string | null;
  readonly cross_rule_interactions: readonly string[];
  readonly founder_authored: boolean;
  readonly authored_by: string | null;
  readonly notes: string | null;
}

/** Expected verdict as loaded from nex_test.fixture_expected */
export interface FixtureExpected {
  readonly fixture_id: string;
  readonly r_rule: string;
  readonly expected_verdict: "PASS" | "REJECT" | "UNKNOWN" | "CANDIDATE_FLAG" | "CONTRADICTION_RECORDED" | string;
  readonly expected_reason: string | null;
  readonly expected_confidence_band: string | null;
  readonly expected_threshold_version: string | null;
}

/**
 * Classification of a fixture result. Deterministic per (fixture, actual, expected).
 *
 * MATCH             — actual equals expected · pipeline behaves as ADR intends
 * INTENTIONAL       — actual diverges from expected AND divergence is
 *                     attributable to a founder-authored pending policy
 *                     (R-03/R-05/R-07/R-12/R-20 not yet populated; R-13
 *                     extensions pending; cross_substrate rule pending)
 * UNEXPECTED        — actual diverges from expected AND cannot be attributed
 *                     to an intentional pending-policy case. This is the
 *                     count that MUST be zero for Stage 1a exit.
 * NOT_RUNNABLE      — fixture cannot be executed by the current runner
 *                     (e.g. cross_substrate has no rule module today)
 */
export type FixtureClassification =
  | "MATCH"
  | "INTENTIONAL_PENDING_POLICY"
  | "UNEXPECTED"
  | "NOT_RUNNABLE";

/** Result of running one fixture through the pipeline. */
export interface FixtureResult {
  readonly fixture_id: string;
  readonly r_rule: string;
  readonly fixture_purpose: string;
  readonly expected_verdict: string;
  readonly expected_reason: string | null;
  readonly actual_verdict: VerdictKind | "NOT_RUNNABLE";
  readonly actual_reason: string | null;
  readonly classification: FixtureClassification;
  readonly guardian_accepted: boolean;
  readonly guardian_rejection_codes: readonly string[];
  readonly envelope: VerdictEnvelope | null;
  readonly guardian_decision: GuardianDecision | null;
}

/** Aggregated report across all fixtures for a single run. */
export interface RunnerReport {
  readonly runId: string;
  readonly fixturesEvaluated: number;
  readonly matches: number;
  readonly intentionalDivergences: number;
  readonly unexpectedDivergences: number;
  readonly notRunnable: number;
  readonly currentStateCounts: {
    readonly PASS: number;
    readonly FAIL: number;
    readonly UNKNOWN: number;
    readonly CANDIDATE_FLAG: number;
    readonly CONTRADICTION_RECORDED: number;
    readonly NOT_RUNNABLE: number;
  };
  readonly intentionalDivergencesByRule: Readonly<Record<string, number>>;
  readonly unexpectedByRule: Readonly<Record<string, readonly string[]>>;
  readonly perFixture: readonly FixtureResult[];
}

/** Comparison of N runs · byte-identical determinism proof. */
export interface DeterminismComparison {
  readonly runs: number;
  readonly identical: boolean;
  readonly divergingFixtures: readonly string[];
}
