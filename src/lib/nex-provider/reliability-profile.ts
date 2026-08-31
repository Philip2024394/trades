// src/lib/nex-provider/reliability-profile.ts
//
// DRIVER RELIABILITY PROFILE · pure calculator from evidence signals.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23): no single signal bans a driver ·
//     declines are the driver's right and are NEVER counted against the band.
//   - Reputation Non-Weapon (2026-08-23): the profile surfaces evidence · never
//     a shame label · REVIEW_SUGGESTED is the strongest flag.
//   - Traveller Protection Principle: passengers deserve honest reliability
//     signals · drivers deserve honest measurement of their own record.
//
// Bands (illustrative · configurable via thresholds argument):
//   - new_driver          insufficient accepted-request history
//   - excellent           completion_rate >= 0.98 AND no-show_rate <= 0.02
//   - good                completion_rate >= 0.94 AND no-show_rate <= 0.05
//   - steady              default when neither excellent nor good but no red flags
//   - needs_attention     high cancel-after-accept rate OR high no-show rate
//
// Bright-line rule: DECLINES are counted in acceptance_rate for information
// but NEVER lower the reliability band or contribute to review flags. Drivers
// may decline any request.

export type ReliabilityBand =
  | "new_driver"
  | "excellent"
  | "good"
  | "steady"
  | "needs_attention";

export interface ReliabilitySignals {
  offered: number;
  accepted: number;
  declined: number;
  completed: number;
  cancellationsAfterAcceptance: number;
  noShows: number;
  recentActivityDays: number | null;   // days since last completed trip · null = never
  documentValidityOk: boolean;
  vehicleVerified: boolean;
  consentActive: boolean;
}

export interface ReliabilityThresholds {
  minAcceptedForBanding?: number;      // default 5
  excellentCompletionRate?: number;    // default 0.98
  excellentNoShowRate?: number;        // default 0.02
  goodCompletionRate?: number;         // default 0.94
  goodNoShowRate?: number;             // default 0.05
  needsAttentionCancelRate?: number;   // default 0.15
  needsAttentionNoShowRate?: number;   // default 0.10
}

export interface ReliabilityProfile {
  band: ReliabilityBand;
  completionRate: number | null;       // completed / accepted · null if accepted=0
  noShowRate: number | null;           // no_shows / accepted
  cancelAfterAcceptRate: number | null;
  acceptanceRate: number | null;       // accepted / offered (informational only)
  reviewFlags: string[];               // REVIEW_SUGGESTED items · never accusations
  interpretation: string;
  unknown: string;
  signals: ReliabilitySignals;
}

const DEFAULTS: Required<ReliabilityThresholds> = {
  minAcceptedForBanding: 5,
  excellentCompletionRate: 0.98,
  excellentNoShowRate: 0.02,
  goodCompletionRate: 0.94,
  goodNoShowRate: 0.05,
  needsAttentionCancelRate: 0.15,
  needsAttentionNoShowRate: 0.10,
};

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function calculateReliabilityProfile(
  signals: ReliabilitySignals,
  thresholds: ReliabilityThresholds = {},
): ReliabilityProfile {
  const t = { ...DEFAULTS, ...thresholds };

  const completionRate = safeRate(signals.completed, signals.accepted);
  const noShowRate = safeRate(signals.noShows, signals.accepted);
  const cancelAfterAcceptRate = safeRate(signals.cancellationsAfterAcceptance, signals.accepted);
  const acceptanceRate = safeRate(signals.accepted, signals.offered);

  const reviewFlags: string[] = [];
  if (!signals.documentValidityOk) reviewFlags.push("document_validity_issue");
  if (!signals.vehicleVerified) reviewFlags.push("vehicle_not_verified");
  if (!signals.consentActive) reviewFlags.push("consent_not_active");
  if (signals.recentActivityDays != null && signals.recentActivityDays > 90) {
    reviewFlags.push("inactive_over_90_days");
  }

  let band: ReliabilityBand;

  // Insufficient history → new_driver (not a punishment)
  if (signals.accepted < t.minAcceptedForBanding) {
    band = "new_driver";
    return {
      band,
      completionRate,
      noShowRate,
      cancelAfterAcceptRate,
      acceptanceRate,
      reviewFlags,
      interpretation:
        `New driver · fewer than ${t.minAcceptedForBanding} accepted requests. NEX does not band drivers with insufficient history.`,
      unknown:
        "Reliability signals need a small history before a meaningful band can be assigned. This is not a negative signal.",
      signals,
    };
  }

  const cr = completionRate ?? 0;
  const ns = noShowRate ?? 0;
  const car = cancelAfterAcceptRate ?? 0;

  // needs_attention takes priority when red rates exceed thresholds
  if (car >= t.needsAttentionCancelRate || ns >= t.needsAttentionNoShowRate) {
    band = "needs_attention";
    reviewFlags.push("elevated_cancel_or_no_show_rate");
    return {
      band,
      completionRate,
      noShowRate,
      cancelAfterAcceptRate,
      acceptanceRate,
      reviewFlags,
      interpretation:
        `Cancellation-after-accept rate ${(car * 100).toFixed(1)}% or no-show rate ${(ns * 100).toFixed(1)}% is above the threshold. Review suggested · never automatic action.`,
      unknown:
        "This band is a signal for human review · never an automatic ban. Individual reasons behind cancellations/no-shows may be legitimate.",
      signals,
    };
  }

  if (cr >= t.excellentCompletionRate && ns <= t.excellentNoShowRate) {
    band = "excellent";
  } else if (cr >= t.goodCompletionRate && ns <= t.goodNoShowRate) {
    band = "good";
  } else {
    band = "steady";
  }

  const interpretation = band === "excellent"
    ? `Excellent · completion rate ${(cr * 100).toFixed(1)}% · no-show rate ${(ns * 100).toFixed(2)}%.`
    : band === "good"
      ? `Good · completion rate ${(cr * 100).toFixed(1)}% · no-show rate ${(ns * 100).toFixed(2)}%.`
      : `Steady · completion rate ${(cr * 100).toFixed(1)}% · no-show rate ${(ns * 100).toFixed(2)}%.`;

  return {
    band,
    completionRate,
    noShowRate,
    cancelAfterAcceptRate,
    acceptanceRate,
    reviewFlags,
    interpretation,
    unknown:
      "Bands are matching-confidence guidance · never a promise about the specific next trip. Declines are the driver's right and do NOT lower the band.",
    signals,
  };
}
