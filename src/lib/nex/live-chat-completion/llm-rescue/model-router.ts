// src/lib/nex/live-chat-completion/llm-rescue/model-router.ts
//
// Founder BEGIN Phase 3.6 · Model router (fast vs reasoning).
//
// Given the query characteristics and the retrieval bundle assembled by
// Phase 3.4/3.5, pick which registered model the rescue provider should
// use. Similar shape to OpenAI's GPT-5 internal router: fast small model
// for routine queries · reasoning-capable model for complex ones.
//
// Router runs BEFORE provider.invoke() · records its decision to
// _debug_timings so observability shows the fast/reasoning distribution
// per hour · which the founder can use to tune thresholds.
//
// Deterministic. Zero LLM (obviously).

import type { RetrievalBundle } from "./contract";

export type ModelClass = "fast" | "reasoning" | "mock";

export interface ModelRegistryEntry {
  model_id: string;    // Ollama model name · e.g. "qwen2.5:3b"
  class: ModelClass;
  context_window: number;
  supports_json_mode: boolean;
  description: string;
}

/**
 * Default registry. Founder overrides via NEX_LLM_ROUTER_REGISTRY (JSON).
 * The mock entry is always present so the mock provider is routable.
 */
export const DEFAULT_MODEL_REGISTRY: readonly ModelRegistryEntry[] = Object.freeze([
  {
    model_id: "qwen2.5:3b",
    class: "fast",
    context_window: 32_768,
    supports_json_mode: true,
    description: "Fast small local model · routine lookups + short synthesis",
  },
  {
    model_id: "qwen2.5:7b",
    class: "reasoning",
    context_window: 32_768,
    supports_json_mode: true,
    description: "Larger local model · multi-step reasoning + long evidence",
  },
  {
    model_id: "mock:test",
    class: "mock",
    context_window: 8_000,
    supports_json_mode: true,
    description: "Deterministic mock provider · regression testing",
  },
]);

export interface RouterDecision {
  chosen_model_id: string;
  chosen_class: ModelClass;
  reason: string;
  evidence_signals: {
    item_count: number;
    conversation_turns: number;
    message_length: number;
    has_conversation_context: boolean;
  };
}

export interface RouteInput {
  bundle: RetrievalBundle;
  provider_name_hint?: string;   // e.g. "mock:test" if using mock provider
  registry?: readonly ModelRegistryEntry[];
}

/**
 * Decide which model to use. Rules (deterministic):
 *   1. If provider hint matches a registry entry with class "mock" → mock.
 *   2. If evidence has ≥ 8 items OR message has > 40 words OR conversation
 *      has > 4 prior turns → reasoning.
 *   3. Otherwise → fast.
 *
 * Never blocks. Never invokes network. Sub-millisecond.
 */
export function routeModel(input: RouteInput): RouterDecision {
  const registry = input.registry ?? DEFAULT_MODEL_REGISTRY;
  const bundle = input.bundle;
  const itemCount = bundle.items.length;
  const conversationTurns = bundle.conversation_context?.length ?? 0;
  const messageLength = String(bundle.message ?? "").split(/\s+/).filter(Boolean).length;
  const signals = {
    item_count: itemCount,
    conversation_turns: conversationTurns,
    message_length: messageLength,
    has_conversation_context: conversationTurns > 0,
  };

  // Rule 1 · mock provider hint → mock class
  if (input.provider_name_hint && input.provider_name_hint.includes("mock")) {
    const mockEntry = registry.find((r) => r.class === "mock");
    if (mockEntry) {
      return {
        chosen_model_id: mockEntry.model_id,
        chosen_class: "mock",
        reason: "provider_hint=mock",
        evidence_signals: signals,
      };
    }
  }

  // Rule 2 · reasoning threshold
  const wantsReasoning = itemCount >= 8 || messageLength > 25 || conversationTurns > 4;
  if (wantsReasoning) {
    const reasoningEntry = registry.find((r) => r.class === "reasoning");
    if (reasoningEntry) {
      const why: string[] = [];
      if (itemCount >= 8) why.push(`items=${itemCount}>=8`);
      if (messageLength > 25) why.push(`msg_words=${messageLength}>25`);
      if (conversationTurns > 4) why.push(`turns=${conversationTurns}>4`);
      return {
        chosen_model_id: reasoningEntry.model_id,
        chosen_class: "reasoning",
        reason: `complex:${why.join("+")}`,
        evidence_signals: signals,
      };
    }
  }

  // Rule 3 · default fast
  const fastEntry = registry.find((r) => r.class === "fast");
  if (fastEntry) {
    return {
      chosen_model_id: fastEntry.model_id,
      chosen_class: "fast",
      reason: `default:items=${itemCount},words=${messageLength},turns=${conversationTurns}`,
      evidence_signals: signals,
    };
  }

  // Ultimate fallback · first entry.
  const first = registry[0];
  return {
    chosen_model_id: first?.model_id ?? "unknown",
    chosen_class: first?.class ?? "fast",
    reason: "registry_empty_fallback",
    evidence_signals: signals,
  };
}
