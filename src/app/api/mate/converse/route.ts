// POST /api/mate/converse
//
// The single conversation endpoint for Mate — merchant, homeowner,
// and visitor surfaces all funnel through here.
//
// Body:
//   { surface: "merchant"|"homeowner"|"visitor",
//     conversation_id?: uuid,   // omit for first turn — we create one
//     message: string,
//     canteen_slug?: string,   // required when surface="visitor"
//     homeowner_id?: string    // required when surface="homeowner"
//   }
//
// Response:
//   { ok: true, conversation_id, message_id, answer, usage,
//     cost_pence, model_used }
//
// Auth:
//   • merchant → signed merchant cookie required
//   • homeowner → signed homeowner cookie (tn_homeowner_sid) required
//   • visitor → anonymous but rate-limited by IP hash

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { askMate } from "@/lib/mate/agent";
import { getUserMemory, refreshUserMemory, shouldRefresh, conversationIdsForUser } from "@/lib/mate/memory";
import type { AnthropicMessage } from "@/lib/llm/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LEN = 1200;
const HISTORY_TURNS   = 8;   // last 8 user+assistant pairs

// Photo upload — base64 payload cap. Roughly 2.5MB decoded which is
// well under Vercel's 4.5MB Serverless body limit AND under Anthropic's
// 5MB per-image cap. Bigger images should be compressed client-side.
const MAX_IMAGE_BASE64_BYTES = 3_400_000; // ~2.5MB decoded
const ALLOWED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg", "image/png", "image/webp", "image/gif"
];

// Fair-use daily caps by surface. Prevents runaway cost.
// Merchant Pro tier bypasses this — check merchant.tier for
// unlimited (Business + Works).
const DAILY_CAP: Record<string, number> = {
  merchant:  50,
  homeowner: 20,
  visitor:   10
};

