// src/lib/nex/llm-gateway/gateway.ts
//
// WAVE-P-1.1 · LLM GATEWAY entry point + observability
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// The gateway is a composite NexBrainProvider that wraps N underlying
// providers with:
//   · ordered fallback (primary → fallback_1 → fallback_2 → ...)
//   · per-provider circuit breaker
//   · cost router with local-resource + optional-$ budget caps
//   · SELF-SUSTAINMENT DOCTRINE gate: paid third-party providers
//     require explicit opt-in env var to be used at all
//   · full invocation record + health events emitted for Master AI

import { randomUUID } from "node:crypto";
import type {
  NexBrainProvider,
  NexChatInput,
  NexChatEvent,
  NexBrainCapabilities,
  NexMessage,
  NexUsage,
} from "@/lib/nex/brain/provider";
import type {
  BudgetPolicy,
  CircuitBreakerConfig,
  FallbackChainEntry,
  GatewayChatInput,
  GatewayHealthEvent,
  GatewayInvocationRecord,
  NexLlmGateway,
  ProviderTier,
  ProviderFailure,
  CircuitBreakerState,
  BudgetConsumption,
} from "./types";
import { DEFAULT_BUDGET_POLICY, DEFAULT_CIRCUIT_BREAKER_CONFIG } from "./types";
import { CircuitBreakerRegistry, classifyFailure } from "./circuit-breaker";
import { BudgetLedger, decideRoute, estimateCallCost } from "./cost-router";

// ═══════════════════════════════════════════════════════════════════
// § SELF-SUSTAINMENT DOCTRINE ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

/** The env var that opts NEX into paid third-party fallback. Default
 *  is `false` per Self-Sustainment doctrine. Must be set explicitly. */
export const PAID_FALLBACK_ENV_VAR = "NEX_ALLOW_PAID_FALLBACK";

/** Returns true only when the operator has explicitly opted in
 *  to using paid third-party providers. */
export function isPaidFallbackAllowed(): boolean {
  const v = process.env[PAID_FALLBACK_ENV_VAR];
  return v === "true" || v === "1" || v === "yes";
}

// ═══════════════════════════════════════════════════════════════════
// § HEALTH EVENT SINK · pluggable
// ═══════════════════════════════════════════════════════════════════

export type HealthEventSink = (event: GatewayHealthEvent) => void;

/** No-op sink · used when caller doesn't want emission. */
export const NULL_HEALTH_SINK: HealthEventSink = () => {};

/** In-memory sink · captures events for tests + inspection. */
export function makeMemoryHealthSink(): { sink: HealthEventSink; events: GatewayHealthEvent[] } {
  const events: GatewayHealthEvent[] = [];
  return { sink: (e) => events.push(e), events };
}

// ═══════════════════════════════════════════════════════════════════
// § GATEWAY CONFIG
// ═══════════════════════════════════════════════════════════════════

export type GatewayConfig = {
  chain: readonly FallbackChainEntry[];
  policy?: BudgetPolicy;
  breaker_config?: CircuitBreakerConfig;
  health_sink?: HealthEventSink;
  /** Test hook · overrides isPaidFallbackAllowed() at construction time. */
  paid_fallback_allowed_override?: boolean;
};

