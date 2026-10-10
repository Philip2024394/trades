// GET /api/nex1/conversation-turns?conversation_id=<id>
//
// C10 Phase 4c · diagnostic surface for durable turn transcripts. Returns
// the current TURNS[] array for a given conversation. Zero LLM · read-only.
//
// Used by the C10 Phase 4c verifier to prove that turn transcripts survive
// module hot-reload (bootstrap hydrates from data/nex1-chat-conversations/).

import { NextResponse } from "next/server";
import { getConversationTurns } from "@/lib/nex-agent/code-engine/capability-conversation-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversation_id");
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "missing_conversation_id" }, { status: 400 });
  }
  const turns = getConversationTurns(conversationId);
  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    conversation_id: conversationId,
    total_turns: turns.length,
    turns,
  });
}
