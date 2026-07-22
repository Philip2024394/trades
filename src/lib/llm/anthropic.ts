// Thin Anthropic wrapper. Direct fetch — no SDK dependency.
//
// Returns null when ANTHROPIC_API_KEY is missing so composers can
// gracefully fall back to a deterministic template (the merchant
// still gets a post, just less voicey).
//
// Prompt caching (2024-08+): pass a `cachedSystem` string alongside
// `system` and the wrapper will structure the system field as a
// content array with a cache_control breakpoint. The cached prefix
// is billed at 10% of standard input token cost on cache hit (2024
// pricing) — critical for Studio AI which sends the section
// catalog + design system context on every call.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-7";
const ANTHROPIC_VERSION = "2023-06-01";

/** A content block — used in agentic (tool-use) turns. Plain string
 *  content is still supported for the simple completion path. */
export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

/** Tool definition passed to the Anthropic Messages API. */
export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type CompleteInput = {
  system: string;
  /** Optional cached-prefix system content. When set, the wrapper
   *  structures `system` as a content array with a cache_control
   *  marker on this string. Subsequent calls with the same
   *  `cachedSystem` (within the 5-minute cache TTL) hit the cache. */
  cachedSystem?: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

export type CompleteResult = {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
};

/** Returns the model's text response + usage stats, or null on missing
 *  key / network error. Never throws — composers layer their own
 *  fallback. Usage stats surface cache hit/miss for cost tracking. */
export async function completeWithUsage(
  input: CompleteInput
): Promise<CompleteResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    // Build the system field. If cachedSystem is provided, structure
    // it as [{cached prefix}, {fresh instructions}] with cache_control
    // on the prefix. Otherwise send a plain string.
    const systemField: unknown = input.cachedSystem
      ? [
          {
            type: "text",
            text: input.cachedSystem,
            cache_control: { type: "ephemeral" }
          },
          { type: "text", text: input.system }
        ]
      : input.system;

    // Anthropic beta header — prompt caching is GA but the header
    // ensures caching semantics regardless of account tier.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION
    };
    if (input.cachedSystem) {
      headers["anthropic-beta"] = "prompt-caching-2024-07-31";
    }
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: input.model ?? DEFAULT_MODEL,
        max_tokens: input.maxTokens ?? 512,
        temperature: input.temperature ?? 0.4,
        system: systemField,
        messages: input.messages
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    const parts = data.content ?? [];
    const text = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    if (!text) return null;
    return {
      text,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
        cacheCreationTokens: data.usage?.cache_creation_input_tokens ?? 0
      }
    };
  } catch {
    return null;
  }
}

export type AgenticInput = CompleteInput & {
  tools?: AnthropicToolDef[];
  /** Force a specific tool by name, "auto" lets the model choose,
   *  "any" requires the model to call at least one tool. */
  toolChoice?: "auto" | "any" | { type: "tool"; name: string };
  /** Extended thinking budget in tokens. Opus 4.7 spends up to this
   *  many tokens reasoning before answering. Unset = no thinking. */
  thinkingBudgetTokens?: number;
};

export type AgenticResult = {
  content:    AnthropicContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
  usage:      CompleteResult["usage"];
};

/** Agentic completion — returns the full content array (may contain
 *  tool_use blocks) plus stop reason. The Mate runtime loops on this
 *  until stopReason !== "tool_use". Never throws. */
