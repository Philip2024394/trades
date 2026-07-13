// POST /api/apps/notebook/quote-requests/[requestId]/replies/[replyId]/decline
//
// Trade declines a single merchant's reply. Doesn't touch other replies
// and doesn't close the request — other merchants can still win.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ requestId: string; replyId: string }> }
) {
  const { requestId, replyId } = await ctx.params;
  const { tradeId } = await getTradeSession();

  const { data: request } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .select("id, trade_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.trade_id !== tradeId) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("app_notebook_quote_replies")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", replyId)
    .eq("request_id", requestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
