// /api/trade-off/quotes/:id — PATCH (move status / edit) + DELETE.

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

async function authorise(id: string, payload: Record<string, unknown>) {
  const slug = s(payload.slug);
  const token = s(payload.token);
  if (!slug || !token) {
    return { ok: false as const, status: 400, error: "Missing slug or token" };
  }
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return { ok: false as const, status: 404, error: "Listing not found" };
  }
  if (!constantTimeEq(token, listing.data.edit_token ?? "")) {
    return { ok: false as const, status: 403, error: "Bad token" };
  }
  const quote = await supabaseAdmin
    .from("hammerex_xrated_quotes")
    .select("id, listing_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!quote.data) {
    return { ok: false as const, status: 404, error: "Quote not found" };
  }
  if (quote.data.listing_id !== listing.data.id) {
    return { ok: false as const, status: 403, error: "Not your quote" };
  }
  return { ok: true as const, quoteId: quote.data.id };
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
  if ("customer_name" in payload) {
    const v = s(payload.customer_name);
    if (!v) {
      return NextResponse.json(
        { ok: false, error: "Customer name cannot be empty" },
        { status: 400 }
      );
    }
    updates.customer_name = v;
  }
  if ("customer_phone" in payload) updates.customer_phone = s(payload.customer_phone) || null;
  if ("customer_email" in payload) updates.customer_email = s(payload.customer_email) || null;
  if ("service_name" in payload) updates.service_name = s(payload.service_name) || null;
  if ("quote_amount_pence" in payload)
    updates.quote_amount_pence = intOrNull(payload.quote_amount_pence);
  if ("follow_up_at" in payload) updates.follow_up_at = dateOrNull(payload.follow_up_at);
  if ("notes" in payload) updates.notes = s(payload.notes) || null;
  if ("lost_reason" in payload) updates.lost_reason = s(payload.lost_reason) || null;
  if ("status" in payload) {
    const v = s(payload.status);
    if (!["sent", "chasing", "accepted", "lost"].includes(v)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status" },
        { status: 400 }
      );
    }
    updates.status = v;
    if (v === "accepted") {
      updates.won_at = new Date().toISOString();
      updates.lost_at = null;
    } else if (v === "lost") {
      updates.lost_at = new Date().toISOString();
      updates.won_at = null;
    } else {
      updates.won_at = null;
      updates.lost_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const up = await supabaseAdmin
    .from("hammerex_xrated_quotes")
    .update(updates)
    .eq("id", auth.quoteId);
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
  const del = await supabaseAdmin
    .from("hammerex_xrated_quotes")
    .delete()
    .eq("id", auth.quoteId);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
