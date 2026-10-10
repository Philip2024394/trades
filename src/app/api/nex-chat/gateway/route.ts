// POST /api/nex-chat/gateway
//
// NEX · Native Conversation Gateway · HTTP entry route · Batch 1 · 2026-09-17.
// Founder-authorised.
//
// This is the consumer-facing entry point for the Native Conversation Gateway.
// It performs deterministic routing to either the native NEX1 intelligence
// path (runChatTurn) or returns a legacy-delegation hint that the caller
// must honour by invoking /api/nex-conv/chat separately.
//
// ROUTING INVARIANTS (§5 execution_source is mandatory · §6 no hidden fallback):
//   · A native invocation returns execution_source: "NEX1_NATIVE"
//   · A legacy delegation returns routing_decision: "route_legacy_domain" ·
//     the caller MUST invoke /api/nex-conv/chat and label its own reply
//     accordingly · this route does NOT invoke the legacy path
//   · A native failure returns the native refusal · this route does NOT
//     silently invoke Qwen
//
// This route MUST NEVER import from openai / anthropic / @google/generative /
// groq-sdk / any inference client.

import { NextResponse } from "next/server";
import { runNativeConversationGateway } from "@/lib/nex-agent/code-engine/capability-conversation-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  sessionId?: string;
  conversationId?: string;
  message?: string;
  mode?: "live" | "shadow";
  historyForLegacy?: readonly { role: "user" | "assistant"; text: string }[];
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.message !== "string" || body.message.length === 0) {
    return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
  }
  const result = await runNativeConversationGateway(
    {
      sessionId: body.sessionId,
      conversationId: body.conversationId,
      message: body.message,
      mode: body.mode ?? "live",
      historyForLegacy: body.historyForLegacy,
    },
    { repo_root: process.cwd() },
  );
  return NextResponse.json(result);
}
