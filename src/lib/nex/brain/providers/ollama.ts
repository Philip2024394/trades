// NEX BRAIN · Ollama provider adapter.
//
// Implements NexBrainProvider against a local Ollama server (default
// http://localhost:11434). Speaks Ollama's native /api/chat wire
// format, which supports tool-use (function calling) on Qwen 2.5+.
//
// Rationale (2026-08-20 · Session 4a):
//   Philip approved a diagnostic test to see whether Qwen 2.5 3B is
//   strong enough to drive the staircase design conversation via
//   structured tool calls. This adapter lets our staircase agent
//   run against the existing local Qwen setup that already backs
//   /api/nex-conv/chat (per ADR-0044). The doctrine end-state
//   (Router · CONSTITUTIONAL 2026-08-20) targets local providers as
//   the independence path — this adapter is the concrete implementation.
//
// Rules baked in (matching respond-local.mjs):
//   - Endpoint MUST be local (localhost / 127.0.0.1 / *.local /
//     ::1). Non-local URLs throw at construction time. Zero
//     third-party AI in any Ollama code path — hard rule per
//     ADR-0044.
//   - Default model qwen2.5:3b · overridable via NEX_RESPONSE_MODEL
//     env var (matches respond-local.mjs's convention).
//   - Blocking mode for Session 4a diagnostic clarity. Streaming
//     upgrade lives in a follow-up if the model proves reliable.

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

const DEFAULT_URL = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.NEX_RESPONSE_MODEL ?? "qwen2.5:3b";
const CHAT_PATH = "/api/chat";

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
  stream: false;
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

// ─── Adapter factory ───────────────────────────────────────────────

export type OllamaBrainOptions = {
  /** Override the Ollama server URL. Must be local (validated). */
  url?: string;
  /** Override the model tag. Default from NEX_RESPONSE_MODEL env or
   *  qwen2.5:3b. Common alternatives: qwen2.5:7b, llama3.1:8b,
   *  qwen2.5-coder:7b (though the last is code-oriented). */
  model?: string;
};

export function createOllamaBrainProvider(
  opts: OllamaBrainOptions = {},
): NexBrainProvider {
  const url = opts.url ?? DEFAULT_URL;
  assertLocalEndpoint(url);
  const model = opts.model ?? DEFAULT_MODEL;
  const chatUrl = url.replace(/\/$/, "") + CHAT_PATH;

  const capabilities: NexBrainCapabilities = {
    supportsTools: true,
    supportsVision: false,
    supportsThinking: false,
    supportsPromptCaching: false,
    supportsStreaming: false,
    maxContextTokens: 32_768,
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

      const tools = input.tools?.map(nexToolToOllama);

      const body: OllamaChatRequest = {
        model,
        messages,
        stream: false,
        options: {
          temperature: input.temperature ?? 0.3,
          num_predict: input.maxTokens ?? 1024,
        },
      };
      if (tools && tools.length > 0) body.tools = tools;

      let res: Response;
      try {
        res = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        yield {
          type: "error",
          error: e instanceof Error ? e.message : "network_error",
          retriable: true,
        };
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        yield {
          type: "error",
          error: `ollama_${res.status}: ${text.slice(0, 200)}`,
          retriable: res.status >= 500,
        };
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
      }

      // Emit the assistant message content as a single text_delta
      // (blocking mode · no chunk-level streaming for Session 4a).
      const content = data.message.content ?? "";
      if (content.length > 0) {
        yield { type: "text_delta", text: content };
      }

      // Assemble NEX-canonical content blocks + emit tool_call events
      // in the same shape the Anthropic adapter emits, so the agent
      // runner's loop works identically.
      const contentBlocks: NexContentBlock[] = [];
      if (content.length > 0) {
        contentBlocks.push({ type: "text", text: content });
      }

      const toolCalls = data.message.tool_calls ?? [];
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

      // Ollama's done_reason maps loosely to NEX stop reasons.
      const stopReason: NexStopReason =
        toolCalls.length > 0 ? "tool_use" :
        data.done_reason === "length" ? "max_tokens" :
        data.done_reason === "stop" ? "end_turn" :
        "end_turn";

      const usage: NexUsage = {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
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
    },
  };
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
      // Vision unsupported in this adapter · omit.
    }
  }

  const out: OllamaMessage = { role: msg.role, content: textParts.join("\n\n") };
  if (toolCalls.length > 0) out.tool_calls = toolCalls;
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
