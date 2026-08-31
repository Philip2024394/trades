// Provider-neutral streaming variant of the Nex agentic runtime.
//
// Consumes a NexBrainProvider directly instead of calling
// completeAgenticStream (which is Anthropic-specific). Emits the
// exact same StreamEvent union runAgenticStream emits, so the
// /api/nex/converse/stream route treats both runtimes as interchangeable.
//
// Why this exists:
//   Ollama (local) is one adapter behind the NexBrainProvider interface;
//   Anthropic (cloud) is another. runAgenticStream is hardwired to
//   Anthropic's wire format. This file lets us route through ANY
//   NexBrainProvider — including Ollama for local-first NEX chat —
//   without touching the widget or the route's downstream logic.
//
// Loop shape mirrors runtimeStream.ts:
//   1. provider.chat({...})  — yields NEX-canonical events
//   2. If stopReason === "tool_use": execute each collected tool,
//      append tool_result blocks (NEX-canonical role: "tool" message),
//      loop.
//   3. Otherwise: extract final text, emit done event, return.
//
// Message translation:
//   The route currently constructs AnthropicMessage[]. This module
//   converts to NexMessage[] on the way IN, so callers don't need to
//   change their message-building code. That translation is lossy on
//   Anthropic-only concepts (cache_control markers, thinking signatures)
//   which local models don't consume anyway.

import type {
  NexBrainProvider,
  NexMessage,
  NexToolDef,
} from "./brain/provider";
import type {
  AnthropicContentBlock,
  AnthropicMessage,
  CompleteResult,
} from "@/lib/llm/anthropic";
import type { NexTool, NexToolContext } from "./tools/types";
import { toolByName } from "./tools/registry";
import type { NexToolCall, NexUiCard } from "./runtime";
import type { StreamEvent } from "./runtimeStream";

const MAX_STEPS = 5;

export type ProviderStreamInput = {
  provider:             NexBrainProvider;
  /** Combined system prompt · Anthropic's caching split doesn't apply
   *  to local providers, so we accept a single string. Callers passing
   *  cachedSystem should concatenate before calling. */
  systemPrompt:         string;
  messages:             AnthropicMessage[];
  tools:                NexTool[];
  ctx:                  NexToolContext;
  maxTokens?:           number;
  temperature?:         number;
  thinkingBudgetTokens?: number;
};

export async function* runProviderStream(input: ProviderStreamInput): AsyncGenerator<StreamEvent> {
  const started = Date.now();
  let messages: NexMessage[] = input.messages.map(anthropicMessageToNex);
  const wireTools: NexToolDef[] = input.tools.map(nexToolToProviderDef);

  let usage: CompleteResult["usage"] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  const toolCalls: NexToolCall[] = [];
  const uiCards: NexUiCard[] = [];
  let stoppedBy: "end_turn" | "max_steps" | "error" = "max_steps";
  let finalText = "";

  for (let step = 1; step <= MAX_STEPS; step++) {
    let turnStop: string = "end_turn";
    let turnFinalMessage: NexMessage | null = null;
    let hadError = false;

    // Pending tool calls collected from this turn — executed after the
    // provider finishes emitting the turn's `done` event.
    const pendingToolCalls: Array<{ toolId: string; toolName: string; input: Record<string, unknown> }> = [];

    for await (const evt of input.provider.chat({
      systemPrompt: input.systemPrompt,
      messages,
      tools:        wireTools.length > 0 ? wireTools : undefined,
      toolChoice:   wireTools.length > 0 ? "auto" : undefined,
      maxTokens:    input.maxTokens ?? 1024,
      temperature:  input.temperature ?? 0.35,
      thinkingBudgetTokens: input.thinkingBudgetTokens,
    })) {
      if (evt.type === "text_delta") {
        yield { type: "text", delta: evt.text };
      } else if (evt.type === "thinking_delta") {
        yield { type: "thinking", delta: evt.text };
      } else if (evt.type === "tool_call_start") {
        yield { type: "tool_start", name: evt.toolName };
      } else if (evt.type === "tool_call_ready") {
        pendingToolCalls.push({ toolId: evt.toolId, toolName: evt.toolName, input: evt.input });
      } else if (evt.type === "done") {
        turnStop = evt.stopReason;
        turnFinalMessage = evt.finalMessage;
        usage = addUsage(usage, {
          inputTokens: evt.usage.inputTokens,
          outputTokens: evt.usage.outputTokens,
          cacheReadTokens: evt.usage.cachedInputTokens,
          cacheCreationTokens: evt.usage.cacheWriteTokens,
        });
      } else if (evt.type === "error") {
        hadError = true;
        stoppedBy = "error";
        // Emit an empty done so the route can persist + close the stream.
        yield {
          type: "done",
          finalText: `NEX had a problem reaching the model: ${evt.error}`,
          toolCalls, uiCards, usage,
          latencyMs: Date.now() - started,
          stoppedBy,
        };
        return;
      }
    }

    if (hadError || turnFinalMessage === null) {
      // Provider ended without a done event · treat as error.
      stoppedBy = "error";
      yield {
        type: "done",
        finalText: "NEX did not receive a complete response from the model.",
        toolCalls, uiCards, usage,
        latencyMs: Date.now() - started,
        stoppedBy,
      };
      return;
    }

    if (turnStop !== "tool_use") {
      finalText = extractText(turnFinalMessage);
      stoppedBy = "end_turn";
      break;
    }

    // Tool-use turn · append the assistant's finalMessage (which
    // already contains the tool_call blocks per NEX-canonical shape)
    // and then execute each tool.
    messages.push(turnFinalMessage);

    const resultBlocks: NexMessage["content"] = [];
    for (const call of pendingToolCalls) {
      const tool = toolByName(call.toolName);
      const t0 = Date.now();
      if (!tool) {
        toolCalls.push({ step, name: call.toolName, input: call.input, output: { error: "unknown_tool" }, ok: false, ms: 0 });
        yield { type: "tool_end", name: call.toolName, ok: false };
        (resultBlocks as Array<{ type: "tool_result"; toolId: string; result: string; isError?: boolean }>).push({
          type: "tool_result",
          toolId: call.toolId,
          result: JSON.stringify({ ok: false, error: "unknown_tool" }),
          isError: true,
        });
        continue;
      }
      try {
        const out = await tool.handler(call.input ?? {}, input.ctx);
        toolCalls.push({ step, name: call.toolName, input: call.input, output: out.data ?? null, ok: out.ok, ms: Date.now() - t0 });
        const uiCard: NexUiCard | undefined = out.ui ? { ...out.ui, fromTool: tool.name } : undefined;
        if (uiCard) uiCards.push(uiCard);
        yield { type: "tool_end", name: call.toolName, ok: out.ok, ui: uiCard };
        (resultBlocks as Array<{ type: "tool_result"; toolId: string; result: string; isError?: boolean }>).push({
          type: "tool_result",
          toolId: call.toolId,
          result: JSON.stringify({ ok: out.ok, data: out.data ?? null, error: out.error ?? null }),
          isError: !out.ok,
        });
      } catch (e) {
        const err = e instanceof Error ? e.message : "handler_threw";
        toolCalls.push({ step, name: call.toolName, input: call.input, output: { error: err }, ok: false, ms: Date.now() - t0 });
        yield { type: "tool_end", name: call.toolName, ok: false };
        (resultBlocks as Array<{ type: "tool_result"; toolId: string; result: string; isError?: boolean }>).push({
          type: "tool_result",
          toolId: call.toolId,
          result: JSON.stringify({ ok: false, error: err }),
          isError: true,
        });
      }
    }

    messages.push({ role: "tool", content: resultBlocks });
  }

  if (stoppedBy === "max_steps") {
    finalText = "I hit my tool-use limit on that one — try asking more directly and I'll sort it.";
  }

  yield {
    type: "done",
    finalText,
    toolCalls, uiCards,
    usage,
    latencyMs: Date.now() - started,
    stoppedBy,
  };
}

