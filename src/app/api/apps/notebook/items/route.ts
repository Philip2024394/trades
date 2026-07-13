// GET  /api/apps/notebook/items       — list the trade's notebook
// POST /api/apps/notebook/items       — add a new item

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";

export const dynamic = "force-dynamic";

const TABLE = "app_notebook_items";

export async function GET() {
  const { tradeId } = await getTradeSession();
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("trade_id", tradeId)
    .eq("archived", false)
    .order("sort_order", { ascending: true })
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

  const productName = String(payload.productName ?? "").trim();
  if (!productName) return NextResponse.json({ error: "missing_productName" }, { status: 400 });

  const row = {
    trade_id:      tradeId,
    product_name:  productName,
    spec:          payload.spec ? String(payload.spec) : null,
    category_slug: payload.categorySlug ? String(payload.categorySlug) : null,
    usual_qty:     Math.max(1, Math.min(9999, Number(payload.usualQty ?? 1))),
    unit:          payload.unit ? String(payload.unit) : "each",
    image_url:     payload.imageUrl ? String(payload.imageUrl) : null
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
