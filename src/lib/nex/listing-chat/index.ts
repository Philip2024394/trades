// src/lib/nex/listing-chat/index.ts
//
// Founder Phase 31 · Listing Chat library.
// Founder Doctrine #7 · PRIVATE MESSAGES — every function in this file
// scopes by (thread_id, from_user_id OR owner) to enforce the two-party
// envelope at query time.
//
// NO reference to this file is permitted from src/lib/nex/brain/*,
// src/lib/nex/retrieval/*, or any embedding pipeline. Verified by
// smoke-listing-chat J.

import { createHash, randomBytes } from "node:crypto";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";
import { getListingDetail } from "@/lib/nex/directory";

export type ThreadStatus = "open" | "archived_by_sender" | "archived_by_owner" | "closed";

export interface ListingThreadRow {
  thread_id: string;
  listing_ref: string;
  sender_user_id: string;
  owner_user_id: string | null;
  owner_email_hint: string | null;
  created_at: string;
  last_message_at: string;
  sender_unread_count: number;
  owner_unread_count: number;
  status: ThreadStatus;
}

export interface ListingMessageRow {
  message_id: string;
  thread_id: string;
  from_role: "sender" | "owner" | "system";
  from_user_id: string | null;
  body: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sanitiser_neutralised: number;
  meta: Record<string, unknown> | null;
}

export function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
export function makeInviteToken(): string {
  return randomBytes(16).toString("hex");
}

// ═══════════════════════════════════════════════════════════════════
// Ensure a thread exists (per listing + sender)
// ═══════════════════════════════════════════════════════════════════

export async function ensureThread(args: {
  listing_ref: string;
  sender_user_id: string;
}): Promise<ListingThreadRow> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `INSERT INTO nex.listing_thread (listing_ref, sender_user_id)
     VALUES ($1, $2)
     ON CONFLICT (listing_ref, sender_user_id) DO UPDATE
       SET last_message_at = nex.listing_thread.last_message_at
     RETURNING thread_id::text, listing_ref, sender_user_id, owner_user_id,
               owner_email_hint, created_at::text, last_message_at::text,
               sender_unread_count, owner_unread_count, status`,
    [args.listing_ref, args.sender_user_id],
  );
  return r.rows[0] as unknown as ListingThreadRow;
}

// ═══════════════════════════════════════════════════════════════════
// Send a message
// ═══════════════════════════════════════════════════════════════════

export interface SendMessageResult {
  message: ListingMessageRow;
  thread: ListingThreadRow;
  is_first_message_from_sender: boolean;
  sanitiser_neutralised: number;
  doctrine_note: string;
}

export async function sendMessage(args: {
  listing_ref: string;
  sender_user_id: string;
  body: string;
}): Promise<SendMessageResult> {
  // Doctrine #5 sanitiser — same layer used by voice/file/OCR intake.
  const sanit = sanitiseUntrustedContent({ text: args.body, source_kind: "tool" });
  const clean = sanit.clean_text.trim();
  if (clean.length === 0) {
    throw new Error("empty_after_sanitise");
  }
  const bounded = clean.slice(0, 4000);

  const thread = await ensureThread({
    listing_ref: args.listing_ref, sender_user_id: args.sender_user_id,
  });

  const pool = getKnowledgeFactoryDbPool();

  // Count sender messages so we know if this is the first
  const count = await pool.query(
    `SELECT count(*)::int AS n FROM nex.listing_message
      WHERE thread_id = $1 AND from_role = 'sender'`,
    [thread.thread_id],
  );
  const isFirst = Number((count.rows[0] as { n: number }).n) === 0;

  const insert = await pool.query(
    `INSERT INTO nex.listing_message
       (thread_id, from_role, from_user_id, body, sanitiser_neutralised)
     VALUES ($1,'sender',$2,$3,$4)
     RETURNING message_id::text, thread_id::text, from_role, from_user_id,
               body, sent_at::text, delivered_at::text, read_at::text,
               sanitiser_neutralised, meta`,
    [thread.thread_id, args.sender_user_id, bounded, sanit.neutralised_count],
  );
  const message = insert.rows[0] as unknown as ListingMessageRow;

  // Bump owner_unread_count + last_message_at
  await pool.query(
    `UPDATE nex.listing_thread
        SET owner_unread_count = owner_unread_count + 1,
            last_message_at    = now()
      WHERE thread_id = $1`,
    [thread.thread_id],
  );

  return {
    message,
    thread,
    is_first_message_from_sender: isFirst,
    sanitiser_neutralised: sanit.neutralised_count,
    doctrine_note: "Doctrine #7 · Private Messages · this message is a two-party envelope · NEX never trains on it.",
  };
}

// ═══════════════════════════════════════════════════════════════════
// Read a thread — MUST scope by sender OR owner
// ═══════════════════════════════════════════════════════════════════

