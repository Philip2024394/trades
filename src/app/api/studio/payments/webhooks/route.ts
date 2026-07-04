// Studio webhook diagnostic log.
//
//   GET /api/studio/payments/webhooks
//     Query: ?provider=stripe|paypal|…|all
//            ?outcome=updated|ignored|failed|no-processor|no-brands|all
//            ?verified=true|false|all
//            ?limit=50 ?before=<received_at ISO cursor>
//     → { ok, events, nextCursor }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? "all";
  const outcome = url.searchParams.get("outcome") ?? "all";
  const verified = url.searchParams.get("verified") ?? "all";
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
  const before = url.searchParams.get("before");

  let query = supabaseAdmin
    .from("studio_payment_webhook_events")
    .select(
      "id, provider_id, brand_id, event_type, external_ref, matched_order_id, signature_verified, http_status, outcome, outcome_detail, payload_preview, headers_preview, latency_ms, received_at"
    )
    // Return events for this brand OR events with brand_id null (which
    // happen when signature failed to match any brand — merchants still
    // want to see those to debug their setup).
    .or(`brand_id.eq.${session.brand.id},brand_id.is.null`)
    .order("received_at", { ascending: false })
    .limit(limit + 1);
  if (provider !== "all") query = query.eq("provider_id", provider);
  if (outcome !== "all") query = query.eq("outcome", outcome);
  if (verified === "true") query = query.eq("signature_verified", true);
  if (verified === "false") query = query.eq("signature_verified", false);
  if (before) query = query.lt("received_at", before);

  const res = await query;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  const rows = res.data ?? [];
  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? events[events.length - 1].received_at
    : null;

  return NextResponse.json({
    ok: true,
    events: events.map((r) => ({
      id: r.id,
      providerId: r.provider_id,
      brandId: r.brand_id,
      eventType: r.event_type,
      externalRef: r.external_ref,
      matchedOrderId: r.matched_order_id,
      signatureVerified: r.signature_verified,
      httpStatus: r.http_status,
      outcome: r.outcome,
      outcomeDetail: r.outcome_detail,
      payloadPreview: r.payload_preview,
      headersPreview: r.headers_preview,
      latencyMs: r.latency_ms,
      receivedAt: r.received_at
    })),
    nextCursor
  });
}
