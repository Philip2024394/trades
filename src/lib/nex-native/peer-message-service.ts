// src/lib/nex-native/peer-message-service.ts
//
// Bridge 3 · peer-to-peer message service.
// -----------------------------------------
// Immutable append-only log of messages between two friends. Companion
// to peer-conversation-service.ts.
//
// Doctrine:
//   · Messages are IMMUTABLE · no updateMessage export. The only
//     mutable column is read_at, which flips from null to a timestamp
//     when the recipient views the message.
//   · Send guards: sender must be a participant of the conversation.
//     Enforced here at the service boundary in addition to RLS.
//   · Body length: 1-4000 chars, matches DB CHECK. Longer messages
//     should be split (client responsibility).

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import {
  getPeerConversationById,
  touchPeerConversation,
} from "./peer-conversation-service";
import type { NexUuid } from "./types";
import {
  NEX_PEER_MESSAGE_QUICK_REACTIONS,
  type NexPeerMessageReactions,
} from "./peer-message-reactions";

export interface NexPeerMessageRow {
  id: NexUuid;
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  sent_at: string;
  read_at: string | null;
  /** When non-null, this message is a reply that quotes the target
   *  peer message. Introduced Bridge 5 · migration 052. */
  reply_to_id: NexUuid | null;
  /** Set to true when the sender retracts the message. UI renders a
   *  "🚫 deleted" placeholder in its slot. Body is preserved for
   *  audit. Sealed Bridge 6 · migration 053. */
  deleted_for_everyone: boolean;
  /** When the retraction happened. */
  deleted_at: string | null;
  /** Bridge 8+9 · public URL of an attached photo, video, or voice
   *  note in the nex-peer-chat-attachments bucket. NULL for text-only
   *  messages. Sealed 2026-09-27 · migration 054. */
  attachment_url: string | null;
  /** 'image' | 'video' | 'audio' · which inline renderer to use. */
  attachment_type: NexPeerAttachmentKind | null;
  /** Optional client metadata about the attachment · duration_ms,
   *  width, height, size_bytes, mime · used for waveform, poster,
   *  progress indicators. */
  attachment_meta: NexPeerAttachmentMeta | null;
  /** Bridge 66 · migration 091 · emoji → [account_id, ...] map.
   *  Default {} · toggled via toggleMessageReaction. Never NULL. */
  reactions: NexPeerMessageReactions;
  /** Bridge 76 · when true, body is the sentinel '(encrypted)' and
   *  the real content lives in ciphertext / nonce. */
  encrypted?: boolean;
  /** Bridge 76 · raw bytes from nacl.box.after · null on legacy plaintext rows. */
  ciphertext?: string | null;
  /** Bridge 76 · 24-byte nonce · null on legacy plaintext rows. */
  nonce?: string | null;
  /** Bridge 76 · sender's Curve25519 public key at send time,
   *  base64-encoded · null on legacy plaintext rows. */
  sender_public_key?: string | null;
  /** Bridge 76 · sender's device id at send time · null on legacy. */
  sender_device_id?: string | null;
  /** Bridge 76 · which recipient device this ciphertext is addressed
   *  to · null on legacy plaintext rows. */
  recipient_device_id?: string | null;
  /** Bridge 76 · groups every fan-out copy of the same logical send. */
  message_group_id?: string | null;
  /** Bridge 76/78 · timestamp recipient client set on successful
   *  decrypt · purge candidate once this is set for encrypted rows. */
  delivered_at?: string | null;
}

/** Payload for one row of a fan-out send · sender client generates
 *  one of these per recipient device (+ one per own device so the
 *  sender can decrypt their outbox on other devices). */
export interface EncryptedPeerMessageInsert {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  sender_public_key: string;
  sender_device_id: string;
  recipient_device_id: string;
  message_group_id: string;
  reply_to_id?: NexUuid | null;
  attachment_url?: string | null;
  attachment_type?: NexPeerAttachmentKind | null;
  attachment_meta?: NexPeerAttachmentMeta | null;
}

