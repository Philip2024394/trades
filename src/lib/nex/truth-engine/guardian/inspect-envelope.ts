// src/lib/nex/truth-engine/guardian/inspect-envelope.ts
//
// Truth Engine Guardian · Stage 1a sub-step 1a.5 · envelope inspection.
//
// Founder-authorised sub-step 1a.5 · 2026-09-11.
// Doctrine: ADR-0314e Section 4 (R-18 envelope shape) + §7.7 H1 (named
// fail-closed reasons) + D-11 (band drift = G-2 non-bypass) + Guardian
// deterministic gate role.
//
// Pure function. Inputs → GuardianRejection[]. No side effects. No
// database access. No AUTHORITATIVE promotion. No R-10 evaluation.

import type { RuleVerdict, VerdictEnvelope } from "../verifier/types";
import { computeTruthEngineOk } from "../verifier/envelope";
import { CANONICAL_FAIL_CLOSED_REASONS } from "../verifier/fail-closed";
import type { GuardianRejection } from "./types";

/**
 * Set of every canonical fail-closed reason string. Guardian uses this
 * to enforce that UNKNOWN / FAIL verdicts carry a reason drawn from the
 * founder-authored canonical set (per §7.7 H1). Non-canonical reasons
 * are rejected · never allowed to pass as "some reason string".
 */
const CANONICAL_REASON_SET: ReadonlySet<string> = new Set(
  Object.values(CANONICAL_FAIL_CLOSED_REASONS),
);

const VALID_VERDICT_KINDS: ReadonlySet<string> = new Set([
  "PASS",
  "FAIL",
  "UNKNOWN",
  "CANDIDATE_FLAG",
  "CONTRADICTION_RECORDED",
]);

const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Inspect envelope structure. Returns rejections for every invariant
 * violation found. Empty array = envelope structurally valid.
 */
export function inspectEnvelopeStructure(env: VerdictEnvelope): readonly GuardianRejection[] {
  const rejections: GuardianRejection[] = [];

  if (typeof env.verifierInstanceId !== "string" || env.verifierInstanceId.length === 0) {
    rejections.push({
      code: "envelope_missing_verifier_instance_id",
      message: "Envelope verifierInstanceId is empty or non-string.",
    });
  }
  if (typeof env.ruleSetVersion !== "string" || env.ruleSetVersion.length === 0) {
    rejections.push({
      code: "envelope_missing_rule_set_version",
      message: "Envelope ruleSetVersion is empty or non-string.",
    });
  }
  if (typeof env.guardianVersion !== "string" || env.guardianVersion.length === 0) {
    rejections.push({
      code: "envelope_missing_guardian_version",
      message: "Envelope guardianVersion is empty or non-string.",
    });
  }
  if (typeof env.objectSnapshotRef !== "string" || env.objectSnapshotRef.length === 0) {
    rejections.push({
      code: "envelope_missing_object_snapshot_ref",
      message: "Envelope objectSnapshotRef is empty or non-string.",
    });
  }
  if (typeof env.verdictAt !== "string" || !ISO_8601_REGEX.test(env.verdictAt)) {
    rejections.push({
      code: "envelope_verdict_at_malformed",
      message: "Envelope verdictAt is not ISO-8601.",
    });
  }
  // Stage 1a invariant: authorisation_policy_ref is ALWAYS null.
  // Any non-null value here is an R-10 promotion attempt.
  if (env.authorisationPolicyRef !== null) {
    rejections.push({
      code: "authorisation_policy_ref_non_null_at_stage_1a",
      message:
        "Envelope authorisationPolicyRef is non-null. Stage 1a forbids R-10 authorisation. Stage 2 wires this field.",
      detail: { authorisationPolicyRef: env.authorisationPolicyRef },
    });
  }
  return rejections;
}

/**
 * Inspect per-rule verdicts for §7.7 H1 compliance and rule-identity
 * integrity. Returns rejections for every invariant violation.
 */
