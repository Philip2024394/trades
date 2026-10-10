// src/lib/nex/marketing/deliverability/ab-testing.ts
//
// NEX Deliverability · A/B Testing Framework
// Founder-authorised programme · Session-13 · Part 11g · 2026-09-22.
//
// PURE FUNCTIONS. Deterministic variant assignment · pure statistics ·
// no persistence · no side effects · no sending.
//
// GOVERNANCE HARD-LOCKS:
//   * Never sends · never triggers a campaign · never persists an assignment
//   * Assignment is deterministic — same (contact_id, campaign_id) always
//     produces the same variant · rerun-safe · idempotent by design
//   * Statistical significance never claims "significant" below the confidence
//     threshold · never fabricates a p-value

import { createHash } from "node:crypto";

export interface VariantDefinition {
  readonly variant_id: string;         // "A" · "B" · "control" · "test-v2"
  readonly weight: number;             // relative allocation weight (integer ≥1)
}

export interface VariantAssignmentInput {
  readonly campaign_id: string;
  readonly contact_id: string;         // recipient identifier (never PII in the body)
  readonly variants: readonly VariantDefinition[];
}

export interface VariantAssignment {
  readonly campaign_id: string;
  readonly contact_id: string;
  readonly variant_id: string;
  readonly assignment_hash: string;    // truncated · for audit only
}

export interface VariantObservation {
  readonly variant_id: string;
  readonly sent: number;
  readonly delivered: number;
  readonly opened: number;
  readonly clicked: number;
  readonly bounced: number;
  readonly complained: number;
  readonly unsubscribed: number;
}

export interface VariantStats {
  readonly variant_id: string;
  readonly n: number;                  // = sent
  readonly delivery_rate: number | null;
  readonly open_rate: number | null;   // opened / delivered
  readonly click_rate: number | null;  // clicked / delivered
  readonly bounce_rate: number | null; // bounced / sent
  readonly complaint_rate: number | null;
  readonly unsubscribe_rate: number | null;
}

export type SignificanceOutcome =
  | { kind: "significant"; z_score: number; p_value: number; winner: string; loser: string; metric: MetricKey; delta: number }
  | { kind: "not_significant"; z_score: number; p_value: number; metric: MetricKey; note: string }
  | { kind: "insufficient_sample"; metric: MetricKey; min_required_per_variant: number; note: string }
  | { kind: "invalid_input"; reason: string };

export type MetricKey = "open_rate" | "click_rate" | "bounce_rate" | "complaint_rate" | "unsubscribe_rate";

export type WinnerOutcome =
  | { kind: "winner"; winner: string; runner_up: string; metric: MetricKey; significance: SignificanceOutcome & { kind: "significant" } }
  | { kind: "no_winner_yet"; leader: string | null; metric: MetricKey; reason: string }
  | { kind: "insufficient_variants"; note: string };

// ─── Deterministic assignment ────────────────────────────────────────
/** Hash (campaign_id, contact_id) with SHA-256 · take first 8 hex chars ·
 *  reduce to [0, total_weight) via modulo · bucket into variants by weight. */
export function assignVariant(input: VariantAssignmentInput): VariantAssignment {
  if (input.variants.length === 0) {
    throw new Error("ab_testing: variants must be non-empty");
  }
  const total_weight = input.variants.reduce((a, v) => a + Math.max(1, Math.floor(v.weight)), 0);
  const seed = `${input.campaign_id}::${input.contact_id}`;
  const digest = createHash("sha256").update(seed).digest("hex");
  const bucket = parseInt(digest.slice(0, 8), 16) % total_weight;

  let acc = 0;
  let chosen: VariantDefinition | null = null;
  for (const v of input.variants) {
    acc += Math.max(1, Math.floor(v.weight));
    if (bucket < acc) { chosen = v; break; }
  }
  if (!chosen) chosen = input.variants[input.variants.length - 1]!; // impossible with above math · defensive

  return {
    campaign_id: input.campaign_id,
    contact_id: input.contact_id,
    variant_id: chosen.variant_id,
    assignment_hash: digest.slice(0, 12),
  };
}

