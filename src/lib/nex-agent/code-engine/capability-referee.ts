// src/lib/nex-agent/code-engine/capability-referee.ts
//
// NEX1 · Referee · Evidence-Based Judge (§10, §14, §15, §22)
// Ledger B additive · Zero LLM · Deterministic.
//
// FOUNDER PRINCIPLE (§10 verbatim)
//   "The referee must ask: What evidence proves the claim?
//    Not: 'Does this look correct?'
//    The referee must never silently manufacture missing evidence."
//
// PURPOSE
//   Receive:
//     · primary NEX's claimed verdict
//     · Twin NEX's independent assessment
//     · raw evidence signals
//   Return:
//     · one of 5 evidence-based verdicts
//     · concrete evidence citations for the verdict
//     · missing_evidence list (never fabricated)
//
// INVARIANTS
//   · Never claims VERIFIED without concrete transition evidence
//   · Never claims FAILED without concrete failure evidence
//   · When primary and Twin disagree · defaults to CONFLICTING_EVIDENCE
//   · When evidence is missing · reports INSUFFICIENT_EVIDENCE (not UNKNOWN)
//   · Zero LLM · deterministic

import { createHash } from "node:crypto";
import type { TwinNexAssessment, PrimaryNexHandoff } from "./capability-twin-nex";

export const REFEREE_VERSION = "referee.v1.2026-09-19";

// ── 5 evidence-based verdicts (§10 verbatim) ────────────────────────────

export type RefereeVerdict =
  | "VERIFIED"
  | "FAILED"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING_EVIDENCE"
  | "SPECIFICATION_UNRESOLVED";

export interface RefereeInput {
  readonly primary_handoff: PrimaryNexHandoff;
  readonly twin_assessment: TwinNexAssessment;
  readonly specification_resolvable: boolean;
  readonly specification_unresolved_reason?: string | null;
}

