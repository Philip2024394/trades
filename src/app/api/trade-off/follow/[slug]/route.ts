// POST /api/trade-off/follow/[slug]     — follow the trade at :slug
// DELETE /api/trade-off/follow/[slug]   — unfollow
// GET /api/trade-off/follow/[slug]      — { followerCount, isFollowing }
//
// Auth: POST/DELETE need magic-link (viewer's slug + edit_token in the
// body). GET is public but returns isFollowing only if the caller
// passes their auth via query params.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

type Ctx = { params: Promise<{ slug: string }> };

async function loadTarget(slug: string) {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, status, follower_count")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

async function loadCaller(
  slug: string | null,
  token: string | null
): Promise<{ id: string } | null> {
  if (!slug || !token) return null;
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "live") return null;
  if (!constantTimeEq(data.edit_token, token)) return null;
  return { id: data.id };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const target = await loadTarget(slug);
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }
  const callerSlug = req.nextUrl.searchParams.get("caller_slug");
  const callerToken = req.nextUrl.searchParams.get("caller_token");
  const caller = await loadCaller(callerSlug, callerToken);

  let isFollowing = false;
  if (caller && caller.id !== target.id) {
    const { data: existing } = await supabaseAdmin
      .from("hammerex_trade_followers")
      .select("id")
      .eq("follower_listing_id", caller.id)
      .eq("followed_listing_id", target.id)
      .maybeSingle();
    isFollowing = !!existing;
  }

  return NextResponse.json(
    {
      ok: true,
      followerCount: target.follower_count ?? 0,
      isFollowing
    },
    {
      headers: {
        "Cache-Control":
          caller || callerSlug
            ? "no-store"
            : "public, s-maxage=15, stale-while-revalidate=60"
      }
    }
  );
}

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const callerSlug = s(body.slug).trim();
  const callerToken = s(body.edit_token).trim();

  const caller = await loadCaller(callerSlug, callerToken);
  if (!caller) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  const target = await loadTarget(slug);
  if (!target || target.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }
  if (target.id === caller.id) {
    return NextResponse.json(
      { ok: false, error: "self_follow" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("hammerex_trade_followers")
    .upsert(
      {
        follower_listing_id: caller.id,
        followed_listing_id: target.id
      },
      { onConflict: "follower_listing_id,followed_listing_id" }
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Log a personal "you gained a follower" event to the target so
  // they see their audience grow.
  await supabaseAdmin.from("os_activity_events").insert({
    kind: "follower_gained",
    subject_type: "listing",
    subject_id: caller.id,
    recipient_listing_id: target.id,
    source_listing_id: caller.id,
    summary_text: "You gained a new follower.",
    action_url: null
  });

  // Read fresh count (trigger has already updated).
  const { data: refreshed } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("follower_count")
    .eq("id", target.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    isFollowing: true,
    followerCount: refreshed?.follower_count ?? target.follower_count ?? 0
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const callerSlug = s(body.slug).trim();
  const callerToken = s(body.edit_token).trim();
  const caller = await loadCaller(callerSlug, callerToken);
  if (!caller) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  const target = await loadTarget(slug);
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }
  const { error } = await supabaseAdmin
    .from("hammerex_trade_followers")
    .delete()
    .eq("follower_listing_id", caller.id)
    .eq("followed_listing_id", target.id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }
  const { data: refreshed } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("follower_count")
    .eq("id", target.id)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    isFollowing: false,
    followerCount: refreshed?.follower_count ?? 0
  });
}