export async function completeAgentic(input: AgenticInput): Promise<AgenticResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const systemField: unknown = input.cachedSystem
      ? [
          { type: "text", text: input.cachedSystem, cache_control: { type: "ephemeral" } },
          { type: "text", text: input.system }
        ]
      : input.system;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION
    };
    if (input.cachedSystem) headers["anthropic-beta"] = "prompt-caching-2024-07-31";

    const body: Record<string, unknown> = {
      model:       input.model ?? DEFAULT_MODEL,
      max_tokens:  input.maxTokens  ?? 1024,
      temperature: input.temperature ?? 0.4,
      system:      systemField,
      messages:    input.messages
    };
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools;
      body.tool_choice = input.toolChoice
        ? (typeof input.toolChoice === "string" ? { type: input.toolChoice } : input.toolChoice)
        : { type: "auto" };
    }
    if (input.thinkingBudgetTokens && input.thinkingBudgetTokens > 0) {
      body.thinking = { type: "enabled", budget_tokens: input.thinkingBudgetTokens };
      // Thinking mode requires temperature=1
      body.temperature = 1;
    }

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST", headers, body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?:     AnthropicContentBlock[];
      stop_reason?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    return {
      content:    data.content ?? [],
      stopReason: data.stop_reason ?? "end_turn",
      usage: {
        inputTokens:          data.usage?.input_tokens ?? 0,
        outputTokens:         data.usage?.output_tokens ?? 0,
        cacheReadTokens:      data.usage?.cache_read_input_tokens ?? 0,
        cacheCreationTokens:  data.usage?.cache_creation_input_tokens ?? 0
      }
    };
  } catch {
    return null;
  }
}

// ─── Streaming ─────────────────────────────────────────────────
//
// Async-generator streaming for agentic turns. Yields one event per
// meaningful state change (text delta, tool started, tool input
// finished, thinking delta) plus a final `done` event carrying the
// reassembled content array + usage + stop reason. The Mate runtime
// consumes this to interleave tool execution with visible typing.

