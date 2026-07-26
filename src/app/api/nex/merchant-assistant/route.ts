// POST /api/nex/merchant-assistant
//
// Conversational Merchant AI Assistant — Phase 7 · Increment 2.
//
// Reads-only tools shipped this increment: list_products, preview_change.
// Write tools land in Increment 3 and return a helpful "not yet enabled"
// message via toolExecutors.runTool() if the AI tries to call them.
//
// Flow:
//   1. Session gate → 401 if no merchant signed in
//   2. Load MerchantContext from session (via contextLoader)
//   3. Call Anthropic with the tools + cached system prompt
//   4. If stopReason === "tool_use": execute each tool, feed results
//      back, loop until end_turn or max iterations
//   5. Return the final assistant text + audit trail of tool calls
//
// Body: { message: string, history?: AssistantMessage[] }
// Returns:
//   200 { ok: true, response: string, tool_calls: [...], usage: {...} }
//   401 { ok: false, error: "not_authenticated" }
//   429 { ok: false, error: "rate_limited" }
//   503 { ok: false, error: "anthropic_unavailable" }
//   500 { ok: false, error: "internal" }
//
// Rate limit: 60 req / 5 min per merchant (in-memory bucket for now;
// promote to Redis when the endpoint sees production traffic).
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 7.1

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  completeAgentic,
  type AnthropicMessage,
  type AnthropicContentBlock,
} from "@/lib/llm/anthropic";
import { loadMerchantContextFromSession } from "@/lib/nex/merchant-assistant/contextLoader";
import {
  MERCHANT_ASSISTANT_CACHED_SYSTEM,
  buildFreshSystem,
} from "@/lib/nex/merchant-assistant/promptBuilder";
import { MERCHANT_ASSISTANT_TOOLS } from "@/lib/nex/merchant-assistant/tools";
import { runTool } from "@/lib/nex/merchant-assistant/toolExecutors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOOL_USE_ITERATIONS = 5;

// In-memory rate limit: 60 requests per 5 minutes per merchant.
// Cold-start-safe (Map is per-instance). Replace with a Redis bucket
// when the endpoint is under production load.
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 60;

function isRateLimited(merchantId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(merchantId);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(merchantId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  // 1. Session gate
  const ctx = await loadMerchantContextFromSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  // 2. Rate limit
  if (isRateLimited(ctx.merchantId)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  // 3. Parse body
  let body: { message?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "missing_message" },
      { status: 400 }
    );
  }

  // 4. Build messages array — prior history + this turn
  const history = Array.isArray(body.history)
    ? (body.history as AnthropicMessage[]).filter(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant")
      )
    : [];

  const messages: AnthropicMessage[] = [
    ...history,
    { role: "user", content: message },
  ];

  // 5. Tool-use loop
  const toolCallAudit: Array<{
    tool: string;
    input: Record<string, unknown>;
    result: unknown;
  }> = [];

  let iterations = 0;
  let finalText = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  while (iterations < MAX_TOOL_USE_ITERATIONS) {
    iterations += 1;

    const agenticResult = await completeAgentic({
      cachedSystem: MERCHANT_ASSISTANT_CACHED_SYSTEM,
      system: buildFreshSystem(ctx),
      messages,
      tools: MERCHANT_ASSISTANT_TOOLS,
      maxTokens: 2048,
      temperature: 0.4,
    });

    if (!agenticResult) {
      return NextResponse.json(
        { ok: false, error: "anthropic_unavailable" },
        { status: 503 }
      );
    }

    totalInputTokens += agenticResult.usage?.inputTokens ?? 0;
    totalOutputTokens += agenticResult.usage?.outputTokens ?? 0;

    // Extract text blocks for the assistant response
    const assistantContent = agenticResult.content;
    const textFromThisTurn = assistantContent
      .filter(
        (b): b is Extract<AnthropicContentBlock, { type: "text" }> =>
          b.type === "text"
      )
      .map((b) => b.text)
      .join("\n\n");
    if (textFromThisTurn) finalText = textFromThisTurn;

    // Add the assistant turn to the message list for the next iteration
    messages.push({ role: "assistant", content: assistantContent });

    // If the model is done, break
    if (agenticResult.stopReason !== "tool_use") break;

    // Otherwise, execute every tool_use block and feed results back
    const toolUseBlocks = assistantContent.filter(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) break;

    const toolResults: AnthropicContentBlock[] = [];
    for (const call of toolUseBlocks) {
      const result = await runTool(ctx, call.name, call.input);
      toolCallAudit.push({
        tool: call.name,
        input: call.input,
        result,
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(result),
        is_error: !result.ok,
      });
    }

    // Feed tool results back to the AI for the next turn
    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({
    ok: true,
    response: finalText || "(No response generated.)",
    tool_calls: toolCallAudit,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      iterations,
    },
  });
}
