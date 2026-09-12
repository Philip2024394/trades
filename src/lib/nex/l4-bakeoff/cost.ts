// src/lib/nex/l4-bakeoff/cost.ts
//
// V.5.2 · L4 bakeoff · cost measurement protocol
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Section 12, 17):
//   · Hosted / self-hosted / hybrid are SEPARATE profile types
//   · Model realistic NEX usage at 1K / 10K / 100K / 1M users
//   · NEVER invent vendor pricing · UNKNOWN when unverified
//   · Assumptions must be explicit and captured

import type {
  CostProfile,
  CostProfileHosted,
  CostProfileSelfHosted,
  CostProfileHybrid,
  UserScaleTier,
} from "./types";

export const USER_SCALE_TIERS: readonly UserScaleTier[] = [1_000, 10_000, 100_000, 1_000_000] as const;

/** Assumed monthly per-user token consumption bands · caller may override. */
export type UsageAssumption = {
  input_tokens_per_user_per_month: number;
  output_tokens_per_user_per_month: number;
  tool_call_multiplier?: number;    // requests that trigger a tool cost extra latency+cost
  research_call_multiplier?: number;
};

export const DEFAULT_USAGE_ASSUMPTION: UsageAssumption = {
  input_tokens_per_user_per_month: 50_000,     // ~1600 messages/user/month at 30 in-tokens each
  output_tokens_per_user_per_month: 30_000,    // slightly asymmetric · typical assistant pattern
  tool_call_multiplier: 1.1,
  research_call_multiplier: 1.05,
};

// ─── HOSTED PROFILE ────────────────────────────────────────────

export function buildHostedCostProfile(input: {
  candidate_id: string;
  input_price_per_million_tokens_usd: number | "unknown";
  output_price_per_million_tokens_usd: number | "unknown";
  tool_call_price_notes?: string;
  infrastructure_fees_usd?: number;
  assumptions?: string[];
  usage?: UsageAssumption;
  now_iso?: string;
}): CostProfileHosted {
  const usage = input.usage ?? DEFAULT_USAGE_ASSUMPTION;
  const monthly: Partial<Record<UserScaleTier, number | "unknown">> = {};

  for (const tier of USER_SCALE_TIERS) {
    if (input.input_price_per_million_tokens_usd === "unknown" || input.output_price_per_million_tokens_usd === "unknown") {
      monthly[tier] = "unknown";
      continue;
    }
    const inputTokens = usage.input_tokens_per_user_per_month * tier;
    const outputTokens = usage.output_tokens_per_user_per_month * tier;
    const inputCost = (inputTokens / 1_000_000) * input.input_price_per_million_tokens_usd;
    const outputCost = (outputTokens / 1_000_000) * input.output_price_per_million_tokens_usd;
    const infra = input.infrastructure_fees_usd ?? 0;
    monthly[tier] = Number((inputCost + outputCost + infra).toFixed(2));
  }

  return {
    candidate_id: input.candidate_id,
    kind: "hosted",
    input_price_per_million_tokens_usd: input.input_price_per_million_tokens_usd,
    output_price_per_million_tokens_usd: input.output_price_per_million_tokens_usd,
    tool_call_price_notes: input.tool_call_price_notes,
    infrastructure_fees_usd: input.infrastructure_fees_usd,
    monthly_cost_projection_usd: monthly,
    assumptions: [
      `usage: ${usage.input_tokens_per_user_per_month} in-tokens + ${usage.output_tokens_per_user_per_month} out-tokens per user per month`,
      ...(input.assumptions ?? []),
    ],
    measured_at_iso: input.now_iso ?? new Date().toISOString(),
  };
}

// ─── SELF-HOSTED PROFILE ───────────────────────────────────────

