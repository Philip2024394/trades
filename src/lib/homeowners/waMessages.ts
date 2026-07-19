// SiteBook WhatsApp threads — server-side helpers.
//
// Homeowner writes a message in SiteBook → we save it → we open a
// wa.me deeplink with the pre-composed text → homeowner sends via
// WhatsApp. Outgoing capture is 100% (we composed it here first).
//
// Reply capture: every outgoing wa.me text includes a short footer
// with a nw.app/r/{token} link. Trade taps → public reply page →
// reply is written back onto the SAME thread (same post_id) as an
// inbound message. Full record chronologically.
//
// See migration 20260718150000_hammerex_sitebook_wa_threads.sql.

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { debitReveal }   from "./revealCredits";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type WaThread = {
  id:                   string;
  token:                string;
  post_id:              string;
  project_id:           string;
  homeowner_id:         string;
  trade_listing_id:     string | null;
  trade_merchant_slug:  string | null;
  trade_merchant_name:  string | null;
  trade_whatsapp_e164:  string | null;
  message_count:        number;
  last_activity_at:     string;
  revoked_at:           string | null;
  created_at:           string;
};

export type WaMessageDirection = "outgoing" | "inbound";
export type WaMessageSentVia   = "whatsapp" | "reply-link" | "paste-back";
export type WaMessageAuthorType = "homeowner" | "trade";

export type WaMessage = {
  id:                   string;
  thread_id:            string;
  direction:            WaMessageDirection;
  author_type:          WaMessageAuthorType;
  author_id:            string | null;
  author_display_name:  string;
  body:                 string;
  template_used:        string | null;
  sent_via:             WaMessageSentVia;
  created_at:           string;
};

// ------------------------------------------------------------
// Token generation
// ------------------------------------------------------------

// URL-safe alphabet, no ambiguous characters (no 0/O, 1/l/I).
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LEN      = 12;

export function generateThreadToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LEN);
  let out = "";
  for (let i = 0; i < TOKEN_LEN; i += 1) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

// ------------------------------------------------------------
// Thread lookup / creation
// ------------------------------------------------------------

/**
 * Find an existing thread for (post_id, trade_listing_id) OR create
 * one. Threads are 1:1 with a (post, trade) pair — reusable across
 * many messages so replies always land on the same conversation.
 */
export async function getOrCreateThread(input: {
  postId:           string;
  projectId:        string;
  homeownerId:      string;
  tradeListingId:   string;
  tradeSlug?:       string | null;
  tradeName?:       string | null;
  tradeWhatsapp?:   string | null;
}): Promise<{ ok: true; thread: WaThread; created: boolean } | { ok: false; error: string }> {
  // Look for existing thread on this (post, trade) pair
  const existing = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("*")
    .eq("post_id", input.postId)
    .eq("trade_listing_id", input.tradeListingId)
    .maybeSingle();

  if (existing.data) {
    return { ok: true, thread: existing.data as WaThread, created: false };
  }

  // Create new — retry once on the (astronomically unlikely) token collision
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateThreadToken();
    const ins = await supabaseAdmin
      .from("hammerex_sitebook_wa_threads")
      .insert({
        token,
        post_id:             input.postId,
        project_id:          input.projectId,
        homeowner_id:        input.homeownerId,
        trade_listing_id:    input.tradeListingId,
        trade_merchant_slug: input.tradeSlug || null,
        trade_merchant_name: input.tradeName || null,
        trade_whatsapp_e164: input.tradeWhatsapp || null
      })
      .select("*")
      .maybeSingle();

    if (ins.data) return { ok: true, thread: ins.data as WaThread, created: true };
    // Token collision or other error — try again with a fresh token
  }
  return { ok: false, error: "thread-create-failed" };
}

// ------------------------------------------------------------
// Send outgoing message + build wa.me URL
// ------------------------------------------------------------

const REPLY_LINK_BASE = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://thenetworkers.app";

/**
 * Compose the WhatsApp message text with the SiteBook footer +
 * reply-link. This is what gets pre-filled into wa.me — homeowner
 * hits send inside WhatsApp and this is what the trade receives.
 */
