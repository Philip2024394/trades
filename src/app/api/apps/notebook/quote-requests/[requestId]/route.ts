// GET /api/apps/notebook/quote-requests/[requestId] — full detail for the
// trade's own request. Returns request header + items + every merchant
// reply with per-line pricing.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await ctx.params;
  const { tradeId } = await getTradeSession();

  const { data: request, error } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .select("*")
    .eq("id", requestId)
    .eq("trade_id", tradeId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: items } = await supabaseAdmin
    .from("app_notebook_quote_request_items")
    .select("*")
    .eq("request_id", requestId);

  const { data: replies } = await supabaseAdmin
    .from("app_notebook_quote_replies")
    .select("*")
    .eq("request_id", requestId)
    .neq("status", "draft")
    .order("submitted_at", { ascending: true });

  const replyIds = (replies ?? []).map((r) => r.id);
  const { data: replyLines } = replyIds.length
    ? await supabaseAdmin
        .from("app_notebook_quote_reply_items")
        .select("*")
        .in("reply_id", replyIds)
    : { data: [] };

  const linesByReply: Record<string, typeof replyLines> = {};
  for (const line of replyLines ?? []) {
    if (!linesByReply[line.reply_id]) linesByReply[line.reply_id] = [];
    linesByReply[line.reply_id]!.push(line);
  }

  return NextResponse.json({
    request,
    items: items ?? [],
    replies: (replies ?? []).map((r) => ({
      ...r,
      lines: linesByReply[r.id] ?? []
    }))
  });
}
