// NEX BRAIN · Ollama provider adapter.
//
// Implements NexBrainProvider against a local Ollama server (default
// http://localhost:11434). Speaks Ollama's native /api/chat wire
// format, which supports tool-use (function calling) on Qwen 2.5+.
//
// Rules baked in (matching respond-local.mjs):
//   - Endpoint MUST be local (localhost / 127.0.0.1 / *.local /
//     ::1). Non-local URLs throw at construction time. Zero
//     third-party AI in any Ollama code path — hard rule per
//     ADR-0044.
//   - Default model qwen2.5:7b-instruct-q3_K_M · fits the 32 GB RAM
//     / RTX 2050 4 GB VRAM dev laptop and beats 3B on Indonesian
//     phrasing + reasoning quality (bench 2026-08-30). Overridable
//     via NEX_RESPONSE_MODEL for smaller models on constrained hosts.
//   - Streaming ON: /api/chat with stream=true, parsed as NDJSON.
//     Emits text_delta events as tokens arrive so the widget types
//     in real time (matches the existing runtimeStream event shape).
//     Blocking mode still available for callers that need full-response
//     semantics (see createOllamaBrainProvider({ stream: false })).

import type {
  NexBrainProvider,
  NexBrainCapabilities,
  NexChatEvent,
  NexChatInput,
  NexContentBlock,
  NexMessage,
  NexStopReason,
  NexToolDef,
  NexUsage,
} from "../provider";

// ─── Config ────────────────────────────────────────────────────────

import { getModelForRole, capabilitiesForTag } from "../model-registry";
import { normalizeImageBase64ForVision } from "./image-normalize";

const DEFAULT_URL = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.NEX_RESPONSE_MODEL ?? getModelForRole("brain.primary_local").ollamaTag;
const DEFAULT_STREAM = process.env.NEX_OLLAMA_STREAM !== "false";
const CHAT_PATH = "/api/chat";
const TAGS_PATH = "/api/tags";
const DEFAULT_TIMEOUT_MS = Number(process.env.NEX_OLLAMA_TIMEOUT_MS ?? "60000");

function assertLocalEndpoint(url: string): void {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");
  if (!isLocal) {
    throw new Error(
      `[nex-brain/ollama] endpoint must be local (localhost / 127.0.0.1 / *.local / ::1). Got: ${host}. NEX has a zero-third-party-AI hard rule for the Ollama path (ADR-0044).`,
    );
  }
}

// ─── Wire types · Ollama's /api/chat shape ────────────────────────
// Kept internal to this file. Never leaks into the NEX-canonical layer.

type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Vision-model input. Each string is a raw base64-encoded image
   *  (no data-URL prefix). Only qwen2.5vl:* / moondream:* / other
   *  vision-capable tags will consume these; text models ignore. */
  images?: string[];
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  tool_call_id?: string;
};

type OllamaToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