export function buildWhatsappText(input: {
  body:              string;
  homeownerFirstName?: string | null;
  siteBookNickname?: string | null;
  siteBookSlug?:     string | null;
  threadToken:       string;
}): string {
  const signature = input.homeownerFirstName || input.siteBookNickname || "SiteBook owner";
  const source    = input.siteBookNickname ? `${input.siteBookNickname}'s SiteBook` : "SiteBook";
  const replyUrl  = `${REPLY_LINK_BASE.replace(/\/$/, "")}/r/${input.threadToken}`;

  return `${input.body}\n\n— Sent from ${signature} via ${source}\nReply on WhatsApp or here: ${replyUrl}`;
}

export function buildWaMeUrl(input: { whatsappE164: string; text: string }): string {
  const stripped = input.whatsappE164.replace(/[^\d]/g, "");
  return `https://wa.me/${stripped}?text=${encodeURIComponent(input.text)}`;
}

/**
 * Full send flow — the homeowner composer calls this then opens the
 * returned waUrl. Idempotent per outgoing message (a fresh row every
 * call — no dedupe; homeowner can send multiple messages).
 */
export async function sendOutgoingMessage(input: {
  postId:              string;
  projectId:           string;
  homeownerId:         string;
  homeownerFirstName?: string | null;
  siteBookNickname?:   string | null;
  siteBookSlug?:       string | null;
  tradeListingId:      string;
  tradeSlug?:          string | null;
  tradeName?:          string | null;
  tradeWhatsapp:       string;
  body:                string;
  templateUsed?:       string | null;
}): Promise<
  | { ok: true; thread: WaThread; message: WaMessage; waUrl: string }
  | { ok: false; error: string }
> {
  if (!input.body?.trim())      return { ok: false, error: "empty-body" };
  if (!input.tradeWhatsapp)     return { ok: false, error: "missing-trade-whatsapp" };

  // Check if a thread already exists BEFORE creating one — if it does,
  // this is a follow-up message on an existing conversation and does
  // NOT cost a reveal credit. Only new (post, trade) pairs are billed.
  const preExisting = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("id")
    .eq("post_id", input.postId)
    .eq("trade_listing_id", input.tradeListingId)
    .maybeSingle();
  const willCreateThread = !preExisting.data;

  // Debit a reveal credit BEFORE creating the thread so we don't leak
  // credits on failed insertions. If the debit fails, bail before any
  // DB write happens.
  if (willCreateThread) {
    const debit = await debitReveal(input.homeownerId);
    if (!debit.ok) return { ok: false, error: debit.error };
  }

  const threadRes = await getOrCreateThread({
    postId:         input.postId,
    projectId:      input.projectId,
    homeownerId:    input.homeownerId,
    tradeListingId: input.tradeListingId,
    tradeSlug:      input.tradeSlug,
    tradeName:      input.tradeName,
    tradeWhatsapp:  input.tradeWhatsapp
  });
  if (!threadRes.ok) return { ok: false, error: threadRes.error };
  const thread = threadRes.thread;

  // Reject on revoked threads
  if (thread.revoked_at) return { ok: false, error: "thread-revoked" };

  const msgIns = await supabaseAdmin
    .from("hammerex_sitebook_wa_messages")
    .insert({
      thread_id:           thread.id,
      direction:           "outgoing",
      author_type:         "homeowner",
      author_id:           input.homeownerId,
      author_display_name: input.homeownerFirstName || "Homeowner",
      body:                input.body.trim(),
      template_used:       input.templateUsed || null,
      sent_via:            "whatsapp"
    })
    .select("*")
    .maybeSingle();

  if (msgIns.error || !msgIns.data) return { ok: false, error: "message-insert-failed" };
  const message = msgIns.data as WaMessage;

  // Also stamp a reply into the parent post so the feed shows the
  // outgoing message inline. This keeps the "record in one place"
  // promise — the post's reply thread IS the message log.
  await supabaseAdmin.from("hammerex_sitebook_post_replies").insert({
    post_id:     input.postId,
    author_type: "homeowner",
    author_id:   input.homeownerId,
    author_name: input.homeownerFirstName || "Homeowner",
    body:        `📤 WhatsApp → ${input.tradeName || "trade"}: ${input.body.trim()}`
  });

  const text  = buildWhatsappText({
    body:               input.body.trim(),
    homeownerFirstName: input.homeownerFirstName,
    siteBookNickname:   input.siteBookNickname,
    siteBookSlug:       input.siteBookSlug,
    threadToken:        thread.token
  });
  const waUrl = buildWaMeUrl({ whatsappE164: input.tradeWhatsapp, text });

  return { ok: true, thread, message, waUrl };
}

