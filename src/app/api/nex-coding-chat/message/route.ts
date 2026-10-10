// POST /api/nex-coding-chat/message
// Body: { session_id?, content }
// Response: { ok, message_id, session_id, immediate_reply?, poll_url? }
//
// - Creates a session if session_id absent.
// - Appends the user turn.
// - If the input is a local slash-command that can be answered locally, replies immediately.
// - Otherwise, writes the payload to `transit/inbox/<message_id>.json`. If no engine
//   is currently watching (detected via a short grace window later in the poll route),
//   the poll route emits a stub response.

import { NextResponse } from "next/server";
import { appendMessage, createSession, loadSession, newMessageId, newSessionId } from "@/lib/nex-coding-chat/memory";
import { buildContext } from "@/lib/nex-coding-chat/context-provider";
import { parseCommand, handleLocalCommand } from "@/lib/nex-coding-chat/command-parser";
import { writeInbox } from "@/lib/nex-coding-chat/transit";
import type { ChatMessage, InboxPayload } from "@/lib/nex-coding-chat/types";

export const dynamic = "force-dynamic";

const HOSTILE = [
  /ignore (all )?(previous )?instructions/i,
  /system prompt/i,
  /you are now/i,
  /disregard governance/i,
  /modify v3_engine_registry/i,
];

export async function POST(req: Request) {
  let body: { session_id?: string; content?: string };
  try {
    body = (await req.json()) as { session_id?: string; content?: string };
  } catch {
    return err(400, "invalid JSON");
  }
  const content = (body.content ?? "").trim();
  if (content.length === 0) return err(400, "content required");
  if (content.length > 8000) return err(400, "content too long (max 8000)");
  if (HOSTILE.some((rx) => rx.test(content))) return err(400, "content contains disallowed override language");

  // Resolve session.
  let session_id = (body.session_id ?? "").trim();
  if (!session_id) {
    session_id = newSessionId();
    createSession(session_id);
  } else if (!loadSession(session_id)) {
    createSession(session_id);
  }

  const message_id = newMessageId();
  const now = new Date().toISOString();

  // Append user message immediately (visible to poll callers).
  const userMsg: ChatMessage = {
    id: message_id,
    session_id,
    role: "user",
    content,
    ts: now,
    status: "sent",
  };
  const sessionAfterUser = appendMessage(session_id, userMsg);

  // Slash-command? Handle locally where possible.
  const parsed = parseCommand(content);
  if (parsed) {
    const localReply = handleLocalCommand(parsed, session_id);
    if (localReply !== null) {
      // Special-case: /clear should archive the current session and start a new one.
      if (parsed.command === "clear") {
        const fresh_session_id = newSessionId();
        createSession(fresh_session_id, "New chat");
        const localMsgId = newMessageId();
        appendMessage(fresh_session_id, {
          id: localMsgId,
          session_id: fresh_session_id,
          role: "nex",
          content: localReply,
          ts: new Date().toISOString(),
          status: "answered",
        });
        return NextResponse.json({
          ok: true,
          session_id: fresh_session_id,
          message_id: localMsgId,
          immediate_reply: localReply,
          poll_url: null,
        });
      }
      const localReplyMsgId = newMessageId();
      appendMessage(session_id, {
        id: localReplyMsgId,
        session_id,
        role: "nex",
        content: localReply,
        ts: new Date().toISOString(),
        status: "answered",
      });
      return NextResponse.json({
        ok: true,
        session_id,
        message_id: localReplyMsgId,
        immediate_reply: localReply,
        poll_url: null,
      });
    }
  }

  // Not locally answerable → write to transit inbox for engines to pick up.
  const context = buildContext(content, sessionAfterUser.messages.slice(0, -1)); // prior messages, not the one we just added
  const payload: InboxPayload = {
    protocol_version: 1,
    message_id,
    session_id,
    ts: now,
    user_query: content,
    command: parsed,
    context,
  };
  writeInbox(payload);

  return NextResponse.json({
    ok: true,
    session_id,
    message_id,
    immediate_reply: null,
    poll_url: `/api/nex-coding-chat/message/${encodeURIComponent(message_id)}?session_id=${encodeURIComponent(session_id)}`,
  });
}

function err(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}
