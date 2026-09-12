// src/lib/nex/master-ai/connectivity-w4-6.ts
//
// NEX Master AI · W4-6 Primary-Evidence Mission
// Philip 2026-09-07 · AUTHORIZE (research + intelligence · attack-survival gate)
//
// Adds three primitives for the mission:
//
//   · §2 · Activity × Classification matrix
//     Nine specific NEX activities, each classified with the licensing
//     status, conditions, and primary-evidence pointer.
//
//   · §15 · Usage stress test
//     Four user profiles (Light / Medium / Heavy / Extreme) with
//     bandwidth + GB/month → aggregate demand at each user tier.
//
//   · §17 · Adversarial self-criticism (attack-survival)
//     Fourteen attacks that attempt to disprove the YES case. A
//     verdict of YES is retained only if it survives every critical
//     attack.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import {
  w4_6_activityMatrixPath,
  w4_6_usageStressPath,
  w4_6_attackSurvivalPath,
} from "./paths";
import type { ConnectivityLegalCategory } from "./connectivity-domain";
import type { AuthorityTier } from "./types";

// ═════════════════════════════════════════════════════════════════════
// §2 · Activity × Classification legal boundary matrix
// ═════════════════════════════════════════════════════════════════════

export const NINE_ACTIVITIES = Object.freeze([
  "nex_buys_internet_from_licensed_isp",
  "nex_provides_wifi_to_its_own_users",
  "nex_charges_users_rp0",
  "nex_provides_access_to_public",
  "nex_resells_connectivity",
  "nex_operates_local_aps",
  "nex_owns_local_backhaul",
  "nex_uses_third_party_fibre",
  "nex_operates_as_managed_wifi",
] as const);
export type NexActivity = typeof NINE_ACTIVITIES[number];

export type ActivityMatrixRow = {
  row_id: string;
  recorded_at_iso: string;
  activity: NexActivity;
  jurisdiction: string;
  classification: ConnectivityLegalCategory;
  licence_required: "YES" | "NO" | "PARTNERSHIP_ONLY" | "UNKNOWN";
  conditions: string;                              // e.g. "SDPPI cert · indoor only · <100mW EIRP"
  primary_evidence_ref: string | null;             // finding_id or explicit URL
  evidence_tier: AuthorityTier | "NONE";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  interpretation_note: string;
  counterargument_note: string | null;
};

export class InvalidActivityRowError extends Error {
  constructor(reason: string) { super(`invalid_activity_row:${reason}`); }
}

