// runProviderStream · unit tests.
//
// Verifies the provider-neutral runtime emits the same StreamEvent
// shape that runAgenticStream emits, so the /api/nex/converse/stream
// route can dispatch to either without downstream branching. Uses a
// fake NexBrainProvider so the tests are deterministic and don't
// touch Ollama or Anthropic.

import { describe, it, expect } from "vitest";
import { runProviderStream } from "./runtimeProviderStream";
import type {
  NexBrainProvider,
  NexBrainCapabilities,
  NexChatEvent,
  NexChatInput,
} from "./brain/provider";
import type { StreamEvent } from "./runtimeStream";

// Simple fake provider · replays a scripted event list per call.
function fakeProvider(...scripts: NexChatEvent[][]): NexBrainProvider {
  let call = 0;
  const capabilities: NexBrainCapabilities = {
    supportsTools: true, supportsVision: false, supportsThinking: false,
    supportsPromptCaching: false, supportsStreaming: true, maxContextTokens: 32_768,
  };
  return {
    id: "fake:test",
    capabilities,
    async *chat(_input: NexChatInput): AsyncGenerator<NexChatEvent> {
      const script = scripts[call++] ?? [];
      for (const evt of script) yield evt;
    },
  };
}

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("runProviderStream · plain text turn", () => {
  it("emits text deltas and a done event with final text", async () => {
    const provider = fakeProvider([
      { type: "text_delta", text: "Hello " },
      { type: "text_delta", text: "world" },
      {
        type: "done",
        stopReason: "end_turn",
        usage: { inputTokens: 5, outputTokens: 2, cachedInputTokens: 0, cacheWriteTokens: 0 },
        finalMessage: { role: "assistant", content: [{ type: "text", text: "Hello world" }] },
      },
    ]);

    const events = await collect(runProviderStream({
      provider,
      systemPrompt: "You are NEX.",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      ctx: { surface: "visitor", userKey: "test-visitor" },
    }));

    const deltas = events.filter((e) => e.type === "text").map((e) => (e as { type: "text"; delta: string }).delta);
    expect(deltas).toEqual(["Hello ", "world"]);

    const done = events.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }> | undefined;
    expect(done).toBeDefined();
    expect(done!.finalText).toBe("Hello world");
    expect(done!.stoppedBy).toBe("end_turn");
    expect(done!.usage.inputTokens).toBe(5);
    expect(done!.usage.outputTokens).toBe(2);
  });
});

describe("runProviderStream · tool loop", () => {
  it("executes an unknown tool as an error result and resumes", async () => {
    const provider = fakeProvider(
      // Turn 1 · model requests a tool that isn't registered.
      [
        { type: "tool_call_start", toolId: "t1", toolName: "definitely_not_a_tool" },
        { type: "tool_call_ready", toolId: "t1", toolName: "definitely_not_a_tool", input: { x: 1 } },
        {
          type: "done",
          stopReason: "tool_use",
          usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, cacheWriteTokens: 0 },
          finalMessage: {
            role: "assistant",
            content: [{ type: "tool_call", toolId: "t1", toolName: "definitely_not_a_tool", input: { x: 1 } }],
          },
        },
      ],
      // Turn 2 · model gives up and answers in text.
      [
        { type: "text_delta", text: "Sorry, I couldn't run that tool." },
        {
          type: "done",
          stopReason: "end_turn",
          usage: { inputTokens: 12, outputTokens: 6, cachedInputTokens: 0, cacheWriteTokens: 0 },
          finalMessage: { role: "assistant", content: [{ type: "text", text: "Sorry, I couldn't run that tool." }] },
        },
      ],
    );

    const events = await collect(runProviderStream({
      provider,
      systemPrompt: "You are NEX.",
      messages: [{ role: "user", content: "call the fake tool" }],
      tools: [],
      ctx: { surface: "visitor", userKey: "test-visitor" },
    }));

    const toolStart = events.find((e) => e.type === "tool_start") as Extract<StreamEvent, { type: "tool_start" }> | undefined;
    const toolEnd   = events.find((e) => e.type === "tool_end")   as Extract<StreamEvent, { type: "tool_end" }> | undefined;
    expect(toolStart?.name).toBe("definitely_not_a_tool");
    expect(toolEnd?.ok).toBe(false);

    const done = events.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }> | undefined;
    expect(done!.finalText).toBe("Sorry, I couldn't run that tool.");
    expect(done!.toolCalls[0]?.ok).toBe(false);
    expect(done!.toolCalls[0]?.output).toEqual({ error: "unknown_tool" });
    // usage sums both turns
    expect(done!.usage.inputTokens).toBe(22);
    expect(done!.usage.outputTokens).toBe(11);
  });
});

describe("runProviderStream · provider errors", () => {
  it("emits a done event with error state when the provider errors mid-stream", async () => {
    const provider = fakeProvider([
      { type: "text_delta", text: "Partial " },
      { type: "error", error: "ollama_unreachable at http://localhost:11434 · is the Ollama server running?", retriable: true },
    ]);

    const events = await collect(runProviderStream({
      provider,
      systemPrompt: "You are NEX.",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      ctx: { surface: "visitor", userKey: "test-visitor" },
    }));

    const done = events.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }> | undefined;
    expect(done).toBeDefined();
    expect(done!.stoppedBy).toBe("error");
    expect(done!.finalText).toMatch(/problem reaching the model/);
    expect(done!.finalText).toMatch(/ollama_unreachable/);
  });
});