export function inspectRuleVerdicts(env: VerdictEnvelope): readonly GuardianRejection[] {
  const rejections: GuardianRejection[] = [];
  const seenRuleIds = new Set<string>();

  for (const v of env.perRuleVerdicts) {
    if (typeof v.ruleId !== "string" || v.ruleId.length === 0) {
      rejections.push({
        code: "rule_id_mismatch",
        message: "Rule verdict has empty ruleId.",
      });
      continue;
    }
    if (typeof v.ruleVersion !== "string" || v.ruleVersion.length === 0) {
      rejections.push({
        code: "rule_version_mismatch",
        message: `Rule ${v.ruleId} verdict has empty ruleVersion.`,
        ruleId: v.ruleId,
      });
    }
    if (!VALID_VERDICT_KINDS.has(v.verdict)) {
      rejections.push({
        code: "verdict_kind_invalid",
        message: `Rule ${v.ruleId} verdict has invalid kind ${String(v.verdict)}.`,
        ruleId: v.ruleId,
      });
      continue;
    }
    if (seenRuleIds.has(v.ruleId)) {
      rejections.push({
        code: "rule_id_duplicated_in_verdicts",
        message: `Rule ${v.ruleId} appears more than once in per-rule verdicts.`,
        ruleId: v.ruleId,
      });
    } else {
      seenRuleIds.add(v.ruleId);
    }
    // §7.7 H1: UNKNOWN and FAIL must carry a named reason.
    if (v.verdict === "UNKNOWN") {
      if (v.reason === null || v.reason.length === 0) {
        rejections.push({
          code: "unknown_verdict_missing_reason",
          message: `Rule ${v.ruleId} produced UNKNOWN without a named reason (§7.7 H1).`,
          ruleId: v.ruleId,
        });
      } else if (!CANONICAL_REASON_SET.has(v.reason)) {
        rejections.push({
          code: "reason_not_canonical",
          message: `Rule ${v.ruleId} UNKNOWN reason "${v.reason}" is not in CANONICAL_FAIL_CLOSED_REASONS.`,
          ruleId: v.ruleId,
          detail: { reason: v.reason },
        });
      }
    }
    if (v.verdict === "FAIL") {
      if (v.reason === null || v.reason.length === 0) {
        rejections.push({
          code: "fail_verdict_missing_reason",
          message: `Rule ${v.ruleId} produced FAIL without a named reason (§7.7 H1).`,
          ruleId: v.ruleId,
        });
      } else if (!CANONICAL_REASON_SET.has(v.reason)) {
        rejections.push({
          code: "reason_not_canonical",
          message: `Rule ${v.ruleId} FAIL reason "${v.reason}" is not in CANONICAL_FAIL_CLOSED_REASONS.`,
          ruleId: v.ruleId,
          detail: { reason: v.reason },
        });
      }
    }
    // CONTRADICTION_RECORDED must also carry a reason (audit trail).
    if (v.verdict === "CONTRADICTION_RECORDED" && (v.reason === null || v.reason.length === 0)) {
      rejections.push({
        code: "fail_verdict_missing_reason",
        message: `Rule ${v.ruleId} produced CONTRADICTION_RECORDED without a named reason.`,
        ruleId: v.ruleId,
      });
    }
  }

  return rejections;
}

/**
 * Recompute truth_engine_ok from perRuleVerdicts and compare to the
 * stated value in the envelope. Silent conversion of UNKNOWN or FAIL
 * into a "passing" aggregate is detected here.
 *
 * Additional per-rule checks:
 *   - If verdict is UNKNOWN or FAIL but the envelope somehow claims
 *     truth_engine_ok=true, that's a silent-conversion attempt.
 */
export function inspectAggregate(env: VerdictEnvelope): readonly GuardianRejection[] {
  const rejections: GuardianRejection[] = [];
  const recomputed = computeTruthEngineOk(env.perRuleVerdicts, "all_must_pass");
  if (recomputed !== env.truthEngineOk) {
    rejections.push({
      code: "truth_engine_ok_recompute_mismatch",
      message: `Guardian recomputed truthEngineOk=${recomputed} but envelope states truthEngineOk=${env.truthEngineOk}.`,
      detail: { stated: env.truthEngineOk, recomputed },
    });
  }
  if (env.truthEngineOk === true) {
    // If aggregate claims true · but any verdict is UNKNOWN or FAIL · that's
    // a silent conversion attempt.
    const anyUnknown = env.perRuleVerdicts.some((v: RuleVerdict) => v.verdict === "UNKNOWN");
    const anyFail = env.perRuleVerdicts.some(
      (v: RuleVerdict) => v.verdict === "FAIL" || v.verdict === "CONTRADICTION_RECORDED",
    );
    if (anyUnknown) {
      rejections.push({
        code: "unknown_to_pass_conversion_detected",
        message:
          "Envelope claims truthEngineOk=true but at least one rule verdict is UNKNOWN. §7.7 H1: UNKNOWN never silently converted to PASS.",
      });
    }
    if (anyFail) {
      rejections.push({
        code: "fail_to_pass_conversion_detected",
        message:
          "Envelope claims truthEngineOk=true but at least one rule verdict is FAIL or CONTRADICTION_RECORDED.",
      });
    }
  }
  return rejections;
}