export type AgenticStreamEvent =
  | { type: "text_delta";     text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_start";     id: string; name: string }
  | { type: "tool_input";     id: string; input: Record<string, unknown> }
  | { type: "done";           content: AnthropicContentBlock[]; stopReason: string; usage: CompleteResult["usage"] }
  | { type: "error";          error: string };

/** Streaming variant of completeAgentic. Yields events as they land.
 *  Reassembles the final content array so the runtime can execute
 *  tool_use blocks + loop. Never throws — yields error events. */
export async function* completeAgenticStream(input: AgenticInput): AsyncGenerator<AgenticStreamEvent> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { yield { type: "error", error: "missing_api_key" }; return; }

  const systemField: unknown = input.cachedSystem
    ? [
        { type: "text", text: input.cachedSystem, cache_control: { type: "ephemeral" } },
        { type: "text", text: input.system }
      ]
    : input.system;

  const headers: Record<string, string> = {
    "Content-Type":       "application/json",
    "x-api-key":          key,
    "anthropic-version":  ANTHROPIC_VERSION,
    "accept":             "text/event-stream"
  };
  if (input.cachedSystem) headers["anthropic-beta"] = "prompt-caching-2024-07-31";

  const body: Record<string, unknown> = {
    model:       input.model ?? DEFAULT_MODEL,
    max_tokens:  input.maxTokens  ?? 1024,
    temperature: input.temperature ?? 0.4,
    system:      systemField,
    messages:    input.messages,
    stream:      true
  };
  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools;
    body.tool_choice = input.toolChoice
      ? (typeof input.toolChoice === "string" ? { type: input.toolChoice } : input.toolChoice)
      : { type: "auto" };
  }
  if (input.thinkingBudgetTokens && input.thinkingBudgetTokens > 0) {
    body.thinking = { type: "enabled", budget_tokens: input.thinkingBudgetTokens };
    body.temperature = 1;
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    yield { type: "error", error: e instanceof Error ? e.message : "network" };
    return;
  }
  if (!res.ok || !res.body) {
    yield { type: "error", error: `upstream_${res.status}` };
    return;
  }

  // Reassembly state — one entry per block index. text blocks accumulate
  // strings; tool_use blocks accumulate partial JSON to parse at the end.
  const blocks: Array<{ type: string; text?: string; thinking?: string; id?: string; name?: string; inputJson?: string }> = [];
  let stopReason = "end_turn";
  let usage: CompleteResult["usage"] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // SSE events separated by blank lines. Parse and dispatch.
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sepIdx);
        buffer   = buffer.slice(sepIdx + 2);
        const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const jsonStr = dataLine.slice(5).trim();
        if (!jsonStr) continue;
        let evt: {
          type?: string;
          index?: number;
          content_block?: { type: string; text?: string; thinking?: string; id?: string; name?: string; input?: Record<string, unknown> };
          delta?: { type?: string; text?: string; thinking?: string; partial_json?: string; stop_reason?: string };
          usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
        };
        try { evt = JSON.parse(jsonStr); } catch { continue; }

        if (evt.type === "content_block_start" && evt.content_block && typeof evt.index === "number") {
          const cb = evt.content_block;
          blocks[evt.index] = {
            type: cb.type,
            text: cb.type === "text" ? "" : undefined,
            thinking: cb.type === "thinking" ? "" : undefined,
            id: cb.id,
            name: cb.name,
            inputJson: cb.type === "tool_use" ? "" : undefined
          };
          if (cb.type === "tool_use" && cb.id && cb.name) {
            yield { type: "tool_start", id: cb.id, name: cb.name };
          }
        } else if (evt.type === "content_block_delta" && typeof evt.index === "number" && evt.delta) {
          const b = blocks[evt.index];
          if (!b) continue;
          if (evt.delta.type === "text_delta" && typeof evt.delta.text === "string") {
            b.text = (b.text ?? "") + evt.delta.text;
            yield { type: "text_delta", text: evt.delta.text };
          } else if (evt.delta.type === "thinking_delta" && typeof evt.delta.thinking === "string") {
            b.thinking = (b.thinking ?? "") + evt.delta.thinking;
            yield { type: "thinking_delta", text: evt.delta.thinking };
          } else if (evt.delta.type === "input_json_delta" && typeof evt.delta.partial_json === "string") {
            b.inputJson = (b.inputJson ?? "") + evt.delta.partial_json;
          }
        } else if (evt.type === "content_block_stop" && typeof evt.index === "number") {
          const b = blocks[evt.index];
          if (b?.type === "tool_use" && b.id) {
            let parsed: Record<string, unknown> = {};
            try { parsed = b.inputJson ? JSON.parse(b.inputJson) as Record<string, unknown> : {}; } catch {}
            yield { type: "tool_input", id: b.id, input: parsed };
          }
        } else if (evt.type === "message_delta") {
          if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
          if (evt.usage) {
            usage = {
              inputTokens:         evt.usage.input_tokens ?? usage.inputTokens,
              outputTokens:        evt.usage.output_tokens ?? usage.outputTokens,
              cacheReadTokens:     evt.usage.cache_read_input_tokens ?? usage.cacheReadTokens,
              cacheCreationTokens: evt.usage.cache_creation_input_tokens ?? usage.cacheCreationTokens
            };
          }
        }
      }
    }
  } catch (e) {
    yield { type: "error", error: e instanceof Error ? e.message : "stream_error" };
    return;
  }

  // Reassemble final content array
  const finalContent: AnthropicContentBlock[] = blocks.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text ?? "" };
    if (b.type === "thinking") return { type: "thinking", thinking: b.thinking ?? "" };
    if (b.type === "tool_use") {
      let parsed: Record<string, unknown> = {};
      try { parsed = b.inputJson ? JSON.parse(b.inputJson) as Record<string, unknown> : {}; } catch {}
      return { type: "tool_use", id: b.id ?? "", name: b.name ?? "", input: parsed };
    }
    return { type: "text", text: "" };
  });

  yield { type: "done", content: finalContent, stopReason, usage };
}

/** Text-only helper — same as completeWithUsage but returns just the
 *  string. Existing callers keep working. */
export async function complete(input: CompleteInput): Promise<string | null> {
  const result = await completeWithUsage(input);
  return result?.text ?? null;
}

/** JSON-mode helper — asks the model for a JSON object and parses.
 *  Returns null if the response can't be parsed or the key is missing. */
export async function completeJson<T = unknown>(
  input: CompleteInput
): Promise<T | null> {
  const raw = await complete(input);
  if (!raw) return null;
  try {
    // Trim common markdown fences the model sometimes wraps JSON in.
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
