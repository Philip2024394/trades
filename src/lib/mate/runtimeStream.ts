// Streaming variant of the Mate agentic runtime. Same loop shape as
// runtime.ts (call model, run tools, loop) but pipes text deltas out
// event-by-event so the widget can type in real time. Tool execution
// happens between model turns (Anthropic returns full tool_use blocks
// before yielding stop_reason=tool_use).

import {
  completeAgenticStream,
  type AnthropicMessage,
  type AnthropicContentBlock,
  type CompleteResult
} from "@/lib/llm/anthropic";
import type { MateTool, MateToolContext } from "./tools/types";
import { toAnthropicTool } from "./tools/types";
import { toolByName } from "./tools/registry";
import type { MateToolCall, MateUiCard } from "./runtime";

const MAX_STEPS = 5;

export type StreamEvent =
  | { type: "text";        delta: string }
  | { type: "thinking";    delta: string }
  | { type: "tool_start";  name: string }
  | { type: "tool_end";    name: string; ok: boolean; ui?: MateUiCard }
  | { type: "done";        finalText: string; toolCalls: MateToolCall[]; uiCards: MateUiCard[]; usage: CompleteResult["usage"]; latencyMs: number; stoppedBy: "end_turn" | "max_steps" | "error" };

export type StreamInput = {
  cachedSystem:         string;
  system:               string;
  messages:             AnthropicMessage[];
  tools:                MateTool[];
  model:                string;
  ctx:                  MateToolContext;
  maxTokens?:           number;
  temperature?:         number;
  thinkingBudgetTokens?: number;
};

function zeroUsage(): CompleteResult["usage"] {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
}

function addUsage(acc: CompleteResult["usage"], next: CompleteResult["usage"]): CompleteResult["usage"] {
  return {
    inputTokens:          acc.inputTokens          + next.inputTokens,
    outputTokens:         acc.outputTokens         + next.outputTokens,
    cacheReadTokens:      acc.cacheReadTokens      + next.cacheReadTokens,
    cacheCreationTokens:  acc.cacheCreationTokens  + next.cacheCreationTokens
  };
}

function extractText(content: AnthropicContentBlock[]): string {
  return content
    .filter((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function* runAgenticStream(input: StreamInput): AsyncGenerator<StreamEvent> {
  const started    = Date.now();
  const wireTools  = input.tools.map(toAnthropicTool);
  let messages: AnthropicMessage[] = [...input.messages];
  let usage = zeroUsage();
  const toolCalls: MateToolCall[] = [];
  const uiCards:   MateUiCard[]   = [];
  let stoppedBy: "end_turn" | "max_steps" | "error" = "max_steps";
  let finalText  = "";

  for (let step = 1; step <= MAX_STEPS; step++) {
    let turnContent: AnthropicContentBlock[] = [];
    let turnStop = "end_turn";

    for await (const evt of completeAgenticStream({
      cachedSystem: input.cachedSystem,
      system:       input.system,
      messages,
      tools:        wireTools.length > 0 ? wireTools : undefined,
      toolChoice:   wireTools.length > 0 ? "auto" : undefined,
      model:        input.model,
      maxTokens:    input.maxTokens  ?? 1024,
      temperature:  input.temperature ?? 0.35,
      thinkingBudgetTokens: input.thinkingBudgetTokens
    })) {
      if (evt.type === "text_delta") {
        yield { type: "text", delta: evt.text };
      } else if (evt.type === "thinking_delta") {
        yield { type: "thinking", delta: evt.text };
      } else if (evt.type === "tool_start") {
        yield { type: "tool_start", name: evt.name };
      } else if (evt.type === "done") {
        turnContent = evt.content;
        turnStop    = evt.stopReason;
        usage       = addUsage(usage, evt.usage);
      } else if (evt.type === "error") {
        stoppedBy = "error";
        yield { type: "done", finalText: "", toolCalls, uiCards, usage, latencyMs: Date.now() - started, stoppedBy };
        return;
      }
    }

    if (turnStop !== "tool_use") {
      finalText = extractText(turnContent);
      stoppedBy = "end_turn";
      break;
    }

    // Tool-use turn: append full assistant content and execute each tool.
    messages.push({ role: "assistant", content: turnContent });
    const toolUseBlocks = turnContent.filter(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use"
    );

    const resultBlocks: AnthropicContentBlock[] = [];
    for (const block of toolUseBlocks) {
      const tool = toolByName(block.name);
      const t0 = Date.now();
      if (!tool) {
        toolCalls.push({ step, name: block.name, input: block.input, output: { error: "unknown_tool" }, ok: false, ms: 0 });
        yield { type: "tool_end", name: block.name, ok: false };
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ ok: false, error: "unknown_tool" }),
          is_error: true
        });
        continue;
      }
      try {
        const out = await tool.handler(block.input ?? {}, input.ctx);
        toolCalls.push({ step, name: block.name, input: block.input, output: out.data ?? null, ok: out.ok, ms: Date.now() - t0 });
        const uiCard = out.ui ? { ...out.ui, fromTool: tool.name } : undefined;
        if (uiCard) uiCards.push(uiCard);
        yield { type: "tool_end", name: block.name, ok: out.ok, ui: uiCard };
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ ok: out.ok, data: out.data ?? null, error: out.error ?? null }),
          is_error: !out.ok
        });
      } catch (e) {
        const err = e instanceof Error ? e.message : "handler_threw";
        toolCalls.push({ step, name: block.name, input: block.input, output: { error: err }, ok: false, ms: Date.now() - t0 });
        yield { type: "tool_end", name: block.name, ok: false };
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ ok: false, error: err }),
          is_error: true
        });
      }
    }
    messages.push({ role: "user", content: resultBlocks });
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
    stoppedBy
  };
}
