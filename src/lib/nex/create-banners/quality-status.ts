// src/lib/nex/create-banners/quality-status.ts
//
// NEX Create Banners · Quality Status · Founder Authorisation A · 2026-09-23
// ==========================================================================
// Explicit enum that keeps the two authorisations separated at runtime.
// Architecture-availability is NOT the same as generation-readiness.
// See docs/nex-banner-generation-production-quality-evaluation-plan-2026-09-23.md
// See feedback_nex_create_banners_two_authorisations_2026_09_23 (memory)

/**
 * QualityStatus is stamped on every generation request / result / variant.
 *
 * At time of Authorisation A the default is `UNPROVEN`. Only Authorisation B
 * (Banner Evaluation Plan signed + passed) can promote it further, and even
 * then the plan mandates per-category evidence · never a blanket flag flip.
 */
export const QUALITY_STATUS_VALUES = [
  "UNPROVEN",
  "EVALUATING",
  "PROVISIONALLY_VALIDATED",
  "PRODUCTION_VALIDATED",
  "BLOCKED",
] as const;
export type QualityStatus = (typeof QUALITY_STATUS_VALUES)[number];

/**
 * Static default. Reads as `UNPROVEN` for the entire Authorisation-A wave.
 * If anywhere in NEX starts silently returning `PRODUCTION_VALIDATED` here
 * without the Banner Evaluation Plan flip, that is a doctrine violation.
 */
export const DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES: QualityStatus =
  "UNPROVEN";

export function isQualityStatus(value: unknown): value is QualityStatus {
  return (
    typeof value === "string" &&
    (QUALITY_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Human-facing label for UI surfaces. The UI MUST NOT strip these labels
 * when quality is anything other than `PRODUCTION_VALIDATED`.
 */
export function qualityStatusUserFacingLabel(status: QualityStatus): string {
  switch (status) {
    case "UNPROVEN":
      return "Quality unproven · not for customer publication";
    case "EVALUATING":
      return "Quality being evaluated · not for customer publication";
    case "PROVISIONALLY_VALIDATED":
      return "Provisionally validated · review before publication";
    case "PRODUCTION_VALIDATED":
      return "Production validated";
    case "BLOCKED":
      return "Blocked · quality gate refused";
  }
}

/**
 * Whether a variant with this quality status may be handed to the Social
 * Poster for customer-facing publication. Only `PRODUCTION_VALIDATED` may.
 */
export function mayPublishToSocialPoster(status: QualityStatus): boolean {
  return status === "PRODUCTION_VALIDATED";
}

/**
 * Whether a variant may be shown to the Founder in a preview surface.
 * All statuses may be previewed. The distinction that matters is publish,
 * not preview.
 */
export function mayPreviewInternally(status: QualityStatus): boolean {
  return true;
}

// Doctrine locks · grep for these to prove the invariants haven't been
// silently softened by a future edit.
export const _QUALITY_STATUS_DEFAULT_IS_UNPROVEN = true as const;
export const _QUALITY_STATUS_PUBLICATION_REQUIRES_PRODUCTION_VALIDATED =
  true as const;
export const _QUALITY_STATUS_NEVER_AUTO_PROMOTED_WITHOUT_EVALUATION_PASS =
  true as const;