type OllamaChatRequest = {
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaToolDef[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
};

type OllamaChatResponse = {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
};

/** Partial chunk shape emitted by /api/chat when stream=true. Each
 *  line is one JSON object. `message.content` holds the token delta
 *  for THIS chunk (not cumulative). When `done: true`, `eval_count`
 *  + `done_reason` are populated and `message.tool_calls` (if any)
 *  is present on the final chunk. */
type OllamaChatChunk = {
  model: string;
  created_at: string;
  message: { role: "assistant"; content: string; tool_calls?: OllamaMessage["tool_calls"] };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

// ─── Adapter factory ───────────────────────────────────────────────

export type OllamaBrainOptions = {
  /** Override the Ollama server URL. Must be local (validated). */
  url?: string;
  /** Override the model tag. Default from NEX_RESPONSE_MODEL env or
   *  qwen2.5:7b-instruct-q3_K_M. Any Ollama tool-capable tag works
   *  (Qwen 2.5 family, Llama 3.1 8B+). */
  model?: string;
  /** Stream tokens as they arrive. Default: env NEX_OLLAMA_STREAM
   *  (true unless "false"). Set false for callers that need one
   *  atomic response (background composers). */
  stream?: boolean;
  /** Network timeout in ms. Applies to the full request lifetime,
   *  not idle-between-chunks. Default 60_000. */
  timeoutMs?: number;
};

export function createOllamaBrainProvider(
  opts: OllamaBrainOptions = {},
): NexBrainProvider {
  const url = opts.url ?? DEFAULT_URL;
  assertLocalEndpoint(url);
  const model = opts.model ?? DEFAULT_MODEL;
  const stream = opts.stream ?? DEFAULT_STREAM;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chatUrl = url.replace(/\/$/, "") + CHAT_PATH;

  const caps = capabilitiesForTag(model);
  const capabilities: NexBrainCapabilities = {
    supportsTools: caps.supportsTools,
    supportsVision: caps.supportsVision,
    supportsThinking: false,
    supportsPromptCaching: false,
    supportsStreaming: stream,
    maxContextTokens: caps.contextTokens,
  };

  return {
    id: `ollama:${model}`,
    capabilities,
    async *chat(input: NexChatInput): AsyncGenerator<NexChatEvent> {
      // Build Ollama message list · prepend the system prompt as a
      // "system" role message (Ollama's convention).
      const messages: OllamaMessage[] = [
        { role: "system", content: input.systemPrompt },
        ...input.messages.flatMap(nexMessageToOllama),
      ];

      // Vision normalisation · re-encode any images through sharp
      // (max 1024px · JPEG q85). Silent failure mode fix for
      // qwen2.5vl:3b on RTX 2050 4 GB (large PNGs → @@@@ gibberish).
      // Only touches messages that actually carry images; text
      // requests are pass-through.
      if (capabilities.supportsVision) {
        for (const m of messages) {
          if (m.images && m.images.length > 0) {
            m.images = await Promise.all(m.images.map(normalizeImageBase64ForVision));
          }
        }
      }

      const tools = input.tools?.map(nexToolToOllama);

      const body: OllamaChatRequest = {
        model,
        messages,
        stream,
        options: {
          temperature: input.temperature ?? 0.3,
          num_predict: input.maxTokens ?? 1024,
        },
      };
      if (tools && tools.length > 0) body.tools = tools;

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (e) {
        clearTimeout(timeoutHandle);
        const isAbort = e instanceof Error && e.name === "AbortError";
        const isConnRefused = e instanceof Error && /ECONNREFUSED|fetch failed/i.test(e.message);
        yield {
          type: "error",
          error: isAbort
            ? `ollama_timeout after ${timeoutMs}ms`
            : isConnRefused
              ? `ollama_unreachable at ${url} · is the Ollama server running?`
              : e instanceof Error ? e.message : "network_error",
          retriable: true,
        };
        return;
      }

      if (!res.ok) {
        clearTimeout(timeoutHandle);
        const text = await res.text().catch(() => "");
        // Model-missing surfaces as 404 with `"model \"…\" not found"` in body.
        const isModelMissing = res.status === 404 && /not found/i.test(text);
        yield {
          type: "error",
          error: isModelMissing
            ? `ollama_model_missing: '${model}' not installed · run 'ollama pull ${model}'`
            : `ollama_${res.status}: ${text.slice(0, 200)}`,
          retriable: res.status >= 500,
        };
        return;
      }

      if (stream) {
        yield* streamChat(res, model, timeoutHandle);
        return;
      }

      let data: OllamaChatResponse;
      try {
        data = (await res.json()) as OllamaChatResponse;
      } catch (e) {
        yield {
          type: "error",
          error: e instanceof Error ? e.message : "invalid_json_from_ollama",
          retriable: false,
        };
        return;
      } finally {
        clearTimeout(timeoutHandle);
      }

      const content = data.message.content ?? "";
      if (content.length > 0) {
        yield { type: "text_delta", text: content };
      }

      yield* finaliseTurn(content, data.message.tool_calls ?? [], data.done_reason, data.prompt_eval_count ?? 0, data.eval_count ?? 0);
    },
  };
}

/** Read Ollama's NDJSON stream and emit NEX-canonical events as each
 *  chunk arrives. One JSON object per newline · `message.content`
 *  holds this chunk's token delta · final chunk carries `done: true`
 *  plus `tool_calls` (if any) + usage counters. */
async function* streamChat(
  res: Response,
  _model: string,
  timeoutHandle: ReturnType<typeof setTimeout>,
): AsyncGenerator<NexChatEvent> {
  if (!res.body) {
    clearTimeout(timeoutHandle);
    yield { type: "error", error: "ollama_no_response_body", retriable: false };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let toolCalls: NonNullable<OllamaMessage["tool_calls"]> = [];
  let doneReason: string | undefined;
  let promptEvalCount = 0;
  let evalCount = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;

        let chunk: OllamaChatChunk;
        try {
          chunk = JSON.parse(line) as OllamaChatChunk;
        } catch {
          continue;
        }

        const delta = chunk.message?.content ?? "";
        if (delta.length > 0) {
          accumulated += delta;
          yield { type: "text_delta", text: delta };
        }

        if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
          toolCalls = chunk.message.tool_calls;
        }

        if (chunk.done) {
          doneReason = chunk.done_reason;
          promptEvalCount = chunk.prompt_eval_count ?? promptEvalCount;
          evalCount = chunk.eval_count ?? evalCount;
        }
      }
    }
  } catch (e) {
    clearTimeout(timeoutHandle);
    yield {
      type: "error",
      error: e instanceof Error ? `ollama_stream_error: ${e.message}` : "ollama_stream_error",
      retriable: true,
    };
    return;
  } finally {
    clearTimeout(timeoutHandle);
  }

  yield* finaliseTurn(accumulated, toolCalls, doneReason, promptEvalCount, evalCount);
}

