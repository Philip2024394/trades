// POST /api/apps/notebook/merchant-inbox/[requestId]/reply
//
// Merchant submits (or updates) their quote for one trade request.
// Body: {
//   items: [{ requestItemId, unitPriceGbp, qty?, inStock?, substitutedNote? }],
//   deliveryPromise?, deliveryDate?, freeDelivery?, deliveryChargeGbp?, notes?,
//   expiresAt?,
//   status: 'draft' | 'submitted'
// }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadMerchantSession } from "@/lib/os/merchantSession";
import { publish } from "@/lib/os/events/bus";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await ctx.params;
  const session = await loadMerchantSession();
  if (!session || !session.slug) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const merchantId = session.merchantId;
  const merchantSlug = session.slug;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Confirm the request targets this merchant
  const { data: request, error: reqError } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .select("id, trade_id, merchant_slugs, status")
    .eq("id", requestId)
    .maybeSingle();
  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 });
  if (!request) return NextResponse.json({ error: "request_not_found" }, { status: 404 });
  const targeted = Array.isArray(request.merchant_slugs)
    ? request.merchant_slugs.includes(merchantSlug)
    : false;
  if (!targeted) return NextResponse.json({ error: "not_targeted" }, { status: 403 });

  // Load the merchant's line items for this request
  const { data: reqItems, error: itemsErr } = await supabaseAdmin
    .from("app_notebook_quote_request_items")
    .select("id, qty")
    .eq("request_id", requestId)
    .eq("merchant_slug", merchantSlug);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  if (!reqItems || reqItems.length === 0) {
    return NextResponse.json({ error: "no_items_for_merchant" }, { status: 400 });
  }
  const reqItemById = new Map(reqItems.map((i) => [i.id, i]));

  // Compute reply totals
  const rawItems = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  const replyItems = rawItems
    .map((it) => {
      const requestItemId = String(it.requestItemId ?? "");
      const source = reqItemById.get(requestItemId);
      if (!source) return null;
      const unitPrice = Math.max(0, Number(it.unitPriceGbp ?? 0));
      const qty = Math.max(1, Number(it.qty ?? source.qty ?? 1));
      return {
        request_item_id:  requestItemId,
        unit_price_gbp:   unitPrice,
        qty,
        line_total_gbp:   Number((unitPrice * qty).toFixed(2)),
        in_stock:         it.inStock === undefined ? true : Boolean(it.inStock),
        substituted_note: it.substitutedNote ? String(it.substitutedNote) : null
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (replyItems.length !== reqItems.length) {
    return NextResponse.json({ error: "missing_line_items" }, { status: 400 });
  }
  const total = replyItems.reduce((s, i) => s + i.line_total_gbp, 0);
  const deliveryCharge = Math.max(0, Number(payload.deliveryChargeGbp ?? 0));
  const status = String(payload.status ?? "draft");
  if (!["draft", "submitted"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  // Upsert reply header
  const submittedAt = status === "submitted" ? new Date().toISOString() : null;
  const { data: reply, error: replyError } = await supabaseAdmin
    .from("app_notebook_quote_replies")
    .upsert(
      {
        request_id:          requestId,
        merchant_id:         merchantId,
        merchant_slug:       merchantSlug,
        status,
        total_gbp:           Number((total + deliveryCharge).toFixed(2)),
        delivery_promise:    payload.deliveryPromise ? String(payload.deliveryPromise) : null,
        delivery_date:       payload.deliveryDate ? String(payload.deliveryDate) : null,
        free_delivery:       payload.freeDelivery === undefined ? true : Boolean(payload.freeDelivery),
        delivery_charge_gbp: deliveryCharge,
        notes:               payload.notes ? String(payload.notes) : null,
        submitted_at:        submittedAt,
        expires_at:          payload.expiresAt ? String(payload.expiresAt) : null
      },
      { onConflict: "request_id,merchant_id" }
    )
    .select()
    .single();
  if (replyError) return NextResponse.json({ error: replyError.message }, { status: 500 });

  // Replace line items — delete then insert (small N, cheaper than diffing)
  await supabaseAdmin
    .from("app_notebook_quote_reply_items")
    .delete()
    .eq("reply_id", reply.id);
  const linesWithReplyId = replyItems.map((i) => ({ ...i, reply_id: reply.id }));
  const { error: linesError } = await supabaseAdmin
    .from("app_notebook_quote_reply_items")
    .insert(linesWithReplyId);
  if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 });

  // Emit on submit
  if (status === "submitted") {
    await publish({
      eventType:       "notebook.quote_request.quoted",
      publisherApp:    "notebook",
      dedupKey:        `notebook-reply-${reply.id}-submitted`,
      actorBusinessId: merchantId,
      subjectType:     "notebook_quote_request",
      subjectId:       requestId,
      payload: {
        replyId:      reply.id,
        requestId,
        merchantId,
        merchantSlug,
        totalGbp:     reply.total_gbp,
        deliveryDate: reply.delivery_date,
        itemCount:    replyItems.length
      }
    }).catch(() => null);

    // Notify the trade in-app + push
    await dispatchNotification({
      recipientKind: "trade",
      recipientId:   request.trade_id,
      kind:          "notebook.quote_request.quoted",
      title:         `${session.displayName ?? merchantSlug} quoted your request`,
      body:          `£${Number(reply.total_gbp).toFixed(2)} · ${reply.delivery_promise ?? "delivery TBC"} · ${replyItems.length} item${replyItems.length === 1 ? "" : "s"}`,
      actionUrl:     `/tc/notebook/quote-requests/${requestId}`,
      subjectType:   "notebook_quote_request",
      subjectId:     requestId,
      payload: {
        replyId:   reply.id,
        requestId,
        merchantSlug,
        totalGbp:  reply.total_gbp
      }
    }).catch(() => null);
  }

  return NextResponse.json({ reply, itemCount: replyItems.length });
}
