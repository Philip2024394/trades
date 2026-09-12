// src/lib/nex/conversations/index.ts
//
// Founder Phase 13 · Conversation persistence library.
//
// Exposes:
//   createConversation · appendMessage · getConversation · listConversations
//   searchConversations · branchConversation · shareConversation
//   getSharedConversation · autoTitle
//
// All persistence goes through withClient() from @/lib/nex/db · which
// null-returns when the pool is unavailable · every function must handle
// that gracefully.

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { createHash, randomBytes, randomUUID } from "node:crypto";

// Local helper: mirror the `withClient` shape but bound to the KF pool
// (which resolves to local nex_dev via NEX_TAXONOMY_POSTGRES_URL, the same
// pool identity + user_memory use — keeps every user-scoped table on one host).
async function withClient<T>(fn: (c: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }) => Promise<T>): Promise<T | null> {
  try {
    const pool = getKnowledgeFactoryDbPool();
    const client = await pool.connect();
    try { return await fn(client); }
    finally { client.release(); }
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type ConversationRole = "user" | "assistant" | "system" | "tool";

export interface ConversationRow {
  conversation_id: string;
  user_id: string | null;
  title: string;
  branched_from: string | null;
  branched_at_msg: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageRow {
  message_id: string;
  conversation_id: string;
  role: ConversationRole;
  content: string;
  ord: number;
  created_at: string;
  meta: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════════
// Auto-title · deterministic · never sends anything to an LLM
// ═══════════════════════════════════════════════════════════════════

export function autoTitle(firstUserMessage: string): string {
  const clean = firstUserMessage
    .replace(/\s+/g, " ")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
  if (clean.length === 0) return "New conversation";
  // Take the first ~48 chars, avoid cutting mid-word.
  if (clean.length <= 48) return clean;
  const cut = clean.slice(0, 48);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 24 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

// ═══════════════════════════════════════════════════════════════════
// Create + append
// ═══════════════════════════════════════════════════════════════════

export interface CreateConversationArgs {
  conversation_id?: string;
  user_id?: string | null;
  title?: string;
  branched_from?: string | null;
  branched_at_msg?: string | null;
}

export async function createConversation(args: CreateConversationArgs = {}): Promise<ConversationRow | null> {
  const conversation_id = args.conversation_id ?? randomUUID();
  const title = args.title ?? "New conversation";
  return withClient(async (c) => {
    const r = await c.query(
      `INSERT INTO nex.conversation
         (conversation_id, user_id, title, branched_from, branched_at_msg)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (conversation_id) DO NOTHING
       RETURNING conversation_id, user_id, title, branched_from, branched_at_msg,
                 created_at::text, updated_at::text`,
      [conversation_id, args.user_id ?? null, title, args.branched_from ?? null, args.branched_at_msg ?? null],
    );
    return (r.rows[0] as unknown as ConversationRow) ?? null;
  });
}

export interface AppendMessageArgs {
  conversation_id: string;
  role: ConversationRole;
  content: string;
  meta?: Record<string, unknown>;
  message_id?: string;
}

export async function appendMessage(args: AppendMessageArgs): Promise<ConversationMessageRow | null> {
  const message_id = args.message_id ?? randomUUID();
  return withClient(async (c) => {
    const ordR = await c.query(
      `SELECT COALESCE(MAX(ord), -1) + 1 AS next FROM nex.conversation_message WHERE conversation_id = $1`,
      [args.conversation_id],
    );
    const ord = Number((ordR.rows[0] as { next: number | string })?.next ?? 0);
    const r = await c.query(
      `INSERT INTO nex.conversation_message
         (message_id, conversation_id, role, content, ord, meta)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING message_id, conversation_id, role, content, ord, created_at::text, meta`,
      [message_id, args.conversation_id, args.role, args.content, ord, args.meta ? JSON.stringify(args.meta) : null],
    );
    await c.query(
      `UPDATE nex.conversation SET updated_at = now() WHERE conversation_id = $1`,
      [args.conversation_id],
    );
    // Auto-title: if this is the first user message AND title is still default, set it.
    if (args.role === "user" && ord === 0) {
      const title = autoTitle(args.content);
      await c.query(
        `UPDATE nex.conversation
           SET title = $2
         WHERE conversation_id = $1 AND (title IS NULL OR title = 'New conversation')`,
        [args.conversation_id, title],
      );
    }
    return (r.rows[0] as unknown as ConversationMessageRow) ?? null;
  });
}

// ═══════════════════════════════════════════════════════════════════
// Read
// ═══════════════════════════════════════════════════════════════════

export async function getConversation(conversation_id: string): Promise<{ conversation: ConversationRow; messages: ConversationMessageRow[] } | null> {
  return withClient(async (c) => {
    const cR = await c.query(
      `SELECT conversation_id, user_id, title, branched_from, branched_at_msg,
              created_at::text, updated_at::text
         FROM nex.conversation
        WHERE conversation_id = $1 AND deleted_at IS NULL`,
      [conversation_id],
    );
    const row = cR.rows[0] as unknown as ConversationRow | undefined;
    if (!row) return null;
    const mR = await c.query(
      `SELECT message_id, conversation_id, role, content, ord, created_at::text, meta
         FROM nex.conversation_message
        WHERE conversation_id = $1
        ORDER BY ord ASC`,
      [conversation_id],
    );
    return { conversation: row, messages: mR.rows as unknown as ConversationMessageRow[] };
  });
}

export async function listConversations(user_id: string, limit = 50): Promise<ConversationRow[]> {
  const rows = await withClient(async (c) => {
    const r = await c.query(
      `SELECT conversation_id, user_id, title, branched_from, branched_at_msg,
              created_at::text, updated_at::text
         FROM nex.conversation
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT $2`,
      [user_id, limit],
    );
    return r.rows as unknown as ConversationRow[];
  });
  return rows ?? [];
}

export async function searchConversations(user_id: string, query: string, limit = 20): Promise<Array<ConversationRow & { snippet: string }>> {
  if (!query.trim()) return [];
  const rows = await withClient(async (c) => {
    const r = await c.query(
      `SELECT DISTINCT ON (conv.conversation_id)
              conv.conversation_id, conv.user_id, conv.title,
              conv.branched_from, conv.branched_at_msg,
              conv.created_at::text, conv.updated_at::text,
              ts_headline('simple', msg.content, plainto_tsquery('simple', $2),
                          'MaxWords=15, MinWords=5') AS snippet
         FROM nex.conversation conv
         JOIN nex.conversation_message msg USING (conversation_id)
        WHERE conv.user_id = $1
          AND conv.deleted_at IS NULL
          AND to_tsvector('simple', msg.content) @@ plainto_tsquery('simple', $2)
        ORDER BY conv.conversation_id, conv.updated_at DESC
        LIMIT $3`,
      [user_id, query, limit],
    );
    return r.rows as unknown as Array<ConversationRow & { snippet: string }>;
  });
  return rows ?? [];
}

// ═══════════════════════════════════════════════════════════════════
// Branch
// ═══════════════════════════════════════════════════════════════════

export async function branchConversation(source_conversation_id: string, from_message_id: string, user_id: string | null): Promise<ConversationRow | null> {
  const new_id = randomUUID();
  return withClient(async (c) => {
    // Load source + copy messages up to (and including) from_message_id.
    const srcR = await c.query(
      `SELECT ord, title FROM (
         SELECT c.title, m.ord FROM nex.conversation c
           JOIN nex.conversation_message m USING (conversation_id)
          WHERE c.conversation_id = $1 AND m.message_id = $2
       ) x LIMIT 1`,
      [source_conversation_id, from_message_id],
    );
    const src = srcR.rows[0] as { ord: number; title: string } | undefined;
    if (!src) return null;
    const newTitle = `Branch: ${src.title}`.slice(0, 80);
    await c.query(
      `INSERT INTO nex.conversation
         (conversation_id, user_id, title, branched_from, branched_at_msg)
       VALUES ($1,$2,$3,$4,$5)`,
      [new_id, user_id, newTitle, source_conversation_id, from_message_id],
    );
    await c.query(
      `INSERT INTO nex.conversation_message
         (message_id, conversation_id, role, content, ord, meta)
       SELECT gen_random_uuid()::text, $1, role, content, ord, meta
         FROM nex.conversation_message
        WHERE conversation_id = $2 AND ord <= $3
        ORDER BY ord ASC`,
      [new_id, source_conversation_id, src.ord],
    );
    const outR = await c.query(
      `SELECT conversation_id, user_id, title, branched_from, branched_at_msg,
              created_at::text, updated_at::text
         FROM nex.conversation WHERE conversation_id = $1`,
      [new_id],
    );
    return (outR.rows[0] as unknown as ConversationRow) ?? null;
  });
}

// ═══════════════════════════════════════════════════════════════════
// Share
// ═══════════════════════════════════════════════════════════════════

export async function shareConversation(conversation_id: string, created_by: string | null): Promise<{ share_token: string; view_url: string } | null> {
  const share_token = randomBytes(16).toString("hex");
  const created = await withClient(async (c) => {
    const r = await c.query(
      `INSERT INTO nex.conversation_share
         (share_token, conversation_id, created_by)
       VALUES ($1,$2,$3)
       RETURNING share_token`,
      [share_token, conversation_id, created_by],
    );
    return (r.rows[0] as { share_token?: string } | undefined)?.share_token ?? null;
  });
  if (!created) return null;
  return { share_token: created, view_url: `/nex/share/${created}` };
}

export async function getSharedConversation(share_token: string): Promise<{ conversation: ConversationRow; messages: ConversationMessageRow[] } | null> {
  return withClient(async (c) => {
    const shareR = await c.query(
      `SELECT conversation_id FROM nex.conversation_share
        WHERE share_token = $1 AND revoked_at IS NULL`,
      [share_token],
    );
    const conversation_id = (shareR.rows[0] as { conversation_id?: string } | undefined)?.conversation_id;
    if (!conversation_id) return null;
    await c.query(
      `UPDATE nex.conversation_share SET view_count = view_count + 1 WHERE share_token = $1`,
      [share_token],
    );
    const cR = await c.query(
      `SELECT conversation_id, user_id, title, branched_from, branched_at_msg,
              created_at::text, updated_at::text
         FROM nex.conversation
        WHERE conversation_id = $1 AND deleted_at IS NULL`,
      [conversation_id],
    );
    const conv = cR.rows[0] as unknown as ConversationRow | undefined;
    if (!conv) return null;
    const mR = await c.query(
      `SELECT message_id, conversation_id, role, content, ord, created_at::text, meta
         FROM nex.conversation_message
        WHERE conversation_id = $1
        ORDER BY ord ASC`,
      [conversation_id],
    );
    return { conversation: conv, messages: mR.rows as unknown as ConversationMessageRow[] };
  });
}

// ═══════════════════════════════════════════════════════════════════
// Utility · deterministic share-token hash for testing
// ═══════════════════════════════════════════════════════════════════

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