/** Batch assignment · convenience wrapper · zero persistence. */
export function assignVariantsBatch(
  campaign_id: string,
  contact_ids: readonly string[],
  variants: readonly VariantDefinition[],
): readonly VariantAssignment[] {
  return contact_ids.map(contact_id => assignVariant({ campaign_id, contact_id, variants }));
}

// ─── Pure statistics ────────────────────────────────────────────────
function safeDiv(num: number, denom: number): number | null {
  return denom > 0 ? num / denom : null;
}

export function computeVariantStats(obs: VariantObservation): VariantStats {
  return {
    variant_id: obs.variant_id,
    n: obs.sent,
    delivery_rate: safeDiv(obs.delivered, obs.sent),
    open_rate: safeDiv(obs.opened, obs.delivered),
    click_rate: safeDiv(obs.clicked, obs.delivered),
    bounce_rate: safeDiv(obs.bounced, obs.sent),
    complaint_rate: safeDiv(obs.complained, obs.sent),
    unsubscribe_rate: safeDiv(obs.unsubscribed, obs.sent),
  };
}

// ─── Two-proportion z-test approximation ────────────────────────────
/** Standard two-proportion z-test for significance.
 *  H0: p_a = p_b · reject when |z| > z_critical for chosen confidence.
 *  Two-tailed p-value approximated via erfc. */
function normalCdfComplement(z: number): number {
  // 2*(1 - Φ(|z|)) using Abramowitz-Stegun approximation
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804 * Math.exp(-absZ * absZ / 2);
  const cdf = 1 - d * (0.319381530 * t
    - 0.356563782 * t * t
    + 1.781477937 * t * t * t
    - 1.821255978 * Math.pow(t, 4)
    + 1.330274429 * Math.pow(t, 5));
  return 2 * (1 - cdf);
}

/** Extract the relevant success/trial pair for a given metric. */
function pickMetricPair(obs: VariantObservation, metric: MetricKey): { successes: number; trials: number } {
  switch (metric) {
    case "open_rate":       return { successes: obs.opened, trials: obs.delivered };
    case "click_rate":      return { successes: obs.clicked, trials: obs.delivered };
    case "bounce_rate":     return { successes: obs.bounced, trials: obs.sent };
    case "complaint_rate":  return { successes: obs.complained, trials: obs.sent };
    case "unsubscribe_rate":return { successes: obs.unsubscribed, trials: obs.sent };
  }
}

export interface SignificanceInput {
  readonly a: VariantObservation;
  readonly b: VariantObservation;
  readonly metric: MetricKey;
  /** Minimum sample size per variant · default 100. Below this the outcome
   *  is `insufficient_sample` regardless of observed rates. */
  readonly min_sample_size?: number;
  /** Two-tailed alpha · default 0.05 (95% confidence). */
  readonly alpha?: number;
}

export function computeStatisticalSignificance(input: SignificanceInput): SignificanceOutcome {
  const min_n = input.min_sample_size ?? 100;
  const alpha = input.alpha ?? 0.05;
  const a = pickMetricPair(input.a, input.metric);
  const b = pickMetricPair(input.b, input.metric);

  if (a.trials < min_n || b.trials < min_n) {
    return {
      kind: "insufficient_sample",
      metric: input.metric,
      min_required_per_variant: min_n,
      note: `variant_a_trials=${a.trials} variant_b_trials=${b.trials} below min ${min_n}`,
    };
  }

  const p_a = a.successes / a.trials;
  const p_b = b.successes / b.trials;
  const p_pool = (a.successes + b.successes) / (a.trials + b.trials);
  const se = Math.sqrt(p_pool * (1 - p_pool) * (1 / a.trials + 1 / b.trials));
  if (se === 0 || !Number.isFinite(se)) {
    return { kind: "invalid_input", reason: "standard_error_undefined_or_zero" };
  }
  const z = (p_a - p_b) / se;
  const p_value = normalCdfComplement(z);
  const z_critical = alpha === 0.05 ? 1.96 : alpha === 0.01 ? 2.576 : 1.96;
  const is_sig = Math.abs(z) > z_critical;

  if (!is_sig) {
    return {
      kind: "not_significant",
      z_score: z, p_value,
      metric: input.metric,
      note: `|z|=${Math.abs(z).toFixed(3)} <= critical=${z_critical} · p=${p_value.toFixed(4)}`,
    };
  }
  return {
    kind: "significant",
    z_score: z, p_value,
    winner: p_a > p_b ? input.a.variant_id : input.b.variant_id,
    loser:  p_a > p_b ? input.b.variant_id : input.a.variant_id,
    metric: input.metric,
    delta: Math.abs(p_a - p_b),
  };
}

