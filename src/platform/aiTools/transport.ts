// Platform AI Transport — swappable model client.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The Dispatcher must not know which model
//    provider is behind the wire. Swappable transport lets us
//    switch Anthropic → OpenAI → local Llama without touching a
//    single App or the Dispatcher.
//
// 2. Which future Apps benefit?  Every App that dispatches through
//    /api/ai/dispatch. Model provider changes at platform level.
//
// 3. Which doc authorises?  ADR-052 + PLATFORM_ARCHITECTURE §7.3
//    "The AI dispatcher endpoint".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Same pattern as `telemetry.setSink()`. Ship a canned transport for
// tests + development. Production overrides via `setTransport()` at
// boot, passing an Anthropic-backed implementation.

import type { ModelTier } from "./router";
import type { DiscoveredAITool } from "./discovery";

export type ToolCall = {
  id: string;
  toolName: string;
  args: unknown;
};

export type ToolResult = {
  toolCallId: string;
  result?: unknown;
  error?: string;
};

export type TransportRequest = {
  model: ModelTier;
  prompt: string;
  history?: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: ToolCall[];
    toolCallId?: string;
  }>;
  /** Tools available for this call. Sent to the model in the
   *  tool-use catalogue. */
  tools: DiscoveredAITool[];
  /** Timeout in ms. Transport hangs beyond this → returns timeout. */
  timeoutMs?: number;
};

export type TransportResponse = {
  /** The model's text output (may be empty if only tool calls fired). */
  text: string;
  /** Any tool calls the model requested. Handler dispatches them. */
  toolCalls: ToolCall[];
  /** Whether the model considers the turn complete. When false the
   *  dispatcher continues the loop after tool results come back. */
  done: boolean;
  /** Approx tokens consumed. Used for cost accounting. */
  inputTokens?: number;
  outputTokens?: number;
  /** Rate-limit / quota errors. */
  error?: string;
};

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

// ─── Canned transport (default in dev/test) ───────────────────

/** The canned transport recognises the prompt and returns a plausible
 *  response WITHOUT calling any external API. Useful for the
 *  verification harness + local dev without an API key.
 *
 *  Rules:
 *    - If the prompt contains a tool name like "find alternatives",
 *      request that tool.
 *    - If the prompt contains "compare", request compare_products.
 *    - Otherwise return a plain-text stub.
 */
export const cannedTransport: Transport = async (req) => {
  const prompt = req.prompt.toLowerCase();

  // Tool-call triggering heuristics — matches Marketplace's declared
  // tools by name. Extends naturally as more Apps register tools.
  const matchesTool = req.tools.find((t) => {
    const localName = (t.name.split(".")[1] ?? t.name).replace(/_/g, " ");
    // Match if any word of the local name shows up in the prompt.
    return localName.split(" ").every((word) => prompt.includes(word));
  });

  if (matchesTool) {
    // Build args heuristically based on the tool's parameter schema.
    // Real transport passes model-generated args; the canned one
    // extracts identifiers from the prompt where it can.
    const productIdMatch = req.prompt.match(/\bp-[a-z0-9-]+\b/i);
    const productIdsMatch = Array.from(
      req.prompt.matchAll(/\bp-[a-z0-9-]+\b/gi)
    ).map((m) => m[0]);
    let args: Record<string, unknown> = { query: req.prompt };
    const params = matchesTool.parameters as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    if (params?.properties) {
      args = {};
      if (params.properties.productId && productIdMatch) {
        args.productId = productIdMatch[0];
      }
      if (params.properties.productIds) {
        args.productIds = productIdsMatch.length > 0 ? productIdsMatch : ["p-fake-a", "p-fake-b"];
      }
      if (params.properties.query) {
        args.query = req.prompt;
      }
    }
    return {
      text: `Calling ${matchesTool.name} to answer that…`,
      toolCalls: [
        {
          id: `call_${Date.now()}`,
          toolName: matchesTool.name,
          args
        }
      ],
      done: false,
      inputTokens: Math.floor(req.prompt.length / 4),
      outputTokens: 20
    };
  }

  return {
    text: `Canned response (${req.model}): ${req.prompt.slice(0, 80)}${
      req.prompt.length > 80 ? "…" : ""
    }`,
    toolCalls: [],
    done: true,
    inputTokens: Math.floor(req.prompt.length / 4),
    outputTokens: Math.floor(req.prompt.length / 8)
  };
};

// ─── Sink swap ────────────────────────────────────────────────

let activeTransport: Transport = cannedTransport;

export function setTransport(transport: Transport): void {
  activeTransport = transport;
}

export function getTransport(): Transport {
  return activeTransport;
}
