// /api/trade-off/yard/posts/:id/reactions
//
// POST   — set or change reaction. Body: { slug, token, kind }.
//          Builder-grade trades skip the paid-tier gate (free Yard
//          access for general-builder, building-merchant, etc.).
// DELETE — remove caller's reaction. Body: { slug, token }.
// GET    — return counts per kind for this post.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { effectiveTier } from "@/lib/xratedTrades";
import { YARD_REACTION_KINDS } from "@/lib/yardReactions";
import { isBuilderGradeTrade } from "@/lib/yardAccess";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function authorise(payload: Record<string, unknown>): Promise<
  | { ok: true; listingId: string }
  | { ok: false; status: number; error: string }
> {
  const slug = s(payload.slug);
  const token = s(payload.token);
  if (!slug || !token) {
    return { ok: false, status: 400, error: "Missing slug or token" };
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at, primary_trade")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return { ok: false, status: 404, error: "Listing not found" };
  }
  if (!constantTimeEq(token, row.data.edit_token ?? "")) {
    return { ok: false, status: 403, error: "Bad token" };
  }
  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const builderFree = isBuilderGradeTrade(row.data.primary_trade);
  const allowed = tier === "app_paid" || tier === "app_trial" || builderFree;
  if (!allowed) {
    return {
      ok: false,
      status: 402,
      error: "The Yard is for paid members. Upgrade to react."
    };
  }
  return { ok: true, listingId: row.data.id };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_yard_post_reactions")
    .select("kind")
    .eq("post_id", id);
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  const counts: Record<string, number> = {};
  for (const r of res.data ?? []) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return NextResponse.json({ ok: true, counts });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const auth = await authorise(payload);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }
  const kind = s(payload.kind);
  if (!YARD_REACTION_KINDS.includes(kind as never)) {
    return NextResponse.json(
      { ok: false, error: "Invalid kind" },
      { status: 400 }
    );
  }
  // Upsert by (post_id, listing_id). If a row exists, switch its kind;
  // if not, insert a new one.
  const up = await supabaseAdmin
    .from("hammerex_trade_off_yard_post_reactions")
    .upsert(
      { post_id: id, listing_id: auth.listingId, kind },
      { onConflict: "post_id,listing_id" }
    );
  if (up.error) {
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const auth = await authorise(payload);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }
  const del = await supabaseAdmin
    .from("hammerex_trade_off_yard_post_reactions")
    .delete()
    .eq("post_id", id)
    .eq("listing_id", auth.listingId);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
