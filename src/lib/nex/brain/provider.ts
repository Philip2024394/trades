// NEX BRAIN · provider abstraction.
//
// Per the Router architecture doctrine (2026-08-20 · CONSTITUTIONAL):
// NEX is provider-independent. Third-party AI providers (Anthropic
// Claude, OpenAI GPT, Google Gemini, open-source) are engines
// UNDERNEATH NEX, never at the architecture level. This module
// defines the NEX-canonical shape every provider adapter must
// implement so a swap-out is a one-file change, not an architectural
// rewrite.
//
// The interface + types here MUST stay:
//   - Provider-agnostic (no Anthropic/OpenAI/Gemini names)
//   - Schema-stable (adding fields requires a doctrine review)
//   - Forward-compatible (new providers can implement subsets and
//     declare their capabilities via the `capabilities` field)
//
// Concrete provider adapters live in `./providers/*`.
// Runtime provider selection lives in `./resolve.ts`.

// ─── NEX-canonical message shape ───────────────────────────────────
// Roles map to every mainstream LLM provider. Content can be a plain
// string (simple text turn) or a structured content array (agentic
// tool-use turns · vision · thinking blocks).

export type NexMessageRole = "user" | "assistant" | "tool";

export type NexContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; toolId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolId: string; result: string; isError?: boolean }
  | { type: "image_url"; url: string; caption?: string };

export type NexMessage = {
  role: NexMessageRole;
  content: string | NexContentBlock[];
};

// ─── NEX-canonical tool definition ─────────────────────────────────
// Tools are declared once by the caller (staircase agent, future
// kitchen agent, etc.) and passed to every provider identically. The
// adapter maps to Claude's tool-use schema / OpenAI's function-calling
// schema / Gemini's function declaration schema.

export type NexToolInputSchema = {
  type: "object";
  properties: Record<string, {
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    enum?: readonly string[];
    items?: { type: string };
  }>;
  required?: readonly string[];
};

export type NexToolDef = {
  /** Canonical tool name · e.g. "updateStaircaseDesign". Same name
   *  used across every provider adapter. */
  name: string;
  /** Human-readable description that the LLM reads to decide when to
   *  call the tool. Speaks to the model, not the customer. */
  description: string;
  inputSchema: NexToolInputSchema;
};

// ─── Chat input · what the caller passes to the provider ──────────

export type NexChatInput = {
  /** Persona / instructions / context that shapes NEX's response.
   *  Adapters may split this across system + cached-prefix depending
   *  on provider capabilities. */
  systemPrompt: string;
  /** Optional stable prefix that benefits from prompt caching. When
   *  set, adapters MUST route it through their caching path (e.g.
   *  Anthropic's cache_control ephemeral marker) to keep cost down
   *  on multi-turn conversations. Missing = no caching. */
  cachedSystemPrefix?: string;
  messages: NexMessage[];
  /** Tools the LLM MAY call. Empty = pure conversation, no tool loop. */
  tools?: NexToolDef[];
  /** Force a specific tool ("required call"), let the model choose
   *  ("auto"), or require at least one call ("any"). Defaults to
   *  "auto" when tools are supplied. */
  toolChoice?: "auto" | "any" | { forceToolName: string };
  /** Max tokens for the response. Adapters SHOULD honour but MAY cap
   *  at their model's ceiling. */
  maxTokens?: number;
  /** Sampling temperature 0..1. Adapters MAY ignore for models that
   *  require fixed temperature (e.g. Anthropic thinking mode = 1). */
  temperature?: number;
  /** When set, request extended reasoning (thinking) with this
   *  token budget. Providers without native thinking may downgrade
   *  gracefully. */
  thinkingBudgetTokens?: number;
};

// ─── Streaming events · what the provider yields ──────────────────
// Every adapter yields the SAME event shape. NEX runtime + UI never
// need to know which provider is behind the stream.

export type NexChatEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_call_start"; toolId: string; toolName: string }
  /** Full tool input, ready to execute. Emitted after streaming
   *  finishes assembling the arguments JSON. */
  | { type: "tool_call_ready"; toolId: string; toolName: string; input: Record<string, unknown> }
  | { type: "done"; stopReason: NexStopReason; usage: NexUsage; finalMessage: NexMessage }
  | { type: "error"; error: string; retriable: boolean };

export type NexStopReason =
  | "end_turn"       // model finished normally
  | "tool_use"       // model wants tools executed · runtime should call them + resume
  | "max_tokens"     // hit response ceiling
  | "stop_sequence"  // hit a stop token
  | "provider_error";

export type NexUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Cached input tokens billed at reduced rate (provider-specific
   *  discount). 0 when caching not used or not supported. */
  cachedInputTokens: number;
  /** Tokens spent creating a new cache entry (billed at premium on
   *  Anthropic · varies elsewhere). 0 when no fresh cache write. */
  cacheWriteTokens: number;
};

// ─── Provider capabilities · declared per adapter ─────────────────
// Callers can gate features on capabilities so a provider that
// doesn't support thinking/vision doesn't get a request it can't
// fulfil.

export type NexBrainCapabilities = {
  /** Provider supports tool-use (function calling) natively. */
  supportsTools: boolean;
  /** Provider accepts image_url content blocks in user messages. */
  supportsVision: boolean;
  /** Provider supports extended-reasoning / thinking mode. */
  supportsThinking: boolean;
  /** Provider supports prompt caching (cached prefix billed at
   *  reduced rate). */
  supportsPromptCaching: boolean;
  /** Provider supports streaming responses. Should always be true
   *  for interactive chat use — non-streaming providers are only
   *  useful for background composers. */
  supportsStreaming: boolean;
  /** Approximate max context window in tokens. Callers use this to
   *  decide when to summarise older turns. */
  maxContextTokens: number;
};

// ─── The interface every adapter implements ───────────────────────

export interface NexBrainProvider {
  /** Stable ID for this provider instance · e.g. "anthropic:claude-opus-4-7",
   *  "openai:gpt-4o-2024-11-20". Used for telemetry + debugging. Never
   *  surfaced to the customer. */
  readonly id: string;
  readonly capabilities: NexBrainCapabilities;

  /** Streaming chat completion. Yields NEX-canonical events as they
   *  land. Callers execute any tool_call_ready events out-of-band
   *  then resume with the tool_result appended to messages.
   *
   *  Adapters MUST:
   *  - Never throw · errors emit as { type: "error" } events
   *  - Emit exactly one { type: "done" } event at the end (unless
   *    error, in which case emit error then return)
   *  - Reassemble the final message correctly (text + tool_use blocks)
   *  - Report usage accurately for cost tracking */
  chat(input: NexChatInput): AsyncGenerator<NexChatEvent>;
}