export interface RefereeJudgement {
  readonly verdict: RefereeVerdict;
  readonly rationale: string;
  readonly evidence_citations: readonly {
    readonly kind: "test_transition" | "test_regression" | "patch_diff" | "runtime" | "specification" | "twin" | "primary";
    readonly claim: string;
    readonly source: string;
  }[];
  readonly missing_evidence: readonly string[];
  readonly primary_verdict: string;
  readonly twin_verdict: string;
  readonly caller_must_decide: true;
  readonly input_digest: string;
  readonly assessed_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export function refereeJudge(input: RefereeInput): RefereeJudgement {
  const { primary_handoff: handoff, twin_assessment: twin } = input;
  const citations: RefereeJudgement["evidence_citations"] = [];
  const missing: string[] = [];

  // 1. Specification resolvable?
  if (!input.specification_resolvable) {
    citations.push({
      kind: "specification",
      claim: `spec unresolvable · reason=${input.specification_unresolved_reason ?? "unspecified"}`,
      source: "referee_input.specification_resolvable=false",
    });
    return finalise("SPECIFICATION_UNRESOLVED", "specification is under-specified · cannot judge target behaviour", citations, missing, input, handoff, twin);
  }

  // 2. Twin flagged missing target test id → INSUFFICIENT_EVIDENCE
  if (twin.independent_verdict === "INDEPENDENT_INSUFFICIENT_EVIDENCE") {
    citations.push({
      kind: "twin",
      claim: "twin reports insufficient evidence",
      source: `twin.independent_verdict=${twin.independent_verdict}`,
    });
    if (!handoff.target_test_id) missing.push("target_test_id");
    if (handoff.test_outputs_after.length === 0) missing.push("test_outputs_after");
    return finalise("INSUFFICIENT_EVIDENCE", "twin analysis reports insufficient test evidence", citations, missing, input, handoff, twin);
  }

  // 3. Twin explicitly challenges primary → CONFLICTING_EVIDENCE
  if (twin.agreement_with_primary === "CHALLENGES_PRIMARY_VERDICT") {
    citations.push({
      kind: "primary",
      claim: `primary claims: ${handoff.primary_verdict}`,
      source: "primary_handoff.primary_verdict",
    });
    citations.push({
      kind: "twin",
      claim: `twin verdict: ${twin.independent_verdict}`,
      source: "twin_assessment.independent_verdict",
    });
    for (const reason of twin.challenge_reasons) {
      citations.push({
        kind: "twin",
        claim: `challenge: ${reason}`,
        source: "twin_assessment.challenge_reasons",
      });
    }
    return finalise("CONFLICTING_EVIDENCE", "primary and twin disagree · evidence is contested", citations, missing, input, handoff, twin);
  }

  // 4. Both agree · check which direction
  if (twin.independent_verdict === "INDEPENDENT_TARGET_VERIFIED") {
    // Require concrete transition evidence
    if (handoff.target_test_id) {
      const before = handoff.test_outputs_before.find((t) => t.test_id === handoff.target_test_id);
      const after = handoff.test_outputs_after.find((t) => t.test_id === handoff.target_test_id);
      if (before && after && before.passed === false && after.passed === true) {
        citations.push({
          kind: "test_transition",
          claim: `${handoff.target_test_id}: FAIL → PASS`,
          source: "primary_handoff.test_outputs_before + test_outputs_after",
        });
        return finalise("VERIFIED", "observed FAIL→PASS transition + twin agrees + no regression", citations, missing, input, handoff, twin);
      } else {
        // Twin said verified but referee can't corroborate · that's insufficient
        missing.push("observed_FAIL_to_PASS_transition");
        return finalise("INSUFFICIENT_EVIDENCE", "twin says verified but referee cannot confirm transition from raw evidence", citations, missing, input, handoff, twin);
      }
    }
    missing.push("target_test_id");
    return finalise("INSUFFICIENT_EVIDENCE", "no target test id · cannot cite transition evidence", citations, missing, input, handoff, twin);
  }

  if (twin.independent_verdict === "INDEPENDENT_TARGET_NOT_ACHIEVED") {
    if (handoff.target_test_id) {
      const after = handoff.test_outputs_after.find((t) => t.test_id === handoff.target_test_id);
      if (after && after.passed === false) {
        citations.push({
          kind: "test_transition",
          claim: `${handoff.target_test_id}: still FAIL after change`,
          source: "primary_handoff.test_outputs_after",
        });
        return finalise("FAILED", "target test did not pass after change · twin agrees", citations, missing, input, handoff, twin);
      }
    }
    return finalise("INSUFFICIENT_EVIDENCE", "twin reports not-achieved but referee cannot cite the failing test", citations, missing, input, handoff, twin);
  }

  if (twin.independent_verdict === "INDEPENDENT_REGRESSION_INTRODUCED") {
    for (const rid of handoff.regression_test_ids) {
      const before = handoff.test_outputs_before.find((t) => t.test_id === rid);
      const after = handoff.test_outputs_after.find((t) => t.test_id === rid);
      if (before?.passed === true && after?.passed === false) {
        citations.push({
          kind: "test_regression",
          claim: `${rid}: PASS → FAIL (regression)`,
          source: "primary_handoff.test_outputs_before + test_outputs_after",
        });
      }
    }
    return finalise("FAILED", "regression introduced · twin agrees", citations, missing, input, handoff, twin);
  }

  if (twin.independent_verdict === "INDEPENDENT_NO_CHANGE_DETECTED") {
    citations.push({
      kind: "patch_diff",
      claim: "patch_diff_lines_changed === 0",
      source: "primary_handoff.patch_diff_lines_changed",
    });
    return finalise("FAILED", "no change was actually made · claimed change did not occur", citations, missing, input, handoff, twin);
  }

  // Default fallback
  missing.push("interpretable_evidence_shape");
  return finalise("INSUFFICIENT_EVIDENCE", `twin verdict=${twin.independent_verdict} · referee cannot classify`, citations, missing, input, handoff, twin);
}

function finalise(
  verdict: RefereeVerdict,
  rationale: string,
  citations: readonly RefereeJudgement["evidence_citations"][number][],
  missing: readonly string[],
  input: RefereeInput,
  handoff: PrimaryNexHandoff,
  twin: TwinNexAssessment,
): RefereeJudgement {
  return {
    verdict,
    rationale,
    evidence_citations: citations,
    missing_evidence: missing,
    primary_verdict: handoff.primary_verdict,
    twin_verdict: twin.independent_verdict,
    caller_must_decide: true,
    input_digest: createHash("sha256")
      .update(JSON.stringify({
        primary: handoff.primary_verdict,
        twin: twin.independent_verdict,
        agreement: twin.agreement_with_primary,
        spec_resolvable: input.specification_resolvable,
      }))
      .digest("hex")
      .slice(0, 16),
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: REFEREE_VERSION,
  };
}
