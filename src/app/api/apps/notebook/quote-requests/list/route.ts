// GET /api/apps/notebook/quote-requests/list
//
// Returns the trade's own quote requests with a compact reply summary
// per merchant, sorted newest first. Powers the "Bulk Quotes" section
// on the notebook.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const { tradeId } = await getTradeSession();

  const { data: requests, error } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .select("id, status, sent_at, total_gbp, merchant_slugs, delivery_timing, project_id, delivery_address")
    .eq("trade_id", tradeId)
    .order("sent_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!requests || requests.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  const requestIds = requests.map((r) => r.id);
  const { data: replies } = await supabaseAdmin
    .from("app_notebook_quote_replies")
    .select("id, request_id, merchant_slug, status, total_gbp, delivery_promise, delivery_date, submitted_at")
    .in("request_id", requestIds)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });

  // Compute each merchant's median reply time (in minutes) across the
  // trade's own history. Powers the "Typical reply: 2h" chip on reply
  // cards + PDPs.
  const replyTimes = new Map<string, number[]>();
  for (const rep of replies ?? []) {
    if (!rep.submitted_at) continue;
    const req = requests.find((r) => r.id === rep.request_id);
    if (!req) continue;
    const mins = Math.round((new Date(rep.submitted_at).getTime() - new Date(req.sent_at).getTime()) / 60_000);
    if (mins < 0) continue;
    const list = replyTimes.get(rep.merchant_slug) ?? [];
    list.push(mins);
    replyTimes.set(rep.merchant_slug, list);
  }
  const medianReplyMinutes = new Map<string, number>();
  for (const [slug, mins] of replyTimes) {
    const sorted = [...mins].sort((a, b) => a - b);
    medianReplyMinutes.set(slug, sorted[Math.floor(sorted.length / 2)]);
  }

  const repliesByRequest: Record<string, typeof replies> = {};
  for (const rep of replies ?? []) {
    if (!repliesByRequest[rep.request_id]) repliesByRequest[rep.request_id] = [];
    repliesByRequest[rep.request_id]!.push(rep);
  }

  return NextResponse.json({
    requests: requests.map((r) => {
      const merchantSlugs = Array.isArray(r.merchant_slugs) ? (r.merchant_slugs as string[]) : [];
      const replied = repliesByRequest[r.id] ?? [];
      const winner = replied.reduce<null | (typeof replied)[number]>(
        (best, cur) => (best === null || Number(cur.total_gbp) < Number(best.total_gbp) ? cur : best),
        null
      );
      return {
        requestId:        r.id,
        status:           r.status,
        sentAt:           r.sent_at,
        totalGbpEstimate: Number(r.total_gbp),
        deliveryTiming:   r.delivery_timing,
        deliveryAddress:  r.delivery_address,
        projectId:        r.project_id,
        merchantCount:    merchantSlugs.length,
        replyCount:       replied.length,
        replies:          replied.map((rep) => ({
          replyId:              rep.id,
          merchantSlug:         rep.merchant_slug,
          totalGbp:             Number(rep.total_gbp),
          deliveryPromise:      rep.delivery_promise,
          deliveryDate:         rep.delivery_date,
          submittedAt:          rep.submitted_at,
          isCheapest:           winner?.id === rep.id,
          merchantMedianReplyMins: medianReplyMinutes.get(rep.merchant_slug) ?? null
        }))
      };
    })
  });
}
