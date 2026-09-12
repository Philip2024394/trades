// src/lib/nex/master-ai/connectivity-economics.ts
//
// NEX Master AI Engineer · Wave 4 · W4-E · Connectivity economics simulator
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// Deterministic model of a NEX Connect Hub across user counts.
// EVERY output is traceable to an explicit input formula · no black
// boxes · no random numbers · same inputs → identical outputs.
//
// PRESERVATION:
//   · No default values are dressed up as facts · every input carries
//     a `source` tag (ASSUMPTION · MEASURED · CITED).
//   · Regulatory status is a SEPARATE domain (connectivity-regulation.ts)
//     · the simulator merely REPORTS the current status of the chosen
//     spectrum band · it never claims legality.
//   · Simulations are APPENDED to a ledger · never mutated.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { economicsSimulationsPath } from "./paths";
import { findSpectrumBand, findArchitecture, findBusinessModel } from "./connectivity-domain";
import { currentFindings } from "./connectivity-regulation";
import type { ConnectivityLegalCategory } from "./connectivity-domain";

export type InputSource = "ASSUMPTION" | "MEASURED" | "CITED";

export type TracedInput<T> = { value: T; source: InputSource; note: string };

export type EconomicsScenarioInput = {
  scenario_slug: string;
  jurisdiction: string;                           // "ID"
  users_count: number;
  spectrum_band_slug: string;                     // ref to catalogue
  architecture_slug: string;                      // ref to catalogue
  business_model_slug: string;                    // ref to catalogue
  hardware_capex_idr: TracedInput<number>;        // one-time Rp
  hardware_amortization_months: TracedInput<number>;
  upstream_mbps: TracedInput<number>;             // provisioned upstream
  upstream_cost_per_mbps_month_idr: TracedInput<number>;
  avg_bandwidth_per_active_user_mbps: TracedInput<number>;
  concurrent_active_pct: TracedInput<number>;     // 0..1
  cache_hit_rate: TracedInput<number>;            // 0..1 · offline reservoir savings
  video_pct: TracedInput<number>;                 // 0..1 of user traffic that is video
  overhead_pct: TracedInput<number>;              // 0..1 protocol/management overhead
  monthly_ops_cost_idr: TracedInput<number>;      // power, site, staff
  baseline_user_monthly_cost_idr: TracedInput<number>; // e.g. Rp100k reference
  performed_by: string;
  // Deep-Feasibility mission extension · optional · backward-compatible
  nex_subsidy_pct?: TracedInput<number>;          // 0..1 · how much NEX absorbs · defaults to 0 (user pays all)
};

export type EconomicsScenarioOutput = {
  simulation_id: string;
  performed_at_iso: string;
  inputs: EconomicsScenarioInput;
  peak_demand_mbps: number;                       // concurrent × per-user × (1+overhead)
  effective_upstream_needed_mbps: number;         // peak × (1 - cache_hit_rate)
  upstream_headroom_pct: number;                  // (provisioned - needed) / needed
  monthly_upstream_cost_idr: number;
  monthly_hardware_amortization_idr: number;
  monthly_total_cost_idr: number;
  cost_per_user_month_idr: number;                // what an equal share costs (before subsidy)
  saving_vs_baseline_pct: number;                 // (baseline - nex) / baseline
  regulatory_status_for_band: ConnectivityLegalCategory | "NO_FINDING_YET";
  regulatory_status_for_business_model: ConnectivityLegalCategory | "NO_FINDING_YET";
  warnings: string[];                             // "band not registered" · "no reg finding" · ...
  // Deep-Feasibility outputs · always populated (defaults to nex_subsidy_pct=0)
  nex_subsidy_pct_applied: number;                // 0..1 · what fraction of system cost NEX absorbs
  user_direct_cost_month_idr: number;             // what the user pays after NEX subsidy
  marginal_cost_per_user_idr: number;             // incremental cost of adding one more user
};

function clampPct(n: number): number { return Math.max(0, Math.min(1, n)); }

