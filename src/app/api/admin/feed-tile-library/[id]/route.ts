// /api/admin/feed-tile-library/[id]
//
// PATCH  → update a single row (partial fields)
// DELETE → soft-delete (set active=false); pass ?hard=1 to actually remove

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_TONES = new Set(["white", "black", "gray"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  let body: Partial<{
    url:         string;
    alt:         string;
    trade_slugs: string[];
    text_tone:   string;
    active:      boolean;
    slug:        string;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.slug !== undefined) {
    if (!/^[a-z0-9-]{2,64}$/.test(body.slug)) {
      return NextResponse.json({ ok: false, error: "invalid-slug" }, { status: 400 });
    }
    patch.slug = body.slug;
  }
  if (body.url !== undefined) {
    if (!/^https?:\/\/[^\s]+$/i.test(body.url)) {
      return NextResponse.json({ ok: false, error: "invalid-url" }, { status: 400 });
    }
    patch.url = body.url;
  }
  if (body.alt !== undefined) {
    if (typeof body.alt !== "string" || body.alt.trim().length < 3) {
      return NextResponse.json({ ok: false, error: "invalid-alt" }, { status: 400 });
    }
    patch.alt = body.alt.trim();
  }
  if (body.trade_slugs !== undefined) {
    if (!Array.isArray(body.trade_slugs) || body.trade_slugs.length === 0) {
      return NextResponse.json({ ok: false, error: "invalid-trade-slugs" }, { status: 400 });
    }
    patch.trade_slugs = body.trade_slugs.filter((s) => typeof s === "string" && s.length > 0);
  }
  if (body.text_tone !== undefined) {
    if (!VALID_TONES.has(body.text_tone)) {
      return NextResponse.json({ ok: false, error: "invalid-text-tone" }, { status: 400 });
    }
    patch.text_tone = body.text_tone;
  }
  if (body.active !== undefined) {
    patch.active = Boolean(body.active);
  }

  const upd = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .update(patch)
    .eq("id", id)
    .select("id, slug")
    .single();
  if (upd.error) {
    return NextResponse.json({ ok: false, error: "db-update-failed", detail: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: upd.data.id, slug: upd.data.slug });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  if (hard) {
    const del = await supabaseAdmin
      .from("hammerex_feed_tile_library")
      .delete()
      .eq("id", id);
    if (del.error) {
      return NextResponse.json({ ok: false, error: "db-delete-failed", detail: del.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "hard" });
  }

  const upd = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (upd.error) {
    return NextResponse.json({ ok: false, error: "db-update-failed", detail: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mode: "soft" });
}
