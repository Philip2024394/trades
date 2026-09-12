// src/lib/nex/llm-gateway/types.ts
//
// WAVE-P-1.1 · LLM GATEWAY · type definitions
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Every type in this module supports GAP-3 (fallback chain) + GAP-6
// (circuit breaker) + cost routing + gateway observability.
//
// The gateway is a composite NexBrainProvider that wraps N underlying
// providers with ordered fallback + per-provider circuit-breaker state
// + budget-aware auto-downgrade. Callers see the same NexBrainProvider
// interface they see for a single provider — the gateway is transparent
// except for enhanced resilience.

import type { NexBrainProvider, NexChatInput, NexChatEvent } from "@/lib/nex/brain/provider";

// ═══════════════════════════════════════════════════════════════════
// § A · TIER + POSITION IN THE CHAIN
// ═══════════════════════════════════════════════════════════════════

/** Tier that a provider occupies in the fallback chain. Ordered from
 *  strongest (primary) to cheapest (budget). Auto-downgrade travels
 *  down this ladder. */
export type ProviderTier =
  | "primary"
  | "fallback_1"
  | "fallback_2"
  | "fallback_3"
  | "budget";

/** Where a provider sits in the chain plus cost + priority metadata.
 *  Priority is the tie-breaker within a tier · lower = tried first.
 *
 *  SELF-SUSTAINMENT DOCTRINE (2026-09-08): `is_paid_third_party` is
 *  load-bearing. Any entry with `true` is doctrinally OPT-IN ONLY ·
 *  gateway refuses to use it unless the env-var opt-in gate is
 *  active. Every entry MUST declare this honestly. */
export type FallbackChainEntry = {
  provider: NexBrainProvider;
  tier: ProviderTier;
  priority: number;
  /** Doctrine-load-bearing: does this provider charge $ to invoke?
   *  Ollama-local · llama.cpp-local · vLLM-self-hosted → false.
   *  Anthropic API · OpenAI API · Gemini API · hosted DeepSeek → true. */
  is_paid_third_party: boolean;
  /** Optional cost hints · only meaningful for paid providers.
   *  UNKNOWN when provider pricing not verified · never fabricated. */
  cost_per_million_input_tokens_usd?: number | "unknown";
  cost_per_million_output_tokens_usd?: number | "unknown";
};

// ═══════════════════════════════════════════════════════════════════
// § B · CIRCUIT BREAKER STATE
// ═══════════════════════════════════════════════════════════════════

/** Circuit-breaker states per provider · standard closed/open/half_open
 *  pattern with explicit timestamps for auditability. */
export type CircuitBreakerState =
  | { state: "closed"; consecutive_failures: number }
  | { state: "open"; opened_at_ms: number; probe_after_ms: number; last_failure_reason: string }
  | { state: "half_open"; opened_at_ms: number; probe_started_at_ms: number };

/** Configurable breaker thresholds. Defaults set below · overridable
 *  per gateway instance. */
export type CircuitBreakerConfig = {
  /** N consecutive failures within window before eject. */
  failure_threshold: number;
  /** How long the breaker stays open before probing. */
  open_duration_ms: number;
  /** Failures that DON'T count toward the threshold (e.g. Anthropic 529
   *  overloaded — provider's fault · not our capacity). */
  excluded_failure_kinds: readonly FailureKind[];
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failure_threshold: 3,
  open_duration_ms: 60_000,
  excluded_failure_kinds: ["overloaded"],
};

// ═══════════════════════════════════════════════════════════════════
// § C · FAILURE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

/** Coarse failure category · determines retry + circuit-breaker
 *  contribution. Overloaded (529 Anthropic · 503 OpenAI) is deliberately
 *  distinct because it reflects PROVIDER capacity · not our behavior. */
export type FailureKind =
  | "network"           // transport-level (timeout · DNS · connection refused)
  | "rate_limit"        // 429 · retry-after honored
  | "overloaded"        // 529 Anthropic · 503 OpenAI · does NOT trip our breaker
  | "server_error"      // 500-599 (except 503/529)
  | "malformed_response"// upstream returned invalid content
  | "auth"              // 401/403 · never retry
  | "quota_exhausted"   // billing failure · never retry
  | "unknown";

/** Discriminated failure record captured for observability + retry logic. */
export type ProviderFailure = {
  kind: FailureKind;
  http_status?: number;
  retry_after_ms?: number;    // honor server-provided backoff
  reason: string;
  ts_iso: string;
};

// ═══════════════════════════════════════════════════════════════════
// § D · GATEWAY HEALTH EVENTS (emitted to event bus for Master AI)
// ═══════════════════════════════════════════════════════════════════

/** Health events the gateway emits · discriminated so consumers
 *  (Master AI aggregateFailurePatterns · dashboards · alerts) can
 *  route by kind.
 *
 *  Includes `paid_fallback_refused_by_doctrine` for self-sustainment
 *  auditability · fires when a request would have succeeded on a
 *  paid provider but the opt-in gate was not set. */
