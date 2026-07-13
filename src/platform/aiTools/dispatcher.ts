// Platform AI Dispatcher — the single entrypoint for every AI call.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Cost routing, quota enforcement, and tool
//    discovery must be uniform. If Marketplace called Opus directly
//    and Orders called Haiku directly, cost control would be
//    impossible and tool discovery would fragment.
//
// 2. Which future Apps benefit?  Every App with an `aiTools` block.
//    Marketplace, Orders, Projects, Fleet, Insurance, Finance,
//    Recruitment, Training — each becomes copilot-callable through
//    the same interface.
//
// 3. Which doc authorises?  ADR-034 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "AI Dispatcher with tool discovery per App" +
//    TRADE_CENTER_PLATFORM_ARCHITECTURE.md §7 "AI Platform Service".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// This is the Week 1 SHIM — it doesn't call Claude, it doesn't
// actually run tools. It's the discovery + validation surface the
// copilot in Week 4 will plug into. Week 1's job is to prove that
// discovery + tool cataloguing works end-to-end without hard-coding
// any App slug.
//
// The full Dispatcher (streaming SSE, cost routing, quota
// enforcement, tool invocation) lands as a follow-up under ADR-034b
// once the copilot UI ships in Week 4.

import { discoverAITools, findAITool } from "./discovery";
import { route } from "./router";
import { getTransport } from "./transport";
import { emitBaseline } from "@/platform/telemetry/baseline";
import type { DiscoveredAITool } from "./discovery";
import type { RouteDecision } from "./router";
import type { ToolCall, ToolResult } from "./transport";

export type AIDispatcherCatalogue = {
  totalTools: number;
  totalApps: number;
  toolsByApp: Record<string, number>;
  tools: DiscoveredAITool[];
};

/** Return the current tool catalogue as the model would see it. Used
 *  by the copilot boot + admin dashboards + Week 1 verification.
 */
export function catalogueAITools(): AIDispatcherCatalogue {
  const tools = discoverAITools();
  const toolsByApp: Record<string, number> = {};
  for (const t of tools) {
    toolsByApp[t.appSlug] = (toolsByApp[t.appSlug] ?? 0) + 1;
  }
  return {
    totalTools: tools.length,
    totalApps: Object.keys(toolsByApp).length,
    toolsByApp,
    tools
  };
}

/** Look up a tool the model wants to call. Returns undefined if no
 *  App declares it — Dispatcher answers with a tool-not-found error
 *  to the model.
 */
export function resolveAITool(name: string): DiscoveredAITool | undefined {
  return findAITool(name);
}

// ─── Tool handler registry (Week 4) ──────────────────────────
//
// Apps register their tool handlers here. In production the runtime
// resolves them lazily from the manifest handler paths; the demo +
// verification harness registers directly.

type ToolHandler = (args: unknown) => Promise<unknown> | unknown;

const handlerRegistry = new Map<string, ToolHandler>();

export function registerToolHandler(
  toolName: string,
  handler: ToolHandler
): void {
  handlerRegistry.set(toolName, handler);
}

export function resolveHandler(toolName: string): ToolHandler | undefined {
  return handlerRegistry.get(toolName);
}

// ─── Full dispatch (Week 4) ──────────────────────────────────

export type DispatchInput = {
  prompt: string;
  userTier?: "free" | "professional" | "enterprise";
  userSlug?: string;
  history?: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: ToolCall[];
    toolCallId?: string;
  }>;
};

export type DispatchOutput = {
  text: string;
  route: RouteDecision;
  toolCalls: Array<ToolCall & { result?: ToolResult }>;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
};

/** Full dispatch — route → transport → tool invocation → telemetry.
 *  Zero App-specific code. */
export async function dispatch(input: DispatchInput): Promise<DispatchOutput> {
  const tools = discoverAITools();
  const decision = route({
    prompt: input.prompt,
    toolCount: tools.length,
    userTier: input.userTier
  });

  // Filter tools to those the user's tier grants
  const availableTools = tools.filter((t) => {
    if (!t.requiredTier) return true;
    // requiredTier maps to AppPlan on manifest. Simple map: free tier
    // gets only free tools.
    if (input.userTier === "enterprise") return true;
    if (input.userTier === "professional") return t.requiredTier !== "merchant-pro";
    return t.requiredTier === "free";
  });

  const transport = getTransport();
  const start = Date.now();
  const response = await transport({
    model: decision.model,
    prompt: input.prompt,
    history: input.history,
    tools: availableTools,
    timeoutMs: 30_000
  });
  const elapsed = Date.now() - start;

  // Invoke tool calls the model asked for. Each invocation emits a
  // `plugin.ai.tool_invoked` baseline metric per ADR-044.
  const toolCalls: Array<ToolCall & { result?: ToolResult }> = [];
  for (const call of response.toolCalls) {
    emitBaseline("plugin.ai.tool_invoked", 1, {
      app: "shell",
      tool_name: call.toolName,
      model: decision.model
    });
    const handler = handlerRegistry.get(call.toolName);
    if (!handler) {
      toolCalls.push({
        ...call,
        result: {
          toolCallId: call.id,
          error: `handler_not_registered:${call.toolName}`
        }
      });
      continue;
    }
    try {
      const out = await Promise.resolve(handler(call.args));
      toolCalls.push({
        ...call,
        result: { toolCallId: call.id, result: out }
      });
    } catch (err) {
      toolCalls.push({
        ...call,
        result: {
          toolCallId: call.id,
          error: err instanceof Error ? err.message : String(err)
        }
      });
    }
  }

  // Baseline metric per dispatch — helps admins see routing behaviour.
  emitBaseline("plugin.request.duration_ms", elapsed, {
    app: "shell",
    route: "/api/ai/dispatch",
    model: decision.model
  });

  return {
    text: response.text,
    route: decision,
    toolCalls,
    usage: {
      inputTokens: response.inputTokens ?? 0,
      outputTokens: response.outputTokens ?? 0
    },
    error: response.error
  };
}

/** Reset — used by the verification harness. */
export function resetDispatcherForTests(): void {
  handlerRegistry.clear();
}