function hashIp(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "0.0.0.0";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

async function resolveUserKey(
  surface: string,
  req: NextRequest
): Promise<{ key: string; keyType: string } | null> {
  if (surface === "merchant") {
    const slug = await getMerchantSlug();
    return slug ? { key: slug, keyType: "merchant_slug" } : null;
  }
  if (surface === "homeowner") {
    // Verified via tn_homeowner_sid cookie — the client-side id is
    // ignored. If someone forges a body id they still need a valid
    // session cookie to get anywhere.
    const h = await getHomeownerFromCookie();
    return h ? { key: h.id, keyType: "homeowner_id" } : null;
  }
  return { key: hashIp(req), keyType: "anon_ip_hash" };
}

async function checkDailyCap(key: string, surface: string): Promise<{ over: boolean; used: number; cap: number }> {
  const cap = DAILY_CAP[surface] ?? 10;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("hammerex_mate_daily_usage")
    .select("messages_sent")
    .eq("user_key", key)
    .eq("usage_date", today)
    .maybeSingle();
  const used = data?.messages_sent ?? 0;
  return { over: used >= cap, used, cap };
}

async function bumpUsage(key: string, costPence: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin.rpc("hammerex_mate_bump_usage", {
    p_user_key: key,
    p_date: today,
    p_cost_pence: costPence
  }).then(() => {}, async () => {
    // Fallback if RPC isn't defined — do a direct upsert. Best
    // effort; overrun by 1 message is fine.
    const { data } = await supabaseAdmin
      .from("hammerex_mate_daily_usage")
      .select("messages_sent, cost_pence")
      .eq("user_key", key)
      .eq("usage_date", today)
      .maybeSingle();
    await supabaseAdmin
      .from("hammerex_mate_daily_usage")
      .upsert({
        user_key:      key,
        usage_date:    today,
        messages_sent: (data?.messages_sent ?? 0) + 1,
        cost_pence:    (data?.cost_pence    ?? 0) + costPence
      }, { onConflict: "user_key,usage_date" });
  });
}

async function loadHistory(conversationId: string): Promise<AnthropicMessage[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_mate_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS * 2);
  const rows = (data ?? []).reverse();
  return rows.map((r) => ({
    role:    r.role === "assistant" ? "assistant" : "user",
    content: r.content ?? ""
  })) as AnthropicMessage[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null) as {
    surface?:          string;
    conversation_id?:  string;
    message?:          string;
    canteen_slug?:     string;
    image_base64?:     string;
    image_media_type?: string;
  } | null;

  const surface        = String(body?.surface ?? "");
  const conversationId = body?.conversation_id ?? null;
  const message        = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE_LEN);
  const canteenSlug    = body?.canteen_slug ?? null;
  const imageBase64    = body?.image_base64 ?? "";
  const imageMediaType = body?.image_media_type ?? "";

  if (!["merchant", "homeowner", "visitor"].includes(surface)) {
    return NextResponse.json({ ok: false, error: "invalid_surface" }, { status: 400 });
  }
  // Message OR image required (photo-only turns are valid — "what's this?")
  if (!message && !imageBase64) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }

  // Validate image if attached
  let validatedImage: { base64: string; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | undefined;
  if (imageBase64) {
    if (!ALLOWED_IMAGE_TYPES.includes(imageMediaType)) {
      return NextResponse.json({ ok: false, error: "unsupported_image_type" }, { status: 400 });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
      return NextResponse.json({ ok: false, error: "image_too_large" }, { status: 413 });
    }
    validatedImage = {
      base64:     imageBase64,
      media_type: imageMediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
    };
  }
  if (surface === "visitor" && !canteenSlug) {
    return NextResponse.json({ ok: false, error: "canteen_slug_required" }, { status: 400 });
  }

  const user = await resolveUserKey(surface, req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const cap = await checkDailyCap(user.key, surface);
  if (cap.over) {
    return NextResponse.json({
      ok: false, error: "daily_cap_reached", used: cap.used, cap: cap.cap
    }, { status: 429 });
  }

  // Get-or-create the conversation row
  let convId = conversationId;
  if (!convId) {
    const { data: created, error: convErr } = await supabaseAdmin
      .from("hammerex_mate_conversations")
      .insert({
        surface,
        user_key:      user.key,
        user_key_type: user.keyType,
        canteen_slug:  canteenSlug
      })
      .select("id")
      .single();
    if (convErr || !created) {
      return NextResponse.json({ ok: false, error: convErr?.message ?? "conv_create_failed" }, { status: 500 });
    }
    convId = created.id;
  }

  const history = conversationId ? await loadHistory(conversationId) : [];

  // Save the user message first (image not persisted — costs storage
  // and we're not doing retrieval on old photos. Only the text stays.)
  await supabaseAdmin.from("hammerex_mate_messages").insert({
    conversation_id: convId,
    role:            "user",
    content:         message || "(sent a photo)",
    context_snapshot: validatedImage ? { has_image: true, image_media_type: validatedImage.media_type } : null
  });

  // Ask Mate
  const extras: { slug?: string; homeownerId?: string; canteenSlug?: string } = {};
  if (surface === "merchant")  extras.slug        = user.key;
  if (surface === "homeowner") extras.homeownerId = user.key;
  if (surface === "visitor")   extras.canteenSlug = canteenSlug ?? "";

  const result = await askMate({
    surface:             surface as "merchant" | "homeowner" | "visitor",
    userKey:             user.key,
    question:            message,
    conversationHistory: history,
    extras,
    image:               validatedImage
  });

  // Save Mate's reply (tool_calls persisted for admin observability
  // — see /admin/mate. UI cards travel back to the widget but are
  // NOT persisted; if the user reopens, they re-request via history).
  const { data: replyRow } = await supabaseAdmin.from("hammerex_mate_messages").insert({
    conversation_id:      convId,
    role:                 "assistant",
    content:              result.answer,
    model:                result.modelUsed,
    input_tokens:         result.usage.inputTokens,
    output_tokens:        result.usage.outputTokens,
    cache_read_tokens:    result.usage.cacheReadTokens,
    cache_created_tokens: result.usage.cacheCreationTokens,
    cost_pence:           result.costPence,
    latency_ms:           result.latencyMs,
    context_snapshot:     result.contextSnapshot,
    tool_calls:           result.toolCalls
  }).select("id").single();

  // Fire-and-forget usage bump — don't block the response
  bumpUsage(user.key, result.costPence).catch((e) => console.error("[mate/converse] usage bump failed:", e));

  // Cross-session memory refresh — fire-and-forget when enough new
  // messages have accumulated since the last refresh. Visitor skipped
  // inside refreshUserMemory (anonymous IP hashes).
  if (surface === "merchant" || surface === "homeowner") {
    (async () => {
      try {
        const mem   = await getUserMemory(surface as "merchant" | "homeowner", user.key);
        const ids   = await conversationIdsForUser(surface as "merchant" | "homeowner", user.key);
        const { count } = await supabaseAdmin
          .from("hammerex_mate_messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", ids);
        if (shouldRefresh(mem, count ?? 0)) {
          await refreshUserMemory(surface as "merchant" | "homeowner", user.key, ids);
        }
      } catch (e) {
        console.error("[mate/converse] memory refresh failed:", e);
      }
    })();
  }

  return NextResponse.json({
    ok:              true,
    conversation_id: convId,
    message_id:      replyRow?.id ?? null,
    answer:          result.answer,
    model_used:      result.modelUsed,
    cost_pence:      result.costPence,
    latency_ms:      result.latencyMs,
    tool_calls:      result.toolCalls,
    ui_cards:        result.uiCards
  });
}
