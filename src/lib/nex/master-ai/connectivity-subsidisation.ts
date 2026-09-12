// src/lib/nex/master-ai/connectivity-subsidisation.ts
//
// NEX Master AI · Deep Feasibility Mission · NEX-as-payer investigation
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// The Founder directive asks the question: can NEX/admin absorb the
// operating cost of a lawful connectivity system so the user's direct
// connectivity cost approaches zero?
//
// This module adds the primitives to reason about it:
//
//   · ArchitectureAssessment · answers the 10 mandatory questions
//     from the directive (§5) for one architecture
//   · Marginal-cost-per-user calculation · asks "what does the next
//     user actually cost?" once the base infrastructure exists
//   · User-direct-cost-at-subsidy calculation · asks "if NEX absorbs
//     X% of the system cost, what does the user pay?"
//
// PRESERVATION:
//   · Every one of the 10 answers is MANDATORY on write · missing
//     answer = InvalidAssessmentError
//   · UNKNOWN is always a legal answer · never fabricate
//   · Assessment persists append-only · corrections use supersedes
//   · Marginal-cost math is pure arithmetic · same inputs → identical
//     outputs · no randomness

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { architectureAssessmentsPath } from "./paths";
import type { ConnectivityLegalCategory } from "./connectivity-domain";
import type { WhoPays } from "./connectivity-mission-domain";

// ─── §5 · Ten mandatory questions ───────────────────────────────────
// Each answer is either a concrete value or the literal string "UNKNOWN"
// (never omitted, never inferred).

export type TenQuestionAnswer = {
  who_pays: WhoPays;                                    // Q1 · WHO PAYS?
  who_owns_network: string;                             // Q2 · e.g. "NEX", "ISP partner", "community cooperative", "UNKNOWN"
  who_provides_upstream: string;                        // Q3 · e.g. "licensed Indonesian ISP", "UNKNOWN"
  spectrum_used: string;                                // Q4 · band description or "N/A · wired only" or "UNKNOWN"
  license_required: "YES" | "NO" | "PARTNERSHIP_ONLY" | "UNKNOWN";       // Q5
  equipment_certification_required: "YES" | "NO" | "UNKNOWN";            // Q6 · e.g. SDPPI in ID
  can_nex_operate_in_indonesia: "YES" | "NO" | "CONDITIONAL" | "UNKNOWN"; // Q7
  can_nex_subsidise_user_to_zero: "YES" | "NO" | "PARTIALLY" | "UNKNOWN"; // Q8
  cost_at_scale_reference: string;                      // Q9 · reference to economics simulation_id or "UNKNOWN"
  cheapest_lawful_notes: string;                        // Q10 · qualitative note or "UNKNOWN"
};

export type ArchitectureAssessment = {
  assessment_id: string;
  created_at_iso: string;
  architecture_slug: string;                            // ref to ARCHITECTURE_CATALOGUE
  business_model_slug: string | null;                   // ref to BUSINESS_MODEL_CATALOGUE
  jurisdiction: string;
  ten_answers: TenQuestionAnswer;
  overall_category: ConnectivityLegalCategory;          // mandatory
  overall_verdict: "PROMISING" | "CONSTRAINED" | "REQUIRES_PARTNER" | "PILOT_ONLY" | "NOT_VIABLE" | "UNKNOWN";
  evidence_ref_ids: string[];                           // refs to connectivity_findings finding_ids
  economics_simulation_ref: string | null;              // ref to economics_simulations simulation_id
  supersedes: string | null;
  created_by: string;
};

export class InvalidAssessmentError extends Error {
  constructor(reason: string) { super(`invalid_assessment:${reason}`); }
}

const TEN_KEYS: readonly (keyof TenQuestionAnswer)[] = [
  "who_pays", "who_owns_network", "who_provides_upstream", "spectrum_used",
  "license_required", "equipment_certification_required",
  "can_nex_operate_in_indonesia", "can_nex_subsidise_user_to_zero",
  "cost_at_scale_reference", "cheapest_lawful_notes",
] as const;

export function recordArchitectureAssessment(
  input: Omit<ArchitectureAssessment, "assessment_id" | "created_at_iso">,
): ArchitectureAssessment {
  if (!input.architecture_slug || input.architecture_slug.length < 2) throw new InvalidAssessmentError("architecture_slug");
  if (!input.jurisdiction || input.jurisdiction.length < 2) throw new InvalidAssessmentError("jurisdiction");
  if (!input.overall_category) throw new InvalidAssessmentError("overall_category_required");
  if (!input.overall_verdict) throw new InvalidAssessmentError("overall_verdict_required");
  // Every one of the 10 must be present · empty string is not permitted
  for (const key of TEN_KEYS) {
    const value = input.ten_answers[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new InvalidAssessmentError(`ten_answer_missing:${key}`);
    }
  }
  const rec: ArchitectureAssessment = {
    ...input,
    assessment_id: randomUUID(),
    created_at_iso: new Date().toISOString(),
  };
  appendJsonLine(architectureAssessmentsPath(), rec);
  return rec;
}

