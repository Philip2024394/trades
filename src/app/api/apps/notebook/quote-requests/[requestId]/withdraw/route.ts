// POST /api/apps/notebook/quote-requests/[requestId]/withdraw
//
// Trade cancels an in-flight quote request. Sets the request status
// to 'cancelled' and marks every unaccepted reply 'withdrawn' so
// merchants know they no longer need to price it.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";
import { publish } from "@/lib/os/events/bus";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await ctx.params;
  const { tradeId } = await getTradeSession();

  const { data: request } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .select("id, trade_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.trade_id !== tradeId) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }
  if (request.status === "won" || request.status === "cancelled") {
    return NextResponse.json({ error: "already_closed" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("app_notebook_quote_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  await supabaseAdmin
    .from("app_notebook_quote_replies")
    .update({ status: "expired" })
    .eq("request_id", requestId)
    .in("status", ["submitted", "draft"]);

  await publish({
    eventType:       "notebook.quote_request.expired",
    publisherApp:    "notebook",
    dedupKey:        `notebook-request-withdraw-${requestId}`,
    actorBusinessId: tradeId,
    subjectType:     "notebook_quote_request",
    subjectId:       requestId,
    payload:         { requestId, withdrawnAt: now }
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
