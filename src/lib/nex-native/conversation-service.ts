// src/lib/nex-native/conversation-service.ts
//
// conversation-service · threads · participants · messages.
//
// Doctrine:
//   · Identity Doctrine · every participant is a nex_account UUID
//   · Messages are IMMUTABLE (no updateMessage export · none allowed)
//   · Product context via about_product_id (nullable) · never phone-keyed

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexConversationInsert,
  NexConversationParticipantInsert,
  NexConversationParticipantRow,
  NexConversationRow,
  NexMessageInsert,
  NexMessageRow,
  NexUuid,
} from "./types";

/** Read one conversation by NEX UUID. */
export async function getConversationById(
  id: NexUuid
): Promise<NexConversationRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`conversation-service.getConversationById: ${error.message}`);
  return (data as NexConversationRow) ?? null;
}

/** Create a new conversation scoped to a business (and optionally a product). */
export async function createConversation(
  input: NexConversationInsert
): Promise<NexConversationRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation")
    .insert({
      business_id: input.business_id,
      about_product_id: input.about_product_id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `conversation-service.createConversation: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexConversationRow;
}

/** Add a participant to a conversation. Composite PK prevents duplicates. */
export async function addParticipant(
  input: NexConversationParticipantInsert
): Promise<NexConversationParticipantRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .insert({
      conversation_id: input.conversation_id,
      account_id: input.account_id,
      side: input.side,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `conversation-service.addParticipant: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexConversationParticipantRow;
}

/** List participants of a conversation. */
export async function listParticipants(
  conversationId: NexUuid
): Promise<NexConversationParticipantRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .select("*")
    .eq("conversation_id", conversationId);
  if (error) throw new Error(`conversation-service.listParticipants: ${error.message}`);
  return (data as NexConversationParticipantRow[]) ?? [];
}