// Bridge 66 · re-export client-safe reactions constants + types so
// existing importers of this service (e.g. the shell + peer chat
// page) continue to compile without knowing about the split.
export { NEX_PEER_MESSAGE_QUICK_REACTIONS, type NexPeerMessageReactions };

export type NexPeerAttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "product"
  | "menu_item"
  | "cart_order"
  | "product_share";

export interface NexPeerAttachmentMeta {
  duration_ms?: number;
  width?: number;
  height?: number;
  size_bytes?: number;
  mime?: string;
  /** Bridge 11 · when attachment_type='product', a snapshot of the
   *  product captured at send time. Frozen so the card stays
   *  renderable even if the product is later edited or deleted. */
  product?: NexPeerProductSnapshot;
  /** Bridge 15c · when attachment_type='menu_item', a snapshot of the
   *  dish captured at send time. Frozen so the card stays renderable
   *  even if the dish is later edited or deleted. */
  menu_item?: NexPeerMenuItemSnapshot;
  /** Bridge 22 · when attachment_type='cart_order', a snapshot of
   *  the entire cart at send time. Frozen prices + variant labels ·
   *  the seller sees exactly what was ordered even if products are
   *  later edited or archived. */
  cart?: NexPeerCartOrderSnapshot;
  /** Bridge 49b · when attachment_type='product_share', a snapshot of
   *  the shared product + shop + the grant that lets the recipient
   *  claim their discount. Rendered as B4 Swiss NEX Banner. Frozen
   *  so the banner keeps working even if the product/ladder edits. */
  product_share?: NexPeerProductShareSnapshot;
}

/** Bridge 49b · Snapshot embedded in an attachment_meta when a peer
 *  shares a Direct Price product to a friend or group chat. */
export interface NexPeerProductShareSnapshot {
  /** The nex_product_share_grant row id · used at checkout to look
   *  up whether the grant is still valid + apply the discount. */
  grant_id: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  business_location: string | null;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  price_pence: number;
  currency: string;
  /** +N% off for the RECIPIENT · same for sharer, stored on the grant
   *  row · shown on the banner as their reward. */
  receiver_bonus_pct: number;
  /** ISO timestamp · matches grant.expires_at · banner shows the
   *  countdown. */
  expires_at: string;
  /** Optional personal note from the sharer · 200 chars max. */
  personal_note: string | null;
  /** Deep link to the buyer-facing D6 view with grant hydrated. */
  open_href: string;
}

export interface NexPeerCartOrderItem {
  kind: "product" | "menu_item";
  id: string;
  name: string;
  price_pence: number;
  currency: string;
  quantity: number;
  variants: string[]; // human labels e.g. ["Black paint", "Body + Summicron"]
  /** Bridge 23c-3 · frozen perk tokens on this line · seller bubble
   *  renders the same 🚚 Free Delivery / 🎁 BOGO chips the buyer
   *  saw at add-time. */
  perks?: string[];
  perks_note?: string | null;
  note: string | null;
  image_url: string | null;
}

export interface NexPeerCartOrderDeliveryAddress {
  recipient_name: string;
  phone: string;
  street: string;
  street_2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  notes: string;
}

export interface NexPeerCartOrderSnapshot {
  shop_id: string;
  shop_slug: string | null;
  shop_display_name: string;
  items: NexPeerCartOrderItem[];
  buyer_notes: string | null;
  subtotal_pence: number;
  currency: string;
  item_count: number;
  /** Bridge 22c-2 · structured delivery address block. NULL means the
   *  buyer sent from a device where it wasn't filled in (legacy carts). */
  delivery_address?: NexPeerCartOrderDeliveryAddress | null;
  /** Bridge 25c · bike-delivery quote the buyer saw at Send time.
   *  Frozen · seller uses it to book GoSend / GrabExpress / Maxim
   *  and reconcile if the driver quote differs. NULL for legacy or
   *  when the buyer opted out of geolocation. */
  delivery_quote?: {
    kind: "free" | "estimate" | "unknown";
    distance_km?: number;
    fare_pence?: number;
    currency?: "IDR";
    eta_minutes?: number;
    free_reason?: string | null;
  } | null;
  /** Bridge 49b-final · NEX Direct Price applied to this cart at
   *  send time · buyer's tier + share bonuses combined and capped
   *  by ladder.max_cap_pct. NULL for legacy carts or shops without
   *  a Direct Price ladder. Seller sees the same discount the buyer
   *  saw when they hit Send. */
  direct_price?: {
    tier_pct: number;
    share_pct: number;
    applied_pct: number;
    capped_at_max: boolean;
    saving_pence: number;
    total_after_discount_pence: number;
  } | null;
}