export async function readThreadForSender(args: {
  listing_ref: string; sender_user_id: string; limit?: number;
}): Promise<{ thread: ListingThreadRow | null; messages: ListingMessageRow[] }> {
  const pool = getKnowledgeFactoryDbPool();
  const tR = await pool.query(
    `SELECT thread_id::text, listing_ref, sender_user_id, owner_user_id,
            owner_email_hint, created_at::text, last_message_at::text,
            sender_unread_count, owner_unread_count, status
       FROM nex.listing_thread
      WHERE listing_ref = $1 AND sender_user_id = $2`,
    [args.listing_ref, args.sender_user_id],
  );
  const thread = (tR.rows[0] as unknown as ListingThreadRow | undefined) ?? null;
  if (!thread) return { thread: null, messages: [] };
  const mR = await pool.query(
    `SELECT message_id::text, thread_id::text, from_role, from_user_id,
            body, sent_at::text, delivered_at::text, read_at::text,
            sanitiser_neutralised, meta
       FROM nex.listing_message
      WHERE thread_id = $1
      ORDER BY sent_at ASC
      LIMIT $2`,
    [thread.thread_id, Math.max(1, Math.min(500, args.limit ?? 100))],
  );
  return { thread, messages: mR.rows as unknown as ListingMessageRow[] };
}

export async function readThreadForOwner(args: {
  thread_id: string; owner_user_id: string; limit?: number;
}): Promise<{ thread: ListingThreadRow | null; messages: ListingMessageRow[] }> {
  const pool = getKnowledgeFactoryDbPool();
  const tR = await pool.query(
    `SELECT thread_id::text, listing_ref, sender_user_id, owner_user_id,
            owner_email_hint, created_at::text, last_message_at::text,
            sender_unread_count, owner_unread_count, status
       FROM nex.listing_thread
      WHERE thread_id = $1 AND owner_user_id = $2`,
    [args.thread_id, args.owner_user_id],
  );
  const thread = (tR.rows[0] as unknown as ListingThreadRow | undefined) ?? null;
  if (!thread) return { thread: null, messages: [] };
  const mR = await pool.query(
    `SELECT message_id::text, thread_id::text, from_role, from_user_id,
            body, sent_at::text, delivered_at::text, read_at::text,
            sanitiser_neutralised, meta
       FROM nex.listing_message
      WHERE thread_id = $1
      ORDER BY sent_at ASC
      LIMIT $2`,
    [thread.thread_id, Math.max(1, Math.min(500, args.limit ?? 100))],
  );
  return { thread, messages: mR.rows as unknown as ListingMessageRow[] };
}

// ═══════════════════════════════════════════════════════════════════
// Owner invite tokens
// ═══════════════════════════════════════════════════════════════════

export async function issueOwnerInvite(args: {
  thread_id: string; listing_ref: string; owner_email: string;
}): Promise<{ invite_token: string; expires_at: string; owner_email_hash_16: string }> {
  const pool = getKnowledgeFactoryDbPool();
  const invite_token = makeInviteToken();
  const owner_email_hash_16 = sha16(args.owner_email.trim().toLowerCase());
  const r = await pool.query(
    `INSERT INTO nex.listing_owner_invite
       (invite_token, thread_id, listing_ref, owner_email_hash_16)
     VALUES ($1, $2, $3, $4)
     RETURNING invite_token, expires_at::text`,
    [invite_token, args.thread_id, args.listing_ref, owner_email_hash_16],
  );
  const row = r.rows[0] as { invite_token: string; expires_at: string };
  return { invite_token: row.invite_token, expires_at: row.expires_at, owner_email_hash_16 };
}

export async function resolveOwnerInvite(invite_token: string): Promise<{
  thread_id: string; listing_ref: string; expired: boolean;
} | null> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT thread_id::text, listing_ref, expires_at, converted_at
       FROM nex.listing_owner_invite
      WHERE invite_token = $1`,
    [invite_token],
  );
  const row = r.rows[0] as { thread_id: string; listing_ref: string; expires_at: string; converted_at: string | null } | undefined;
  if (!row) return null;
  const expired = new Date(row.expires_at).getTime() < Date.now();
  return { thread_id: row.thread_id, listing_ref: row.listing_ref, expired };
}

export async function convertOwnerInvite(args: {
  invite_token: string; owner_user_id: string;
}): Promise<boolean> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `UPDATE nex.listing_owner_invite
        SET converted_at = COALESCE(converted_at, now()),
            converted_user_id = COALESCE(converted_user_id, $2),
            first_used_at = COALESCE(first_used_at, now())
      WHERE invite_token = $1`,
    [args.invite_token, args.owner_user_id],
  );
  if ((r.rowCount ?? 0) === 0) return false;
  // Link the thread to the owner user id
  await pool.query(
    `UPDATE nex.listing_thread t
        SET owner_user_id = $2
       FROM nex.listing_owner_invite i
      WHERE i.invite_token = $1 AND i.thread_id = t.thread_id`,
    [args.invite_token, args.owner_user_id],
  );
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// Convenience · resolve the owner email for a listing (from directory data)
// ═══════════════════════════════════════════════════════════════════

export async function tryResolveOwnerEmailFromListing(listing_ref: string): Promise<string | null> {
  const detail = await getListingDetail(listing_ref);
  if (!detail) return null;
  // The accommodation table doesn't have owner_email in current data;
  // this is where a future owner-claim table would provide it. Until
  // then we surface null and the send flow falls back to email-hint
  // captured on the send request.
  return (detail as unknown as { owner_email?: string }).owner_email ?? null;
}
