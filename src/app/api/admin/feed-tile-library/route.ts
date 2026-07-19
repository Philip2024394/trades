// /api/admin/feed-tile-library
//
// GET  → list all rows (admin panel)
// POST → create a new library entry
//
// Auth: admin-only in production (currently gated by the admin
// session cookie via the (authed) group; the /api endpoint checks
// the same cookie).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_TONES = new Set(["white", "black", "gray"]);

type Row = {
  id:          string;
  slug:        string;
  url:         string;
  alt:         string;
  trade_slugs: string[];
  text_tone:   "white" | "black" | "gray";
  active:      boolean;
  posted_by:   string;
  created_at:  string;
  updated_at:  string;
};

export async function GET() {
  const res = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("id, slug, url, alt, trade_slugs, text_tone, active, posted_by, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (res.error) {
    return NextResponse.json({ ok: false, error: "db-read-failed", detail: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rows: (res.data ?? []) as Row[] });
}

export async function POST(req: Request) {
  let body: {
    slug?:        string;
    url?:         string;
    alt?:         string;
    trade_slugs?: string[];
    text_tone?:   string;
    active?:      boolean;
    posted_by?:   string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  if (!body.slug || !/^[a-z0-9-]{2,64}$/.test(body.slug)) {
    return NextResponse.json({ ok: false, error: "invalid-slug", detail: "kebab-case a-z0-9 only" }, { status: 400 });
  }
  if (!body.url || !/^https?:\/\/[^\s]+$/i.test(body.url)) {
    return NextResponse.json({ ok: false, error: "invalid-url" }, { status: 400 });
  }
  if (!body.alt || body.alt.trim().length < 3) {
    return NextResponse.json({ ok: false, error: "invalid-alt", detail: "min 3 chars" }, { status: 400 });
  }
  const trades = Array.isArray(body.trade_slugs) ? body.trade_slugs.filter((s) => typeof s === "string" && s.length > 0) : [];
  if (trades.length === 0) {
    return NextResponse.json({ ok: false, error: "invalid-trade-slugs", detail: "at least one trade required" }, { status: 400 });
  }
  const tone = body.text_tone ?? "white";
  if (!VALID_TONES.has(tone)) {
    return NextResponse.json({ ok: false, error: "invalid-text-tone" }, { status: 400 });
  }

  const ins = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .insert({
      slug:        body.slug,
      url:         body.url,
      alt:         body.alt.trim(),
      trade_slugs: trades,
      text_tone:   tone,
      active:      body.active ?? true,
      posted_by:   body.posted_by ?? "admin"
    })
    .select("id, slug")
    .single();
  if (ins.error) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: ins.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: ins.data.id, slug: ins.data.slug });
}