export function buildSelfHostedCostProfile(input: {
  candidate_id: string;
  gpu_hardware_usd: number | "unknown";
  electricity_monthly_usd: number | "unknown";
  storage_usd: number | "unknown";
  runtime_license_usd?: number;
  maintenance_hours_monthly: number | "unknown";
  concurrency_supported: number | "unknown";
  hardware_amortization_months: number | "unknown";
  maintenance_hourly_rate_usd?: number;
  assumptions?: string[];
  usage?: UsageAssumption;
  now_iso?: string;
}): CostProfileSelfHosted {
  const usage = input.usage ?? DEFAULT_USAGE_ASSUMPTION;
  const maintenanceRate = input.maintenance_hourly_rate_usd ?? 75;
  const monthly: Partial<Record<UserScaleTier, number | "unknown">> = {};

  for (const tier of USER_SCALE_TIERS) {
    if (
      input.gpu_hardware_usd === "unknown" ||
      input.electricity_monthly_usd === "unknown" ||
      input.storage_usd === "unknown" ||
      input.maintenance_hours_monthly === "unknown" ||
      input.concurrency_supported === "unknown" ||
      input.hardware_amortization_months === "unknown"
    ) {
      monthly[tier] = "unknown";
      continue;
    }
    // Approximate concurrent-demand model: assume each user generates
    // (in+out)/60_000 second-equivalents of GPU time per month · convert
    // to concurrent-user-hours · check against supported concurrency.
    const requestsPerUserMonth = 1600;                             // ~50k in-tokens / 30 tokens per msg
    const perRequestSec = 2.5;                                     // conservative avg wall-clock
    const totalUserSecondsMonth = tier * requestsPerUserMonth * perRequestSec;
    const availableConcurrentSecondsMonth = input.concurrency_supported * 30 * 24 * 3600;
    const utilization = totalUserSecondsMonth / availableConcurrentSecondsMonth;
    const gpusNeeded = Math.max(1, Math.ceil(utilization));

    const hardware_amortization_monthly = (input.gpu_hardware_usd * gpusNeeded) / input.hardware_amortization_months;
    const electricity_monthly = input.electricity_monthly_usd * gpusNeeded;
    const storage_monthly = input.storage_usd / 12;                // one-off / 12 for monthly view
    const maintenance_monthly = input.maintenance_hours_monthly * maintenanceRate * gpusNeeded;
    const license_monthly = input.runtime_license_usd ?? 0;

    monthly[tier] = Number((
      hardware_amortization_monthly + electricity_monthly + storage_monthly + maintenance_monthly + license_monthly
    ).toFixed(2));
  }

  return {
    candidate_id: input.candidate_id,
    kind: "self_hosted",
    gpu_hardware_usd: input.gpu_hardware_usd,
    electricity_monthly_usd: input.electricity_monthly_usd,
    storage_usd: input.storage_usd,
    runtime_license_usd: input.runtime_license_usd,
    maintenance_hours_monthly: input.maintenance_hours_monthly,
    concurrency_supported: input.concurrency_supported,
    hardware_amortization_months: input.hardware_amortization_months,
    monthly_cost_projection_usd: monthly,
    assumptions: [
      `usage: ${usage.input_tokens_per_user_per_month} in-tokens + ${usage.output_tokens_per_user_per_month} out-tokens per user per month`,
      `avg wall-clock per request: 2.5s (conservative)`,
      `maintenance hourly rate: $${maintenanceRate}`,
      `GPUs scaled up when utilization > 100%`,
      ...(input.assumptions ?? []),
    ],
    measured_at_iso: input.now_iso ?? new Date().toISOString(),
  };
}

// ─── HYBRID PROFILE ────────────────────────────────────────────

export function buildHybridCostProfile(input: {
  candidate_id: string;
  local_workload_fraction: number | "unknown";
  cloud_escalation_fraction: number | "unknown";
  local_cost_profile?: CostProfileSelfHosted;
  cloud_cost_profile?: CostProfileHosted;
  routing_frequency_notes?: string;
  assumptions?: string[];
  now_iso?: string;
}): CostProfileHybrid {
  const monthly: Partial<Record<UserScaleTier, number | "unknown">> = {};

  for (const tier of USER_SCALE_TIERS) {
    if (
      input.local_workload_fraction === "unknown" ||
      input.cloud_escalation_fraction === "unknown" ||
      !input.local_cost_profile ||
      !input.cloud_cost_profile
    ) {
      monthly[tier] = "unknown";
      continue;
    }
    const localCost = input.local_cost_profile.monthly_cost_projection_usd[tier];
    const cloudCost = input.cloud_cost_profile.monthly_cost_projection_usd[tier];
    if (typeof localCost !== "number" || typeof cloudCost !== "number") {
      monthly[tier] = "unknown";
      continue;
    }
    monthly[tier] = Number((
      localCost * input.local_workload_fraction + cloudCost * input.cloud_escalation_fraction
    ).toFixed(2));
  }

  return {
    candidate_id: input.candidate_id,
    kind: "hybrid",
    local_workload_fraction: input.local_workload_fraction,
    cloud_escalation_fraction: input.cloud_escalation_fraction,
    routing_frequency_notes: input.routing_frequency_notes,
    monthly_cost_projection_usd: monthly,
    assumptions: [
      "hybrid = local_fraction * local_cost + cloud_fraction * cloud_cost",
      ...(input.assumptions ?? []),
    ],
    measured_at_iso: input.now_iso ?? new Date().toISOString(),
  };
}

// ─── Convenience: build UNKNOWN profile when nothing verifiable ───

export function buildUnknownHostedProfile(candidate_id: string, reason: string): CostProfileHosted {
  return buildHostedCostProfile({
    candidate_id,
    input_price_per_million_tokens_usd: "unknown",
    output_price_per_million_tokens_usd: "unknown",
    assumptions: [`REASON_UNKNOWN: ${reason}`],
  });
}
