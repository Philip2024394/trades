// POST /api/apps/notebook/quote-requests/[requestId]/resubmit
//
// Repopulates the trade's basket from a past request. Doesn't
// automatically send — the trade lands on the Quotation List with
// everything pre-loaded, tweaks anything that changed, and hits
// Send when ready.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await ctx.params;
  const { tradeId } = await getTradeSession();

  // Ownership check
  const { data: request } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .select("id, trade_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.trade_id !== tradeId) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const { data: items, error } = await supabaseAdmin
    .from("app_notebook_quote_request_items")
    .select("*")
    .eq("request_id", requestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) return NextResponse.json({ error: "empty_source" }, { status: 400 });

  // Clear the current basket and refill from this request's items
  await supabaseAdmin
    .from("app_notebook_quote_basket_items")
    .delete()
    .eq("trade_id", tradeId);

  const rows = items.map((i) => ({
    trade_id:       tradeId,
    item_key:       i.item_key,
    product_name:   i.product_name,
    spec:           i.spec,
    image_url:      i.image_url,
    qty:            i.qty,
    unit:           i.unit,
    merchant_slug:  i.merchant_slug,
    merchant_name:  i.merchant_name,
    product_slug:   i.product_slug,
    unit_price_gbp: i.unit_price_gbp
  }));

  const { error: insertError } = await supabaseAdmin
    .from("app_notebook_quote_basket_items")
    .insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true, itemCount: rows.length });
}
