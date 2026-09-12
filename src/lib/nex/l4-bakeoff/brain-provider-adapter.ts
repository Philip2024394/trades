// src/lib/nex/l4-bakeoff/brain-provider-adapter.ts
//
// V.5.4.1 · Bridge NexBrainProvider (chat generator) → CandidateAdapter
// Founder BEGIN V.5.4 · 2026-09-08
//
// The L4 bakeoff harness consumes CandidateAdapter · not NexBrainProvider.
// This module bridges any NexBrainProvider (Ollama · future self-hosted
// runtimes · opt-in paid providers) into the CandidateAdapter shape.
//
// Discipline:
//   · Never throws (contract) · every failure typed
//   · Latency captured wall-clock (Date.now delta)
//   · Token counts propagated from NexUsage
//   · Failure classification maps NexChatEvent { type: "error", retriable }
//     → AdapterResponse discriminated union
//   · Self-Sustainment invariant: caller supplies is_paid_third_party
//     · adapter does NOT assume or fabricate this
//   · Gateway single-choke-point invariant: even though this bridge sits
//     between the L4 harness and the NexBrainProvider, the actual inference
//     STILL goes through the underlying NexBrainProvider (which is provider-
//     agnostic) · no direct SDK calls introduced

import type {
  NexBrainProvider,
  NexChatInput,
  NexChatEvent,
  NexMessage,
  NexContentBlock,
  NexUsage,
} from "@/lib/nex/brain/provider";
import type {
  AdapterRequest,
  AdapterResponse,
  CandidateAdapter,
  CandidateIdentity,
  EvaluationDimension,
} from "./types";
import { ALL_DIMENSIONS } from "./types";

// ═══════════════════════════════════════════════════════════════════
// § A · REQUEST TRANSLATION (AdapterRequest → NexChatInput)
// ═══════════════════════════════════════════════════════════════════

export function translateAdapterRequestToNexChatInput(req: AdapterRequest): NexChatInput {
  const messages: NexMessage[] = [];

  // Prepend conversation history if present
  if (req.conversation_history && req.conversation_history.length > 0) {
    for (const h of req.conversation_history) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  // Append the current turn's prompt as the final user message
  messages.push({ role: "user", content: req.prompt });

  return {
    systemPrompt: req.system_prompt ?? "",
    messages,
    tools: req.tools ? req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object",
        properties: (t.parameters?.properties as Record<string, { type: "string" | "number" | "boolean" | "array" | "object"; description?: string }>) ?? {},
        required: (t.parameters?.required as readonly string[]) ?? [],
      },
    })) : undefined,
    temperature: req.temperature,
    maxTokens: req.max_tokens,
  };
}

// ═══════════════════════════════════════════════════════════════════
// § B · RESPONSE AGGREGATION (async-generator NexChatEvent → AdapterResponse)
// ═══════════════════════════════════════════════════════════════════

/** Consume a NexBrainProvider chat generator + aggregate into a
 *  single AdapterResponse. Never throws. Handles:
 *   · text_delta accumulation
 *   · tool_call_ready collection
 *   · done event capture (usage + finalMessage)
 *   · error event → typed failure
 *   · unexpected exceptions → adapter_failure
 *   · ttft capture (first text/thinking delta timestamp) */