export function runEconomicsScenario(input: EconomicsScenarioInput): EconomicsScenarioOutput {
  const warnings: string[] = [];
  if (input.users_count <= 0) throw new Error("users_count_must_be_positive");
  if (findSpectrumBand(input.spectrum_band_slug) === null) warnings.push(`unknown_spectrum_band:${input.spectrum_band_slug}`);
  if (findArchitecture(input.architecture_slug) === null) warnings.push(`unknown_architecture:${input.architecture_slug}`);
  if (findBusinessModel(input.business_model_slug) === null) warnings.push(`unknown_business_model:${input.business_model_slug}`);

  const concurrent_pct = clampPct(input.concurrent_active_pct.value);
  const cache_hit = clampPct(input.cache_hit_rate.value);
  const overhead = clampPct(input.overhead_pct.value);
  const concurrentUsers = input.users_count * concurrent_pct;
  const rawPeakMbps = concurrentUsers * input.avg_bandwidth_per_active_user_mbps.value;
  const peak_demand_mbps = rawPeakMbps * (1 + overhead);
  const effective_upstream_needed_mbps = peak_demand_mbps * (1 - cache_hit);

  if (effective_upstream_needed_mbps > input.upstream_mbps.value) {
    warnings.push(`upstream_undersized · needed=${Math.round(effective_upstream_needed_mbps)}Mbps > provisioned=${input.upstream_mbps.value}Mbps`);
  }
  const upstream_headroom_pct = input.upstream_mbps.value <= 0
    ? -1
    : (input.upstream_mbps.value - effective_upstream_needed_mbps) / effective_upstream_needed_mbps;

  const monthly_upstream_cost_idr = input.upstream_mbps.value * input.upstream_cost_per_mbps_month_idr.value;
  const monthly_hardware_amortization_idr = input.hardware_amortization_months.value <= 0
    ? 0
    : input.hardware_capex_idr.value / input.hardware_amortization_months.value;
  const monthly_total_cost_idr = monthly_upstream_cost_idr + monthly_hardware_amortization_idr + input.monthly_ops_cost_idr.value;
  const cost_per_user_month_idr = monthly_total_cost_idr / input.users_count;
  const saving_vs_baseline_pct = input.baseline_user_monthly_cost_idr.value <= 0
    ? 0
    : (input.baseline_user_monthly_cost_idr.value - cost_per_user_month_idr) / input.baseline_user_monthly_cost_idr.value;

  // Report regulatory status without inventing it
  const bandFinding = currentFindings({ jurisdiction: input.jurisdiction, topic: "SPECTRUM" })
    .find((f) => f.band_slug === input.spectrum_band_slug);
  const modelFinding = currentFindings({ jurisdiction: input.jurisdiction, topic: "LICENSING" })
    .find((f) => f.business_model_slug === input.business_model_slug);
  const regulatory_status_for_band: ConnectivityLegalCategory | "NO_FINDING_YET" = bandFinding?.category ?? "NO_FINDING_YET";
  const regulatory_status_for_business_model: ConnectivityLegalCategory | "NO_FINDING_YET" = modelFinding?.category ?? "NO_FINDING_YET";
  if (regulatory_status_for_band === "NO_FINDING_YET") warnings.push(`no_regulation_finding_for_band:${input.spectrum_band_slug}·jurisdiction:${input.jurisdiction}`);
  if (regulatory_status_for_business_model === "NO_FINDING_YET") warnings.push(`no_regulation_finding_for_business_model:${input.business_model_slug}·jurisdiction:${input.jurisdiction}`);

  // NEX subsidy (optional · defaults to 0)
  const nex_subsidy_pct_applied = clampPct(input.nex_subsidy_pct?.value ?? 0);
  const user_direct_cost_month_idr = Math.round(cost_per_user_month_idr * (1 - nex_subsidy_pct_applied));
  // Marginal cost per user · variable share proportional to their effective bandwidth
  const activeMbps = input.avg_bandwidth_per_active_user_mbps.value * concurrent_pct;
  const effectivePerUser = activeMbps * (1 - cache_hit);
  const totalPeakMbps = effectivePerUser * input.users_count;
  const variableShare = totalPeakMbps > 0
    ? (monthly_upstream_cost_idr / totalPeakMbps) * effectivePerUser
    : monthly_upstream_cost_idr / input.users_count;
  const marginal_cost_per_user_idr = Math.round(variableShare);

  const out: EconomicsScenarioOutput = {
    simulation_id: randomUUID(),
    performed_at_iso: new Date().toISOString(),
    inputs: input,
    peak_demand_mbps: round2(peak_demand_mbps),
    effective_upstream_needed_mbps: round2(effective_upstream_needed_mbps),
    upstream_headroom_pct: round2(upstream_headroom_pct),
    monthly_upstream_cost_idr: Math.round(monthly_upstream_cost_idr),
    monthly_hardware_amortization_idr: Math.round(monthly_hardware_amortization_idr),
    monthly_total_cost_idr: Math.round(monthly_total_cost_idr),
    cost_per_user_month_idr: Math.round(cost_per_user_month_idr),
    saving_vs_baseline_pct: round2(saving_vs_baseline_pct),
    regulatory_status_for_band,
    regulatory_status_for_business_model,
    warnings,
    nex_subsidy_pct_applied,
    user_direct_cost_month_idr,
    marginal_cost_per_user_idr,
  };
  appendJsonLine(economicsSimulationsPath(), out);
  return out;
}

/** Convenience: run the canonical 50 / 100 / 500 / 1,000 / 10,000 user
 *  ladder using a shared input template (users_count is overridden). */
export function runUserLadder(template: Omit<EconomicsScenarioInput, "users_count">, counts: number[] = [50, 100, 500, 1000, 10000]): EconomicsScenarioOutput[] {
  return counts.map((n) => runEconomicsScenario({ ...template, users_count: n }));
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function readAllSimulations(): EconomicsScenarioOutput[] {
  return readJsonlAll<EconomicsScenarioOutput>(economicsSimulationsPath());
}

export function _resetEconomicsForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(economicsSimulationsPath())) fs.unlinkSync(economicsSimulationsPath()); } catch { /* ignore */ }
}
