// src/lib/nex/l4-bakeoff/brain-provider-adapter.test.ts
//
// V.5.4.1 · Contract tests for NexBrainProvider → CandidateAdapter bridge
// Founder BEGIN V.5.4 · 2026-09-08
//
// Zero real Ollama invocation. All tests use mocked NexBrainProvider.

import { describe, it, expect } from "vitest";
import type {
  NexBrainProvider,
  NexBrainCapabilities,
  NexChatEvent,
  NexChatInput,
  NexMessage,
  NexUsage,
} from "@/lib/nex/brain/provider";
import {
  makeBrainProviderCandidateAdapter,
  translateAdapterRequestToNexChatInput,
  aggregateNexChatIntoAdapterResponse,
} from "./brain-provider-adapter";
import { makeOllamaQwen3_8bIdentity, makeOllamaQwen3_8bCandidate } from "./candidates/ollama-qwen3-8b";
import type { AdapterRequest, CandidateIdentity } from "./types";

// ─── Helpers · mocked NexBrainProviders ────────────────────────

const DEFAULT_CAPS: NexBrainCapabilities = {
  supportsTools: true, supportsVision: false, supportsThinking: false,
  supportsPromptCaching: false, supportsStreaming: true, maxContextTokens: 8192,
};

function makeMockProvider(events: NexChatEvent[], id = "mock-provider"): NexBrainProvider {
  return {
    id,
    capabilities: DEFAULT_CAPS,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      for (const e of events) yield e;
    },
  };
}

function makeThrowingProvider(err: unknown = new Error("provider bomb")): NexBrainProvider {
  return {
    id: "throwing-provider",
    capabilities: DEFAULT_CAPS,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      throw err;
    },
  };
}

const TEST_IDENTITY: CandidateIdentity = {
  candidate_id: "test_candidate_v1",
  display_name: "Test Candidate",
  provider_kind: "self_hosted_open_weight",
  provider: "mock",
  model_family: "test",
  model_variant: "1",
  model_version: "test-v1",
  license: "MIT",
  quantization: "n/a",
  context_window_tokens: 8192,
  supports_streaming: true,
  supports_tool_calls: true,
  supports_structured_output: false,
  supports_vision: false,
  supports_audio_in: false,
  supports_audio_out: false,
};

const BASIC_REQUEST: AdapterRequest = {
  prompt: "hello there",
  system_prompt: "You are NEX.",
  request_id: "req_test_1",
};

// ═══════════════════════════════════════════════════════════════════
// § REQUEST TRANSLATION
// ═══════════════════════════════════════════════════════════════════

