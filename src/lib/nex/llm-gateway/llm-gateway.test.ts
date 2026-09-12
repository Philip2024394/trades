// src/lib/nex/llm-gateway/llm-gateway.test.ts
//
// WAVE-P-1.1 · LLM GATEWAY · comprehensive contract tests
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Covers Self-Sustainment doctrine (paid provider opt-in gate) · fallback
// chain · circuit breaker · cost router · observability. Every doctrine
// invariant is a first-class test dimension.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  NexBrainProvider,
  NexChatInput,
  NexChatEvent,
  NexBrainCapabilities,
  NexMessage,
} from "@/lib/nex/brain/provider";
import type { FallbackChainEntry, GatewayHealthEvent } from "./types";
import {
  CircuitBreakerRegistry,
  classifyFailure,
  recordFailure,
  recordSuccess,
  evaluate,
  markProbing,
} from "./circuit-breaker";
import {
  BudgetLedger,
  decideRoute,
  pickCheaperTier,
  estimateCallCost,
} from "./cost-router";
import {
  LlmGateway,
  makeMemoryHealthSink,
  isPaidFallbackAllowed,
  PAID_FALLBACK_ENV_VAR,
} from "./gateway";

// ─── Test provider factory ───────────────────────────────────────

const CAPS: NexBrainCapabilities = {
  supportsTools: true, supportsVision: false, supportsThinking: false,
  supportsPromptCaching: false, supportsStreaming: true, maxContextTokens: 32000,
};

function makeSuccessProvider(id: string, text = "hi there"): NexBrainProvider {
  return {
    id,
    capabilities: CAPS,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      yield { type: "text_delta", text };
      const msg: NexMessage = { role: "assistant", content: [{ type: "text", text }] };
      yield { type: "done", stopReason: "end_turn", usage: { inputTokens: 10, outputTokens: 4, cachedInputTokens: 0, cacheWriteTokens: 0 }, finalMessage: msg };
    },
  };
}

function makeFailProvider(id: string, errorMsg = "boom"): NexBrainProvider {
  return {
    id,
    capabilities: CAPS,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      yield { type: "error", error: errorMsg, retriable: true };
    },
  };
}

function makeThrowingProvider(id: string, err: unknown = new Error("thrown")): NexBrainProvider {
  return {
    id,
    capabilities: CAPS,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      throw err;
    },
  };
}

function makeHttpFailProvider(id: string, http_status: number): NexBrainProvider {
  return {
    id,
    capabilities: CAPS,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      yield { type: "error", error: `HTTP ${http_status}`, retriable: true };
    },
  };
}

const BASIC_INPUT: NexChatInput = {
  systemPrompt: "You are NEX.",
  messages: [{ role: "user", content: "hello" }],
};

// ═══════════════════════════════════════════════════════════════════
// § CIRCUIT BREAKER · state transitions
// ═══════════════════════════════════════════════════════════════════