// ─── Message translation · Anthropic → NEX-canonical ──────────────

function anthropicMessageToNex(m: AnthropicMessage): NexMessage {
  if (typeof m.content === "string") {
    return { role: m.role, content: m.content };
  }

  // Anthropic represents tool_result blocks as user messages · convert
  // those to NEX role: "tool" so the provider adapter routes them
  // correctly (Ollama expects `role: "tool"` for tool_result payloads).
  const hasToolResult = m.content.some((b) => b.type === "tool_result");
  if (m.role === "user" && hasToolResult) {
    const blocks: NexMessage["content"] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") {
        (blocks as Array<{ type: "tool_result"; toolId: string; result: string; isError?: boolean }>).push({
          type: "tool_result",
          toolId: b.tool_use_id,
          result: typeof b.content === "string" ? b.content : JSON.stringify(b.content),
          isError: b.is_error,
        });
      } else if (b.type === "text") {
        (blocks as Array<{ type: "text"; text: string }>).push({ type: "text", text: b.text });
      }
    }
    return { role: "tool", content: blocks };
  }

  const blocks: NexMessage["content"] = [];
  for (const b of m.content) {
    if (b.type === "text") {
      (blocks as Array<{ type: "text"; text: string }>).push({ type: "text", text: b.text });
    } else if (b.type === "thinking") {
      (blocks as Array<{ type: "thinking"; text: string }>).push({ type: "thinking", text: b.thinking });
    } else if (b.type === "tool_use") {
      (blocks as Array<{ type: "tool_call"; toolId: string; toolName: string; input: Record<string, unknown> }>).push({
        type: "tool_call",
        toolId: b.id,
        toolName: b.name,
        input: b.input ?? {},
      });
    } else if (b.type === "image") {
      // Text-only providers ignore images · encode as a data URL so
      // vision-capable providers can consume it. If the resolved
      // provider lacks vision, its adapter must omit the block.
      (blocks as Array<{ type: "image_url"; url: string }>).push({
        type: "image_url",
        url: `data:${b.source.media_type};base64,${b.source.data}`,
      });
    }
  }

  return { role: m.role, content: blocks };
}

// ─── Tool translation · NEX tool → provider-canonical tool def ────

function nexToolToProviderDef(t: NexTool): NexToolDef {
  // NexTool.input_schema uses Anthropic's permissive JSON-Schema shape.
  // NexToolDef.inputSchema is a narrower TypeScript type but forwards
  // arbitrary property shapes to the adapter (which forwards to the
  // model's tool schema). A cast is safe here — both shapes ARE JSON
  // Schema at the wire level; the TS narrowing is for callers that
  // build tool defs from scratch, not for translated ones.
  return {
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema as unknown as NexToolDef["inputSchema"],
  };
}

// ─── Utility ──────────────────────────────────────────────────────

function extractText(msg: NexMessage): string {
  if (typeof msg.content === "string") return msg.content.trim();
  return msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function addUsage(acc: CompleteResult["usage"], next: CompleteResult["usage"]): CompleteResult["usage"] {
  return {
    inputTokens: acc.inputTokens + next.inputTokens,
    outputTokens: acc.outputTokens + next.outputTokens,
    cacheReadTokens: acc.cacheReadTokens + next.cacheReadTokens,
    cacheCreationTokens: acc.cacheCreationTokens + next.cacheCreationTokens,
  };
}
