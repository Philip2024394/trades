// GET /api/apps/notebook/merchant-inbox
//
// Server-side merchant-scoped read of trade-initiated quote requests
// that name this merchant in their fan-out. Merchant auth flows through
// the cookie session helper (`loadMerchantSession`), not Supabase auth.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadMerchantSession } from "@/lib/os/merchantSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await loadMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!session.slug) {
    return NextResponse.json({ error: "merchant_slug_missing" }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("app_notebook_merchant_inbox")
    .select("*")
    .eq("merchant_slug", session.slug)
    .order("sent_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requestIds = (rows ?? []).map((r) => r.request_id);
  if (requestIds.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("app_notebook_quote_request_items")
    .select("*")
    .in("request_id", requestIds)
    .eq("merchant_slug", session.slug);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const itemsByRequest: Record<string, typeof items> = {};
  for (const it of items ?? []) {
    if (!itemsByRequest[it.request_id]) itemsByRequest[it.request_id] = [];
    itemsByRequest[it.request_id]!.push(it);
  }

  return NextResponse.json({
    requests: (rows ?? []).map((r) => ({
      requestId:            r.request_id,
      tradeId:              r.trade_id,
      projectId:            r.project_id,
      deliveryAddress:      r.delivery_address,
      deliveryTiming:       r.delivery_timing,
      requestStatus:        r.request_status,
      sentAt:               r.sent_at,
      expiresAt:            r.expires_at,
      merchantSubtotalGbp:  Number(r.merchant_subtotal_gbp ?? 0),
      merchantItemCount:    r.merchant_item_count ?? 0,
      items:                itemsByRequest[r.request_id] ?? []
    }))
  });
}
