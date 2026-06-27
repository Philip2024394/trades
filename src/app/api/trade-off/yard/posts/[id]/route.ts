// /api/trade-off/yard/posts/:id
//
// PATCH  — edit own post. Body: { slug, token, ...fields }.
// DELETE — soft-archive own post. Body: { slug, token }.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  YARD_TITLE_MAX,
  YARD_TITLE_MIN,
  YARD_BODY_MAX,
  YARD_BODY_MIN
} from "@/lib/yardPosts";

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

async function authorise(
  id: string,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; listingId: string; postId: string }
  | { ok: false; status: number; error: string }
> {
  const slug = s(payload.slug);
  const token = s(payload.token);
  if (!slug || !token) {
    return { ok: false, status: 400, error: "Missing slug or token" };
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return { ok: false, status: 404, error: "Listing not found" };
  }
  if (!constantTimeEq(token, listing.data.edit_token ?? "")) {
    return { ok: false, status: 403, error: "Bad token" };
  }

  const post = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, listing_id, is_sample")
    .eq("id", id)
    .maybeSingle();
  if (!post.data) {
    return { ok: false, status: 404, error: "Post not found" };
  }
  if (post.data.listing_id !== listing.data.id) {
    return { ok: false, status: 403, error: "Not your post" };
  }
  if (post.data.is_sample) {
    return { ok: false, status: 403, error: "Sample posts are read-only" };
  }
  return { ok: true, listingId: listing.data.id, postId: post.data.id };
}

export async function PATCH(
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

  const auth = await authorise(id, payload);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const updates: Record<string, unknown> = {};

  if ("title" in payload) {
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
    updates.title = title;
  }
  if ("body" in payload) {
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
    updates.body = body;
  }
  if ("region" in payload) updates.region = s(payload.region) || null;
  if ("start_date" in payload)
    updates.start_date = dateOrNull(payload.start_date);
  if ("end_date" in payload) updates.end_date = dateOrNull(payload.end_date);
  if ("crew_size_needed" in payload)
    updates.crew_size_needed = intOrNull(payload.crew_size_needed);
  if ("day_rate_pence" in payload)
    updates.day_rate_pence = intOrNull(payload.day_rate_pence);
  if ("status" in payload) {
    const status = s(payload.status);
    if (status !== "live" && status !== "archived") {
      return NextResponse.json(
        { ok: false, error: "status must be 'live' or 'archived'" },
        { status: 400 }
      );
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const up = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update(updates)
    .eq("id", auth.postId);
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

  const auth = await authorise(id, payload);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  // Hard delete real posts. Sample posts are blocked by authorise().
  const del = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .delete()
    .eq("id", auth.postId);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