/** Post an immutable message. */
export async function postMessage(input: NexMessageInsert): Promise<NexMessageRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_message")
    .insert({
      conversation_id: input.conversation_id,
      sender_account_id: input.sender_account_id,
      body: input.body,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `conversation-service.postMessage: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexMessageRow;
}

/** Read messages in a conversation · chronological order. */
export async function listMessages(
  conversationId: NexUuid
): Promise<NexMessageRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`conversation-service.listMessages: ${error.message}`);
  return (data as NexMessageRow[]) ?? [];
}

// ---------------------------------------------------------------------------
// Wave 5 extensions · inbox + last-read + participation lookup
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  conversation: NexConversationRow;
  my_side: "business" | "customer";
  my_last_read_at: string | null;
  business: { id: NexUuid; display_name: string; slug: string };
  product: { id: NexUuid; name: string; price_pence: number; currency: string } | null;
  last_message: NexMessageRow | null;
  unread_count: number;
  other_display_name: string | null;
  /** The other participant's last_read_at · used to render read receipts
   *  on my own outbound messages: if my last_message was created before
   *  or at this timestamp, they've seen it. Null when the other side has
   *  never opened the thread. */
  other_last_read_at: string | null;
}

/**
 * List every conversation the given account participates in · newest first.
 * Enriched with business + product context, last message, and unread count
 * (messages created after my last_read_at that I did NOT send).
 *
 * Wave 5 · powers the inbox at /nex-native/conversations.
 */
export async function listConversationsForAccount(
  accountId: NexUuid,
  opts?: { limit?: number }
): Promise<ConversationSummary[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));

  // 1 · fetch participant rows for this account, embed the conversation
  //     and the business + product on the conversation.
  const { data: parts, error: partsErr } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .select(
      `
      conversation_id, account_id, side, joined_at, last_read_at,
      nex_conversation!inner (
        id, business_id, about_product_id, created_at,
        nex_business!inner ( id, display_name, slug ),
        nex_product ( id, name, price_pence, currency )
      )
    `
    )
    .eq("account_id", accountId)
    .limit(limit);
  if (partsErr) throw new Error(`conversation-service.listConversationsForAccount parts: ${partsErr.message}`);

  const rows = (parts ?? []) as unknown as Array<{
    conversation_id: NexUuid;
    account_id: NexUuid;
    side: "business" | "customer";
    joined_at: string;
    last_read_at: string | null;
    nex_conversation: {
      id: NexUuid;
      business_id: NexUuid;
      about_product_id: NexUuid | null;
      created_at: string;
      nex_business: { id: NexUuid; display_name: string; slug: string };
      nex_product: { id: NexUuid; name: string; price_pence: number; currency: string } | null;
    };
  }>;

  if (rows.length === 0) return [];

  // 2 · fetch last message per conversation (single batched query with
  //     window function would be nicer via .rpc; two queries is fine for MVP)
  const convIds = rows.map((r) => r.conversation_id);
  const { data: latestMsgs, error: msgsErr } = await nexSupabaseAdmin
    .from("nex_message")
    .select("*")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  if (msgsErr) throw new Error(`conversation-service.listConversationsForAccount msgs: ${msgsErr.message}`);
  const lastByConv = new Map<NexUuid, NexMessageRow>();
  for (const m of (latestMsgs ?? []) as NexMessageRow[]) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
  }

  // 3 · fetch other participants · pull their last_read_at too so we can
  //     compute read receipts on my outbound messages (Founder Tier-1 UX
  //     upgrade 2026-09-27).
  const { data: otherParts, error: otherErr } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .select("conversation_id, account_id, side, last_read_at, nex_account!inner ( id, display_name )")
    .in("conversation_id", convIds)
    .neq("account_id", accountId);
  if (otherErr) throw new Error(`conversation-service.listConversationsForAccount others: ${otherErr.message}`);
  const otherByConv = new Map<NexUuid, { display_name: string; last_read_at: string | null }>();
  for (const op of (otherParts ?? []) as unknown as Array<{
    conversation_id: NexUuid;
    account_id: NexUuid;
    side: string;
    last_read_at: string | null;
    nex_account: { id: NexUuid; display_name: string };
  }>) {
    if (!otherByConv.has(op.conversation_id)) {
      otherByConv.set(op.conversation_id, {
        display_name: op.nex_account.display_name,
        last_read_at: op.last_read_at,
      });
    }
  }

  // 4 · assemble · compute unread counts client-side (all messages already fetched)
  const summaries: ConversationSummary[] = rows.map((r) => {
    const conv = r.nex_conversation;
    const msgs = (latestMsgs ?? []).filter((m: NexMessageRow) => m.conversation_id === r.conversation_id);
    const unread = r.last_read_at
      ? msgs.filter((m: NexMessageRow) => m.sender_account_id !== accountId && m.created_at > r.last_read_at!).length
      : msgs.filter((m: NexMessageRow) => m.sender_account_id !== accountId).length;
    const other = otherByConv.get(r.conversation_id) ?? null;
    return {
      conversation: {
        id: conv.id,
        business_id: conv.business_id,
        about_product_id: conv.about_product_id,
        created_at: conv.created_at,
      },
      my_side: r.side,
      my_last_read_at: r.last_read_at,
      business: conv.nex_business,
      product: conv.nex_product ?? null,
      last_message: lastByConv.get(r.conversation_id) ?? null,
      unread_count: unread,
      other_display_name: other?.display_name ?? null,
      other_last_read_at: other?.last_read_at ?? null,
    };
  });

  // newest activity first: last message created_at when present, else conversation created_at
  summaries.sort((a, b) => {
    const aT = a.last_message?.created_at ?? a.conversation.created_at;
    const bT = b.last_message?.created_at ?? b.conversation.created_at;
    return aT > bT ? -1 : aT < bT ? 1 : 0;
  });
  return summaries;
}

/**
 * Update the caller's last_read_at on a participation row (composite PK).
 * Idempotent · timestamp defaults to now(). Returns the updated row.
 * If the participant record doesn't exist, returns null (caller is not a
 * participant and must not be given last-read power).
 */
export async function updateLastRead(
  conversationId: NexUuid,
  accountId: NexUuid,
  timestamp?: string
): Promise<NexConversationParticipantRow | null> {
  const stamp = timestamp ?? new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .update({ last_read_at: stamp })
    .eq("conversation_id", conversationId)
    .eq("account_id", accountId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`conversation-service.updateLastRead: ${error.message}`);
  return (data as NexConversationParticipantRow) ?? null;
}

/** Read the caller's own participant row · null when not a participant. */
export async function getParticipation(
  conversationId: NexUuid,
  accountId: NexUuid
): Promise<NexConversationParticipantRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(`conversation-service.getParticipation: ${error.message}`);
  return (data as NexConversationParticipantRow) ?? null;
}

/**
 * Find the most-recent conversation between a specific customer and a
 * specific business (optionally scoped to a specific product context).
 * Used by the Wave 4 application boundary to reuse an existing thread
 * on a return visit rather than creating an infinite series of empty
 * conversations from the same customer.
 *
 * Returns null when no such conversation exists — the caller is expected
 * to create one via createConversation + addParticipant × 2.
 */
export async function findLatestCustomerConversation(input: {
  customer_account_id: NexUuid;
  business_id: NexUuid;
  about_product_id?: NexUuid | null;
}): Promise<NexConversationRow | null> {
  let q = nexSupabaseAdmin
    .from("nex_conversation")
    .select("*, nex_conversation_participant!inner(account_id, side)")
    .eq("business_id", input.business_id)
    .eq("nex_conversation_participant.account_id", input.customer_account_id)
    .eq("nex_conversation_participant.side", "customer");
  if (input.about_product_id === null || input.about_product_id === undefined) {
    q = q.is("about_product_id", null);
  } else {
    q = q.eq("about_product_id", input.about_product_id);
  }
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1);
  if (error) {
    throw new Error(`conversation-service.findLatestCustomerConversation: ${error.message}`);
  }
  if (!data || data.length === 0) return null;
  // Strip the joined participant · we only wanted it as a filter
  const row = data[0] as NexConversationRow & { nex_conversation_participant?: unknown };
  delete row.nex_conversation_participant;
  return row;
}
