// GET  /api/apps/notebook/basket   — read the trade's current basket
// POST /api/apps/notebook/basket   — upsert one item (add or replace)
//
// The basket is a draft holding pen. On submit it snapshots into a
// quote_request and clears here.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";
import { publish } from "@/lib/os/events/bus";

export const dynamic = "force-dynamic";

const TABLE = "app_notebook_quote_basket_items";

export async function GET() {
  const { tradeId } = await getTradeSession();
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const { tradeId } = await getTradeSession();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const required = ["itemKey", "productName", "qty", "unit", "merchantSlug", "merchantName", "productSlug", "unitPriceGbp"] as const;
  for (const k of required) {
    if (payload[k] === undefined) {
      return NextResponse.json({ error: `missing_${k}` }, { status: 400 });
    }
  }

  const row = {
    trade_id:       tradeId,
    item_key:       String(payload.itemKey),
    product_name:   String(payload.productName),
    spec:           payload.spec ? String(payload.spec) : null,
    image_url:      payload.imageUrl ? String(payload.imageUrl) : null,
    qty:            Math.max(1, Math.min(9999, Number(payload.qty))),
    unit:           String(payload.unit),
    merchant_slug:  String(payload.merchantSlug),
    merchant_name:  String(payload.merchantName),
    product_slug:   String(payload.productSlug),
    unit_price_gbp: Number(payload.unitPriceGbp)
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(row, { onConflict: "trade_id,item_key" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publish({
    eventType:       "notebook.basket.item_added",
    publisherApp:    "notebook",
    dedupKey:        `notebook-basket-${tradeId}-${row.item_key}-${Date.now()}`,
    actorBusinessId: tradeId,
    subjectType:     "notebook_basket_item",
    subjectId:       data.id,
    payload: {
      itemKey:      row.item_key,
      productName:  row.product_name,
      merchantSlug: row.merchant_slug,
      qty:          row.qty,
      unitPriceGbp: row.unit_price_gbp
    }
  }).catch(() => null);

  return NextResponse.json({ item: data });
}
