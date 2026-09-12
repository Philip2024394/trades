// src/lib/nex/truth-engine/guardian/inspect-action.ts
//
// Truth Engine Guardian · Stage 1a sub-step 1a.5 · action inspection.
//
// Founder-authorised sub-step 1a.5 · 2026-09-11.
// Doctrine: Guardian rejects every proposed action outside Stage 1a scope.
//
// Stage 1a permits ONLY `envelope_only` inspection. Every other action
// kind is a Stage 2 (R-10 promotion), Stage 1b (nex_test writes), or
// Stage 6 (production integration) concern and is rejected here.

import type { GuardianAction, GuardianConfig, GuardianRejection } from "./types";

/**
 * Inspect a proposed post-verifier action. Returns rejections when the
 * action is out-of-scope for Stage 1a. Guardian NEVER executes the
 * action · it only decides whether callers are allowed to.
 */
export function inspectAction(
  action: GuardianAction,
  config: GuardianConfig,
): readonly GuardianRejection[] {
  switch (action.kind) {
    case "envelope_only":
      // Stage 1a: envelope inspection only · always allowed at this level.
      return [];
    case "promote_to_authoritative":
      return [
        {
          code: "promotion_attempted_authoritative_forbidden",
          message:
            "AUTHORITATIVE promotion is Stage 2 R-10 territory. Guardian at Stage 1a rejects deterministically.",
          detail: { target: action.target },
        },
      ];
    case "apply_r10_authorisation":
      return [
        {
          code: "r10_authorisation_attempted_stage_2_only",
          message:
            "R-10 authorisation policy application is Stage 2 territory. Guardian at Stage 1a rejects deterministically.",
          detail: { policyRef: action.policyRef },
        },
      ];
    case "write_production":
      return [inspectWriteAction(action, config)];
    default: {
      // Defensive: unknown action kinds are rejected · not silently allowed.
      const kind = (action as { kind: string }).kind;
      return [
        {
          code: "policy_invention_attempted",
          message: `Guardian rejects unknown action kind "${kind}" as a policy-invention attempt.`,
          detail: { kind },
        },
      ];
    }
  }
}

function inspectWriteAction(
  action: { readonly kind: "write_production"; readonly schema: "nex" | "nex_lab" | "nex_test"; readonly table: string },
  config: GuardianConfig,
): GuardianRejection {
  if (action.schema === "nex") {
    return {
      code: "production_nex_write_attempted",
      message: "Guardian at Stage 1a rejects any write to production `nex.*` schema.",
      detail: { schema: action.schema, table: action.table },
    };
  }
  if (action.schema === "nex_lab") {
    return {
      code: "nex_lab_write_attempted",
      message: "Guardian at Stage 1a rejects any write to `nex_lab_*` schema.",
      detail: { schema: action.schema, table: action.table },
    };
  }
  // nex_test writes permitted only when config allows (Stage 1b posture).
  if (!config.nexTestWritesPermitted) {
    return {
      code: "nex_test_write_attempted_stage_1a",
      message:
        "Guardian at Stage 1a rejects `nex_test.*` writes. Fixture-only posture preserved. Stage 1b or explicit founder authorisation required.",
      detail: { schema: action.schema, table: action.table },
    };
  }
  // If we reach here, config explicitly permits nex_test writes AND the
  // schema is nex_test. Even so · Stage 1a default configuration should
  // not enable this. This branch is only reachable when a caller
  // explicitly constructs a Stage 1b-posture GuardianConfig.
  return {
    code: "nex_test_write_attempted_stage_1a",
    message:
      "Guardian at Stage 1a: nex_test writes are permitted at this configuration but Guardian still records this attempt for audit.",
    detail: { schema: action.schema, table: action.table, note: "Stage 1b posture · founder-authorised" },
  };
}
