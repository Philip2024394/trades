// src/app/api/nex-chat/messages/route.ts
//
// NEX chat message persistence · F3.5 (2026-08-25).
//
// GET  /api/nex-chat/messages?conversationId=...  · list live messages + history-line rows
// POST /api/nex-chat/messages                     · create a new message
//
// This is the minimal server-side chat surface needed so grenade has a
// real target to delete. Deleted messages return as history-line entries
// (kind: "grenade-history") not as normal bubbles.
//
// Auth for MVP: same header pattern as /api/nex-actions/invoke.

import { NextResponse, type NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 5 });
  return _pool;
}

function requireUser(req: NextRequest) {
  const id = req.headers.get("x-nex-user-id");
  const displayName = req.headers.get("x-nex-user-display-name");
  if (!id || !displayName) return null;
  return { id, displayName };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ ok: false, error: "conversationId required" }, { status: 400 });

  const [messages, deletions] = await Promise.all([
    pool().query(
      `SELECT message_id, sender_id, sender_display_name, content, created_at
         FROM nex.chat_message
        WHERE conversation_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC`,
      [conversationId],
    ),
    pool().query(
      `SELECT deletion_id, message_id, actor_user_id, actor_display_name,
              history_line, event_time
         FROM nex.chat_message_deletion
        WHERE conversation_id = $1
        ORDER BY event_time ASC`,
      [conversationId],
    ),
  ]);

  const items: Array<Record<string, unknown>> = [];
  for (const m of messages.rows) {
    items.push({
      kind: "message",
      id: m.message_id,
      senderId: m.sender_id,
      senderDisplayName: m.sender_display_name,
      content: m.content,
      createdAt: m.created_at,
    });
  }
  for (const d of deletions.rows) {
    items.push({
      kind: "grenade-history",
      id: `deletion:${d.deletion_id}`,
      deletedMessageId: d.message_id,
      actorId: d.actor_user_id,
      actorDisplayName: d.actor_display_name,
      historyLine: d.history_line,
      eventTime: d.event_time,
    });
  }
  // Sort by createdAt / eventTime ascending so history-line lands in place.
  items.sort((a, b) => {
    const at = new Date((a.createdAt ?? a.eventTime) as string).getTime();
    const bt = new Date((b.createdAt ?? b.eventTime) as string).getTime();
    return at - bt;
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  let body: { conversationId?: string; messageId?: string; content?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 }); }
  const { conversationId, messageId, content } = body;
  if (!conversationId || !messageId || !content) {
    return NextResponse.json({ ok: false, error: "conversationId+messageId+content required" }, { status: 400 });
  }
  await pool().query(
    `SELECT nex.chat_message_upsert($1,$2,$3,$4,$5,now())`,
    [messageId, conversationId, user.id, user.displayName, content],
  );
  return NextResponse.json({ ok: true, messageId });
}
