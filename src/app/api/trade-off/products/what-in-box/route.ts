// POST /api/trade-off/products/what-in-box
//   { slug, edit_token, product_id, items: [{label, qty?, image_url?, sort_order?}] }
//
// Same replace-all pattern as /pair-with. Client sends the full item
// list every save; server deletes existing + inserts fresh. Keeps the
// editor state a plain array.
//
// Guards:
//   • Auth via slug + edit_token (constant-time compare)
//   • Anchor product must belong to the trade's listing
//   • Cap at 30 rows per product
//   • label 1–120 chars, qty 1–999
//   • image_url URL-shaped only, capped at 600 chars
//
// GET /api/trade-off/products/what-in-box?slug=&edit_token=&product_id=
// returns the current rows (used by the editor to seed state).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 30;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function resolveListing(slug: string, token: string) {
  if (!slug || !token) {
    return { error: "Missing slug or edit_token." as const, status: 400 };
  }
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!res.data) {
    return { error: "Listing not found." as const, status: 404 };
  }
  if (!constantTimeEq(res.data.edit_token, token)) {
    return { error: "Invalid edit token." as const, status: 403 };
  }
  return { listingId: res.data.id as string };
}

async function verifyAnchor(productId: string, listingId: string) {
  const anchor = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .eq("id", productId)
    .maybeSingle();
  return !!anchor.data && anchor.data.listing_id === listingId;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = s(url.searchParams.get("slug"));
  const token = s(url.searchParams.get("edit_token"));
  const productId = s(url.searchParams.get("product_id"));
  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid product_id" },
      { status: 400 }
    );
  }
  const gate = await resolveListing(slug, token);
  if ("error" in gate) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status }
    );
  }
  if (!(await verifyAnchor(productId, gate.listingId))) {
    return NextResponse.json(
      { ok: false, error: "product_not_yours" },
      { status: 404 }
    );
  }
  const boxRes = await supabaseAdmin
    .from("hammerex_xrated_what_in_box")
    .select("id, label, qty, image_url, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  return NextResponse.json({ ok: true, items: boxRes.data ?? [] });
}

type ItemIn = {
  label?: unknown;
  qty?: unknown;
  image_url?: unknown;
  sort_order?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const productId = s(body.product_id);
  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid product_id" },
      { status: 400 }
    );
  }
  const rawItems = Array.isArray(body.items) ? (body.items as ItemIn[]) : [];
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { ok: false, error: `Cap ${MAX_ITEMS} items per product.` },
      { status: 400 }
    );
  }

  const gate = await resolveListing(slug, token);
  if ("error" in gate) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status }
    );
  }
  if (!(await verifyAnchor(productId, gate.listingId))) {
    return NextResponse.json(
      { ok: false, error: "product_not_yours" },
      { status: 404 }
    );
  }

  const cleaned: Array<{
    label: string;
    qty: number;
    image_url: string | null;
    sort_order: number;
  }> = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    const label = s(it.label).slice(0, 120);
    if (label.length === 0) continue;
    const qtyRaw =
      typeof it.qty === "number" ? it.qty : Number(s(it.qty)) || 1;
    const qty =
      Number.isFinite(qtyRaw) && qtyRaw >= 1 && qtyRaw <= 999
        ? Math.round(qtyRaw)
        : 1;
    const url = s(it.image_url);
    const image_url =
      url.length > 0 && /^https?:\/\//i.test(url) ? url.slice(0, 600) : null;
    const so =
      typeof it.sort_order === "number" && Number.isFinite(it.sort_order)
        ? Math.max(0, Math.round(it.sort_order))
        : i;
    cleaned.push({ label, qty, image_url, sort_order: so });
  }

  const del = await supabaseAdmin
    .from("hammerex_xrated_what_in_box")
    .delete()
    .eq("product_id", productId);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: del.error.message },
      { status: 500 }
    );
  }

  if (cleaned.length > 0) {
    const ins = await supabaseAdmin
      .from("hammerex_xrated_what_in_box")
      .insert(cleaned.map((c) => ({ product_id: productId, ...c })));
    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: "insert_failed", detail: ins.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, saved: cleaned.length });
}
