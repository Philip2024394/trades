// GET /api/nex-coding-chat/message/[id]?session_id=...
// Poll endpoint. Returns:
//   - status=answered + reply       when an engine has written outbox/<id>.json
//   - status=processing             while the inbox is present but no outbox yet
//   - status=timeout + stub reply   after GRACE_MS elapses without an engine response
//
// The route emits a truthful stub via transit.ts when no external engine picks up
// within the grace window, so the UI never hangs.

import { NextResponse } from "next/server";
import { existsSync, statSync } from "node:fs";
import * as path from "node:path";
import {
  inboxPath,
  outboxPath,
  readOutboxIfReady,
  writeStubOutbox,
  cleanup,
} from "@/lib/nex-coding-chat/transit";
import { loadSession, appendMessage, newMessageId, updateMessageStatus } from "@/lib/nex-coding-chat/memory";
import type { ChatMessage } from "@/lib/nex-coding-chat/types";

export const dynamic = "force-dynamic";

/** After this many ms without an engine response we emit a stub outbox reply. */
const GRACE_MS = 20_000;

const MSG_ID_RX = /^msg-[0-9T:.\-Z]+-[0-9a-f]{8}$/;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const message_id = params.id.trim();
  if (!MSG_ID_RX.test(message_id)) {
    return NextResponse.json({ ok: false, error: "message_id invalid" }, { status: 400 });
  }
  const url = new URL(req.url);
  const session_id = (url.searchParams.get("session_id") ?? "").trim();
  if (!session_id) {
    return NextResponse.json({ ok: false, error: "session_id required" }, { status: 400 });
  }

  const s = loadSession(session_id);
  if (!s) return NextResponse.json({ ok: false, error: "session not found" }, { status: 404 });

  // Fast-path: outbox already has an answer.
  const outbox = readOutboxIfReady(message_id);
  if (outbox) {
    return finish(message_id, session_id, outbox.reply, outbox.executor, "answered");
  }

  // Slow-path: inbox present, no answer yet. If grace window exceeded, emit stub.
  const in_path = inboxPath(message_id);
  if (!existsSync(in_path)) {
    // Perhaps message was answered previously and cleaned up. Look for it in session log.
    const nexMsg = [...s.messages].reverse().find(
      (m) => m.role === "nex" && (m.content.includes(message_id) || m.id === message_id),
    );
    if (nexMsg) {
      return NextResponse.json({
        ok: true,
        status: nexMsg.status,
        reply: nexMsg.content,
        executor: "n/a",
      });
    }
    return NextResponse.json({ ok: false, error: "message not in transit and not in session" }, { status: 404 });
  }

  const stat = statSync(in_path);
  const age_ms = Date.now() - stat.mtimeMs;
  if (age_ms >= GRACE_MS) {
    writeStubOutbox(message_id, session_id, `no engine responded within ${GRACE_MS}ms · file waited ${age_ms}ms`);
    const stub = readOutboxIfReady(message_id);
    if (stub) {
      return finish(message_id, session_id, stub.reply, "STUB", "timeout");
    }
  }

  // Still processing.
  return NextResponse.json({
    ok: true,
    status: "processing",
    waited_ms: age_ms,
    remaining_ms: Math.max(0, GRACE_MS - age_ms),
  });
}

function finish(
  message_id: string,
  session_id: string,
  reply: string,
  executor: string,
  status: "answered" | "timeout",
) {
  // Append the NEX turn if not already appended (guard for double-poll).
  const s = loadSession(session_id);
  if (!s) return NextResponse.json({ ok: false, error: "session vanished" }, { status: 500 });
  const alreadyAppended = s.messages.some((m) => m.role === "nex" && m.content === reply);
  if (!alreadyAppended) {
    const nexMsgId = newMessageId();
    const nexMsg: ChatMessage = {
      id: nexMsgId,
      session_id,
      role: "nex",
      content: reply,
      ts: new Date().toISOString(),
      status,
    };
    appendMessage(session_id, nexMsg);
    // Update the user's message status too.
    updateMessageStatus(session_id, message_id, "answered");
  }
  cleanup(message_id);
  return NextResponse.json({ ok: true, status, reply, executor });
}
