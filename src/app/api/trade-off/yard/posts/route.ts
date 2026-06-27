// /api/trade-off/yard/posts
//
// GET  — list live Yard posts. Public (no auth). Query params:
//        country (default "UK"), kind, trade, region (substring match).
// POST — create a new Yard post. Body: { slug, token, ...post fields }.
//        Auth: magic-link edit_token matches the row + tier is
//        app_trial / app_paid. Auto-sets expires_at = now+14d.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import {
  YARD_TITLE_MAX,
  YARD_TITLE_MIN,
  YARD_BODY_MAX,
  YARD_BODY_MIN
} from "@/lib/yardPosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

const VALID_TRADE_SLUGS = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") ?? "UK").trim() || "UK";
  const kind = url.searchParams.get("kind") ?? "";
  const trade = url.searchParams.get("trade") ?? "";
  const region = url.searchParams.get("region") ?? "";
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50"))
  );

  let q = supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, trade_slug, title, body, country, region, start_date, end_date, crew_size_needed, day_rate_pence, is_sample, status, created_at, expires_at"
    )
    .eq("status", "live")
    .eq("country", country)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (kind === "available" || kind === "needed") q = q.eq("kind", kind);
  if (trade && VALID_TRADE_SLUGS.has(trade)) q = q.eq("trade_slug", trade);
  if (region) q = q.ilike("region", `%${region}%`);

  const res = await q;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  const posts = res.data ?? [];

  // Hydrate poster identity for cards: trading_name OR display_name,
  // primary_trade label, city, slug, whatsapp (for WA deep-link), avatar.
  const listingIds = Array.from(new Set(posts.map((p) => p.listing_id)));
  let posterMap: Record<
    string,
    {
      slug: string;
      display_name: string;
      trading_name: string | null;
      city: string | null;
      country: string | null;
      primary_trade: string;
      whatsapp: string;
      avatar_url: string | null;
    }
  > = {};
  if (listingIds.length > 0) {
    const lres = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, trading_name, city, country, primary_trade, whatsapp, avatar_url"
      )
      .in("id", listingIds);
    if (lres.data) {
      posterMap = Object.fromEntries(
        lres.data.map((l) => [
          l.id,
          {
            slug: l.slug,
            display_name: l.display_name,
            trading_name: l.trading_name,
            city: l.city,
            country: l.country,
            primary_trade: l.primary_trade,
            whatsapp: l.whatsapp,
            avatar_url: l.avatar_url
          }
        ])
      );
    }
  }

  return NextResponse.json({
    ok: true,
    posts,
    posters: posterMap,
    counts: {
      total: posts.length,
      available: posts.filter((p) => p.kind === "available").length,
      needed: posts.filter((p) => p.kind === "needed").length
    }
  });
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function dateOrNull(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  return str;
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const slug = s(payload.slug);
  const token = s(payload.token);
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or token" },
      { status: 400 }
    );
  }

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!constantTimeEq(token, row.data.edit_token ?? "")) {
    return NextResponse.json({ ok: false, error: "Bad token" }, { status: 403 });
  }

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  if (tier !== "app_paid" && tier !== "app_trial") {
    return NextResponse.json(
      { ok: false, error: "The Yard is for paid members. Upgrade to post." },
      { status: 402 }
    );
  }

  const kind = s(payload.kind);
  if (kind !== "available" && kind !== "needed") {
    return NextResponse.json(
      { ok: false, error: "kind must be 'available' or 'needed'" },
      { status: 400 }
    );
  }

  const tradeSlug = s(payload.trade_slug);
  if (!VALID_TRADE_SLUGS.has(tradeSlug)) {
    return NextResponse.json(
      { ok: false, error: "Invalid trade_slug" },
      { status: 400 }
    );
  }

  const title = s(payload.title);
  if (title.length < YARD_TITLE_MIN || title.length > YARD_TITLE_MAX) {
    return NextResponse.json(
      {
        ok: false,
        error: `Title must be ${YARD_TITLE_MIN}–${YARD_TITLE_MAX} chars`
      },
      { status: 400 }
    );
  }

  const body = s(payload.body);
  if (body.length < YARD_BODY_MIN || body.length > YARD_BODY_MAX) {
    return NextResponse.json(
      {
        ok: false,
        error: `Body must be ${YARD_BODY_MIN}–${YARD_BODY_MAX} chars`
      },
      { status: 400 }
    );
  }

  const country = s(payload.country) || "UK";
  const region = s(payload.region) || null;
  const start_date = dateOrNull(payload.start_date);
  const end_date = dateOrNull(payload.end_date);
  const crew_size_needed =
    kind === "needed" ? intOrNull(payload.crew_size_needed) : null;
  const day_rate_pence = intOrNull(payload.day_rate_pence);

  // 14-day auto-expire.
  const expires_at = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  const ins = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      listing_id: row.data.id,
      kind,
      trade_slug: tradeSlug,
      title,
      body,
      country,
      region,
      start_date,
      end_date,
      crew_size_needed,
      day_rate_pence,
      expires_at,
      is_sample: false,
      status: "live"
    })
    .select("id")
    .single();
  if (ins.error) {
    return NextResponse.json(
      { ok: false, error: ins.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: ins.data?.id });
}
