// src/lib/nex-native/family-safety/safechat-status-reader.ts
//
// NEX Family Safety · Phase 1 · SafeChat feature-status reader.
//
// Server-only. This file is the ONLY authorised dashboard-side reader
// of SafeChat state. It reports the FEATURE STATUS (classifier
// version, phase-1 logging flag, user-facing flag, simulated-mode) ·
// it NEVER returns individual classifications, raw rule_matches,
// signals, message bodies, or any child-content column.
//
// Load-bearing privacy doctrine:
//   · This file imports ONLY `feature-flag` from the sealed SafeChat
//     module. It MUST NOT import `classifier`, `classification-logger`,
//     `pattern-detector`, `conversation-signal-aggregator`, or any
//     module that reads classification rows. Grep-anchor test enforces.
//   · The classifier version is a STATIC CONSTANT exported from this
//     file (sealed to v1.1.0 default per the audit evidence doctrine).
//     Phase 1 does NOT read it from the DB or env · the value is a
//     deliberate ceiling.
//   · User-facing visibility is OFF in Phase 1. The reader surfaces
//     this honestly: "classification is simulated and no summaries
//     are produced for guardians at this time".

import "server-only";

import { isSafeChatPhase1LoggingEnabled } from "../safechat/feature-flag";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed shape
// ═════════════════════════════════════════════════════════════════════

/** Classifier version · pinned to the audit-sealed default. Any live
 *  rollout to a newer ruleset requires an explicit founder-authorised
 *  wave + an update here, not an env var. */
export const SAFECHAT_CLASSIFIER_VERSION_PHASE_1 = "v1.1.0" as const;

/** Retention schedule for SafeChat Phase 1 classification rows ·
 *  surfaced as copy only · the sweep itself is sealed in
 *  `src/lib/nex-native/safechat/retention-sweep.ts` (not read here). */
export const SAFECHAT_RETENTION_WINDOW_DAYS_PHASE_1 = 30 as const;

export interface SafeChatFeatureStatus {
  readonly classifierVersion: typeof SAFECHAT_CLASSIFIER_VERSION_PHASE_1;
  readonly phase1LoggingEnabled: boolean;
  readonly userFacingEnabled: false; // Phase 1 ceiling · NEVER true from this reader
  readonly simulated: true; // Phase 1 ceiling
  readonly retentionWindowDays: typeof SAFECHAT_RETENTION_WINDOW_DAYS_PHASE_1;
  readonly guardianSummariesAvailable: false; // Phase 1 ceiling
  readonly honestReason: string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Reader
// ═════════════════════════════════════════════════════════════════════

/**
 * Return the feature-level SafeChat status for display on
 * `/family-safety/safechat`. ZERO per-conversation data. ZERO
 * per-classification data. ZERO reads of the sealed classification
 * log. The reader is pure w.r.t. the DB · it only consults
 * environment flags via the sealed feature-flag module.
 */
export function readSafeChatFeatureStatus(): SafeChatFeatureStatus {
  return {
    classifierVersion: SAFECHAT_CLASSIFIER_VERSION_PHASE_1,
    phase1LoggingEnabled: isSafeChatPhase1LoggingEnabled(),
    userFacingEnabled: false,
    simulated: true,
    retentionWindowDays: SAFECHAT_RETENTION_WINDOW_DAYS_PHASE_1,
    guardianSummariesAvailable: false,
    honestReason:
      "SafeChat is in Phase 1 · classification is simulated and no summaries are produced for guardians at this time.",
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Per-child guardian-facing status (always unavailable in Phase 1)
// ═════════════════════════════════════════════════════════════════════

export const SAFECHAT_GUARDIAN_SUMMARY_PHASE_1_REASON =
  "safechat_guardian_summary_not_in_phase_1" as const;

export interface SafeChatGuardianSummaryUnavailable {
  readonly available: false;
  readonly reason: typeof SAFECHAT_GUARDIAN_SUMMARY_PHASE_1_REASON;
  readonly simulated: true;
}

// Reserved shape for the future wave. Phase 1 code MUST NOT return
// this · the service always returns `Unavailable`.
export interface SafeChatGuardianSummaryAvailable {
  readonly available: true;
  readonly summary: never; // placeholder · Phase 1 never returns this
}

export type SafeChatGuardianSummaryResult =
  | SafeChatGuardianSummaryUnavailable
  | SafeChatGuardianSummaryAvailable;

/**
 * Phase 1 behaviour: UNCONDITIONAL unavailable.
 *
 * This reader is called by `/family-safety/dashboard/children/[id]/safechat`.
 * It NEVER queries classification rows. It returns the sealed
 * "unavailable" shape with the Phase 1 reason token, which the page
 * renders as plain honest copy.
 */
export function readSafeChatGuardianSummaryForChild(): SafeChatGuardianSummaryResult {
  return {
    available: false,
    reason: SAFECHAT_GUARDIAN_SUMMARY_PHASE_1_REASON,
    simulated: true,
  };
}
