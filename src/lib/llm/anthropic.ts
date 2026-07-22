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
