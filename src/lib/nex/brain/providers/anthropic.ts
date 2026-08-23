// NEX BRAIN · Anthropic provider adapter.
//
// Implements NexBrainProvider on top of the existing thin Anthropic
// wrapper at `src/lib/llm/anthropic.ts`. Translates NEX-canonical
// types ↔ Anthropic-specific ones. Provider name appears here + only
// here; every other layer of NEX sees only the NEX-canonical shape
// (per the Router architecture doctrine · 2026-08-20).
//
// Why we wrap rather than expose the Anthropic wrapper directly:
//   - Swap-in candidates (GPT-5, Gemini 3, open-source) need the
//     same call site. Anthropic-shaped tool_use / content blocks are
//     nearly compatible with OpenAI's function calling but not
//     identical · the NEX-canonical layer absorbs the diff.
//   - Callers (staircase agent, future kitchen agent) never import
//     `src/lib/llm/anthropic.ts` directly — always via NEX Router.

import {
  completeAgenticStream,
  type AnthropicContentBlock,
  type AnthropicMessage,
  type AnthropicToolDef,
  type AgenticStreamEvent,
} from "@/lib/llm/anthropic";
import type {
  NexBrainProvider,
  NexBrainCapabilities,
  NexChatEvent,
  NexChatInput,
  NexContentBlock,
  NexMessage,
  NexStopReason,
  NexToolDef,
  NexUsage,
} from "../provider";

// ─── Model registry ────────────────────────────────────────────────
// The models we've validated for NEX use. Adding a new Anthropic
// model means adding it here + updating the caller's config.

export const ANTHROPIC_MODELS = {
  "claude-opus-4-7": { maxContextTokens: 200_000, supportsThinking: true },
  "claude-haiku-4-5-20251001": { maxContextTokens: 200_000, supportsThinking: false },
} as const;

export type AnthropicModelId = keyof typeof ANTHROPIC_MODELS;

// ─── Adapter factory ───────────────────────────────────────────────

export function createAnthropicBrainProvider(
  model: AnthropicModelId = "claude-opus-4-7",
): NexBrainProvider {
  const modelInfo = ANTHROPIC_MODELS[model];

  const capabilities: NexBrainCapabilities = {
    supportsTools: true,
    supportsVision: true,
    supportsThinking: modelInfo.supportsThinking,
    supportsPromptCaching: true,
    supportsStreaming: true,
    maxContextTokens: modelInfo.maxContextTokens,
  };

  return {
    id: `anthropic:${model}`,
    capabilities,
    async *chat(input: NexChatInput): AsyncGenerator<NexChatEvent> {
      const anthropicMessages = input.messages.map(nexMessageToAnthropic);
      const anthropicTools = input.tools?.map(nexToolToAnthropic);

      const toolChoice = normaliseToolChoice(input.toolChoice);

      const stream = completeAgenticStream({
        model,
        system: input.systemPrompt,
        cachedSystem: input.cachedSystemPrefix,
        messages: anthropicMessages,
        tools: anthropicTools,
        toolChoice,
        maxTokens: input.maxTokens ?? 1024,
        temperature: input.temperature,
        thinkingBudgetTokens: capabilities.supportsThinking ? input.thinkingBudgetTokens : undefined,
      });

      // Reassembly state for the final NexMessage
      const contentBlocks: NexContentBlock[] = [];
      const activeToolCalls = new Map<string, { name: string; input?: Record<string, unknown> }>();

      for await (const event of stream) {
        const translated = translateEvent(event, contentBlocks, activeToolCalls);
        for (const nexEvent of translated) yield nexEvent;
      }
    },
  };
}

// ─── Type translation · NEX-canonical ↔ Anthropic ─────────────────

function nexMessageToAnthropic(msg: NexMessage): AnthropicMessage {
  // NEX "tool" role → Anthropic "user" role with tool_result blocks
  // (Anthropic's convention for tool responses).
  if (msg.role === "tool") {
    const blocks = typeof msg.content === "string"
      ? [{ type: "text" as const, text: msg.content }]
      : msg.content.map(nexBlockToAnthropic);
    return { role: "user", content: blocks };
  }

  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }
  return { role: msg.role, content: msg.content.map(nexBlockToAnthropic) };
}