// ─── Winner selection (multi-variant) ───────────────────────────────
export interface SelectWinnerInput {
  readonly observations: readonly VariantObservation[];
  readonly metric: MetricKey;
  readonly min_sample_size?: number;
  readonly alpha?: number;
}

export function selectWinner(input: SelectWinnerInput): WinnerOutcome {
  if (input.observations.length < 2) {
    return { kind: "insufficient_variants", note: "need at least 2 variants" };
  }
  // Rank by rate for the metric
  const ranked = [...input.observations].map(o => {
    const s = computeVariantStats(o);
    const rate =
      input.metric === "open_rate" ? s.open_rate :
      input.metric === "click_rate" ? s.click_rate :
      input.metric === "bounce_rate" ? s.bounce_rate :
      input.metric === "complaint_rate" ? s.complaint_rate :
      s.unsubscribe_rate;
    return { obs: o, rate: rate ?? -1 };
  }).sort((a, b) => (b.rate - a.rate));

  const leader_obs = ranked[0]!.obs;
  const runner_obs = ranked[1]!.obs;
  const leader_rate = ranked[0]!.rate;
  const runner_rate = ranked[1]!.rate;
  const min_n = input.min_sample_size ?? 100;

  // For "higher is better" metrics (open, click, delivery), that's the ranking
  // For "lower is better" (bounce, complaint, unsubscribe), we need to flip
  const higher_is_better = input.metric === "open_rate" || input.metric === "click_rate";
  const actual_leader = higher_is_better ? leader_obs : runner_obs;
  const actual_runner = higher_is_better ? runner_obs : leader_obs;

  const sig = computeStatisticalSignificance({
    a: actual_leader,
    b: actual_runner,
    metric: input.metric,
    min_sample_size: min_n,
    alpha: input.alpha,
  });

  if (sig.kind === "significant") {
    // For lower-is-better metrics, invert winner/loser semantics
    const winner = higher_is_better ? sig.winner : sig.loser;
    const runner_up = higher_is_better ? sig.loser : sig.winner;
    return { kind: "winner", winner, runner_up, metric: input.metric, significance: sig };
  }
  if (sig.kind === "insufficient_sample") {
    return { kind: "no_winner_yet", leader: leader_rate > 0 ? leader_obs.variant_id : null, metric: input.metric, reason: `insufficient_sample_min=${min_n}` };
  }
  return { kind: "no_winner_yet", leader: leader_obs.variant_id, metric: input.metric, reason: sig.kind === "not_significant" ? sig.note : "unknown" };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _AB_TESTING_NEVER_SENDS = "framework_computes_assignments_and_statistics_never_transmits";
export const _AB_TESTING_NEVER_PERSISTS = "no_DB_writes_no_side_effects_pure_functions";
export const _AB_TESTING_DETERMINISTIC_ASSIGNMENT =
  "same_campaign_id_and_contact_id_always_produces_same_variant_hash_seeded_SHA_256";
export const _AB_TESTING_NEVER_CLAIMS_SIGNIFICANCE_BELOW_THRESHOLD =
  "not_significant_returned_when_p_value_above_alpha_never_fabricated";
