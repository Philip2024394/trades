// src/lib/nex-agent/code-engine/capability-twin-nex.ts
//
// NEX1 · Twin NEX · Independent Inspection Layer (§13, §22)
// Ledger B additive · Zero LLM · Deterministic.
//
// FOUNDER PRINCIPLE (§13 verbatim)
//   "Twin NEX must NOT simply repeat NEX1's conclusion.
//    Its value comes from independent inspection."
//
// PURPOSE
//   Given NEX1's proposed change + observed evidence, Twin NEX runs its own
//   deterministic checks against the SAME evidence. It never trusts NEX1's
//   verdict transitively · it re-derives its own verdict from the raw signals.
//
//   Twin NEX outputs:
//     · independent_verdict
//     · agreement_with_primary
//     · challenge_reasons (concrete disagreement points)
//     · repair_proposal (if applicable)
//     · caller_must_decide: true (never authorises for NEX1)
//
// INVARIANTS
//   · Never trusts primary's verdict field · derives own verdict from evidence
//   · Never manufactures test results · only reports what evidence supplied
//   · Zero LLM · deterministic given same input
//   · Ledger B additive · never modifies frozen files

import { createHash } from "node:crypto";

export const TWIN_NEX_VERSION = "twin-nex.v1.2026-09-19";

// ── Input contract ───────────────────────────────────────────────────────

export interface PrimaryNexHandoff {
  readonly original_specification: string;
  readonly primary_verdict: string;                   // NEX1's claimed verdict
  readonly proposed_change_summary: string;
  readonly target_file: string | null;
  readonly target_test_id: string | null;
  readonly test_outputs_before: {
    readonly test_id: string;
    readonly passed: boolean;
  }[];
  readonly test_outputs_after: {
    readonly test_id: string;
    readonly passed: boolean;
  }[];
  readonly regression_test_ids: readonly string[];
  readonly patch_diff_lines_changed: number;
  readonly failure_class_from_primary: string | null;
  readonly runtime_evidence?: {
    readonly preview_state: string | null;
    readonly http_status: number | null;
    readonly runtime_error_observed: boolean;
  };
}

// ── Output contract ─────────────────────────────────────────────────────

export type TwinIndependentVerdict =
  | "INDEPENDENT_TARGET_VERIFIED"     // Twin observes F2P transition + P2P preserved
  | "INDEPENDENT_TARGET_NOT_ACHIEVED" // Twin observes F2P did not transition
  | "INDEPENDENT_REGRESSION_INTRODUCED"
  | "INDEPENDENT_NO_CHANGE_DETECTED"  // patch_diff_lines_changed === 0
  | "INDEPENDENT_INSUFFICIENT_EVIDENCE"
  | "INDEPENDENT_UNKNOWN";

export type AgreementStatus =
  | "AGREES_WITH_PRIMARY"
  | "CHALLENGES_PRIMARY_VERDICT"
  | "PRIMARY_VERDICT_UNKNOWN_SHAPE"
  | "INSUFFICIENT_EVIDENCE_TO_JUDGE";

