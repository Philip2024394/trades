// Shared helpers between /api/mate/converse (sync) and
// /api/mate/converse/stream. Keeps auth + cap + image validation +
// history loading in one place.

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import type { AnthropicMessage } from "@/lib/llm/anthropic";

export const MAX_MESSAGE_LEN         = 1200;
export const HISTORY_TURNS           = 8;
export const MAX_IMAGE_BASE64_BYTES  = 3_400_000;
export const ALLOWED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg", "image/png", "image/webp", "image/gif"
];

export const DAILY_CAP: Record<string, number> = {
  merchant: 50, homeowner: 20, visitor: 10
};
const UNCAPPED_TIERS = new Set(["business", "works"]);

export type MateSurface = "merchant" | "homeowner" | "visitor";
export type MateImage = { base64: string; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

export function hashIp(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "0.0.0.0";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export async function resolveUserKey(
  surface: string,
  req: NextRequest
): Promise<{ key: string; keyType: string } | null> {
  if (surface === "merchant") {
    const slug = await getMerchantSlug();
    return slug ? { key: slug, keyType: "merchant_slug" } : null;
  }
  if (surface === "homeowner") {
    const h = await getHomeownerFromCookie();
    return h ? { key: h.id, keyType: "homeowner_id" } : null;
  }
  return { key: hashIp(req), keyType: "anon_ip_hash" };
}

export async function isMerchantUncapped(slug: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("tier")
    .eq("slug", slug)
    .maybeSingle();
  const tier = String(data?.tier ?? "").toLowerCase();
  return UNCAPPED_TIERS.has(tier);
}

export async function checkDailyCap(key: string, surface: string): Promise<{ over: boolean; used: number; cap: number }> {
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

export async function bumpUsage(key: string, costPence: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin.rpc("hammerex_mate_bump_usage", {
    p_user_key: key, p_date: today, p_cost_pence: costPence
  }).then(() => {}, async () => {
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

export async function loadHistory(conversationId: string): Promise<AnthropicMessage[]> {
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

export function validateImage(imageBase64: string, imageMediaType: string): MateImage | NextResponse | null {
  if (!imageBase64) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(imageMediaType)) {
    return NextResponse.json({ ok: false, error: "unsupported_image_type" }, { status: 400 });
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return NextResponse.json({ ok: false, error: "image_too_large" }, { status: 413 });
  }
  return {
    base64: imageBase64,
    media_type: imageMediaType as MateImage["media_type"]
  };
}

export function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