/** Product snapshot embedded in an attachment_meta when a peer
 *  message carries a product inquiry. Sealed 2026-09-27 · migration
 *  059. */
export interface NexPeerProductSnapshot {
  product_id: string;
  business_id: string;
  business_slug: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  short_description: string | null;
}

/** Menu-item (dish) snapshot embedded in an attachment_meta when a
 *  peer message carries a dish inquiry. Sealed 2026-09-28 · migration
 *  067. Restaurants + cafes get their own card renderer that shows
 *  spice + dietary chips alongside price + image. */
export interface NexPeerMenuItemSnapshot {
  menu_item_id: string;
  business_id: string;
  business_slug: string | null;
  section_name: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  short_description: string | null;
  spice_level: number;
  dietary_tags: string[];
  portion_note: string | null;
  /** Bridge 23a · free-perk tokens attached to the dish · buyer
   *  bubble renders them as chips (Free Delivery is highlighted). */
  perks?: string[];
  /** Bridge 23a · custom note used when perks contains 'other'. */
  perks_note?: string | null;
}

/** Window in which a sender can still retract a message. WhatsApp
 *  uses roughly 1 hour · we match that. Beyond the window the
 *  service refuses to delete. */
export const NEX_PEER_MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1000;

export interface SendPeerMessageInput {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  /** Optional · when set, the message quotes this target and the UI
   *  renders a reply-quote header inside the bubble. */
  reply_to_id?: NexUuid | null;
  /** Optional attachment on the message · Bridge 8+9. Body may be
   *  empty (attachment-only messages are allowed at the DB level
   *  via the body_or_attachment CHECK constraint). */
  attachment_url?: string | null;
  attachment_type?: NexPeerAttachmentKind | null;
  attachment_meta?: NexPeerAttachmentMeta | null;
  /** Optional · Bridge 99 idempotency key (Migration 102 Part C).
   *  When supplied, the insert is subject to UNIQUE
   *  (sender_account_id, send_intent_id) · a repeated send with the
   *  same intent raises a Postgres duplicate-key error the caller can
   *  interpret as "already delivered". Callers without an idempotency
   *  requirement should leave this undefined. */
  send_intent_id?: NexUuid | null;
}

/** Persist a peer chat message. Sender must be a participant of the
 *  conversation · throws otherwise. Bumps last_message_at on the
 *  conversation as a side-effect (so listing conversations sorted by
 *  recency works without an aggregate query). */
