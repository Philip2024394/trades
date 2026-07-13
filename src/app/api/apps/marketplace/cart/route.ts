// GET  /api/apps/marketplace/cart — read the caller's server-backed cart.
// POST /api/apps/marketplace/cart — upsert a single item (add / increment).
// PUT  /api/apps/marketplace/cart — bulk-replace with a full item list
//   (used by the localStorage-drain merge on sign-up).
//
// The client mirrors this store into localStorage for offline resilience
// and instant renders; the server row is authoritative once fetched. If
// the server is unreachable the client falls back to the local cache.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type ItemPayload = {
  productId:    string;
  productSlug:  string;
  productName:  string;
  imageUrl?:    string;
  qty:          number;
  unit?:        string;
  unitPriceGbp: number;
  merchantSlug: string;
  merchantName: string;
};

function toItemRow(uid: string, i: ItemPayload) {
  return {
    trade_id:       uid,
    product_id:     String(i.productId),
    product_slug:   String(i.productSlug),
    product_name:   String(i.productName),
    image_url:      i.imageUrl ? String(i.imageUrl) : null,
    qty:            Math.max(1, Math.round(Number(i.qty))),
    unit:           i.unit ? String(i.unit) : null,
    unit_price_gbp: Math.max(0, Number(i.unitPriceGbp)),
    merchant_slug:  String(i.merchantSlug),
    merchant_name:  String(i.merchantName)
  };
}

function fromRow(r: {
  product_id:     string;
  product_slug:   string;
  product_name:   string;
  image_url:      string | null;
  qty:            number;
  unit:           string | null;
  unit_price_gbp: number | string;
  merchant_slug:  string;
  merchant_name:  string;
  added_at:       string;
}): ItemPayload & { addedAt: string } {
  return {
    productId:    r.product_id,
    productSlug:  r.product_slug,
    productName:  r.product_name,
    imageUrl:     r.image_url ?? undefined,
    qty:          Number(r.qty),
    unit:         r.unit ?? undefined,
    unitPriceGbp: Number(r.unit_price_gbp),
    merchantSlug: r.merchant_slug,
    merchantName: r.merchant_name,
    addedAt:      r.added_at
  };
}

async function requireUser() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ items: [] });

  const { data, error } = await supabaseAdmin
    .from("app_marketplace_cart_items")
    .select("product_id, product_slug, product_name, image_url, qty, unit, unit_price_gbp, merchant_slug, merchant_name, added_at")
    .eq("trade_id", user.id)
    .order("added_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map(fromRow) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: ItemPayload;
  try {
    payload = (await req.json()) as ItemPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload.productId || !payload.productSlug) {
    return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  const row = toItemRow(user.id, payload);
  // Additive semantics — if the row already exists, bump the qty by
  // the incoming amount rather than replace. Matches client-side
  // useGuestBasket.add() behaviour so both stores stay in step.
  const { data: existing } = await supabaseAdmin
    .from("app_marketplace_cart_items")
    .select("qty")
    .eq("trade_id", user.id)
    .eq("product_id", row.product_id)
    .maybeSingle();

  const newQty = existing ? Number(existing.qty) + row.qty : row.qty;
  const { error } = await supabaseAdmin
    .from("app_marketplace_cart_items")
    .upsert(
      { ...row, qty: newQty, updated_at: new Date().toISOString() },
      { onConflict: "trade_id,product_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  // Bulk replace — used ONLY by the guest-basket merge on sign-up so
  // localStorage items land server-side in one shot. Additive: each
  // incoming item is upserted, existing items untouched (so a returning
  // user who signs up on a second device doesn't lose their prior
  // authed cart).
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: { items?: ItemPayload[] };
  try {
    payload = (await req.json()) as { items?: ItemPayload[] };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return NextResponse.json({ ok: true, merged: 0 });

  const rows = items
    .filter((i) => i.productId && i.productSlug)
    .map((i) => toItemRow(user.id, i));

  // For each incoming row, add its qty to any existing row (additive)
  // rather than replace. Small N so a per-row upsert loop is fine.
  for (const row of rows) {
    const { data: existing } = await supabaseAdmin
      .from("app_marketplace_cart_items")
      .select("qty")
      .eq("trade_id", user.id)
      .eq("product_id", row.product_id)
      .maybeSingle();
    const newQty = existing ? Number(existing.qty) + row.qty : row.qty;
    await supabaseAdmin
      .from("app_marketplace_cart_items")
      .upsert(
        { ...row, qty: newQty, updated_at: new Date().toISOString() },
        { onConflict: "trade_id,product_id" }
      );
  }

  return NextResponse.json({ ok: true, merged: rows.length });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  if (productId) {
    // Delete a single item.
    const { error } = await supabaseAdmin
      .from("app_marketplace_cart_items")
      .delete()
      .eq("trade_id", user.id)
      .eq("product_id", productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // No productId = clear whole cart (e.g. post-checkout for the current
  // merchant slice needs the caller to specify merchantSlug instead).
  const merchantSlug = url.searchParams.get("merchantSlug");
  if (merchantSlug) {
    const { error } = await supabaseAdmin
      .from("app_marketplace_cart_items")
      .delete()
      .eq("trade_id", user.id)
      .eq("merchant_slug", merchantSlug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from("app_marketplace_cart_items")
    .delete()
    .eq("trade_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