/** Emit tool_call events + a single `done` event with usage. Shared
 *  between blocking and streaming paths so the tail is identical. */
function* finaliseTurn(
  content: string,
  toolCalls: NonNullable<OllamaMessage["tool_calls"]>,
  doneReason: string | undefined,
  promptEvalCount: number,
  evalCount: number,
): Generator<NexChatEvent> {
  const contentBlocks: NexContentBlock[] = [];
  if (content.length > 0) {
    contentBlocks.push({ type: "text", text: content });
  }

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i]!;
    // Ollama doesn't assign tool_call ids · synthesise one for
    // NEX-canonical shape so tool_result blocks can reference back.
    const toolId = `ollama-${Date.now()}-${i}`;
    const toolName = call.function.name;
    const toolInput = coerceToolArguments(call.function.arguments);

    yield { type: "tool_call_start", toolId, toolName };
    yield { type: "tool_call_ready", toolId, toolName, input: toolInput };

    contentBlocks.push({
      type: "tool_call",
      toolId,
      toolName,
      input: toolInput,
    });
  }

  const stopReason: NexStopReason =
    toolCalls.length > 0 ? "tool_use" :
    doneReason === "length" ? "max_tokens" :
    doneReason === "stop" ? "end_turn" :
    "end_turn";

  const usage: NexUsage = {
    inputTokens: promptEvalCount,
    outputTokens: evalCount,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
  };

  const finalMessage: NexMessage = {
    role: "assistant",
    content: contentBlocks,
  };

  yield {
    type: "done",
    stopReason,
    usage,
    finalMessage,
  };
}

// ─── Availability probe ────────────────────────────────────────────
// Consumers that want provider fallback (e.g. resolveNexBrainWithFallback)
// call this at request time. Cheap · calls /api/tags which lists installed
// models without loading any weights.

