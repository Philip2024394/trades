// /api/trade-off/quotes
//
// GET  — list authed listing's quotes. Query: slug, token, status (optional).
// POST — create a quote. Body: slug, token, customer_name, customer_phone,
//        customer_email, service_name, quote_amount_pence, follow_up_at,
//        notes, status.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { effectiveTier } from "@/lib/xratedTrades";
import { isAddonEnabled } from "@/lib/xratedAddons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function authorise(slug: string, token: string) {
  if (!slug || !token) {
    return { ok: false as const, status: 400, error: "Missing slug or token" };
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at, addons_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return { ok: false as const, status: 404, error: "Listing not found" };
  }
  if (!constantTimeEq(token, row.data.edit_token ?? "")) {
    return { ok: false as const, status: 403, error: "Bad token" };
  }
  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid) {
    return {
      ok: false as const,
      status: 402,
      error: "Quote Pipeline is a paid add-on. Upgrade to use it."
    };
  }
  const addonsMap =
    row.data.addons_enabled && typeof row.data.addons_enabled === "object"
      ? (row.data.addons_enabled as Record<string, boolean>)
      : {};
  if (!isAddonEnabled({ addons_enabled: addonsMap }, "quote_pipeline")) {
    return {
      ok: false as const,
      status: 402,
      error: "Quote Pipeline is not enabled on this profile."
    };
  }
  return { ok: true as const, listingId: row.data.id };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = s(url.searchParams.get("slug"));
  const token = s(url.searchParams.get("token"));
  const status = s(url.searchParams.get("status"));

  const auth = await authorise(slug, token);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }
  let q = supabaseAdmin
    .from("hammerex_xrated_quotes")
    .select("*")
    .eq("listing_id", auth.listingId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (
    status === "sent" ||
    status === "chasing" ||
    status === "accepted" ||
    status === "lost"
  ) {
    q = q.eq("status", status);
  }
  const res = await q;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, quotes: res.data ?? [] });
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
  const auth = await authorise(slug, token);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }
  const customer_name = s(payload.customer_name);
  if (!customer_name) {
    return NextResponse.json(
      { ok: false, error: "Customer name is required" },
      { status: 400 }
    );
  }
  const customer_phone = s(payload.customer_phone) || null;
  const customer_email = s(payload.customer_email) || null;
  const service_name = s(payload.service_name) || null;
  const quote_amount_pence = intOrNull(payload.quote_amount_pence);
  const follow_up_at = dateOrNull(payload.follow_up_at);
  const notes = s(payload.notes) || null;
  const status = s(payload.status) || "sent";
  if (!["sent", "chasing", "accepted", "lost"].includes(status)) {
    return NextResponse.json(
      { ok: false, error: "Invalid status" },
      { status: 400 }
    );
  }
  const ins = await supabaseAdmin
    .from("hammerex_xrated_quotes")
    .insert({
      listing_id: auth.listingId,
      customer_name,
      customer_phone,
      customer_email,
      service_name,
      quote_amount_pence,
      follow_up_at,
      notes,
      status,
      won_at: status === "accepted" ? new Date().toISOString() : null,
      lost_at: status === "lost" ? new Date().toISOString() : null
    })
    .select("*")
    .single();
  if (ins.error) {
    return NextResponse.json(
      { ok: false, error: ins.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, quote: ins.data });
}