export async function sendPeerMessage(
  input: SendPeerMessageInput,
): Promise<NexPeerMessageRow> {
  const body = input.body.trim();
  const hasAttachment = !!input.attachment_url && !!input.attachment_type;
  if (body.length === 0 && !hasAttachment) {
    throw new Error(
      "peer-message-service.sendPeerMessage: body is empty and no attachment provided",
    );
  }
  if (body.length > 4000) {
    throw new Error(
      "peer-message-service.sendPeerMessage: body exceeds 4000 chars",
    );
  }
  if (
    (input.attachment_url && !input.attachment_type) ||
    (input.attachment_type && !input.attachment_url)
  ) {
    throw new Error(
      "peer-message-service.sendPeerMessage: attachment_url + attachment_type must be set together",
    );
  }
  const conversation = await getPeerConversationById(input.conversation_id);
  if (!conversation) {
    throw new Error(
      "peer-message-service.sendPeerMessage: conversation not found",
    );
  }
  const isParticipant =
    conversation.participant_a_id === input.sender_account_id ||
    conversation.participant_b_id === input.sender_account_id;
  if (!isParticipant) {
    throw new Error(
      "peer-message-service.sendPeerMessage: sender is not a participant of this conversation",
    );
  }
  // Validate the reply target exists AND belongs to the same
  // conversation · defends against replying to a message in another
  // thread (impossible via UI but cheap to enforce here).
  let replyToId: NexUuid | null = null;
  if (input.reply_to_id) {
    const { data: target, error: targetErr } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("id, conversation_id")
      .eq("id", input.reply_to_id)
      .maybeSingle();
    if (targetErr) {
      throw new Error(
        `peer-message-service.sendPeerMessage · reply target lookup failed: ${targetErr.message}`,
      );
    }
    if (
      target &&
      (target as { conversation_id: string }).conversation_id ===
        input.conversation_id
    ) {
      replyToId = input.reply_to_id;
    }
    // Silently drop bad reply pointers rather than erroring the send.
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert({
      conversation_id: input.conversation_id,
      sender_account_id: input.sender_account_id,
      body,
      reply_to_id: replyToId,
      attachment_url: input.attachment_url ?? null,
      attachment_type: input.attachment_type ?? null,
      attachment_meta: input.attachment_meta ?? null,
      // Bridge 99 idempotency key · UNIQUE (sender_account_id,
      // send_intent_id) enforced by Migration 102 Part C.
      ...(input.send_intent_id ? { send_intent_id: input.send_intent_id } : {}),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `peer-message-service.sendPeerMessage: ${error?.message ?? "no row returned"}`,
    );
  }
  const row = data as NexPeerMessageRow;
  await touchPeerConversation(row.conversation_id, row.sent_at).catch(() => {
    // best-effort · leaving last_message_at stale won't break sends
  });
  return row;
}

/** List messages in a conversation, oldest first. Optional limit. */
export async function listPeerMessages(
  conversationId: NexUuid,
  opts?: { limit?: number },
): Promise<NexPeerMessageRow[]> {
  let query = nexSupabaseAdmin
    .from("nex_peer_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
  if (opts?.limit && opts.limit > 0) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) {
    throw new Error(`peer-message-service.listPeerMessages: ${error.message}`);
  }
  return (data as NexPeerMessageRow[]) ?? [];
}

/** Mark every inbound (not-from-viewer) message in the conversation as
 *  read. Idempotent side-effect · safe to call on every page load. */
export async function markPeerMessagesRead(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) {
    // best-effort · never throw from a read-marker
    // eslint-disable-next-line no-console
    console.warn(
      `peer-message-service.markPeerMessagesRead soft-fail: ${error.message}`,
    );
  }
}

/** Retract a peer message · "delete for everyone". Sender-only,
 *  within a 1-hour window from send time. Sets deleted_for_everyone
 *  + deleted_at · body is preserved for audit. Throws with clear
 *  reasons the Server Action can surface as user-facing banners. */
export async function deletePeerMessageForEveryone(
  messageId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<void> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, sender_account_id, sent_at, deleted_for_everyone")
    .eq("id", messageId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-message-service.deletePeerMessageForEveryone lookup: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error("message not found");
  }
  const row = data as Pick<
    NexPeerMessageRow,
    "sender_account_id" | "sent_at" | "deleted_for_everyone"
  > & { id: NexUuid };
  if (row.deleted_for_everyone) {
    // Idempotent · already deleted · nothing to do.
    return;
  }
  if (row.sender_account_id !== viewerAccountId) {
    throw new Error("only the sender can delete this message");
  }
  const age = Date.now() - new Date(row.sent_at).getTime();
  if (age > NEX_PEER_MESSAGE_DELETE_WINDOW_MS) {
    throw new Error(
      "delete window has passed · you can retract messages within an hour",
    );
  }
  const now = new Date().toISOString();
  const upd = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ deleted_for_everyone: true, deleted_at: now })
    .eq("id", messageId);
  if (upd.error) {
    throw new Error(
      `peer-message-service.deletePeerMessageForEveryone update: ${upd.error.message}`,
    );
  }
}

