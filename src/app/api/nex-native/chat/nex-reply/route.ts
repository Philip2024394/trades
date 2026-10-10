// src/app/api/nex-native/chat/nex-reply/route.ts
//
// Wave 6 · POST /api/nex-native/chat/nex-reply
// --------------------------------------------
// Body: { conversationId: string }
//
// Triggers a NEX Assistant reply for the given conversation. The reply
// (if any) is persisted through the SAME conversationService.postMessage
// path that customer messages use, so Wave 3.1 immutability triggers
// and Wave 3/5 access policies apply identically.
//
// Auth: caller must be authenticated AND a participant of the conversation.
// Otherwise 401 / 403.
//
// The route NEVER fabricates a reply. If the intelligence path is unavailable
// (e.g. GROQ_API_KEY missing) or refuses (e.g. last message wasn't from a
// customer) the response body carries an honest `skipped_reason`.

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import * as conversationService from "@/lib/nex-native/conversation-service";
import { generateNexReply } from "@/lib/nex-native/intelligence/nex-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await resolveNexAppSession(req);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!conversationId) return NextResponse.json({ error: "missing_conversationId" }, { status: 400 });

  const participation = await conversationService.getParticipation(conversationId, session.account.id);
  if (!participation) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  const result = await generateNexReply(conversationId);
  return NextResponse.json({
    conversation_id: conversationId,
    ...result,
  });
}
