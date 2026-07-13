// POST /api/apps/notebook/quote-requests
//
// Submit the current basket as a quote request.
// Snapshots basket → request + items, then clears the basket.
// Optionally links to an existing site project, or creates a new one
// on the fly if the trade passed `newProjectName`.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";
import { publish } from "@/lib/os/events/bus";
import { dispatchMerchantNotification } from "@/lib/tradeAuthDispatch";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

const VALID_TIMING = new Set(["same-day", "tomorrow", "3-days", "5-days", "1-week"]);

export async function POST(req: Request) {
  const { tradeId } = await getTradeSession();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const deliveryAddress = String(payload.deliveryAddress ?? "").trim();
  const deliveryTiming = String(payload.deliveryTiming ?? "");
  if (!deliveryAddress) return NextResponse.json({ error: "missing_deliveryAddress" }, { status: 400 });
  if (!VALID_TIMING.has(deliveryTiming)) {
    return NextResponse.json({ error: "invalid_deliveryTiming" }, { status: 400 });
  }

  // Load basket
  const { data: basket, error: basketError } = await supabaseAdmin
    .from("app_notebook_quote_basket_items")
    .select("*")
    .eq("trade_id", tradeId);
  if (basketError) return NextResponse.json({ error: basketError.message }, { status: 500 });
  if (!basket || basket.length === 0) {
    return NextResponse.json({ error: "basket_empty" }, { status: 400 });
  }

  // Optionally create a project on the fly
  let projectId: string | null = payload.projectId ? String(payload.projectId) : null;
  const newProjectName = payload.newProjectName ? String(payload.newProjectName).trim() : "";
  if (!projectId && newProjectName) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("app_notebook_site_projects")
      .insert({
        trade_id:      tradeId,
        site_name:     newProjectName,
        address_mode:  "manual",
        address_label: deliveryAddress
      })
      .select("id")
      .single();
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
    projectId = created.id;
  }

  // Totals + merchant fan-out
  const totalGbp = basket.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price_gbp), 0);
  const merchantSlugs = Array.from(new Set(basket.map((i) => i.merchant_slug)));

  // Optional structured delivery fields
  const receiverName = payload.deliveryReceiverName ? String(payload.deliveryReceiverName).trim() : null;
  const deliveryNotes = payload.deliveryNotes ? String(payload.deliveryNotes).trim() : null;
  const deliveryPostcode = payload.deliveryPostcode ? String(payload.deliveryPostcode).trim().toUpperCase() : null;
  const deliveryLat = payload.deliveryLat !== undefined && payload.deliveryLat !== null ? Number(payload.deliveryLat) : null;
  const deliveryLng = payload.deliveryLng !== undefined && payload.deliveryLng !== null ? Number(payload.deliveryLng) : null;
  const merchantBrief = payload.merchantBrief ? String(payload.merchantBrief).trim() : null;

  // Create the request header
  const { data: request, error: requestError } = await supabaseAdmin
    .from("app_notebook_quote_requests")
    .insert({
      trade_id:              tradeId,
      project_id:            projectId,
      new_project_name:      newProjectName || null,
      delivery_address:      deliveryAddress,
      delivery_receiver_name: receiverName,
      delivery_notes:        deliveryNotes,
      delivery_postcode:     deliveryPostcode,
      delivery_lat:          deliveryLat,
      delivery_lng:          deliveryLng,
      delivery_timing:       deliveryTiming,
      merchant_brief:        merchantBrief,
      total_gbp:             totalGbp.toFixed(2),
      merchant_slugs:        merchantSlugs,
      status:                "sent"
    })
    .select()
    .single();
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });

  // Snapshot line items
  const items = basket.map((i) => ({
    request_id:     request.id,
    item_key:       i.item_key,
    product_name:   i.product_name,
    spec:           i.spec,
    image_url:      i.image_url,
    qty:            i.qty,
    unit:           i.unit,
    merchant_slug:  i.merchant_slug,
    merchant_name:  i.merchant_name,
    product_slug:   i.product_slug,
    unit_price_gbp: i.unit_price_gbp,
    line_total_gbp: (Number(i.qty) * Number(i.unit_price_gbp)).toFixed(2)
  }));

  const { error: itemsError } = await supabaseAdmin
    .from("app_notebook_quote_request_items")
    .insert(items);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  // Stamp last-quoted metadata on the trade's notebook items so cards
  // can render a "Last quoted £X · Merchant · N days ago" chip on
  // return visits. We only update rows the trade actually owns; a
  // clearance-basket entry (itemKey starts with "clearance-") won't
  // match any notebook_items row and will silently no-op.
  const nowIso = new Date().toISOString();
  await Promise.all(
    basket
      .filter((i) => !i.item_key.startsWith("clearance-"))
      .map((i) =>
        supabaseAdmin
          .from("app_notebook_items")
          .update({
            last_quoted_at:            nowIso,
            last_quoted_price_gbp:     i.unit_price_gbp,
            last_quoted_merchant_slug: i.merchant_slug,
            last_quoted_merchant_name: i.merchant_name
          })
          .eq("trade_id", tradeId)
          .eq("id", i.item_key)
          .then(() => null, () => null)
      )
  );

  // Clear the basket
  const { error: clearError } = await supabaseAdmin
    .from("app_notebook_quote_basket_items")
    .delete()
    .eq("trade_id", tradeId);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  // Fan out to each targeted merchant on the event bus so their inbox
  // can invalidate + push a notification.
  await Promise.all(
    merchantSlugs.map((slug) =>
      publish({
        eventType:     "notebook.quote_request.sent",
        publisherApp:  "notebook",
        dedupKey:      `notebook-quote-request-${request.id}-${slug}`,
        actorBusinessId: tradeId,
        projectId:     projectId ?? null,
        subjectType:   "notebook_quote_request",
        subjectId:     request.id,
        payload: {
          requestId:       request.id,
          tradeId,
          merchantSlug:    slug,
          projectId,
          deliveryAddress,
          deliveryTiming,
          totalGbp,
          itemCount:       basket.filter((i) => i.merchant_slug === slug).length
        }
      }).catch(() => null)
    )
  );

  // Send a direct notification (WhatsApp + email) to each targeted
  // merchant so they see the request outside the app too. Fire-and-
  // forget — a provider failure never blocks the trade's submit.
  const origin = new URL(req.url).origin;
  const { data: merchants } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, whatsapp, email")
    .in("slug", merchantSlugs);

  const tradeSession = await getTradeSession();
  const requestUrl = `${origin}/tc/merchant-admin/quote-inbox?request=${request.id}`;

  await Promise.all(
    (merchants ?? []).flatMap((m) => {
      const merchantItems = basket.filter((i) => i.merchant_slug === m.slug);
      const merchantSubtotal = merchantItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price_gbp), 0);
      return [
        dispatchMerchantNotification({
          merchantWhatsApp:  m.whatsapp ?? null,
          merchantEmail:     m.email ?? null,
          merchantName:      m.display_name ?? m.slug,
          tradeDisplayName:  tradeSession.displayName,
          itemCount:         merchantItems.length,
          totalGbpEstimate:  merchantSubtotal,
          deliveryTiming,
          requestUrl
        }).catch(() => null),
        // In-app notification + push to the merchant's device
        dispatchNotification({
          recipientKind: "merchant",
          recipientId:   m.id,
          kind:          "notebook.quote_request.sent",
          title:         `New quote request from ${tradeSession.displayName}`,
          body:          `${merchantItems.length} item${merchantItems.length === 1 ? "" : "s"} · est. £${merchantSubtotal.toFixed(2)} · ${deliveryTiming}`,
          actionUrl:     `/tc/merchant-admin/quote-inbox?request=${request.id}`,
          subjectType:   "notebook_quote_request",
          subjectId:     request.id,
          payload: {
            requestId:      request.id,
            merchantSlug:   m.slug,
            itemCount:      merchantItems.length,
            subtotalGbp:    merchantSubtotal,
            deliveryTiming
          }
        }).catch(() => null)
      ];
    })
  );

  return NextResponse.json({
    request: {
      id:             request.id,
      status:         request.status,
      totalGbp:       totalGbp,
      merchantCount:  merchantSlugs.length,
      itemCount:      basket.length,
      projectId,
      deliveryTiming,
      sentAt:         request.sent_at
    }
  });
}
