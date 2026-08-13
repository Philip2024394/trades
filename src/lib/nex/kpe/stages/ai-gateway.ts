// KPE Stage 11 · AI Gateway
//
// The ONLY component in the KPE (and by extension, in NEX) that holds
// credentials for external LLM providers. Every AI call from every worker
// must eventually land here.
//
// Design:
//   · Provider plugins register with the AI Gateway registry
//   · Router picks a provider based on `preferred_tier` + capability + health
//   · If no provider matches, fails fast with a clear error (never silently
//     succeeds with a mock in production)
//
// v1 ships one provider · a mock · so the pipeline runs end-to-end without
// external dependencies. Real providers (Groq, Anthropic, Gemini, local)
// register at boot in Phase 3 · zero pipeline code changes required.

import type { AICapability, AIGatewayInput, AIGatewayOutput, PipelineStage } from "../types";

// ── Provider registry (internal to the Gateway) ──────────────────

export type AIProvider = {
  name: string;
  tier: "local_llm" | "frontier_llm";
  supports: AICapability[];
  invoke: (capability: AICapability, prompt: string) => Promise<{
    output: string; tokens_in: number; tokens_out: number; cost_gbp: number;
  }>;
  healthy: () => boolean;
};

const providers = new Map<string, AIProvider>();

export function registerAIProvider(p: AIProvider): void {
  providers.set(p.name, p);
}

export function listAIProviders(): Array<{ name: string; tier: string; supports: string[]; healthy: boolean }> {
  return [...providers.values()].map((p) => ({
    name: p.name, tier: p.tier, supports: p.supports, healthy: p.healthy(),
  }));
}

function chooseProvider(tier: "local_llm" | "frontier_llm", capability: AICapability): AIProvider | null {
  const candidates = [...providers.values()]
    .filter((p) => p.tier === tier && p.supports.includes(capability) && p.healthy());
  return candidates[0] ?? null;   // v1 · pick first · Phase 3 adds real routing
}

// ── Default mock provider · ships in-tree · overridden in production ──

registerAIProvider({
  name: "mock",
  tier: "local_llm",
  supports: ["extract", "classify", "summarise", "rerank", "converse"],
  healthy: () => true,
  invoke: async (capability, prompt) => {
    const outputByCap: Record<AICapability, string> = {
      extract:        `{"extracted": "mock", "input_length": ${prompt.length}}`,
      classify:       `{"label": "unclassified", "confidence": 0.5}`,
      summarise:      `Mock summary of ${prompt.length} chars.`,
      rerank:         `[{"index": 0, "score": 0.5}]`,
      embed:          `[]`,
      vision_analyse: `{"description": "mock vision analysis", "confidence": 0.5}`,
      converse:       `Mock conversational reply.`,
    };
    return {
      output: outputByCap[capability] ?? "mock",
      tokens_in: Math.ceil(prompt.length / 4),
      tokens_out: 50,
      cost_gbp: 0,
    };
  },
});

// ── Stage implementation ──────────────────────────────────────────

export const AIGatewayStage: PipelineStage<AIGatewayInput, AIGatewayOutput> = {
  name: "ai_gateway",
  version: "1.0.0",
  async run(input: AIGatewayInput): Promise<AIGatewayOutput> {
    const started = Date.now();
    const provider = chooseProvider(input.preferred_tier, input.capability);
    if (!provider) {
      return {
        ok: false,
        provider: "none",
        output: "",
        tokens_in: 0,
        tokens_out: 0,
        latency_ms: Date.now() - started,
        cost_gbp: 0,
        error: `no_provider_for_tier_${input.preferred_tier}_capability_${input.capability}`,
      };
    }
    try {
      const result = await provider.invoke(input.capability, input.prompt_slice);
      return {
        ok: true,
        provider: provider.name,
        output: result.output,
        tokens_in: result.tokens_in,
        tokens_out: result.tokens_out,
        latency_ms: Date.now() - started,
        cost_gbp: result.cost_gbp,
      };
    } catch (err) {
      return {
        ok: false,
        provider: provider.name,
        output: "",
        tokens_in: 0,
        tokens_out: 0,
        latency_ms: Date.now() - started,
        cost_gbp: 0,
        error: err instanceof Error ? err.message : "unknown_provider_error",
      };
    }
  },
};