// ═══════════════════════════════════════════════════════════════════
// § THE GATEWAY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LlmGateway implements NexLlmGateway {
  readonly id: string;
  readonly capabilities: NexBrainCapabilities;
  readonly chain: readonly FallbackChainEntry[];
  private readonly policy: BudgetPolicy;
  private readonly breakers: CircuitBreakerRegistry;
  private readonly budgets: BudgetLedger;
  private readonly sink: HealthEventSink;
  private readonly paidAllowed: boolean;

  constructor(config: GatewayConfig) {
    if (!config.chain || config.chain.length === 0) {
      throw new Error("LlmGateway refused: chain must be non-empty");
    }
    // Sort chain by (tier order, then priority) for deterministic
    // fallback order.
    const tierOrder: Record<ProviderTier, number> = {
      primary: 0, fallback_1: 1, fallback_2: 2, fallback_3: 3, budget: 4,
    };
    const sorted = [...config.chain].sort((a, b) => {
      const t = tierOrder[a.tier] - tierOrder[b.tier];
      return t !== 0 ? t : a.priority - b.priority;
    });
    this.chain = Object.freeze(sorted) as readonly FallbackChainEntry[];
    this.policy = config.policy ?? DEFAULT_BUDGET_POLICY;
    this.breakers = new CircuitBreakerRegistry(config.breaker_config ?? DEFAULT_CIRCUIT_BREAKER_CONFIG);
    this.budgets = new BudgetLedger();
    this.sink = config.health_sink ?? NULL_HEALTH_SINK;
    this.paidAllowed = config.paid_fallback_allowed_override ?? isPaidFallbackAllowed();
    this.id = `gateway:${sorted.map((e) => e.provider.id).join("|")}`;
    // Union capabilities across chain · caller sees widest set
    this.capabilities = this.unionCapabilities();
  }

  private unionCapabilities(): NexBrainCapabilities {
    const caps = this.chain.map((e) => e.provider.capabilities);
    return {
      supportsTools: caps.some((c) => c.supportsTools),
      supportsVision: caps.some((c) => c.supportsVision),
      supportsThinking: caps.some((c) => c.supportsThinking),
      supportsPromptCaching: caps.some((c) => c.supportsPromptCaching),
      supportsStreaming: caps.some((c) => c.supportsStreaming),
      maxContextTokens: Math.max(...caps.map((c) => c.maxContextTokens)),
    };
  }

  getCircuitBreakerState(provider_id: string): CircuitBreakerState {
    return this.breakers.get(provider_id);
  }

  getBudgetConsumption(scope_id: string): BudgetConsumption {
    return this.budgets.get(scope_id);
  }

  // ─── NexBrainProvider · pass-through with gateway semantics ────
  async *chat(input: NexChatInput): AsyncGenerator<NexChatEvent> {
    const gen = this.chatWithGateway({ ...input });
    let done: IteratorResult<NexChatEvent, GatewayInvocationRecord>;
    while (!(done = await gen.next()).done) {
      yield done.value;
    }
  }

  // ─── The load-bearing gateway method ──────────────────────────
  async *chatWithGateway(input: GatewayChatInput): AsyncGenerator<NexChatEvent, GatewayInvocationRecord> {
    const invocation_id = `gwi_${randomUUID()}`;
    const started_at_iso = new Date().toISOString();
    const started_ms = Date.now();
    const requested_tier: ProviderTier = input.preferred_tier ?? "primary";
    const scope_id = input.budget_scope_id ?? this.policy.scope_id;
    const fallback_events: { from_provider_id: string; to_provider_id: string; reason: string }[] = [];
    const cost_downgrade_events: { from_tier: ProviderTier; to_tier: ProviderTier; reason: string }[] = [];

    // Estimate token usage for budget check (coarse · caller may
    // provide max_tokens for output)
    const estimated_input_tokens = coarseInputTokenEstimate(input);
    const estimated_output_tokens = input.maxTokens ?? 4096;

    // Cost router first pass · may downgrade or refuse
    const consumption = this.budgets.get(scope_id);
    const route = decideRoute({
      requested_tier,
      policy: this.policy,
      consumption,
      estimated_input_tokens,
      estimated_output_tokens,
      chain: this.chain,
    });

    let effectiveTier = requested_tier;
    if (route.action === "refuse") {
      this.emit({
        kind: "budget_refused",
        reason: route.reason,
        budget_field: route.budget_field,
        ts_iso: new Date().toISOString(),
      });
      yield { type: "error", error: `budget_refused: ${route.reason}`, retriable: false };
      return {
        invocation_id, started_at_iso, completed_at_iso: new Date().toISOString(),
        requested_tier, actually_used_provider_id: "n/a", actually_used_tier: requested_tier,
        paid_provider_used: false,
        fallback_events, cost_downgrade_events,
        input_tokens: 0, output_tokens: 0,
        latency_ms: Date.now() - started_ms,
        outcome: "budget_refused",
      };
    }
    if (route.action === "downgrade") {
      cost_downgrade_events.push({ from_tier: effectiveTier, to_tier: route.downgrade_to_tier, reason: route.reason });
      this.emit({
        kind: "cost_downgrade",
        from_tier: effectiveTier,
        to_tier: route.downgrade_to_tier,
        reason: route.reason,
        ts_iso: new Date().toISOString(),
      });
      effectiveTier = route.downgrade_to_tier;
    }

    // Walk the chain from effectiveTier onward (never upgrade)
    const attemptOrder = this.buildAttemptOrder(effectiveTier);
    const attempted: string[] = [];

    for (let i = 0; i < attemptOrder.length; i++) {
      const entry = attemptOrder[i];
      const providerId = entry.provider.id;

      // SELF-SUSTAINMENT DOCTRINE gate · refuse paid unless opt-in
      if (entry.is_paid_third_party && !this.paidAllowed) {
        this.emit({
          kind: "paid_fallback_refused_by_doctrine",
          would_have_used_provider_id: providerId,
          reason: `Self-Sustainment doctrine: paid third-party provider not opted in (${PAID_FALLBACK_ENV_VAR}!=true)`,
          ts_iso: new Date().toISOString(),
        });
        continue;
      }

      // Circuit breaker gate
      const evalResult = this.breakers.evaluate(providerId);
      if (!evalResult.allow) {
        // Skip · try next
        attempted.push(providerId);
        continue;
      }
      if (evalResult.probe) {
        this.breakers.markProbing(providerId);
      }

      // Attempt the call
      attempted.push(providerId);
      if (i > 0) {
        const prev = attemptOrder[i - 1];
        fallback_events.push({ from_provider_id: prev.provider.id, to_provider_id: providerId, reason: "prior_failure_or_gate" });
        this.emit({ kind: "fallback_used", from_provider_id: prev.provider.id, to_provider_id: providerId, reason: "prior_failure_or_gate", ts_iso: new Date().toISOString() });
      }

      let providerFailed = false;
      let providerFailure: ProviderFailure | undefined;
      let usage: NexUsage | undefined;
      let finalMessage: NexMessage | undefined;

      try {
        for await (const evt of entry.provider.chat(input)) {
          if (evt.type === "error") {
            providerFailed = true;
            providerFailure = classifyFailure({ error: evt.error });
            // Do NOT yield the error to caller yet · we may recover via fallback
            break;
          }
          if (evt.type === "done") {
            usage = evt.usage;
            finalMessage = evt.finalMessage;
          }
          yield evt;
        }
      } catch (err) {
        providerFailed = true;
        providerFailure = classifyFailure({ error: err });
      }

      if (providerFailed && providerFailure) {
        const next = this.breakers.recordFailure(providerId, providerFailure);
        this.emit({
          kind: "provider_failed",
          provider_id: providerId,
          is_paid_third_party: entry.is_paid_third_party,
          failure: providerFailure,
          consecutive_failures: next.state === "closed" ? next.consecutive_failures : 0,
          ts_iso: new Date().toISOString(),
        });
        if (next.state === "open") {
          this.emit({
            kind: "provider_ejected",
            provider_id: providerId,
            probe_after_ms: next.probe_after_ms,
            last_failure_reason: next.last_failure_reason,
            ts_iso: new Date().toISOString(),
          });
        }
        // Try next provider in chain
        continue;
      }

      // Success · record + return
      this.breakers.recordSuccess(providerId);
      this.emit({
        kind: "provider_healthy",
        provider_id: providerId,
        is_paid_third_party: entry.is_paid_third_party,
        ts_iso: new Date().toISOString(),
      });

      const input_tokens = usage?.inputTokens ?? 0;
      const output_tokens = usage?.outputTokens ?? 0;
      const cost = estimateCallCost({ entry, input_tokens, output_tokens }) ?? 0;
      this.budgets.record(scope_id, input_tokens, output_tokens, cost);

      return {
        invocation_id,
        started_at_iso,
        completed_at_iso: new Date().toISOString(),
        requested_tier,
        actually_used_provider_id: providerId,
        actually_used_tier: entry.tier,
        paid_provider_used: entry.is_paid_third_party,
        fallback_events,
        cost_downgrade_events,
        input_tokens,
        output_tokens,
        latency_ms: Date.now() - started_ms,
        outcome: "ok",
      };
    }

    // All providers failed / refused
    this.emit({ kind: "all_providers_failed", attempted, ts_iso: new Date().toISOString() });
    yield { type: "error", error: `all_providers_failed · attempted: ${attempted.join(", ")}`, retriable: true };
    // Determine outcome tag
    const anyPaidAttemptedButBlocked = attemptOrder.some((e) => e.is_paid_third_party) && !this.paidAllowed;
    return {
      invocation_id,
      started_at_iso,
      completed_at_iso: new Date().toISOString(),
      requested_tier,
      actually_used_provider_id: "n/a",
      actually_used_tier: requested_tier,
      paid_provider_used: false,
      fallback_events,
      cost_downgrade_events,
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: Date.now() - started_ms,
      outcome: anyPaidAttemptedButBlocked ? "paid_fallback_refused_by_doctrine" : "all_providers_failed",
    };
  }

  // ─── helpers ─────────────────────────────────────────────────
  private buildAttemptOrder(startTier: ProviderTier): readonly FallbackChainEntry[] {
    const tierOrder: ProviderTier[] = ["primary", "fallback_1", "fallback_2", "fallback_3", "budget"];
    const startIdx = tierOrder.indexOf(startTier);
    return this.chain.filter((e) => tierOrder.indexOf(e.tier) >= startIdx);
  }

  private emit(event: GatewayHealthEvent): void {
    try {
      this.sink(event);
    } catch { /* sink failures never break the gateway · doctrine */ }
  }

  /** For tests · reset internal state. */
  reset(): void {
    this.breakers.reset();
    this.budgets.reset();
  }
}

// ─── Coarse token estimate (deterministic · no network) ─────────

function coarseInputTokenEstimate(input: NexChatInput): number {
  // Rough: 1 token per 4 chars · matches OpenAI/Anthropic guidance
  const sysChars = (input.systemPrompt?.length ?? 0) + (input.cachedSystemPrefix?.length ?? 0);
  let msgChars = 0;
  for (const m of input.messages) {
    if (typeof m.content === "string") msgChars += m.content.length;
    else {
      for (const b of m.content) {
        if (b.type === "text" || b.type === "thinking") msgChars += b.text.length;
        else if (b.type === "tool_result") msgChars += b.result.length;
      }
    }
  }
  return Math.ceil((sysChars + msgChars) / 4);
}
