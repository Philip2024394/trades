// POST /api/nex-chat/native-turn
//
// NEX Chat · Native compatibility adapter · §6 Option B · 2026-09-17.
// Founder-authorised · previously protected consumer surfaces authorized for
// modification for the unification purpose only.
//
// PURPOSE
//   A deterministic compatibility adapter that lets the consumer NEX Chat UI
//   post to the SAME unified conversation-intelligence runtime that NEX1
//   Code Chat uses (`runChatTurn` → `capability-conversation-context` +
//   `capability-conversation-intents` + composer + native code capabilities).
//
//   This route DOES NOT delete or alter the existing `/api/nex-conv/chat`
//   consumer route · it exists in parallel. Consumer product surfaces that
//   depend on accommodation/food/transport/markets/staircase adapters
//   continue to use the existing route unchanged. Surfaces that want to
//   participate in the native unified conversation-intelligence layer
//   (e.g. general chat + coding conversation) can now POST to this route.
//
// DISCIPLINE (per founder Zero-LLM Absolute Rule):
//   · This route MUST NEVER import from src/lib/nex/brain/ (consumer LLM path)
//   · This route MUST NEVER import from openai / anthropic / @google/generative
//     / groq-sdk / any inference client
//   · Every reply carries source: "NEX1_NATIVE" and zero_llm: true from
//     runChatTurn · these fields are passed through verbatim
//
// CONTRACT (kept close to the consumer surface's existing expectations)
//   Request:
//     { conversationId?: string, message: string, sessionId?: string }
//   Response (200):
//     { ok: true, source: "NEX1_NATIVE", text, state, turnId,
//       zero_llm: true, resolvedTarget, conversationHead? }
//   Error (400):
//     { ok: false, error: "..." }

import { NextResponse } from "next/server";
import { runChatTurn } from "@/lib/nex-agent/code-engine/capability-chat-turn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  conversationId?: string;
  conversation_id?: string;
  message?: string;
  sessionId?: string;
  session_id?: string;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  // Consumer surfaces sometimes send conversationId in camelCase (session) vs
  // snake_case. Accept both. Fall back to sessionId when no conversationId is
  // provided so the session stays coherent for a browser tab.
  const conversation_id =
    (typeof body.conversationId === "string" && body.conversationId) ||
    (typeof body.conversation_id === "string" && body.conversation_id) ||
    (typeof body.sessionId === "string" && body.sessionId) ||
    (typeof body.session_id === "string" && body.session_id) ||
    "";
  const message = typeof body.message === "string" ? body.message : "";
  if (!conversation_id || !message) {
    return NextResponse.json(
      { ok: false, error: "conversationId + message required" },
      { status: 400 },
    );
  }
  const result = await runChatTurn({
    conversation_id,
    user_message: message,
    repo_root: process.cwd(),
  });
  // Consumer-friendly shape (camelCase mirrors the field names the existing
  // NEX Chat components use). Original NEX1 shape is also included under
  // `raw` for surfaces that want the full runtime state.
  return NextResponse.json({
    ok: true,
    source: result.source,
    text: result.text,
    state: result.state,
    turnId: result.turn_id,
    zero_llm: result.zero_llm,
    resolvedTarget: result.resolved_target,
    raw: {
      classification: result.classification,
      summary: result.summary,
      conversation_head: result.conversation_head,
      trace: result.trace,
    },
  });
}