export interface TwinNexAssessment {
  readonly independent_verdict: TwinIndependentVerdict;
  readonly agreement_with_primary: AgreementStatus;
  readonly challenge_reasons: readonly string[];
  readonly repair_proposal: {
    readonly kind:
      | "no_repair_needed"
      | "reconsider_hypothesis"
      | "rollback_change"
      | "extend_test_coverage"
      | "clarify_specification"
      | "no_repair_proposed_by_twin";
    readonly rationale: string;
  };
  readonly evidence_signals: readonly string[];
  readonly caller_must_decide: true;
  readonly input_digest: string;
  readonly assessed_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export function twinNexInspect(handoff: PrimaryNexHandoff): TwinNexAssessment {
  const signals: string[] = [];

  const beforeMap = new Map(handoff.test_outputs_before.map((t) => [t.test_id, t.passed]));
  const afterMap = new Map(handoff.test_outputs_after.map((t) => [t.test_id, t.passed]));

  // Derive independent verdict from raw evidence · NEVER from primary_verdict field.
  let independent_verdict: TwinIndependentVerdict;

  const targetBefore = handoff.target_test_id ? beforeMap.get(handoff.target_test_id) : undefined;
  const targetAfter = handoff.target_test_id ? afterMap.get(handoff.target_test_id) : undefined;
  const targetTransitioned = targetBefore === false && targetAfter === true;

  const regressed_ids: string[] = [];
  for (const rid of handoff.regression_test_ids) {
    const wasPass = beforeMap.get(rid) === true;
    const nowPass = afterMap.get(rid) === true;
    if (wasPass && !nowPass) regressed_ids.push(rid);
  }
  signals.push(`target_before=${targetBefore ?? "n/a"}`);
  signals.push(`target_after=${targetAfter ?? "n/a"}`);
  signals.push(`target_transitioned=${targetTransitioned}`);
  signals.push(`regressed_count=${regressed_ids.length}`);
  signals.push(`patch_diff_lines_changed=${handoff.patch_diff_lines_changed}`);

  if (handoff.patch_diff_lines_changed === 0) {
    independent_verdict = "INDEPENDENT_NO_CHANGE_DETECTED";
  } else if (regressed_ids.length > 0) {
    independent_verdict = "INDEPENDENT_REGRESSION_INTRODUCED";
  } else if (handoff.target_test_id === null) {
    independent_verdict = "INDEPENDENT_INSUFFICIENT_EVIDENCE";
  } else if (targetTransitioned) {
    independent_verdict = "INDEPENDENT_TARGET_VERIFIED";
  } else if (targetAfter === false) {
    independent_verdict = "INDEPENDENT_TARGET_NOT_ACHIEVED";
  } else if (targetAfter === undefined) {
    independent_verdict = "INDEPENDENT_INSUFFICIENT_EVIDENCE";
  } else {
    independent_verdict = "INDEPENDENT_UNKNOWN";
  }
  signals.push(`independent_verdict=${independent_verdict}`);

  // Compare with primary
  const primaryClaimsVerified = /VERIFIED|SUCCESS/i.test(handoff.primary_verdict);
  const primaryClaimsFailed = /FAILED|NOT_ACHIEVED|REGRESSION|BROKEN/i.test(handoff.primary_verdict);

  let agreement_with_primary: AgreementStatus;
  const challenge_reasons: string[] = [];

  if (independent_verdict === "INDEPENDENT_TARGET_VERIFIED" && primaryClaimsVerified) {
    agreement_with_primary = "AGREES_WITH_PRIMARY";
  } else if (primaryClaimsVerified && independent_verdict !== "INDEPENDENT_TARGET_VERIFIED") {
    agreement_with_primary = "CHALLENGES_PRIMARY_VERDICT";
    if (independent_verdict === "INDEPENDENT_NO_CHANGE_DETECTED") {
      challenge_reasons.push("primary_claims_verified_but_patch_shows_no_change");
    }
    if (independent_verdict === "INDEPENDENT_TARGET_NOT_ACHIEVED") {
      challenge_reasons.push("primary_claims_verified_but_target_test_did_not_pass_after_change");
    }
    if (independent_verdict === "INDEPENDENT_REGRESSION_INTRODUCED") {
      challenge_reasons.push(`primary_claims_verified_but_regression_introduced_in:${regressed_ids.join(",")}`);
    }
    if (independent_verdict === "INDEPENDENT_INSUFFICIENT_EVIDENCE") {
      challenge_reasons.push("primary_claims_verified_but_no_target_test_id_in_evidence");
    }
  } else if (primaryClaimsFailed && independent_verdict === "INDEPENDENT_TARGET_VERIFIED") {
    agreement_with_primary = "CHALLENGES_PRIMARY_VERDICT";
    challenge_reasons.push("primary_claims_failed_but_target_test_actually_transitioned_FAIL_to_PASS");
  } else if (primaryClaimsFailed && (
    independent_verdict === "INDEPENDENT_TARGET_NOT_ACHIEVED" ||
    independent_verdict === "INDEPENDENT_REGRESSION_INTRODUCED" ||
    independent_verdict === "INDEPENDENT_NO_CHANGE_DETECTED"
  )) {
    agreement_with_primary = "AGREES_WITH_PRIMARY";
  } else if (independent_verdict === "INDEPENDENT_INSUFFICIENT_EVIDENCE") {
    agreement_with_primary = "INSUFFICIENT_EVIDENCE_TO_JUDGE";
  } else {
    agreement_with_primary = "PRIMARY_VERDICT_UNKNOWN_SHAPE";
  }

  // Runtime evidence check
  if (handoff.runtime_evidence) {
    if (handoff.runtime_evidence.runtime_error_observed && primaryClaimsVerified) {
      challenge_reasons.push("primary_claims_verified_but_runtime_error_observed_at_preview_layer");
      if (agreement_with_primary === "AGREES_WITH_PRIMARY") {
        agreement_with_primary = "CHALLENGES_PRIMARY_VERDICT";
      }
    }
    if (handoff.runtime_evidence.preview_state === "BUILD_ERROR" && primaryClaimsVerified) {
      challenge_reasons.push("primary_claims_verified_but_preview_reports_build_error");
      if (agreement_with_primary === "AGREES_WITH_PRIMARY") {
        agreement_with_primary = "CHALLENGES_PRIMARY_VERDICT";
      }
    }
  }

  // Repair proposal
  const repair_proposal = buildRepairProposal(independent_verdict, agreement_with_primary, regressed_ids, handoff);

  return {
    independent_verdict,
    agreement_with_primary,
    challenge_reasons,
    repair_proposal,
    evidence_signals: signals,
    caller_must_decide: true,
    input_digest: createHash("sha256")
      .update(JSON.stringify({
        spec: handoff.original_specification,
        target_test: handoff.target_test_id,
        before: handoff.test_outputs_before,
        after: handoff.test_outputs_after,
        regressions: [...handoff.regression_test_ids].sort(),
        diff_lines: handoff.patch_diff_lines_changed,
      }))
      .digest("hex")
      .slice(0, 16),
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: TWIN_NEX_VERSION,
  };
}

function buildRepairProposal(
  verdict: TwinIndependentVerdict,
  agreement: AgreementStatus,
  regressed_ids: readonly string[],
  _handoff: PrimaryNexHandoff,
): TwinNexAssessment["repair_proposal"] {
  if (verdict === "INDEPENDENT_TARGET_VERIFIED" && agreement === "AGREES_WITH_PRIMARY") {
    return { kind: "no_repair_needed", rationale: "target transition observed and primary agrees" };
  }
  if (verdict === "INDEPENDENT_NO_CHANGE_DETECTED") {
    return {
      kind: "reconsider_hypothesis",
      rationale: "patch introduced zero lines of change · the original hypothesis about what needed changing is likely wrong",
    };
  }
  if (verdict === "INDEPENDENT_REGRESSION_INTRODUCED") {
    return {
      kind: "rollback_change",
      rationale: `regression detected in: ${regressed_ids.join(", ")} · roll back and re-plan a narrower change`,
    };
  }
  if (verdict === "INDEPENDENT_TARGET_NOT_ACHIEVED") {
    return {
      kind: "reconsider_hypothesis",
      rationale: "target test did not pass after change · the change hypothesis was wrong or the wrong file/symbol was modified",
    };
  }
  if (verdict === "INDEPENDENT_INSUFFICIENT_EVIDENCE") {
    return {
      kind: "extend_test_coverage",
      rationale: "no target test id supplied or test outputs incomplete · cannot judge without observed transition evidence",
    };
  }
  return { kind: "no_repair_proposed_by_twin", rationale: `verdict=${verdict} · agreement=${agreement}` };
}