export function readAllAssessments(): ArchitectureAssessment[] {
  return readJsonlAll<ArchitectureAssessment>(architectureAssessmentsPath());
}

export function currentAssessments(filter?: {
  jurisdiction?: string;
  architecture_slug?: string;
}): ArchitectureAssessment[] {
  const all = readAllAssessments();
  const superseded = new Set<string>();
  for (const a of all) if (a.supersedes) superseded.add(a.supersedes);
  return all
    .filter((a) => !superseded.has(a.assessment_id))
    .filter((a) => !filter?.jurisdiction || a.jurisdiction === filter.jurisdiction)
    .filter((a) => !filter?.architecture_slug || a.architecture_slug === filter.architecture_slug);
}

// ─── Marginal cost per user ─────────────────────────────────────────
// Fixed cost is spread over the base user count; the marginal cost of
// serving user N is the incremental cost (upstream Mbps × cost/Mbps
// attributable to that user, minus what caching displaces).
//
// This is a pure function · no randomness · returns 0 for zero users.

export type MarginalCostInputs = {
  monthly_fixed_cost_idr: number;                  // hardware amortisation + site + ops
  monthly_upstream_cost_idr: number;               // provisioned upstream cost
  provisioned_upstream_mbps: number;               // used to derive cost per Mbps
  avg_bandwidth_per_active_user_mbps: number;
  concurrent_active_pct: number;                    // 0..1
  cache_hit_rate: number;                           // 0..1 (offline reservoir)
  users: number;
};

export type MarginalCostResult = {
  average_cost_per_user_idr: number;                // total / users · what an equal share costs
  marginal_cost_per_next_user_idr: number;          // incremental cost of adding one more user
  fixed_cost_amortisation_per_user_idr: number;     // fixed share
  variable_upstream_cost_per_user_idr: number;      // variable share attributable to that user
};

export function computeMarginalCostPerUser(input: MarginalCostInputs): MarginalCostResult {
  if (input.users <= 0) {
    return {
      average_cost_per_user_idr: 0,
      marginal_cost_per_next_user_idr: 0,
      fixed_cost_amortisation_per_user_idr: 0,
      variable_upstream_cost_per_user_idr: 0,
    };
  }
  const totalMonthly = input.monthly_fixed_cost_idr + input.monthly_upstream_cost_idr;
  const avg = totalMonthly / input.users;
  const fixedShare = input.monthly_fixed_cost_idr / input.users;
  // Marginal cost per NEW user = per-Mbps upstream cost × their expected effective Mbps
  //   (cache_hit_rate directly reduces the effective Mbps they'll consume)
  const perMbpsCost = input.provisioned_upstream_mbps > 0
    ? input.monthly_upstream_cost_idr / input.provisioned_upstream_mbps
    : 0;
  const activeUserMbps = input.avg_bandwidth_per_active_user_mbps * input.concurrent_active_pct;
  const effectivePerUser = activeUserMbps * (1 - input.cache_hit_rate);
  const variableShare = perMbpsCost * effectivePerUser;
  const marginal = variableShare;                     // fixed cost doesn't grow when adding 1 user (until re-provisioning)
  return {
    average_cost_per_user_idr: Math.round(avg),
    marginal_cost_per_next_user_idr: Math.round(marginal),
    fixed_cost_amortisation_per_user_idr: Math.round(fixedShare),
    variable_upstream_cost_per_user_idr: Math.round(variableShare),
  };
}

// ─── User's direct cost at NEX subsidy ──────────────────────────────

export type UserDirectCostAtSubsidyInputs = {
  monthly_total_cost_idr: number;
  users: number;
  nex_subsidy_pct: number;                          // 0..1 · how much NEX absorbs
};

export function computeUserDirectCostAtSubsidy(input: UserDirectCostAtSubsidyInputs): number {
  if (input.users <= 0) return 0;
  const clamped = Math.max(0, Math.min(1, input.nex_subsidy_pct));
  const perUser = input.monthly_total_cost_idr / input.users;
  return Math.round(perUser * (1 - clamped));
}

export function _resetSubsidisationForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(architectureAssessmentsPath())) fs.unlinkSync(architectureAssessmentsPath()); } catch { /* ignore */ }
}