// ------------------------------------------------------------
// Inbound reply (from /r/{token} public page)
// ------------------------------------------------------------

/**
 * Look up a thread by its public token. Returns full thread + post
 * context so the reply page can render conversation history.
 */
export async function loadThreadByToken(token: string): Promise<
  | { ok: true; thread: WaThread; messages: WaMessage[] }
  | { ok: false; error: "not-found" | "revoked" }
> {
  const t = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!t.data) return { ok: false, error: "not-found" };

  const thread = t.data as WaThread;
  if (thread.revoked_at) return { ok: false, error: "revoked" };

  const m = await supabaseAdmin
    .from("hammerex_sitebook_wa_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  return { ok: true, thread, messages: (m.data as WaMessage[]) ?? [] };
}

/**
 * Trade posts a reply via the public /r/{token} page.
 * Also writes a reply into the parent post so it appears in the
 * homeowner's feed under the original message.
 */
export async function addInboundReply(input: {
  token:    string;
  body:     string;
}): Promise<{ ok: true; message: WaMessage } | { ok: false; error: string }> {
  if (!input.body?.trim()) return { ok: false, error: "empty-body" };
  if (input.body.length > 4000) return { ok: false, error: "too-long" };

  const t = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("*")
    .eq("token", input.token)
    .maybeSingle();
  if (!t.data) return { ok: false, error: "not-found" };
  const thread = t.data as WaThread;
  if (thread.revoked_at) return { ok: false, error: "revoked" };

  // Simple rate-limit: max 20 inbound replies per thread per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await supabaseAdmin
    .from("hammerex_sitebook_wa_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread.id)
    .eq("direction", "inbound")
    .gte("created_at", oneHourAgo);
  if ((recent.count ?? 0) >= 20) return { ok: false, error: "rate-limited" };

  const ins = await supabaseAdmin
    .from("hammerex_sitebook_wa_messages")
    .insert({
      thread_id:           thread.id,
      direction:           "inbound",
      author_type:         "trade",
      author_id:           thread.trade_listing_id,
      author_display_name: thread.trade_merchant_name || "Trade",
      body:                input.body.trim(),
      sent_via:            "reply-link"
    })
    .select("*")
    .maybeSingle();

  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  const message = ins.data as WaMessage;

  // Mirror onto parent post replies so it lands in the homeowner feed
  await supabaseAdmin.from("hammerex_sitebook_post_replies").insert({
    post_id:     thread.post_id,
    author_type: "trade",
    author_id:   thread.trade_listing_id,
    author_name: thread.trade_merchant_name || "Trade",
    body:        `📥 WhatsApp reply: ${input.body.trim()}`
  });

  return { ok: true, message };
}

// ------------------------------------------------------------
// Homeowner-side loaders
// ------------------------------------------------------------

/**
 * Load all threads + messages for a specific post. Used by the feed
 * card to render the outgoing/inbound conversation inline.
 */
export async function loadThreadsForPost(postId: string): Promise<
  Array<{ thread: WaThread; messages: WaMessage[] }>
> {
  const t = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  const threads = (t.data as WaThread[]) ?? [];
  if (!threads.length) return [];

  const m = await supabaseAdmin
    .from("hammerex_sitebook_wa_messages")
    .select("*")
    .in("thread_id", threads.map((x) => x.id))
    .order("created_at", { ascending: true });
  const byThread = new Map<string, WaMessage[]>();
  for (const msg of (m.data as WaMessage[]) ?? []) {
    const arr = byThread.get(msg.thread_id) ?? [];
    arr.push(msg);
    byThread.set(msg.thread_id, arr);
  }
  return threads.map((thread) => ({ thread, messages: byThread.get(thread.id) ?? [] }));
}

/**
 * Homeowner can kill a thread — reply page starts returning "revoked"
 * and future outgoing sends on the same (post, trade) will fail with
 * 'thread-revoked'. To restart, they'd need to create a new post.
 */
export async function revokeThread(threadId: string, homeownerId: string): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_wa_threads")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("homeowner_id", homeownerId)
    .select("id")
    .maybeSingle();
  return !!res.data;
}