/**
 * Bridge 66 · Toggle a reaction on a peer message.
 * ------------------------------------------------
 * Reads the current `reactions` JSONB, adds or removes the caller's
 * account id from the emoji's array, writes back. Returns the resulting
 * reactions map so the caller can echo it into the UI without a re-read.
 *
 * Idempotent · calling twice with the same emoji is a toggle (add then
 * remove). Emojis outside the quick-reactions whitelist are rejected so
 * an untrusted client can't stuff arbitrary strings into the JSONB.
 */
export async function toggleMessageReaction(
  messageId: NexUuid,
  callerAccountId: NexUuid,
  emoji: string,
): Promise<NexPeerMessageReactions> {
  if (!NEX_PEER_MESSAGE_QUICK_REACTIONS.includes(emoji)) {
    throw new Error(`reaction '${emoji}' is not on the whitelist`);
  }

  const cur = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, conversation_id, reactions")
    .eq("id", messageId)
    .maybeSingle();
  if (cur.error) {
    throw new Error(
      `peer-message-service.toggleMessageReaction lookup: ${cur.error.message}`,
    );
  }
  if (!cur.data) throw new Error("message not found");

  const row = cur.data as {
    id: NexUuid;
    conversation_id: NexUuid;
    reactions: NexPeerMessageReactions | null;
  };
  // Membership check · RLS also enforces this but a clear error is
  // kinder than a silent 0-row update.
  const conv = await getPeerConversationById(row.conversation_id);
  if (!conv) throw new Error("conversation not found");
  if (
    callerAccountId !== conv.participant_a_id &&
    callerAccountId !== conv.participant_b_id
  ) {
    throw new Error("only conversation participants can react");
  }

  const next: NexPeerMessageReactions = { ...(row.reactions ?? {}) };
  const list = next[emoji] ? [...next[emoji]!] : [];
  const idx = list.indexOf(callerAccountId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(callerAccountId);
  }
  if (list.length === 0) {
    delete next[emoji];
  } else {
    next[emoji] = list;
  }

  const upd = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ reactions: next })
    .eq("id", messageId);
  if (upd.error) {
    throw new Error(
      `peer-message-service.toggleMessageReaction update: ${upd.error.message}`,
    );
  }
  return next;
}

/**
 * Bridge 76 · Insert N encrypted rows atomically as one fan-out send.
 * ------------------------------------------------------------------
 * Every payload in `rows` must share the same conversation_id +
 * sender_account_id + message_group_id (the client is responsible for
 * grouping them correctly). The sentinel body '(encrypted)' is set
 * server-side so the existing shell + listing paths continue to work
 * without decrypting.
 *
 * Returns the inserted row ids so the caller can display an optimistic
 * bubble instantly, then flip it to "delivered" once ack broadcasts
 * come back from the recipient devices.
 */