export async function aggregateNexChatIntoAdapterResponse(input: {
  provider: NexBrainProvider;
  nex_input: NexChatInput;
  started_ms: number;
}): Promise<AdapterResponse> {
  const { provider, nex_input, started_ms } = input;

  let accumulatedText = "";
  const toolCalls: { name: string; arguments: Record<string, unknown> }[] = [];
  let usage: NexUsage | undefined;
  let modelVersionReturned = provider.id;
  let ttftMs: number | undefined;
  let sawError = false;
  let errorMessage = "";
  let errorRetriable = false;

  try {
    const gen = provider.chat(nex_input);
    for await (const evt of gen) {
      // Capture time-to-first-token on the first text or thinking delta
      if (ttftMs === undefined && (evt.type === "text_delta" || evt.type === "thinking_delta")) {
        ttftMs = Date.now() - started_ms;
      }

      if (evt.type === "text_delta") {
        accumulatedText += evt.text;
      } else if (evt.type === "tool_call_ready") {
        toolCalls.push({ name: evt.toolName, arguments: evt.input });
      } else if (evt.type === "done") {
        usage = evt.usage;
        modelVersionReturned = extractModelVersionFromFinalMessage(evt.finalMessage) ?? provider.id;
        // If we didn't accumulate text via deltas · pull it from final message
        if (!accumulatedText) {
          accumulatedText = extractTextFromMessage(evt.finalMessage);
        }
      } else if (evt.type === "error") {
        sawError = true;
        errorMessage = evt.error;
        errorRetriable = evt.retriable;
        break;
      }
      // thinking_delta / tool_call_start intentionally not aggregated · we
      // care about final observable output
    }
  } catch (err) {
    // Contract violation: NexBrainProvider chat() promised not to throw ·
    // capture as adapter_failure so harness can classify separately from
    // model_failure
    return {
      kind: "adapter_failure",
      reason: `NexBrainProvider chat() threw (contract violation): ${err instanceof Error ? err.message : String(err)}`,
      latency_ms: Date.now() - started_ms,
    };
  }

  const totalLatencyMs = Date.now() - started_ms;

  if (sawError) {
    // Map to model_failure or network_failure depending on retriable hint
    // Note: NexChatEvent doesn't distinguish transport-vs-model errors ·
    // conservative default is model_failure with the message
    return {
      kind: errorRetriable ? "network_failure" : "model_failure",
      reason: errorMessage,
      partial_text: accumulatedText || undefined,
      latency_ms: totalLatencyMs,
    };
  }

  return {
    kind: "ok",
    text: accumulatedText,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    input_tokens: usage?.inputTokens ?? "unknown",
    output_tokens: usage?.outputTokens ?? "unknown",
    latency_ms: totalLatencyMs,
    ttft_ms: ttftMs,
    model_version_returned: modelVersionReturned,
  };
}

// ─── helpers ─────────────────────────────────────────────────────

function extractTextFromMessage(msg: NexMessage): string {
  if (typeof msg.content === "string") return msg.content;
  const parts: string[] = [];
  for (const block of msg.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("");
}

function extractModelVersionFromFinalMessage(_msg: NexMessage): string | null {
  // Placeholder: NexMessage doesn't carry provider-returned model version.
  // Callers relying on this field should populate it via CandidateIdentity
  // rather than expecting the message to carry it.
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// § C · BRIDGE FACTORY (NexBrainProvider + Identity → CandidateAdapter)
// ═══════════════════════════════════════════════════════════════════

export type BrainProviderAdapterOptions = {
  provider: NexBrainProvider;
  identity: CandidateIdentity;
  /** Which dimensions this candidate supports · defaults to ALL_DIMENSIONS
   *  when omitted (assume general-purpose model can attempt everything · let
   *  the harness classify per-case). */
  supported_dimensions?: readonly EvaluationDimension[];
};

/** Create a CandidateAdapter from a NexBrainProvider. Adapter never throws ·
 *  every failure typed · latency + tokens propagated. */
export function makeBrainProviderCandidateAdapter(opts: BrainProviderAdapterOptions): CandidateAdapter {
  const supported = opts.supported_dimensions ?? ALL_DIMENSIONS;

  return {
    identity: opts.identity,
    supportedDimensions(): readonly EvaluationDimension[] {
      return supported;
    },
    async invoke(req: AdapterRequest): Promise<AdapterResponse> {
      const started_ms = Date.now();
      try {
        const nex_input = translateAdapterRequestToNexChatInput(req);
        return await aggregateNexChatIntoAdapterResponse({
          provider: opts.provider,
          nex_input,
          started_ms,
        });
      } catch (err) {
        return {
          kind: "adapter_failure",
          reason: `bridge threw: ${err instanceof Error ? err.message : String(err)}`,
          latency_ms: Date.now() - started_ms,
        };
      }
    },
  };
}