export type GatewayHealthEvent =
  | { kind: "provider_healthy"; provider_id: string; is_paid_third_party: boolean; ts_iso: string }
  | { kind: "provider_failed"; provider_id: string; is_paid_third_party: boolean; failure: ProviderFailure; consecutive_failures: number; ts_iso: string }
  | { kind: "provider_ejected"; provider_id: string; probe_after_ms: number; last_failure_reason: string; ts_iso: string }
  | { kind: "provider_probe_success"; provider_id: string; ts_iso: string }
  | { kind: "provider_probe_failed"; provider_id: string; reason: string; ts_iso: string }
  | { kind: "fallback_used"; from_provider_id: string; to_provider_id: string; reason: string; ts_iso: string }
  | { kind: "cost_downgrade"; from_tier: ProviderTier; to_tier: ProviderTier; reason: string; ts_iso: string }
  | { kind: "budget_refused"; reason: string; budget_field: string; ts_iso: string }
  | { kind: "paid_fallback_refused_by_doctrine"; would_have_used_provider_id: string; reason: string; ts_iso: string }
  | { kind: "all_providers_failed"; attempted: readonly string[]; ts_iso: string };

// ═══════════════════════════════════════════════════════════════════
// § E · BUDGET POLICY
// ═══════════════════════════════════════════════════════════════════

/** Per-scope budget caps. When ANY cap is exceeded, cost router
 *  either downgrades to a cheaper tier OR refuses the request
 *  (depending on refuse_on_exhaust). */
export type BudgetPolicy = {
  scope_id: string;                        // e.g. "user:phil" · "org:trades" · "request:req_123"
  max_input_tokens_per_request?: number;
  max_output_tokens_per_request?: number;
  max_input_tokens_per_day?: number;
  max_output_tokens_per_day?: number;
  max_usd_per_day?: number;
  /** When at this fraction of daily budget · start downgrading to
   *  cheaper tiers rather than continuing on primary. */
  downgrade_at_fraction: number;           // e.g. 0.80
  /** When at 100% of budget · refuse rather than downgrade. */
  refuse_on_exhaust: boolean;
};

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  scope_id: "default",
  downgrade_at_fraction: 0.80,
  refuse_on_exhaust: true,
};

/** Running budget consumption · in-memory ledger per scope. */
export type BudgetConsumption = {
  scope_id: string;
  input_tokens_today: number;
  output_tokens_today: number;
  usd_today: number;
  day_iso: string;                          // rolls at midnight UTC
};

// ═══════════════════════════════════════════════════════════════════
// § F · GATEWAY INPUT / RESULT (extends NexChatInput)
// ═══════════════════════════════════════════════════════════════════

/** Extended chat input with idempotency + budget scope · everything
 *  else pass-through to NexChatInput. */
export type GatewayChatInput = NexChatInput & {
  /** Idempotency key · when repeated · gateway returns cached result
   *  (bounded TTL). Populated by GAP-5 idempotency middleware. */
  idempotency_key?: string;
  /** Which budget policy this request is billed to · falls back to
   *  DEFAULT_BUDGET_POLICY when absent. */
  budget_scope_id?: string;
  /** Preferred tier · gateway MAY downgrade if budget/circuit forces
   *  it · gateway MUST NOT upgrade above this. */
  preferred_tier?: ProviderTier;
};

/** Outcome record captured per gateway invocation · surfaces exactly
 *  which provider handled the call · what fallbacks fired · full
 *  provenance. Consumers use this for cost accounting + debugging.
 *
 *  SELF-SUSTAINMENT DOCTRINE (2026-09-08): `paid_provider_used` is
 *  load-bearing · every invocation MUST report honestly whether a
 *  paid third-party was used. Metrics + audits key off this field. */
export type GatewayInvocationRecord = {
  invocation_id: string;
  started_at_iso: string;
  completed_at_iso: string;
  requested_tier: ProviderTier;
  actually_used_provider_id: string;
  actually_used_tier: ProviderTier;
  /** Doctrine-load-bearing: was the request served by a paid third-party
   *  provider? Every invocation MUST report honestly. */
  paid_provider_used: boolean;
  fallback_events: readonly {
    from_provider_id: string;
    to_provider_id: string;
    reason: string;
  }[];
  cost_downgrade_events: readonly {
    from_tier: ProviderTier;
    to_tier: ProviderTier;
    reason: string;
  }[];
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  outcome: "ok" | "all_providers_failed" | "budget_refused" | "paid_fallback_refused_by_doctrine" | "malformed";
};

// ═══════════════════════════════════════════════════════════════════
// § G · THE GATEWAY INTERFACE
// ═══════════════════════════════════════════════════════════════════

/** Callers use this instead of `NexBrainProvider` when they want
 *  gateway semantics (fallback + breaker + budget). The gateway
 *  itself IS a NexBrainProvider · so a caller wanting simple semantics
 *  can just call `.chat()` and get the same NEX-canonical event stream. */
export interface NexLlmGateway extends NexBrainProvider {
  chatWithGateway(input: GatewayChatInput): AsyncGenerator<NexChatEvent, GatewayInvocationRecord>;
  readonly chain: readonly FallbackChainEntry[];
  getCircuitBreakerState(provider_id: string): CircuitBreakerState;
  getBudgetConsumption(scope_id: string): BudgetConsumption;
}

// ═══════════════════════════════════════════════════════════════════
// § H · V.5.2 SCOPE MARKERS (gateway must NOT do)
// ═══════════════════════════════════════════════════════════════════

/** Actions the gateway is NEVER allowed to do · per Wave-P-1 doctrine. */
export type GatewayForbiddenAction =
  | "selectFinalL4"                // gateway routes · does not select V.5.9 winner
  | "wireIntoProductionRoute"      // needs separate BEGIN
  | "modifyExistingProviderAdapter"// gateway wraps · never rewrites
  | "silentlySwapProviderWithoutEvent" // every swap emits a GatewayHealthEvent
  | "convertUnknownCostToNumber"   // UNKNOWN pricing stays UNKNOWN
  | "bypassBudgetRefusal";
