// src/app/api/nex/owner/[invite_token]/reply/route.ts
//
// Founder Phase 31 · P31-6 · Owner reply endpoint.
//
// Two shapes:
//   GET  → returns thread + messages so the owner-inbox page can render
//          (no auth · the opaque token IS the auth) — Doctrine #7 kept
//          because the token is scoped to a single thread + a single
//          owner-email hash.
//   POST { body, owner_user_id? } → appends an owner-role message. If
//          owner_user_id supplied (owner signed up on the reply page),
//          converts the invite and links the thread to that user.

import { NextResponse } from "next/server";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { convertOwnerInvite, resolveOwnerInvite } from "@/lib/nex/listing-chat";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

export const runtime = "nodejs";

async function loadThread(thread_id: string): Promise<{ thread: Record<string, unknown> | null; messages: Array<Record<string, unknown>> }> {
  const pool = getKnowledgeFactoryDbPool();
  const t = await pool.query(
    `SELECT thread_id::text, listing_ref, sender_user_id, owner_user_id,
            owner_email_hint, created_at::text, last_message_at::text,
            sender_unread_count, owner_unread_count, status
       FROM nex.listing_thread WHERE thread_id = $1`,
    [thread_id],
  );
  const m = await pool.query(
    `SELECT message_id::text, thread_id::text, from_role, from_user_id,
            body, sent_at::text, delivered_at::text, read_at::text,
            sanitiser_neutralised, meta
       FROM nex.listing_message
      WHERE thread_id = $1
      ORDER BY sent_at ASC`,
    [thread_id],
  );
  return { thread: (t.rows[0] as Record<string, unknown> | undefined) ?? null, messages: m.rows as Array<Record<string, unknown>> };
}

export async function GET(_req: Request, ctx: { params: Promise<{ invite_token: string }> }) {
  const { invite_token } = await ctx.params;
  const resolved = await resolveOwnerInvite(invite_token);
  if (!resolved) return NextResponse.json({ error: "invalid_or_unknown_invite" }, { status: 404 });
  if (resolved.expired) return NextResponse.json({ error: "invite_expired" }, { status: 410 });
  const { thread, messages } = await loadThread(resolved.thread_id);
  return NextResponse.json({
    listing_ref: resolved.listing_ref,
    thread, messages,
    doctrine_note: "Doctrine #7 · this invite gives access to ONE thread ONLY. When you sign up, the thread links to your NEX account. Later messages remain private to you and the visitor.",
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ invite_token: string }> }) {
  const { invite_token } = await ctx.params;
  const resolved = await resolveOwnerInvite(invite_token);
  if (!resolved) return NextResponse.json({ error: "invalid_or_unknown_invite" }, { status: 404 });
  if (resolved.expired) return NextResponse.json({ error: "invite_expired" }, { status: 410 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const messageBody = typeof body.body === "string" ? body.body : "";
  if (!messageBody || messageBody.length > 4000) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const owner_user_id = typeof body.owner_user_id === "string" ? body.owner_user_id : null;

  const sanit = sanitiseUntrustedContent({ text: messageBody, source_kind: "tool" });
  const clean = sanit.clean_text.trim().slice(0, 4000);
  if (clean.length === 0) return NextResponse.json({ error: "empty_after_sanitise" }, { status: 400 });

  const pool = getKnowledgeFactoryDbPool();

  // If owner signed up on the reply page, link the thread on first reply.
  if (owner_user_id) await convertOwnerInvite({ invite_token, owner_user_id });

  const insert = await pool.query(
    `INSERT INTO nex.listing_message
       (thread_id, from_role, from_user_id, body, sanitiser_neutralised)
     VALUES ($1,'owner',$2,$3,$4)
     RETURNING message_id::text, thread_id::text, from_role, from_user_id,
               body, sent_at::text, sanitiser_neutralised`,
    [resolved.thread_id, owner_user_id, clean, sanit.neutralised_count],
  );
  await pool.query(
    `UPDATE nex.listing_thread
        SET sender_unread_count = sender_unread_count + 1,
            last_message_at    = now()
      WHERE thread_id = $1`,
    [resolved.thread_id],
  );

  return NextResponse.json({
    ok: true,
    message: insert.rows[0],
    converted: !!owner_user_id,
    doctrine_note: "Doctrine #7 · your reply is a two-party envelope · NEX never trains on it.",
    sanitiser_neutralised: sanit.neutralised_count,
  });
}