export function recordActivityMatrixRow(input: Omit<ActivityMatrixRow, "row_id" | "recorded_at_iso">): ActivityMatrixRow {
  if (!NINE_ACTIVITIES.includes(input.activity)) throw new InvalidActivityRowError(`unknown_activity:${input.activity}`);
  if (!input.jurisdiction || input.jurisdiction.length < 2) throw new InvalidActivityRowError("jurisdiction");
  if (!input.classification) throw new InvalidActivityRowError("classification");
  if (!input.interpretation_note || input.interpretation_note.length < 5) throw new InvalidActivityRowError("interpretation_note");
  if (input.classification !== "UNKNOWN" && input.confidence === "NONE") throw new InvalidActivityRowError("non_unknown_needs_confidence");
  const rec: ActivityMatrixRow = {
    ...input,
    row_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(w4_6_activityMatrixPath(), rec);
  return rec;
}

export function readActivityMatrix(): ActivityMatrixRow[] {
  return readJsonlAll<ActivityMatrixRow>(w4_6_activityMatrixPath());
}

export function currentActivityMatrix(jurisdiction: string): ActivityMatrixRow[] {
  const all = readActivityMatrix().filter((r) => r.jurisdiction === jurisdiction);
  // Latest per activity wins
  const latest = new Map<NexActivity, ActivityMatrixRow>();
  for (const r of all) latest.set(r.activity, r);
  return Array.from(latest.values());
}

// ═════════════════════════════════════════════════════════════════════
// §15 · Usage stress test (four profiles × N user tiers)
// ═════════════════════════════════════════════════════════════════════

export type UserProfileSlug = "light" | "medium" | "heavy" | "extreme";

export type UserProfile = {
  slug: UserProfileSlug;
  name: string;
  monthly_gb: number;
  average_mbps_when_active: number;
  active_hours_per_day: number;
  concurrent_probability_peak: number;              // 0..1 · probability a user is active at peak
  content_kind: "messaging_browsing" | "social_music_moderate_video" | "continuous_video" | "extreme_video";
  notes: string;
};

export const USER_PROFILES: readonly UserProfile[] = Object.freeze([
  Object.freeze({
    slug: "light",   name: "Light user",
    monthly_gb: 5,   average_mbps_when_active: 1.5, active_hours_per_day: 1.0, concurrent_probability_peak: 0.10,
    content_kind: "messaging_browsing",
    notes: "Messaging + browsing · minimal video"
  }),
  Object.freeze({
    slug: "medium",  name: "Medium user",
    monthly_gb: 20,  average_mbps_when_active: 3,   active_hours_per_day: 2.5, concurrent_probability_peak: 0.25,
    content_kind: "social_music_moderate_video",
    notes: "Social + music + moderate video"
  }),
  Object.freeze({
    slug: "heavy",   name: "Heavy user",
    monthly_gb: 60,  average_mbps_when_active: 5,   active_hours_per_day: 4,   concurrent_probability_peak: 0.40,
    content_kind: "continuous_video",
    notes: "TikTok / Instagram / Reels / YouTube pattern"
  }),
  Object.freeze({
    slug: "extreme", name: "Extreme user",
    monthly_gb: 150, average_mbps_when_active: 8,   active_hours_per_day: 6,   concurrent_probability_peak: 0.55,
    content_kind: "extreme_video",
    notes: "Several hours of HD/UHD video every day"
  }),
] as const);

export type UsageStressPoint = {
  users: number;
  profile: UserProfileSlug;
  peak_concurrent_users: number;
  peak_aggregate_mbps: number;
  total_gb_per_month: number;
  reservoir_reducible_mbps_at_hit_rate: (rate: number) => number;
};

export type UsageStressResult = {
  stress_id: string;
  recorded_at_iso: string;
  user_tiers: number[];
  points: Array<{
    users: number;
    profile: UserProfileSlug;
    peak_concurrent_users: number;
    peak_aggregate_mbps: number;
    total_gb_per_month: number;
    effective_peak_at_40pct_cache_mbps: number;
    effective_peak_at_60pct_cache_mbps: number;
  }>;
};

export function runUsageStress(userTiers: number[] = [100, 500, 1000, 5000, 10_000, 50_000, 100_000]): UsageStressResult {
  const points: UsageStressResult["points"] = [];
  for (const users of userTiers) {
    for (const p of USER_PROFILES) {
      const peakConcurrent = Math.round(users * p.concurrent_probability_peak);
      const peakMbps = peakConcurrent * p.average_mbps_when_active;
      const totalGb = users * p.monthly_gb;
      points.push({
        users,
        profile: p.slug,
        peak_concurrent_users: peakConcurrent,
        peak_aggregate_mbps: Math.round(peakMbps),
        total_gb_per_month: Math.round(totalGb),
        effective_peak_at_40pct_cache_mbps: Math.round(peakMbps * 0.6),
        effective_peak_at_60pct_cache_mbps: Math.round(peakMbps * 0.4),
      });
    }
  }
  const rec: UsageStressResult = {
    stress_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    user_tiers: userTiers,
    points,
  };
  appendJsonLine(w4_6_usageStressPath(), rec);
  return rec;
}

// ═════════════════════════════════════════════════════════════════════
// §17 · Adversarial self-criticism (14 attacks against the YES case)
// ═════════════════════════════════════════════════════════════════════

export type AttackSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AttackVerdict = "SURVIVED" | "WEAKENED" | "BROKE_YES" | "INSUFFICIENT_EVIDENCE";

export type AttackRecord = {
  attack_id: string;
  attack_slug: string;
  question: string;
  severity: AttackSeverity;
  verdict: AttackVerdict;
  reasoning: string;
  what_would_change_verdict: string;
};

export type AttackSurvivalReport = {
  survival_id: string;
  recorded_at_iso: string;
  attacks: AttackRecord[];
  survived_all_critical: boolean;                   // gate: YES may only stand if this is true
  survived_all_high: boolean;
  broke_yes_count: number;
  weakened_count: number;
  survived_count: number;
  insufficient_evidence_count: number;
};

export const FOURTEEN_ATTACKS: readonly {
  slug: string; question: string; severity: AttackSeverity;
}[] = Object.freeze([
  Object.freeze({ slug: "attack_isp_reclassification",    question: "Could this actually be classified as ISP operation?",                                severity: "CRITICAL" as const }),
  Object.freeze({ slug: "attack_resale_rules",             question: "Could resale rules apply?",                                                             severity: "CRITICAL" as const }),
  Object.freeze({ slug: "attack_public_network_rules",     question: "Could public-network rules apply?",                                                     severity: "HIGH" as const }),
  Object.freeze({ slug: "attack_spectrum_rules",           question: "Could spectrum rules prevent deployment?",                                              severity: "CRITICAL" as const }),
  Object.freeze({ slug: "attack_equipment_certification",  question: "Could equipment certification prevent deployment?",                                     severity: "CRITICAL" as const }),
  Object.freeze({ slug: "attack_outdoor_ap_rules",         question: "Could outdoor AP rules change the result?",                                             severity: "HIGH" as const }),
  Object.freeze({ slug: "attack_p2p_p2mp_licensing",       question: "Could P2P/P2MP change the licensing requirement?",                                      severity: "HIGH" as const }),
  Object.freeze({ slug: "attack_zero_price_is_telecom",    question: "Could charging Rp0 still constitute providing telecom service?",                        severity: "CRITICAL" as const }),
  Object.freeze({ slug: "attack_commercial_nature",        question: "Could NEX's commercial nature change the classification?",                              severity: "HIGH" as const }),
  Object.freeze({ slug: "attack_user_scale",               question: "Could user scale change the classification?",                                            severity: "MEDIUM" as const }),
  Object.freeze({ slug: "attack_reservoir_copyright",      question: "Could the Reservoir create copyright problems?",                                         severity: "HIGH" as const }),
  Object.freeze({ slug: "attack_upstream_isp_terms",       question: "Could upstream ISP terms prohibit sharing?",                                             severity: "CRITICAL" as const }),
  Object.freeze({ slug: "attack_local_government_rules",   question: "Could government/local rules add requirements?",                                         severity: "MEDIUM" as const }),
  Object.freeze({ slug: "attack_what_evidence_disproves",  question: "What evidence would prove our YES wrong?",                                               severity: "HIGH" as const }),
] as const);

export function recordAttackSurvival(input: { attacks: AttackRecord[] }): AttackSurvivalReport {
  if (input.attacks.length !== FOURTEEN_ATTACKS.length) {
    throw new Error(`attack_survival_requires_${FOURTEEN_ATTACKS.length}_attacks_got_${input.attacks.length}`);
  }
  const critical = input.attacks.filter((a) => a.severity === "CRITICAL");
  const high     = input.attacks.filter((a) => a.severity === "HIGH");
  const survivedCritical = critical.every((a) => a.verdict === "SURVIVED" || a.verdict === "WEAKENED");
  const survivedHigh     = high.every((a) => a.verdict === "SURVIVED" || a.verdict === "WEAKENED");
  const rec: AttackSurvivalReport = {
    survival_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    attacks: input.attacks,
    survived_all_critical: survivedCritical,
    survived_all_high: survivedHigh,
    broke_yes_count: input.attacks.filter((a) => a.verdict === "BROKE_YES").length,
    weakened_count: input.attacks.filter((a) => a.verdict === "WEAKENED").length,
    survived_count: input.attacks.filter((a) => a.verdict === "SURVIVED").length,
    insufficient_evidence_count: input.attacks.filter((a) => a.verdict === "INSUFFICIENT_EVIDENCE").length,
  };
  appendJsonLine(w4_6_attackSurvivalPath(), rec);
  return rec;
}

export function readAttackSurvival(): AttackSurvivalReport[] {
  return readJsonlAll<AttackSurvivalReport>(w4_6_attackSurvivalPath());
}

// ═════════════════════════════════════════════════════════════════════
// §11+§12 · YES gate that requires attack survival
// ═════════════════════════════════════════════════════════════════════

export type FinalW4_6Verdict = {
  verdict: "🟢 YES" | "🟢 YES WITH CONDITIONS" | "🟡 PARTIAL YES" | "🔴 NO" | "⚪ UNKNOWN";
  survived_all_critical: boolean;
  primary_evidence_present: boolean;
  reasoning: string;
};

export function composeFinalVerdict(input: {
  survival: AttackSurvivalReport;
  primary_evidence_findings_count: number;
  activity_matrix: ActivityMatrixRow[];
}): FinalW4_6Verdict {
  const primaryPresent = input.primary_evidence_findings_count > 0;
  const survived = input.survival.survived_all_critical;
  // Any BROKE_YES on a CRITICAL attack means NO
  const criticalBroke = input.survival.attacks.some((a) => a.severity === "CRITICAL" && a.verdict === "BROKE_YES");
  if (criticalBroke) {
    return {
      verdict: "🔴 NO",
      survived_all_critical: false,
      primary_evidence_present: primaryPresent,
      reasoning: "at_least_one_CRITICAL_attack_broke_yes",
    };
  }
  // If any activity is REQUIRES_LICENSE and category is a hard requirement → YES WITH CONDITIONS
  const hasFiniteRequirements = input.activity_matrix.some((r) =>
    r.classification === "REQUIRES_LICENSE" || r.classification === "REQUIRES_PARTNERSHIP" || r.classification === "POSSIBLE_PILOT"
  );
  const hasUnknowns = input.activity_matrix.some((r) => r.classification === "UNKNOWN");
  if (survived && primaryPresent && !hasUnknowns && !hasFiniteRequirements) {
    return {
      verdict: "🟢 YES",
      survived_all_critical: true,
      primary_evidence_present: true,
      reasoning: "all_critical_attacks_survived_with_primary_evidence_and_no_finite_requirements_remaining",
    };
  }
  if (survived && (primaryPresent || hasFiniteRequirements)) {
    return {
      verdict: "🟢 YES WITH CONDITIONS",
      survived_all_critical: true,
      primary_evidence_present: primaryPresent,
      reasoning: hasFiniteRequirements
        ? "critical_attacks_survived_but_finite_licence_partnership_or_pilot_requirements_remain"
        : "critical_attacks_survived_with_primary_evidence_but_secondary_conditions_apply",
    };
  }
  if (!survived) {
    return {
      verdict: "🟡 PARTIAL YES",
      survived_all_critical: false,
      primary_evidence_present: primaryPresent,
      reasoning: "some_critical_attacks_weakened_or_insufficient_evidence · full YES cannot be defended",
    };
  }
  return {
    verdict: "⚪ UNKNOWN",
    survived_all_critical: survived,
    primary_evidence_present: primaryPresent,
    reasoning: "insufficient_evidence_to_defend_yes_or_no",
  };
}

export function _resetW4_6ForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [w4_6_activityMatrixPath(), w4_6_usageStressPath(), w4_6_attackSurvivalPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
