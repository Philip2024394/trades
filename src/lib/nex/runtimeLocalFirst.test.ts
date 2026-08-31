// runLocalFirstStream · unit tests.
//
// Verifies the two contract points that matter for "user-invisible
// failover":
//   (a) When the local stream errors BEFORE emitting user-visible
//       output AND a fallback is supplied, the wrapper silently swaps
//       and yields the fallback's events instead. The local error
//       done is discarded.
//   (b) When the local stream has emitted user-visible output (text /
//       thinking / tool_end) and then errors, the wrapper commits —
//       yields the error done through, does NOT switch. Because
//       already-streamed text can't be un-sent.

import { describe, it, expect, vi } from "vitest";
import { runLocalFirstStream } from "./runtimeLocalFirst";
import type { StreamEvent } from "./runtimeStream";

async function* replay(...events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const e of events) yield e;
}

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("runLocalFirstStream · silent swap before first text", () => {
  it("discards the local error done and yields the fallback's events", async () => {
    const localEvents: StreamEvent[] = [
      { type: "done", finalText: "NEX had a problem reaching the model: ollama_unreachable", toolCalls: [], uiCards: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 20, stoppedBy: "error" },
    ];
    const fallbackEvents: StreamEvent[] = [
      { type: "text", delta: "Hello " },
      { type: "text", delta: "from the cloud." },
      { type: "done", finalText: "Hello from the cloud.", toolCalls: [], uiCards: [], usage: { inputTokens: 8, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 1200, stoppedBy: "end_turn" },
    ];
    const onSwap = vi.fn();

    const merged = await collect(runLocalFirstStream({
      local: () => replay(...localEvents),
      fallback: () => replay(...fallbackEvents),
      onSwap,
    }));

    // Local error done is invisible; we only see fallback events.
    expect(merged.map((e) => e.type)).toEqual(["text", "text", "done"]);
    const done = merged.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }>;
    expect(done.finalText).toBe("Hello from the cloud.");
    expect(done.stoppedBy).toBe("end_turn");
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap.mock.calls[0]?.[0]).toMatch(/ollama_unreachable/);
  });

  it("does not swap if no fallback is supplied · propagates local error done", async () => {
    const localEvents: StreamEvent[] = [
      { type: "done", finalText: "NEX had a problem reaching the model: ollama_unreachable", toolCalls: [], uiCards: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 20, stoppedBy: "error" },
    ];
    const merged = await collect(runLocalFirstStream({ local: () => replay(...localEvents) }));
    expect(merged).toHaveLength(1);
    expect(merged[0]!.type).toBe("done");
    expect((merged[0] as Extract<StreamEvent, { type: "done" }>).stoppedBy).toBe("error");
  });
});

describe("runLocalFirstStream · commits once user-visible output emitted", () => {
  it("does NOT swap when the local stream emitted text before erroring", async () => {
    const localEvents: StreamEvent[] = [
      { type: "text", delta: "Partial answer " },
      { type: "done", finalText: "NEX had a problem reaching the model: dropped_mid_stream", toolCalls: [], uiCards: [], usage: { inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 500, stoppedBy: "error" },
    ];
    const fallback = vi.fn(() => replay({ type: "text", delta: "should-not-appear" }, { type: "done", finalText: "x", toolCalls: [], uiCards: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 1, stoppedBy: "end_turn" }));

    const merged = await collect(runLocalFirstStream({
      local: () => replay(...localEvents),
      fallback,
    }));

    // Text is preserved, error done is preserved (not swapped for fallback).
    expect((merged[0] as Extract<StreamEvent, { type: "text" }>).delta).toBe("Partial answer ");
    const done = merged.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }>;
    expect(done.stoppedBy).toBe("error");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("does NOT swap on a normal successful local stream", async () => {
    const localEvents: StreamEvent[] = [
      { type: "text", delta: "All good." },
      { type: "done", finalText: "All good.", toolCalls: [], uiCards: [], usage: { inputTokens: 6, outputTokens: 3, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 300, stoppedBy: "end_turn" },
    ];
    const fallback = vi.fn(() => replay({ type: "done", finalText: "unused", toolCalls: [], uiCards: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 1, stoppedBy: "end_turn" }));

    const merged = await collect(runLocalFirstStream({ local: () => replay(...localEvents), fallback }));
    expect(merged.map((e) => e.type)).toEqual(["text", "done"]);
    expect(fallback).not.toHaveBeenCalled();
  });
});