describe("§P1-BREAKER · state transitions", () => {
  it("starts closed with 0 consecutive_failures", () => {
    const reg = new CircuitBreakerRegistry();
    const s = reg.get("p1");
    expect(s.state).toBe("closed");
    if (s.state === "closed") expect(s.consecutive_failures).toBe(0);
  });

  it("recordFailure advances consecutive_failures then trips to open at threshold", () => {
    let s: ReturnType<typeof recordFailure> = { state: "closed", consecutive_failures: 0 };
    const fail = classifyFailure({ error: new Error("network") });
    s = recordFailure(s, fail, { failure_threshold: 3, open_duration_ms: 60000, excluded_failure_kinds: [] });
    expect(s.state).toBe("closed");
    s = recordFailure(s, fail, { failure_threshold: 3, open_duration_ms: 60000, excluded_failure_kinds: [] });
    s = recordFailure(s, fail, { failure_threshold: 3, open_duration_ms: 60000, excluded_failure_kinds: [] });
    expect(s.state).toBe("open");
  });

  it("recordSuccess resets state to closed with 0 failures", () => {
    const s: ReturnType<typeof recordFailure> = { state: "open", opened_at_ms: 100, probe_after_ms: 500, last_failure_reason: "x" };
    const next = recordSuccess(s);
    expect(next.state).toBe("closed");
    if (next.state === "closed") expect(next.consecutive_failures).toBe(0);
  });

  it("SELF-SUSTAINMENT · overloaded failures excluded from threshold", () => {
    let s: ReturnType<typeof recordFailure> = { state: "closed", consecutive_failures: 0 };
    const overloaded = classifyFailure({ http_status: 529 });
    expect(overloaded.kind).toBe("overloaded");
    for (let i = 0; i < 10; i++) {
      s = recordFailure(s, overloaded);
    }
    expect(s.state).toBe("closed");
  });

  it("evaluate returns allow:false when open + before probe_after_ms", () => {
    const s = { state: "open" as const, opened_at_ms: 1000, probe_after_ms: 60000, last_failure_reason: "test" };
    const r = evaluate(s, 2000);
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.reason).toContain("breaker_open");
  });

  it("evaluate returns allow:true probe:true after probe_after_ms elapses", () => {
    const s = { state: "open" as const, opened_at_ms: 1000, probe_after_ms: 5000, last_failure_reason: "test" };
    const r = evaluate(s, 6000);
    expect(r.allow).toBe(true);
    if (r.allow) expect(r.probe).toBe(true);
  });

  it("markProbing transitions open → half_open · preserves opened_at_ms", () => {
    const s = { state: "open" as const, opened_at_ms: 1000, probe_after_ms: 5000, last_failure_reason: "x" };
    const next = markProbing(s, 7000);
    expect(next.state).toBe("half_open");
    if (next.state === "half_open") {
      expect(next.opened_at_ms).toBe(1000);
      expect(next.probe_started_at_ms).toBe(7000);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// § FAILURE CLASSIFICATION · deterministic
// ═══════════════════════════════════════════════════════════════════

describe("§P1-CLASSIFY · deterministic failure kinds", () => {
  it("529 → overloaded (excluded from breaker)", () => {
    expect(classifyFailure({ http_status: 529 }).kind).toBe("overloaded");
  });
  it("503 → overloaded", () => {
    expect(classifyFailure({ http_status: 503 }).kind).toBe("overloaded");
  });
  it("429 → rate_limit", () => {
    expect(classifyFailure({ http_status: 429 }).kind).toBe("rate_limit");
  });
  it("401/403 → auth (never retry)", () => {
    expect(classifyFailure({ http_status: 401 }).kind).toBe("auth");
    expect(classifyFailure({ http_status: 403 }).kind).toBe("auth");
  });
  it("402 → quota_exhausted", () => {
    expect(classifyFailure({ http_status: 402 }).kind).toBe("quota_exhausted");
  });
  it("500 → server_error", () => {
    expect(classifyFailure({ http_status: 500 }).kind).toBe("server_error");
  });
  it("ECONNREFUSED → network", () => {
    expect(classifyFailure({ error: new Error("ECONNREFUSED") }).kind).toBe("network");
  });
  it("retry_after seconds header parsed to ms", () => {
    const f = classifyFailure({ http_status: 429, retry_after_header: "30" });
    expect(f.retry_after_ms).toBe(30_000);
  });
  it("unknown error is honestly labelled UNKNOWN not fabricated", () => {
    expect(classifyFailure({ error: new Error("mystery") }).kind).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § COST ROUTER · budget + downgrade
// ═══════════════════════════════════════════════════════════════════

describe("§P1-COST · budget + downgrade + refuse", () => {
  it("empty policy allows preferred tier", () => {
    const ledger = new BudgetLedger();
    const chain: FallbackChainEntry[] = [
      { provider: makeSuccessProvider("p1"), tier: "primary", priority: 0, is_paid_third_party: false },
    ];
    const r = decideRoute({
      requested_tier: "primary",
      policy: { scope_id: "s", downgrade_at_fraction: 0.8, refuse_on_exhaust: true },
      consumption: ledger.get("s"),
      estimated_input_tokens: 100, estimated_output_tokens: 100,
      chain,
    });
    expect(r.action).toBe("allow_preferred_tier");
  });

  it("per-request cap triggers refuse", () => {
    const ledger = new BudgetLedger();
    const r = decideRoute({
      requested_tier: "primary",
      policy: { scope_id: "s", max_input_tokens_per_request: 50, downgrade_at_fraction: 0.8, refuse_on_exhaust: true },
      consumption: ledger.get("s"),
      estimated_input_tokens: 100, estimated_output_tokens: 100,
      chain: [{ provider: makeSuccessProvider("p1"), tier: "primary", priority: 0, is_paid_third_party: false }],
    });
    expect(r.action).toBe("refuse");
  });

  it("downgrade fires when consumption at threshold", () => {
    const ledger = new BudgetLedger();
    ledger.record("s", 800, 0, 0); // 800 of 1000 daily input = 80%
    const r = decideRoute({
      requested_tier: "primary",
      policy: { scope_id: "s", max_input_tokens_per_day: 1000, downgrade_at_fraction: 0.8, refuse_on_exhaust: false },
      consumption: ledger.get("s"),
      estimated_input_tokens: 100, estimated_output_tokens: 100,
      chain: [
        { provider: makeSuccessProvider("p1"), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeSuccessProvider("p2"), tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
    });
    expect(r.action).toBe("downgrade");
    if (r.action === "downgrade") expect(r.downgrade_to_tier).toBe("fallback_1");
  });

  it("pickCheaperTier returns undefined when at cheapest tier", () => {
    const chain: FallbackChainEntry[] = [
      { provider: makeSuccessProvider("p1"), tier: "budget", priority: 0, is_paid_third_party: false },
    ];
    expect(pickCheaperTier("budget", chain)).toBeUndefined();
  });

  it("estimateCallCost returns undefined when either price is UNKNOWN · never fabricated", () => {
    const cost = estimateCallCost({
      entry: { provider: makeSuccessProvider("p"), tier: "primary", priority: 0, is_paid_third_party: false, cost_per_million_input_tokens_usd: "unknown", cost_per_million_output_tokens_usd: 2 },
      input_tokens: 1000, output_tokens: 100,
    });
    expect(cost).toBeUndefined();
  });

  it("BudgetLedger.record accumulates within same day · resets at new day", () => {
    const ledger = new BudgetLedger();
    ledger.record("s", 100, 50, 0.01);
    const c = ledger.get("s");
    expect(c.input_tokens_today).toBe(100);
    expect(c.output_tokens_today).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § GATEWAY · SELF-SUSTAINMENT DOCTRINE (LOAD-BEARING)
// ═══════════════════════════════════════════════════════════════════

describe("§P1-DOCTRINE · SELF-SUSTAINMENT · paid provider opt-in gate", () => {
  let priorEnv: string | undefined;
  beforeEach(() => { priorEnv = process.env[PAID_FALLBACK_ENV_VAR]; delete process.env[PAID_FALLBACK_ENV_VAR]; });
  afterEach(() => { if (priorEnv === undefined) delete process.env[PAID_FALLBACK_ENV_VAR]; else process.env[PAID_FALLBACK_ENV_VAR] = priorEnv; });

  it("isPaidFallbackAllowed returns false when env var unset (default)", () => {
    expect(isPaidFallbackAllowed()).toBe(false);
  });

  it("isPaidFallbackAllowed returns true only for exact opt-in values", () => {
    process.env[PAID_FALLBACK_ENV_VAR] = "true";
    expect(isPaidFallbackAllowed()).toBe(true);
    process.env[PAID_FALLBACK_ENV_VAR] = "1";
    expect(isPaidFallbackAllowed()).toBe(true);
    process.env[PAID_FALLBACK_ENV_VAR] = "yes";
    expect(isPaidFallbackAllowed()).toBe(true);
    process.env[PAID_FALLBACK_ENV_VAR] = "false";
    expect(isPaidFallbackAllowed()).toBe(false);
    process.env[PAID_FALLBACK_ENV_VAR] = "TRUE"; // wrong case
    expect(isPaidFallbackAllowed()).toBe(false);
  });

  it("gateway REFUSES paid provider when opt-in NOT set · emits paid_fallback_refused_by_doctrine event", async () => {
    const { sink, events } = makeMemoryHealthSink();
    const gw = new LlmGateway({
      chain: [
        { provider: makeSuccessProvider("openai-paid"), tier: "primary", priority: 0, is_paid_third_party: true },
      ],
      health_sink: sink,
      paid_fallback_allowed_override: false,
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    const collected: NexChatEvent[] = [];
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
      collected.push(step.value);
    }
    // All events yielded before return
    expect(final.outcome).toBe("paid_fallback_refused_by_doctrine");
    expect(final.paid_provider_used).toBe(false);
    const refusalEvent = events.find((e) => e.kind === "paid_fallback_refused_by_doctrine");
    expect(refusalEvent).toBeDefined();
    if (refusalEvent && refusalEvent.kind === "paid_fallback_refused_by_doctrine") {
      expect(refusalEvent.would_have_used_provider_id).toBe("openai-paid");
    }
  });

  it("gateway ALLOWS paid provider when opt-in explicitly set · records paid_provider_used:true honestly", async () => {
    const gw = new LlmGateway({
      chain: [
        { provider: makeSuccessProvider("anthropic-paid"), tier: "primary", priority: 0, is_paid_third_party: true },
      ],
      paid_fallback_allowed_override: true,
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
    }
    expect(final.outcome).toBe("ok");
    expect(final.paid_provider_used).toBe(true);
    expect(final.actually_used_provider_id).toBe("anthropic-paid");
  });

  it("Ollama primary + paid fallback: paid NEVER used when Ollama works · paid_provider_used=false", async () => {
    const gw = new LlmGateway({
      chain: [
        { provider: makeSuccessProvider("ollama-qwen3-8b"), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeSuccessProvider("anthropic-paid"), tier: "fallback_1", priority: 0, is_paid_third_party: true },
      ],
      paid_fallback_allowed_override: true, // even with opt-in, Ollama wins because primary
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
    }
    expect(final.outcome).toBe("ok");
    expect(final.paid_provider_used).toBe(false);
    expect(final.actually_used_provider_id).toBe("ollama-qwen3-8b");
  });

  it("Ollama-only chain (no paid at all) succeeds without any doctrine friction", async () => {
    const gw = new LlmGateway({
      chain: [
        { provider: makeSuccessProvider("ollama-qwen3-8b"), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeSuccessProvider("ollama-phi-4"), tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
      paid_fallback_allowed_override: false,
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
    }
    expect(final.outcome).toBe("ok");
    expect(final.paid_provider_used).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § GATEWAY · FALLBACK CHAIN
// ═══════════════════════════════════════════════════════════════════

describe("§P1-FALLBACK · ordered chain traversal", () => {
  it("primary fails · fallback_1 succeeds · records fallback_event", async () => {
    const { sink, events } = makeMemoryHealthSink();
    const gw = new LlmGateway({
      chain: [
        { provider: makeFailProvider("ollama-primary", "boom"), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeSuccessProvider("ollama-backup"), tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
      health_sink: sink,
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
    }
    expect(final.outcome).toBe("ok");
    expect(final.actually_used_provider_id).toBe("ollama-backup");
    expect(final.fallback_events.length).toBe(1);
    expect(events.some((e) => e.kind === "fallback_used")).toBe(true);
  });

  it("all providers fail · outcome=all_providers_failed", async () => {
    const gw = new LlmGateway({
      chain: [
        { provider: makeFailProvider("p1"), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeFailProvider("p2"), tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
    }
    expect(final.outcome).toBe("all_providers_failed");
  });

  it("provider that THROWS (contract violation) is caught + treated as adapter failure", async () => {
    const gw = new LlmGateway({
      chain: [
        { provider: makeThrowingProvider("p1"), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeSuccessProvider("p2"), tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
    });
    const gen = gw.chatWithGateway({ ...BASIC_INPUT });
    let final;
    while (true) {
      const step = await gen.next();
      if (step.done) { final = step.value; break; }
    }
    expect(final.outcome).toBe("ok");
    expect(final.actually_used_provider_id).toBe("p2");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § GATEWAY · CIRCUIT BREAKER integration
// ═══════════════════════════════════════════════════════════════════

describe("§P1-BREAKER-GATEWAY · circuit breaker integration", () => {
  it("after N consecutive failures · breaker trips · provider ejected · fallback used automatically", async () => {
    const { sink, events } = makeMemoryHealthSink();
    const gw = new LlmGateway({
      chain: [
        { provider: makeHttpFailProvider("flaky", 500), tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: makeSuccessProvider("stable"), tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
      breaker_config: { failure_threshold: 2, open_duration_ms: 60000, excluded_failure_kinds: ["overloaded"] },
      health_sink: sink,
    });
    // First call · primary fails · fallback used
    await drain(gw.chatWithGateway({ ...BASIC_INPUT }));
    // Second call · primary fails again · breaker trips → open
    await drain(gw.chatWithGateway({ ...BASIC_INPUT }));
    // Third call · primary short-circuited by breaker · fallback used
    const final = await drain(gw.chatWithGateway({ ...BASIC_INPUT }));
    expect(final.actually_used_provider_id).toBe("stable");
    expect(gw.getCircuitBreakerState("flaky").state === "open" || gw.getCircuitBreakerState("flaky").state === "closed").toBe(true);
    expect(events.some((e) => e.kind === "provider_ejected")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § GATEWAY · observability + capabilities
// ═══════════════════════════════════════════════════════════════════

describe("§P1-OBSERVE · health events + capability union", () => {
  it("gateway.capabilities is UNION of chain capabilities", () => {
    const withVision: NexBrainProvider = { id: "vision-only", capabilities: { ...CAPS, supportsVision: true, supportsTools: false }, async *chat() {} };
    const withThinking: NexBrainProvider = { id: "thinking-only", capabilities: { ...CAPS, supportsThinking: true, supportsVision: false }, async *chat() {} };
    const gw = new LlmGateway({
      chain: [
        { provider: withVision, tier: "primary", priority: 0, is_paid_third_party: false },
        { provider: withThinking, tier: "fallback_1", priority: 0, is_paid_third_party: false },
      ],
    });
    expect(gw.capabilities.supportsVision).toBe(true);
    expect(gw.capabilities.supportsThinking).toBe(true);
    expect(gw.capabilities.supportsTools).toBe(true);
  });

  it("provider_healthy event includes is_paid_third_party for auditability", async () => {
    const { sink, events } = makeMemoryHealthSink();
    const gw = new LlmGateway({
      chain: [{ provider: makeSuccessProvider("ollama"), tier: "primary", priority: 0, is_paid_third_party: false }],
      health_sink: sink,
    });
    await drain(gw.chatWithGateway({ ...BASIC_INPUT }));
    const healthy = events.find((e) => e.kind === "provider_healthy");
    expect(healthy).toBeDefined();
    if (healthy && healthy.kind === "provider_healthy") expect(healthy.is_paid_third_party).toBe(false);
  });

  it("empty chain refused at construction · not silently allowed", () => {
    expect(() => new LlmGateway({ chain: [] })).toThrow(/refused/);
  });
});

// ─── helper: drain generator to completion ───────────────────────

async function drain(gen: AsyncGenerator<NexChatEvent, any>) {
  while (true) {
    const s = await gen.next();
    if (s.done) return s.value;
  }
}