export async function sendEncryptedPeerMessages(
  rows: EncryptedPeerMessageInsert[],
): Promise<NexUuid[]> {
  if (rows.length === 0) return [];

  const groupIds = new Set(rows.map((r) => r.message_group_id));
  if (groupIds.size !== 1) {
    throw new Error("sendEncryptedPeerMessages: all rows must share message_group_id");
  }
  const convIds = new Set(rows.map((r) => r.conversation_id));
  if (convIds.size !== 1) {
    throw new Error("sendEncryptedPeerMessages: all rows must share conversation_id");
  }
  const senderIds = new Set(rows.map((r) => r.sender_account_id));
  if (senderIds.size !== 1) {
    throw new Error("sendEncryptedPeerMessages: all rows must share sender_account_id");
  }

  const conv = await getPeerConversationById(rows[0]!.conversation_id);
  if (!conv) throw new Error("conversation not found");
  const sender = rows[0]!.sender_account_id;
  if (
    sender !== conv.participant_a_id &&
    sender !== conv.participant_b_id
  ) {
    throw new Error("only conversation participants can send messages");
  }

  // Postgres bytea is exchanged over PostgREST as base64-encoded text
  // (the \x prefix hex form doesn't round-trip cleanly on insert). The
  // Supabase client encodes Uint8Array → base64 automatically when the
  // column type is bytea, but we prefer to encode explicitly here so
  // the wire shape is predictable.
  const encode = (b: Uint8Array): string => bufferToBase64(b);

  const payload = rows.map((r) => ({
    conversation_id: r.conversation_id,
    sender_account_id: r.sender_account_id,
    body: "(encrypted)",
    encrypted: true,
    ciphertext: encode(r.ciphertext),
    nonce: encode(r.nonce),
    sender_public_key: r.sender_public_key,
    sender_device_id: r.sender_device_id,
    recipient_device_id: r.recipient_device_id,
    message_group_id: r.message_group_id,
    reply_to_id: r.reply_to_id ?? null,
    attachment_url: r.attachment_url ?? null,
    attachment_type: r.attachment_type ?? null,
    attachment_meta: r.attachment_meta ?? null,
  }));

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert(payload)
    .select("id");
  if (error) {
    throw new Error(`sendEncryptedPeerMessages: ${error.message}`);
  }

  // Bump last_message_at so conversation lists sort correctly.
  await touchPeerConversation(rows[0]!.conversation_id);

  return (data as Array<{ id: NexUuid }>).map((r) => r.id);
}

/** Mark an encrypted row as delivered after the recipient's client
 *  decrypts successfully · triggers Bridge 78 purge eligibility. */
export async function markPeerMessageDelivered(
  messageId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("delivered_at", null);
  if (error) {
    // best-effort · never throw from an ack path
    // eslint-disable-next-line no-console
    console.warn(`markPeerMessageDelivered soft-fail: ${error.message}`);
  }
}

/** Node-safe base64 encoder for Uint8Array · we can't rely on the
 *  browser's btoa here (service is `server-only`). */
function bufferToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Storage bucket that holds peer-chat attachments · created by
 *  migration 055 · public read, 25 MB cap, image/video/audio MIMEs. */
const NEX_PEER_ATTACHMENT_BUCKET = "nex-peer-chat-attachments";

/** Max upload size (bytes) · matches the bucket's file_size_limit. */
export const NEX_PEER_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/** MIME → kind classifier · rejects anything outside the whitelist. */
export function classifyPeerAttachmentMime(
  mime: string,
): NexPeerAttachmentKind | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return null;
}

/** Upload a file to the peer-chat attachments bucket. Returns the
 *  public URL + resolved kind + metadata so the caller can either
 *  attach it to a message right away or stash it in URL state and
 *  attach on next send. Throws on MIME rejection, size cap, or
 *  storage error. */
export async function uploadPeerAttachment(
  senderAccountId: NexUuid,
  file: File,
): Promise<{
  url: string;
  kind: NexPeerAttachmentKind;
  meta: NexPeerAttachmentMeta;
}> {
  if (file.size > NEX_PEER_ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `attachment exceeds ${NEX_PEER_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB cap`,
    );
  }
  const kind = classifyPeerAttachmentMime(file.type || "");
  if (!kind) {
    throw new Error(`attachment MIME '${file.type}' is not allowed`);
  }
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  };
  const ext = extMap[file.type.toLowerCase()] ?? "bin";
  // Path layout · senderId/timestamp-randomshort.ext · keeps every
  // sender's uploads in their own prefix (useful for future
  // per-sender cleanup) and avoids collision without a UUID lookup.
  const objectPath = `${senderAccountId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from(NEX_PEER_ATTACHMENT_BUCKET);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `peer-message-service.uploadPeerAttachment: ${error.message}`,
    );
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  const meta: NexPeerAttachmentMeta = {
    size_bytes: file.size,
    mime: file.type,
  };
  return { url: pub.publicUrl, kind, meta };
}

/** Count unread messages for a viewer across a specific conversation.
 *  Cheap · used for the chat surface unread pill. */
export async function countUnreadPeerMessages(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}
