// Mate agentic runtime — the tool-use loop.
//
// Contract:
//   askAgentic({ cachedSystem, system, messages, tools, model, ctx })
//     → { finalText, toolCalls, uiCards, usage, latencyMs }
//
// Loop:
//   1. Call completeAgentic
//   2. If stopReason === "tool_use": dispatch each tool_use block to
//      its registered handler, append tool_result blocks, loop
//   3. Otherwise: extract final text and return
//
// Safety:
//   • MAX_STEPS caps runaway loops (5 turns of tool use, then stop)
//   • Unknown tool → returns is_error true so Claude can recover
//   • Handler throws are trapped — Claude sees an error tool_result
//   • Cumulative usage tracked across every call in the loop

import {
  completeAgentic,
  type AnthropicMessage,
  type AnthropicContentBlock,
  type CompleteResult
} from "@/lib/llm/anthropic";
import type { MateTool, MateToolContext } from "./tools/types";
import { toAnthropicTool } from "./tools/types";
import { toolByName } from "./tools/registry";

const MAX_STEPS = 5;

export type MateToolCall = {
  step:   number;
  name:   string;
  input:  Record<string, unknown>;
  output: unknown;
  ok:     boolean;
  ms:     number;
};

export type MateUiCard = {
  kind:      "draft-review-reply" | "draft-yard-post" | "list" | "action";
  payload:   Record<string, unknown>;
  fromTool:  string;
};

export type AgenticRunResult = {
  finalText:   string;
  toolCalls:   MateToolCall[];
  uiCards:     MateUiCard[];
  usage:       CompleteResult["usage"];
  latencyMs:   number;
  stoppedBy:   "end_turn" | "max_steps" | "error";
};

export type AgenticRunInput = {
  cachedSystem: string;
  system:       string;
  messages:     AnthropicMessage[];
  tools:        MateTool[];
  model:        string;
  ctx:          MateToolContext;
  maxTokens?:   number;
  temperature?: number;
};

function extractText(content: AnthropicContentBlock[]): string {
  return content
    .filter((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

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

export async function runAgentic(input: AgenticRunInput): Promise<AgenticRunResult> {
  const started = Date.now();
  const wireTools = input.tools.map(toAnthropicTool);
  let messages: AnthropicMessage[] = [...input.messages];
  let usage = zeroUsage();
  const toolCalls: MateToolCall[] = [];
  const uiCards:   MateUiCard[]   = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const res = await completeAgentic({
      cachedSystem: input.cachedSystem,
      system:       input.system,
      messages,
      tools:        wireTools.length > 0 ? wireTools : undefined,
      toolChoice:   wireTools.length > 0 ? "auto" : undefined,
      model:        input.model,
      maxTokens:    input.maxTokens  ?? 1024,
      temperature:  input.temperature ?? 0.35
    });

    if (!res) {
      return {
        finalText: "",
        toolCalls, uiCards,
        usage,
        latencyMs: Date.now() - started,
        stoppedBy: "error"
      };
    }

    usage = addUsage(usage, res.usage);

    if (res.stopReason !== "tool_use") {
      return {
        finalText:  extractText(res.content),
        toolCalls, uiCards,
        usage,
        latencyMs:  Date.now() - started,
        stoppedBy:  "end_turn"
      };
    }

    // Tool-use turn — Claude returned one or more tool_use blocks.
    // Append the assistant's full content (must include the tool_use
    // blocks so the follow-up tool_result IDs line up).
    messages.push({ role: "assistant", content: res.content });

    const toolUseBlocks = res.content.filter(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use"
    );

    const resultBlocks: AnthropicContentBlock[] = [];
    for (const block of toolUseBlocks) {
      const tool = toolByName(block.name);
      const t0 = Date.now();
      if (!tool) {
        toolCalls.push({ step, name: block.name, input: block.input, output: { error: "unknown_tool" }, ok: false, ms: 0 });
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
        if (out.ui) uiCards.push({ ...out.ui, fromTool: tool.name });
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ ok: out.ok, data: out.data ?? null, error: out.error ?? null }),
          is_error: !out.ok
        });
      } catch (e) {
        const err = e instanceof Error ? e.message : "handler_threw";
        toolCalls.push({ step, name: block.name, input: block.input, output: { error: err }, ok: false, ms: Date.now() - t0 });
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

  // Hit MAX_STEPS. Return whatever the last assistant text was.
  return {
    finalText: "I hit my tool-use limit on that one — try asking a bit more directly and I'll get you a sharper answer.",
    toolCalls,
    uiCards,
    usage,
    latencyMs: Date.now() - started,
    stoppedBy: "max_steps"
  };
}
