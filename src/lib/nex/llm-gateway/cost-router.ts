// src/lib/nex/llm-gateway/cost-router.ts
//
// WAVE-P-1.1 · Cost router with per-scope budget caps + auto-downgrade
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Discipline:
//   · Budget consumption rolls per UTC day
//   · downgrade_at_fraction triggers cheaper-tier routing
//   · refuse_on_exhaust triggers hard refusal (returns "budget_refused")
//   · UNKNOWN cost hints stay UNKNOWN · never fabricated
//   · Every state change observable

import type {
  BudgetPolicy,
  BudgetConsumption,
  ProviderTier,
  FallbackChainEntry,
} from "./types";
import { DEFAULT_BUDGET_POLICY } from "./types";

// ─── Consumption tracking · in-memory ledger ─────────────────────

export class BudgetLedger {
  private ledger = new Map<string, BudgetConsumption>();

  private today(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  get(scope_id: string): BudgetConsumption {
    const existing = this.ledger.get(scope_id);
    const today = this.today();
    if (existing && existing.day_iso === today) return existing;
    // New day OR new scope · fresh row
    const fresh: BudgetConsumption = {
      scope_id,
      input_tokens_today: 0,
      output_tokens_today: 0,
      usd_today: 0,
      day_iso: today,
    };
    this.ledger.set(scope_id, fresh);
    return fresh;
  }

  record(scope_id: string, input_tokens: number, output_tokens: number, cost_usd: number): BudgetConsumption {
    const current = this.get(scope_id);
    const next: BudgetConsumption = {
      ...current,
      input_tokens_today: current.input_tokens_today + input_tokens,
      output_tokens_today: current.output_tokens_today + output_tokens,
      usd_today: current.usd_today + cost_usd,
    };
    this.ledger.set(scope_id, next);
    return next;
  }

  /** For tests · clear all state. */
  reset(): void {
    this.ledger.clear();
  }
}

// ─── Routing decision ────────────────────────────────────────────

export type CostRouterDecision =
  | { action: "allow_preferred_tier"; consumption: BudgetConsumption }
  | { action: "downgrade"; downgrade_to_tier: ProviderTier; reason: string; consumption: BudgetConsumption }
  | { action: "refuse"; reason: string; budget_field: string; consumption: BudgetConsumption };

/** Given the requested tier + policy + current consumption + chain,
 *  decide whether to allow the request as-is · downgrade to cheaper
 *  tier · or refuse. Pure. */
export function decideRoute(input: {
  requested_tier: ProviderTier;
  policy: BudgetPolicy;
  consumption: BudgetConsumption;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  chain: readonly FallbackChainEntry[];
}): CostRouterDecision {
  const { requested_tier, policy, consumption, estimated_input_tokens, estimated_output_tokens, chain } = input;

  // Per-request caps · hard refusal if exceeded
  if (policy.max_input_tokens_per_request && estimated_input_tokens > policy.max_input_tokens_per_request) {
    return {
      action: "refuse",
      reason: `estimated ${estimated_input_tokens} input tokens exceeds per-request cap ${policy.max_input_tokens_per_request}`,
      budget_field: "max_input_tokens_per_request",
      consumption,
    };
  }
  if (policy.max_output_tokens_per_request && estimated_output_tokens > policy.max_output_tokens_per_request) {
    return {
      action: "refuse",
      reason: `estimated ${estimated_output_tokens} output tokens exceeds per-request cap ${policy.max_output_tokens_per_request}`,
      budget_field: "max_output_tokens_per_request",
      consumption,
    };
  }

  // Per-day caps · check exhaustion first
  const projectedInputToday = consumption.input_tokens_today + estimated_input_tokens;
  const projectedOutputToday = consumption.output_tokens_today + estimated_output_tokens;

  if (policy.max_input_tokens_per_day && projectedInputToday > policy.max_input_tokens_per_day) {
    if (policy.refuse_on_exhaust) {
      return {
        action: "refuse",
        reason: `daily input budget exhausted: current=${consumption.input_tokens_today} + estimate=${estimated_input_tokens} > cap=${policy.max_input_tokens_per_day}`,
        budget_field: "max_input_tokens_per_day",
        consumption,
      };
    }
  }
  if (policy.max_output_tokens_per_day && projectedOutputToday > policy.max_output_tokens_per_day) {
    if (policy.refuse_on_exhaust) {
      return {
        action: "refuse",
        reason: `daily output budget exhausted`,
        budget_field: "max_output_tokens_per_day",
        consumption,
      };
    }
  }

  // Downgrade trigger · at downgrade_at_fraction of any daily cap
  const downgradeReasons: string[] = [];
  if (policy.max_input_tokens_per_day) {
    const fraction = consumption.input_tokens_today / policy.max_input_tokens_per_day;
    if (fraction >= policy.downgrade_at_fraction) {
      downgradeReasons.push(`input_tokens at ${(fraction * 100).toFixed(0)}% of daily cap`);
    }
  }
  if (policy.max_output_tokens_per_day) {
    const fraction = consumption.output_tokens_today / policy.max_output_tokens_per_day;
    if (fraction >= policy.downgrade_at_fraction) {
      downgradeReasons.push(`output_tokens at ${(fraction * 100).toFixed(0)}% of daily cap`);
    }
  }
  if (policy.max_usd_per_day) {
    const fraction = consumption.usd_today / policy.max_usd_per_day;
    if (fraction >= policy.downgrade_at_fraction) {
      downgradeReasons.push(`usd at ${(fraction * 100).toFixed(0)}% of daily cap`);
    }
  }

  if (downgradeReasons.length > 0) {
    const cheaperTier = pickCheaperTier(requested_tier, chain);
    if (cheaperTier) {
      return {
        action: "downgrade",
        downgrade_to_tier: cheaperTier,
        reason: downgradeReasons.join(" · "),
        consumption,
      };
    }
    // No cheaper tier available · allow at requested tier · caller
    // logs the situation
  }

  return { action: "allow_preferred_tier", consumption };
}

/** Find the next-cheaper tier in the chain relative to `current`.
 *  Returns undefined if `current` is already the cheapest. */
export function pickCheaperTier(current: ProviderTier, chain: readonly FallbackChainEntry[]): ProviderTier | undefined {
  const order: ProviderTier[] = ["primary", "fallback_1", "fallback_2", "fallback_3", "budget"];
  const currentIdx = order.indexOf(current);
  if (currentIdx < 0) return undefined;
  for (let i = currentIdx + 1; i < order.length; i++) {
    const t = order[i];
    if (chain.some((e) => e.tier === t)) return t;
  }
  return undefined;
}

/** Estimate USD cost for a call · returns undefined when either
 *  price is UNKNOWN. Never fabricates a number. */
export function estimateCallCost(input: {
  entry: FallbackChainEntry;
  input_tokens: number;
  output_tokens: number;
}): number | undefined {
  const { entry, input_tokens, output_tokens } = input;
  const inPrice = entry.cost_per_million_input_tokens_usd;
  const outPrice = entry.cost_per_million_output_tokens_usd;
  if (inPrice === undefined || inPrice === "unknown" || outPrice === undefined || outPrice === "unknown") {
    return undefined;
  }
  return (input_tokens / 1_000_000) * inPrice + (output_tokens / 1_000_000) * outPrice;
}