export type OllamaProbeResult =
  | { ok: true; url: string; models: string[]; modelInstalled: boolean; selectedModel: string }
  | { ok: false; url: string; error: string };

/** Probe an Ollama server for reachability + model presence. Never
 *  throws · always returns a discriminated result. Callers use `ok`
 *  to decide whether to route to Ollama or fall back. */
export async function probeOllama(opts: { url?: string; model?: string; timeoutMs?: number } = {}): Promise<OllamaProbeResult> {
  const url = opts.url ?? DEFAULT_URL;
  const selectedModel = opts.model ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 3000;
  try { assertLocalEndpoint(url); }
  catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : "non_local_endpoint" };
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.replace(/\/$/, "") + TAGS_PATH, { signal: controller.signal });
    if (!res.ok) return { ok: false, url, error: `ollama_${res.status}` };
    const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
    const models = (data.models ?? []).map((m) => m.model ?? m.name ?? "").filter(Boolean);
    return {
      ok: true,
      url,
      models,
      modelInstalled: models.includes(selectedModel),
      selectedModel,
    };
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return { ok: false, url, error: isAbort ? "probe_timeout" : e instanceof Error ? e.message : "probe_failed" };
  } finally {
    clearTimeout(t);
  }
}

// ─── Type translation · NEX-canonical ↔ Ollama ────────────────────

function nexMessageToOllama(msg: NexMessage): OllamaMessage[] {
  // Tool results in Ollama go as separate "tool" role messages, one
  // per tool_result block. A single NEX message with multiple
  // tool_result blocks expands into multiple Ollama messages.
  if (msg.role === "tool") {
    if (typeof msg.content === "string") {
      return [{ role: "tool", content: msg.content }];
    }
    const out: OllamaMessage[] = [];
    for (const block of msg.content) {
      if (block.type === "tool_result") {
        out.push({
          role: "tool",
          content: block.result,
          tool_call_id: block.toolId,
        });
      } else if (block.type === "text") {
        out.push({ role: "tool", content: block.text });
      }
    }
    return out;
  }

  // Assistant + user messages · flatten content array to string +
  // (for assistant) any tool_call blocks.
  if (typeof msg.content === "string") {
    return [{ role: msg.role, content: msg.content }];
  }

  const textParts: string[] = [];
  const toolCalls: OllamaMessage["tool_calls"] = [];
  const images: string[] = [];
  for (const block of msg.content) {
    if (block.type === "text") textParts.push(block.text);
    else if (block.type === "thinking") { /* not sent · Ollama doesn't consume thinking blocks */ }
    else if (block.type === "tool_call") {
      toolCalls.push({
        function: { name: block.toolName, arguments: block.input },
      });
    } else if (block.type === "tool_result") {
      // Should not appear on a user/assistant NEX message · guard.
    } else if (block.type === "image_url") {
      // Vision path · Ollama expects raw base64 (no data-URL prefix).
      // Strip `data:<mime>;base64,` if present. Vision-capable models
      // (qwen2.5vl, moondream, etc.) consume these; text models ignore.
      const raw = block.url.startsWith("data:") ? block.url.split(",", 2)[1] ?? "" : block.url;
      if (raw) images.push(raw);
    }
  }

  const out: OllamaMessage = { role: msg.role, content: textParts.join("\n\n") };
  if (toolCalls.length > 0) out.tool_calls = toolCalls;
  if (images.length > 0) out.images = images;
  return [out];
}

function nexToolToOllama(tool: NexToolDef): OllamaToolDef {
  const properties: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
    properties[key] = { ...schema };
  }
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties,
        required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined,
      },
    },
  };
}

/** Ollama sometimes returns tool arguments as a JSON-encoded STRING
 *  rather than an object (depends on the model + version). Coerce
 *  both shapes into a plain object. */
function coerceToolArguments(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* fall through */
    }
    return {};
  }
  if (args && typeof args === "object") return args as Record<string, unknown>;
  return {};
}
