// src/lib/nex-native/intelligence/nex-engine-provider.ts
//
// NEX Generation Engine · NexBrainProvider adapter (server-only).
// ---------------------------------------------------------------
// This is the ONE and ONLY generation provider NEX exposes to the
// existing NEX Intelligence runtime (`runProviderStream`,
// `NexBrainProvider` contract). It presents the NEX Generation Engine
// (100% NEX-owned architecture) as a `NexBrainProvider` so every
// existing NEX code path that consumes a provider gets the engine
// automatically.
//
// Architecture (from top to bottom):
//
//   NEX UI
//        │
//   existing NEX conversation service + adapter (nex-assistant.ts)
//        │
//   NEX Intelligence runtime (runProviderStream)
//        │
//   NexBrainProvider  ◀── this file exposes the NEX Engine here
//        │
//   NEX Generation Engine (generation-engine.ts)
//        │  · orchestration
//        │  · context construction (via caller)
//        │  · validation
//        │  · bounded correction / regeneration
//        │  · telemetry
//        │
//   Model Registry (model-registry.ts)
//        │  · role-based selection
//        │  · licence gate (commercial-safe only)
//        │  · replaceable backends
//        │
//   Foundation model adapter (models/*.ts)
//        │  · currently: Qwen2.5-0.5B-Instruct · Apache-2.0
//        │  · replaceable component · no engine dependency
//        │
//   Local runtime (@huggingface/transformers v4.3.0 · in-process)
//
// Non-negotiable guarantees:
//   1. 100% NEX-owned engine architecture.
//   2. No hosted AI · no Anthropic · no OpenAI · no Gemini · no Ollama.
//   3. Model is a REPLACEABLE COMPONENT. The engine does not know or
//      care which foundation model is currently plugged in.
//   4. Any generation failure surfaces honestly · never fabricates a
//      reply to conceal an engine failure.

import "server-only";
import type {
  NexBrainCapabilities,
  NexBrainProvider,
  NexChatEvent,
  NexChatInput,
  NexMessage,
} from "@/lib/nex/brain/provider";
import { runGenerationEngine } from "./generation-engine";
import type { NexChatMessage } from "./models/types";
import { selectModel, listRegisteredModels, type NexModelRole } from "./model-registry";
import { summarizeEngineTelemetry, getEngineTelemetry } from "./telemetry";

// NEX Engine capabilities · flat honest declaration. Tools currently
// route through the runtime loop (runProviderStream) rather than being
// native to the local model.
const NEX_ENGINE_CAPABILITIES: NexBrainCapabilities = {
  supportsTools: false,
  supportsVision: false,
  supportsThinking: false,
  supportsPromptCaching: false,
  supportsStreaming: true,
  maxContextTokens: 2048,
};

// ─── NEX-canonical → engine-canonical message conversion ─────────────
// NexMessage.content may be a string OR an array of content blocks.
// The engine consumes plain-text chat messages; we flatten any block
// list into concatenated text (dropping non-text blocks · the local
// foundation model doesn't consume vision, thinking, or tool blocks).

function toEngineMessages(input: NexChatInput): NexChatMessage[] {
  const out: NexChatMessage[] = [];
  for (const m of input.messages) {
    const text = extractText(m);
    if (!text) continue;
    // NEX-canonical "tool" role is not consumed by the local foundation
    // model. Fold tool payloads into a user-labelled context turn so
    // any resumed conversation carries the tool result forward without
    // confusing the model.
    const role: NexChatMessage["role"] =
      m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : "user";
    out.push({ role, content: text });
  }
  return out;
}

function extractText(m: NexMessage): string {
  if (typeof m.content === "string") return m.content.trim();
  return m.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// ─── NEX Engine · NexBrainProvider adapter ──────────────────────────

export interface NexEngineProviderOptions {
  /** Which model role to bind. Default: "default". */
  role?: NexModelRole;
  /** Max attempts before honest gap. Default: 3. */
  maxAttempts?: number;
}

export function createNexEngineBrainProvider(
  opts: NexEngineProviderOptions = {}
): NexBrainProvider {
  const role = opts.role ?? "default";
  const model = selectModel(role);
  const providerId = model
    ? `nex-engine:${model.id}`
    : `nex-engine:no-model-registered`;

  return {
    id: providerId,
    capabilities: NEX_ENGINE_CAPABILITIES,
    async *chat(input: NexChatInput): AsyncGenerator<NexChatEvent> {
      if (!model) {
        yield {
          type: "error",
          error: "NEX Engine · no commercial-safe model registered for role " + role,
          retriable: false,
        };
        return;
      }

      const engineMessages = toEngineMessages(input);
      const outcome = await runGenerationEngine(
        model,
        {
          systemPrompt: input.systemPrompt,
          messages: engineMessages,
          maxTokens: input.maxTokens,
          temperature: input.temperature,
        },
        { maxAttempts: opts.maxAttempts ?? 3 }
      );

      if (!outcome.ok) {
        yield {
          type: "error",
          error: `NEX Engine · ${outcome.error}`,
          retriable: false,
        };
        return;
      }

      // Emit as a single text_delta then done. runProviderStream
      // (existing NEX runtime) already treats this shape identically
      // to any incremental stream.
      yield { type: "text_delta", text: outcome.text };
      const finalMessage: NexMessage = {
        role: "assistant",
        content: [{ type: "text", text: outcome.text }],
      };
      yield {
        type: "done",
        stopReason: "end_turn",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
        },
        finalMessage,
      };
    },
  };
}

// ─── Diagnostics · lets adapters + acceptance harnesses inspect the
// current model without loading it. Never blocks. ────────────────────

export interface NexEngineDescriptor {
  role: NexModelRole;
  modelId: string | null;
  repositoryId: string | null;
  licenceSpdx: string | null;
  commercialUsePermitted: boolean;
  runtime: string | null;
}

export function describeNexEngine(role: NexModelRole = "default"): NexEngineDescriptor {
  const model = selectModel(role);
  if (!model) {
    return {
      role,
      modelId: null,
      repositoryId: null,
      licenceSpdx: null,
      commercialUsePermitted: false,
      runtime: null,
    };
  }
  return {
    role,
    modelId: model.id,
    repositoryId: model.repositoryId,
    licenceSpdx: model.licence.spdx,
    commercialUsePermitted: model.licence.commercialUsePermitted,
    runtime: model.runtime,
  };
}

// ─── Engine health · Phase G/J observability surface ─────────────────
// Aggregates: active model, registered candidates, telemetry summary,
// last recorded event · reserved for Founder/HQ diagnostics.

export interface NexEngineHealth {
  active: NexEngineDescriptor;
  registeredModelIds: string[];
  telemetry: ReturnType<typeof summarizeEngineTelemetry>;
  lastEventTs: string | null;
  memory: { rssMb: number; heapUsedMb: number };
}

export function getNexEngineHealth(role: NexModelRole = "default"): NexEngineHealth {
  const active = describeNexEngine(role);
  const registered = listRegisteredModels().map((m) => m.id);
  const telemetry = summarizeEngineTelemetry();
  const events = getEngineTelemetry().events;
  const lastEventTs = events.length > 0 ? events[events.length - 1]!.ts : null;
  const mem = process.memoryUsage();
  return {
    active,
    registeredModelIds: registered,
    telemetry,
    lastEventTs,
    memory: {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
    },
  };
}
