// POST /api/apps/notebook/quote-requests/[requestId]/replies/[replyId]/accept
//
// Trade accepts one merchant's reply. Marks the reply accepted, marks
// every other reply on the same request as declined, and flips the
// request status to 'won'. Emits notebook.quote_request.won on the bus.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";
import { publish } from "@/lib/os/events/bus";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ requestId: string; replyId: string }> }
) {
  const { requestId, replyId } = await ctx.params;
  const { tradeId } = await getTradeSession();

  // Ownership check
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

  // Accept the winning reply
  const { data: accepted, error: acceptError } = await supabaseAdmin
    .from("app_notebook_quote_replies")
    .update({ status: "accepted", accepted_at: now })
    .eq("id", replyId)
    .eq("request_id", requestId)
    .select()
    .single();
  if (acceptError) return NextResponse.json({ error: acceptError.message }, { status: 500 });

  // Decline every other reply on the same request
  await supabaseAdmin
    .from("app_notebook_quote_replies")
    .update({ status: "declined", declined_at: now })
    .eq("request_id", requestId)
    .neq("id", replyId)
    .in("status", ["submitted", "draft"]);

  // Flip request status
  await supabaseAdmin
    .from("app_notebook_quote_requests")
    .update({ status: "won" })
    .eq("id", requestId);

  await publish({
    eventType:       "notebook.quote_request.won",
    publisherApp:    "notebook",
    dedupKey:        `notebook-request-won-${requestId}`,
    actorBusinessId: tradeId,
    subjectType:     "notebook_quote_request",
    subjectId:       requestId,
    payload: {
      requestId,
      acceptedReplyId: replyId,
      merchantSlug:    accepted.merchant_slug,
      totalGbp:        accepted.total_gbp
    }
  }).catch(() => null);

  return NextResponse.json({ ok: true, reply: accepted });
}
