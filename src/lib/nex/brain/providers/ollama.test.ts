// Ollama provider · unit tests.
//
// Covers the parts that don't need a real Ollama server: streaming
// parse, error mapping (unreachable / model-missing / timeout), and
// the probeOllama helper's discriminated result. An end-to-end
// verification against a real server lives in
// scripts/verify-ollama-provider.mjs (invoked manually / in CI when
// Ollama is available).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOllamaBrainProvider, probeOllama } from "./ollama";
import type { NexChatEvent } from "../provider";

function ndjson(...chunks: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(JSON.stringify(c) + "\n"));
      controller.close();
    },
  });
}

async function collect(gen: AsyncGenerator<NexChatEvent>): Promise<NexChatEvent[]> {
  const out: NexChatEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const origFetch = global.fetch;
beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { global.fetch = origFetch; });

describe("createOllamaBrainProvider · endpoint validation", () => {
  it("rejects non-local URLs at construction time", () => {
    expect(() => createOllamaBrainProvider({ url: "https://ollama.example.com" }))
      .toThrow(/endpoint must be local/);
  });

  it("accepts localhost", () => {
    expect(() => createOllamaBrainProvider({ url: "http://localhost:11434" })).not.toThrow();
  });

  it("accepts 127.0.0.1", () => {
    expect(() => createOllamaBrainProvider({ url: "http://127.0.0.1:11434" })).not.toThrow();
  });

  it("declares supportsStreaming=true when stream option is true", () => {
    const p = createOllamaBrainProvider({ stream: true });
    expect(p.capabilities.supportsStreaming).toBe(true);
  });

  it("declares supportsStreaming=false when stream option is false", () => {
    const p = createOllamaBrainProvider({ stream: false });
    expect(p.capabilities.supportsStreaming).toBe(false);
  });
});

describe("createOllamaBrainProvider · streaming", () => {
  it("emits a text_delta per chunk and one done event at the end", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(
      ndjson(
        { model: "m", created_at: "t1", message: { role: "assistant", content: "Hello" }, done: false },
        { model: "m", created_at: "t2", message: { role: "assistant", content: ", " }, done: false },
        { model: "m", created_at: "t3", message: { role: "assistant", content: "world!" }, done: false },
        { model: "m", created_at: "t4", message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 12, eval_count: 3 },
      ),
      { status: 200 },
    ));

    const p = createOllamaBrainProvider({ stream: true });
    const events = await collect(p.chat({ systemPrompt: "test", messages: [{ role: "user", content: "hi" }] }));

    const deltas = events.filter((e) => e.type === "text_delta").map((e) => (e as { type: "text_delta"; text: string }).text);
    expect(deltas).toEqual(["Hello", ", ", "world!"]);

    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect((done as Extract<NexChatEvent, { type: "done" }>).stopReason).toBe("end_turn");
    expect((done as Extract<NexChatEvent, { type: "done" }>).usage.inputTokens).toBe(12);
    expect((done as Extract<NexChatEvent, { type: "done" }>).usage.outputTokens).toBe(3);
  });

  it("assembles tool_call events from the final chunk", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(
      ndjson(
        { model: "m", created_at: "t1", message: { role: "assistant", content: "" }, done: false },
        { model: "m", created_at: "t2", message: { role: "assistant", content: "", tool_calls: [
          { function: { name: "find_local_business", arguments: { cuisine: "Japanese", area: "Seminyak" } } },
        ] }, done: true, done_reason: "stop", prompt_eval_count: 20, eval_count: 8 },
      ),
      { status: 200 },
    ));

    const p = createOllamaBrainProvider({ stream: true });
    const events = await collect(p.chat({ systemPrompt: "test", messages: [{ role: "user", content: "Find sushi" }] }));

    const ready = events.find((e) => e.type === "tool_call_ready") as Extract<NexChatEvent, { type: "tool_call_ready" }> | undefined;
    expect(ready?.toolName).toBe("find_local_business");
    expect(ready?.input).toEqual({ cuisine: "Japanese", area: "Seminyak" });

    const done = events.find((e) => e.type === "done") as Extract<NexChatEvent, { type: "done" }> | undefined;
    expect(done?.stopReason).toBe("tool_use");
  });
});

describe("createOllamaBrainProvider · errors", () => {
  it("emits ollama_unreachable when fetch throws ECONNREFUSED", async () => {
    global.fetch = vi.fn().mockRejectedValue(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } }));
    const p = createOllamaBrainProvider({ stream: true });
    const events = await collect(p.chat({ systemPrompt: "s", messages: [{ role: "user", content: "hi" }] }));
    const err = events.find((e) => e.type === "error") as Extract<NexChatEvent, { type: "error" }> | undefined;
    expect(err?.error).toMatch(/ollama_unreachable/);
    expect(err?.retriable).toBe(true);
  });

  it("emits ollama_model_missing on 404 with 'not found'", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(
      "model \"qwen2.5:missing\" not found, try pulling it first",
      { status: 404 },
    ));
    const p = createOllamaBrainProvider({ stream: true, model: "qwen2.5:missing" });
    const events = await collect(p.chat({ systemPrompt: "s", messages: [{ role: "user", content: "hi" }] }));
    const err = events.find((e) => e.type === "error") as Extract<NexChatEvent, { type: "error" }> | undefined;
    expect(err?.error).toMatch(/ollama_model_missing/);
    expect(err?.error).toContain("qwen2.5:missing");
  });

  it("emits ollama_timeout when the request aborts", async () => {
    // AbortError from the AbortController firing before fetch resolves.
    global.fetch = vi.fn().mockImplementation(async (_url, init: RequestInit) => {
      return await new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    const p = createOllamaBrainProvider({ stream: true, timeoutMs: 20 });
    const events = await collect(p.chat({ systemPrompt: "s", messages: [{ role: "user", content: "hi" }] }));
    const err = events.find((e) => e.type === "error") as Extract<NexChatEvent, { type: "error" }> | undefined;
    expect(err?.error).toMatch(/ollama_timeout/);
  });
});

describe("probeOllama", () => {
  it("returns ok:true when /api/tags responds with the model", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ models: [{ model: "qwen2.5:7b-instruct-q3_K_M" }, { model: "qwen2.5:3b" }] }),
      { status: 200 },
    ));
    const r = await probeOllama({ model: "qwen2.5:7b-instruct-q3_K_M" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.modelInstalled).toBe(true);
      expect(r.models).toContain("qwen2.5:3b");
    }
  });

  it("returns ok:true, modelInstalled:false when the model isn't listed", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ models: [{ model: "qwen2.5:3b" }] }),
      { status: 200 },
    ));
    const r = await probeOllama({ model: "qwen2.5:7b-instruct-q3_K_M" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.modelInstalled).toBe(false);
  });

  it("returns ok:false when the server is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:11434"));
    const r = await probeOllama();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ECONNREFUSED|probe_failed/);
  });

  it("returns ok:false with non-local endpoint", async () => {
    const r = await probeOllama({ url: "https://ollama.example.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/endpoint must be local/);
  });
});