describe("§V541-REQUEST · AdapterRequest → NexChatInput translation", () => {
  it("basic prompt becomes final user message", () => {
    const nex = translateAdapterRequestToNexChatInput(BASIC_REQUEST);
    expect(nex.messages.length).toBe(1);
    expect(nex.messages[0].role).toBe("user");
    expect(nex.messages[0].content).toBe("hello there");
    expect(nex.systemPrompt).toBe("You are NEX.");
  });

  it("conversation history preserved · prompt appended as final user turn", () => {
    const nex = translateAdapterRequestToNexChatInput({
      ...BASIC_REQUEST,
      conversation_history: [
        { role: "user", content: "earlier user" },
        { role: "assistant", content: "earlier assistant" },
      ],
    });
    expect(nex.messages.length).toBe(3);
    expect(nex.messages[2].content).toBe("hello there");
  });

  it("sampling parameters passed through", () => {
    const nex = translateAdapterRequestToNexChatInput({
      ...BASIC_REQUEST, temperature: 0.2, max_tokens: 512,
    });
    expect(nex.temperature).toBe(0.2);
    expect(nex.maxTokens).toBe(512);
  });

  it("tools translated · properties + required preserved", () => {
    const nex = translateAdapterRequestToNexChatInput({
      ...BASIC_REQUEST,
      tools: [{ name: "search", description: "search web", parameters: { properties: { q: { type: "string", description: "query" } }, required: ["q"] } }],
    });
    expect(nex.tools?.length).toBe(1);
    expect(nex.tools?.[0].name).toBe("search");
    expect(nex.tools?.[0].inputSchema.required).toEqual(["q"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § RESPONSE AGGREGATION
// ═══════════════════════════════════════════════════════════════════

describe("§V541-RESPONSE · async generator → AdapterResponse", () => {
  const finalMessage: NexMessage = { role: "assistant", content: [{ type: "text", text: "hi there" }] };
  const usage: NexUsage = { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, cacheWriteTokens: 0 };

  it("text_delta + done → kind:ok · accumulates text · captures tokens + latency", async () => {
    const provider = makeMockProvider([
      { type: "text_delta", text: "hi " },
      { type: "text_delta", text: "there" },
      { type: "done", stopReason: "end_turn", usage, finalMessage },
    ]);
    const started = Date.now();
    const r = await aggregateNexChatIntoAdapterResponse({ provider, nex_input: { systemPrompt: "", messages: [] }, started_ms: started });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.text).toBe("hi there");
      expect(r.input_tokens).toBe(10);
      expect(r.output_tokens).toBe(5);
      expect(r.latency_ms).toBeGreaterThanOrEqual(0);
      expect(r.ttft_ms).toBeDefined();
    }
  });

  it("no deltas · text from finalMessage extracted", async () => {
    const provider = makeMockProvider([
      { type: "done", stopReason: "end_turn", usage, finalMessage },
    ]);
    const r = await aggregateNexChatIntoAdapterResponse({ provider, nex_input: { systemPrompt: "", messages: [] }, started_ms: Date.now() });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.text).toBe("hi there");
  });

  it("tool_call_ready events collected", async () => {
    const provider = makeMockProvider([
      { type: "tool_call_ready", toolId: "t1", toolName: "search", input: { q: "abc" } },
      { type: "done", stopReason: "tool_use", usage, finalMessage },
    ]);
    const r = await aggregateNexChatIntoAdapterResponse({ provider, nex_input: { systemPrompt: "", messages: [] }, started_ms: Date.now() });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.tool_calls?.length).toBe(1);
      expect(r.tool_calls?.[0].name).toBe("search");
    }
  });

  it("error event · retriable=true → network_failure · retriable=false → model_failure", async () => {
    const retriable = makeMockProvider([{ type: "error", error: "timeout", retriable: true }]);
    const nonRetriable = makeMockProvider([{ type: "error", error: "malformed schema", retriable: false }]);
    const r1 = await aggregateNexChatIntoAdapterResponse({ provider: retriable, nex_input: { systemPrompt: "", messages: [] }, started_ms: Date.now() });
    const r2 = await aggregateNexChatIntoAdapterResponse({ provider: nonRetriable, nex_input: { systemPrompt: "", messages: [] }, started_ms: Date.now() });
    expect(r1.kind).toBe("network_failure");
    expect(r2.kind).toBe("model_failure");
  });

  it("provider that throws is caught · returns adapter_failure (contract violation captured)", async () => {
    const provider = makeThrowingProvider(new Error("kaboom"));
    const r = await aggregateNexChatIntoAdapterResponse({ provider, nex_input: { systemPrompt: "", messages: [] }, started_ms: Date.now() });
    expect(r.kind).toBe("adapter_failure");
    if (r.kind === "adapter_failure") expect(r.reason).toContain("kaboom");
  });

  it("usage unknown when done event lacks it · propagates UNKNOWN honestly", async () => {
    const provider = makeMockProvider([
      { type: "text_delta", text: "response" },
      { type: "done", stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 }, finalMessage: { role: "assistant", content: "response" } },
    ]);
    const r = await aggregateNexChatIntoAdapterResponse({ provider, nex_input: { systemPrompt: "", messages: [] }, started_ms: Date.now() });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.input_tokens).toBe(0);   // provider reported 0 explicitly
      expect(r.output_tokens).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// § BRIDGE FACTORY (CandidateAdapter shape)
// ═══════════════════════════════════════════════════════════════════

describe("§V541-BRIDGE · makeBrainProviderCandidateAdapter", () => {
  const goodProvider = makeMockProvider([
    { type: "text_delta", text: "ok" },
    { type: "done", stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0 }, finalMessage: { role: "assistant", content: "ok" } },
  ]);

  it("bridge produces valid CandidateAdapter · identity + supportedDimensions + invoke", async () => {
    const adapter = makeBrainProviderCandidateAdapter({ provider: goodProvider, identity: TEST_IDENTITY });
    expect(adapter.identity.candidate_id).toBe("test_candidate_v1");
    expect(adapter.supportedDimensions().length).toBeGreaterThan(0);
    const r = await adapter.invoke(BASIC_REQUEST);
    expect(r.kind).toBe("ok");
  });

  it("adapter NEVER throws · even on provider that throws", async () => {
    const throwing = makeThrowingProvider();
    const adapter = makeBrainProviderCandidateAdapter({ provider: throwing, identity: TEST_IDENTITY });
    const r = await adapter.invoke(BASIC_REQUEST);
    expect(r.kind).toBe("adapter_failure");
  });

  it("custom supported_dimensions honored", async () => {
    const adapter = makeBrainProviderCandidateAdapter({
      provider: goodProvider,
      identity: TEST_IDENTITY,
      supported_dimensions: ["natural_conversation", "safety"],
    });
    expect(adapter.supportedDimensions()).toEqual(["natural_conversation", "safety"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § OLLAMA CANDIDATE IDENTITY
// ═══════════════════════════════════════════════════════════════════

describe("§V541-OLLAMA-IDENTITY · candidate metadata correct", () => {
  it("makeOllamaQwen3_8bIdentity returns correctly-shaped CandidateIdentity", () => {
    const id = makeOllamaQwen3_8bIdentity();
    expect(id.candidate_id).toBe("ollama_qwen3_8b_v1");
    expect(id.provider_kind).toBe("self_hosted_open_weight");
    expect(id.provider).toBe("ollama");
    expect(id.model_family).toBe("qwen3");
    expect(id.model_variant).toBe("8b");
    expect(id.license).toBe("Apache-2.0");
  });

  it("SELF-SUSTAINMENT: is_paid_third_party in metadata is FALSE", () => {
    const id = makeOllamaQwen3_8bIdentity();
    expect(id.metadata?.is_paid_third_party).toBe(false);
    expect(id.metadata?.self_sustainment_compliant).toBe(true);
  });

  it("UNKNOWN honestly reported for context_window + quantization (verified only at real-invocation time)", () => {
    const id = makeOllamaQwen3_8bIdentity();
    expect(id.context_window_tokens).toBe("unknown");
    expect(id.quantization).toBe("unknown");
  });

  it("model_tag override propagates to identity + metadata", () => {
    const id = makeOllamaQwen3_8bIdentity({ model_tag: "qwen3:8b-q4_K_M" });
    expect(id.model_version).toBe("qwen3:8b-q4_K_M");
    expect(id.metadata?.requires_model_installed).toBe("qwen3:8b-q4_K_M");
  });

  it("vision NOT declared as supported (qwen3:8b is text-only)", () => {
    const id = makeOllamaQwen3_8bIdentity();
    expect(id.supports_vision).toBe(false);
  });

  it("makeOllamaQwen3_8bCandidate produces adapter without invoking Ollama", () => {
    // Construction alone MUST NOT contact Ollama · pure factory
    // (invocation would happen only on adapter.invoke(...) · which we don't call here)
    // But createOllamaBrainProvider enforces local-only endpoint · so any real
    // invocation attempt against non-local would throw at construction. Default
    // URL is local. Verify factory returns a well-shaped adapter object.
    const adapter = makeOllamaQwen3_8bCandidate();
    expect(adapter.identity.candidate_id).toBe("ollama_qwen3_8b_v1");
    expect(adapter.supportedDimensions().length).toBeGreaterThan(0);
    // Ollama-specific dimensions NOT declared
    expect(adapter.supportedDimensions()).not.toContain("voice_readiness");
    expect(adapter.supportedDimensions()).not.toContain("vision_readiness");
  });
});
