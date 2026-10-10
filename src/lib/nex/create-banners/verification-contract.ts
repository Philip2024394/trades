// src/lib/nex/create-banners/verification-contract.ts
//
// NEX Create Banners · Verification seam · Founder Authorisation A · 2026-09-23
// =============================================================================
// This module defines the verification SEAM · not a scoring implementation.
// Scoring authority remains with the Founder per Banner Evaluation Plan §7.
// Automated checks may be added incrementally but NEVER self-score for
// production-quality gating.

import type {
  AutomatedCheck,
  BannerVerification,
  BannerVariant,
} from "./types";
import { DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES } from "./quality-status";

/**
 * A verifier runs automated checks on a variant and returns evidence.
 * It NEVER concludes production-quality validated · that flag is
 * Founder-only per Banner Evaluation Plan §7.
 */
export interface Verifier {
  readonly verifier_slug: string;
  runChecks(input: {
    readonly variant: BannerVariant;
    readonly composed_asset_path: string | null;
    readonly raw_generated_asset_path: string;
  }): Promise<readonly AutomatedCheck[]>;
}

/**
 * The out-of-the-box automated checks NEX ships at Authorisation A.
 * All start as `not_yet_proven` · replacing them with real checks is
 * a separate authorised piece of work.
 */
export const AUTOMATED_CHECK_STUBS: readonly Pick<
  AutomatedCheck,
  "check_id" | "kind" | "outcome" | "evidence"
>[] = [
  {
    check_id: "dimensions_match_format",
    kind: "technical.dimensions",
    outcome: "not_yet_proven",
    evidence: "check not yet implemented · placeholder",
  },
  {
    check_id: "file_is_valid_image",
    kind: "technical.file_validity",
    outcome: "not_yet_proven",
    evidence: "check not yet implemented · placeholder",
  },
  {
    check_id: "composition_zones_populated",
    kind: "composition.zones_populated",
    outcome: "not_yet_proven",
    evidence: "check not yet implemented · placeholder",
  },
  {
    check_id: "provenance_chain_complete",
    kind: "provenance.chain",
    outcome: "not_yet_proven",
    evidence: "check not yet implemented · placeholder",
  },
  {
    check_id: "no_forbidden_elements_present",
    kind: "content.forbidden_elements",
    outcome: "not_yet_proven",
    evidence: "check not yet implemented · placeholder",
  },
  {
    check_id: "generation_metadata_recorded",
    kind: "provenance.generation_metadata",
    outcome: "not_yet_proven",
    evidence: "check not yet implemented · placeholder",
  },
] as const;

/**
 * Build a verification record with all checks marked `not_yet_proven`
 * and an overall status of `blocked` because no scoring exists.
 * Reviewer must upgrade `overall` to `pass`/`fail` per §7.
 */
export function buildInitialVerification(input: {
  readonly variant: BannerVariant;
}): BannerVerification {
  return {
    verification_id: `${input.variant.variant_id}::verification`,
    variant_id: input.variant.variant_id,
    automated_checks: AUTOMATED_CHECK_STUBS.map((s) => ({ ...s })),
    defects_found: [],
    attribution: "clean",
    overall: "blocked",
    quality_status: DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
    verified_at: new Date().toISOString(),
    reviewed_by: "nex_automated",
  };
}

export const _VERIFICATION_NEVER_SELF_SCORES_FOR_PRODUCTION_QUALITY =
  true as const;
export const _VERIFICATION_AUTOMATED_CHECKS_START_NOT_YET_PROVEN =
  true as const;