function nexBlockToAnthropic(block: NexContentBlock): AnthropicContentBlock {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "thinking":
      return { type: "thinking", thinking: block.text };
    case "tool_call":
      return { type: "tool_use", id: block.toolId, name: block.toolName, input: block.input };
    case "tool_result":
      return { type: "tool_result", tool_use_id: block.toolId, content: block.result, is_error: block.isError };
    case "image_url":
      // NEX-canonical uses URL references. Anthropic's messages API
      // accepts URLs directly (2024+) but the wrapper here supports
      // base64 only. Skip for now — vision arrives in a later session
      // when we upgrade the wrapper to accept URLs.
      return { type: "text", text: `[image: ${block.caption ?? block.url}]` };
  }
}

function nexToolToAnthropic(tool: NexToolDef): AnthropicToolDef {
  // Cast readonly arrays/records to mutable for the Anthropic API shape.
  const properties: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
    properties[key] = { ...schema };
  }
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties,
      required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined,
    },
  };
}

function normaliseToolChoice(choice: NexChatInput["toolChoice"]) {
  if (!choice) return undefined;
  if (choice === "auto" || choice === "any") return choice;
  return { type: "tool" as const, name: choice.forceToolName };
}

// ─── Event translation · Anthropic → NEX-canonical ────────────────

function translateEvent(
  event: AgenticStreamEvent,
  contentBlocks: NexContentBlock[],
  activeToolCalls: Map<string, { name: string; input?: Record<string, unknown> }>,
): NexChatEvent[] {
  switch (event.type) {
    case "text_delta":
      return [{ type: "text_delta", text: event.text }];
    case "thinking_delta":
      return [{ type: "thinking_delta", text: event.text }];
    case "tool_start":
      activeToolCalls.set(event.id, { name: event.name });
      return [{ type: "tool_call_start", toolId: event.id, toolName: event.name }];
    case "tool_input": {
      const entry = activeToolCalls.get(event.id);
      if (!entry) return [];
      entry.input = event.input;
      return [
        {
          type: "tool_call_ready",
          toolId: event.id,
          toolName: entry.name,
          input: event.input,
        },
      ];
    }
    case "done": {
      // Reassemble content blocks from Anthropic's final content
      // array into NEX-canonical shape.
      for (const block of event.content) {
        const nexBlock = anthropicBlockToNex(block);
        if (nexBlock) contentBlocks.push(nexBlock);
      }
      const usage: NexUsage = {
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        cachedInputTokens: event.usage.cacheReadTokens,
        cacheWriteTokens: event.usage.cacheCreationTokens,
      };
      const finalMessage: NexMessage = { role: "assistant", content: contentBlocks };
      return [
        {
          type: "done",
          stopReason: mapStopReason(event.stopReason),
          usage,
          finalMessage,
        },
      ];
    }
    case "error":
      return [
        {
          type: "error",
          error: event.error,
          // network / stream errors are retriable · missing_api_key is not
          retriable: event.error !== "missing_api_key",
        },
      ];
  }
}

function anthropicBlockToNex(block: AnthropicContentBlock): NexContentBlock | null {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "thinking":
      return { type: "thinking", text: block.thinking };
    case "tool_use":
      return { type: "tool_call", toolId: block.id, toolName: block.name, input: block.input };
    case "tool_result":
      return {
        type: "tool_result",
        toolId: block.tool_use_id,
        result: block.content,
        isError: block.is_error,
      };
    case "image":
      // Anthropic image block is base64 — NEX-canonical uses URLs.
      // Skip in the outbound path (assistant messages shouldn't
      // normally contain images).
      return null;
  }
}

function mapStopReason(reason: string): NexStopReason {
  switch (reason) {
    case "end_turn":
    case "tool_use":
    case "max_tokens":
    case "stop_sequence":
      return reason;
    default:
      return "provider_error";
  }
}
