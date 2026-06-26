// POST /api/trade-off/projects/create
// Magic-link authenticated. Body: { slug, edit_token, title, description,
// before_url, during_url, after_url, location_city, completed_at }.
//
// Verifies the listing's edit_token via constant-time compare, then inserts
// a new hammerex_trade_off_projects row. sort_order = max(existing) + 1.
// verified always defaults to false — admins flip it manually.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

function strOrNull(v: unknown, max = 400): string | null {
  const t = s(v);
  if (!t) return null;
  return t.slice(0, max);
}

function dateOrNull(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  // Accept YYYY-MM-DD; reject anything else to keep the DB clean.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return t;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const title = s(body.title).slice(0, 160);
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Title is required." },
      { status: 400 }
    );
  }

  const before_url = strOrNull(body.before_url, 600);
  const during_url = strOrNull(body.during_url, 600);
  const after_url = strOrNull(body.after_url, 600);

  if (!before_url && !during_url && !after_url) {
    return NextResponse.json(
      { ok: false, error: "At least one of before/during/after photos is required." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 401 });
  }

  // Compute next sort_order = max(existing) + 1, starting from 0.
  const sortRow = await supabaseAdmin
    .from("hammerex_trade_off_projects")
    .select("sort_order")
    .eq("listing_id", listing.data.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort =
    sortRow.data && typeof sortRow.data.sort_order === "number"
      ? sortRow.data.sort_order + 1
      : 0;

  const insert = await supabaseAdmin
    .from("hammerex_trade_off_projects")
    .insert({
      listing_id: listing.data.id,
      title,
      description: strOrNull(body.description, 2000),
      before_url,
      during_url,
      after_url,
      location_city: strOrNull(body.location_city, 80),
      completed_at: dateOrNull(body.completed_at),
      verified: false,
      sort_order: nextSort
    })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    console.error("[trade-off/projects/create] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, project_id: insert.data.id });
}
