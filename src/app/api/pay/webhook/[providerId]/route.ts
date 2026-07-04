// Universal payment webhook router.
//
//   POST /api/pay/webhook/[providerId]
//     Provider POSTs its event body + signature headers.
//     Router:
//       1. Loads processor
//       2. Loads any brand's credentials (webhook signatures need
//          the webhook secret — we scan all brands using this provider
//          until one verifies; providers with per-brand endpoints
//          include brand context in the URL / body).
//       3. Delegates to processor.verifyAndParseWebhook
//       4. Updates studio_payment_orders on success
//       5. Logs every event to studio_payment_webhook_events for the
//          merchant-facing diagnostic surface at /studio/payments/webhooks

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { paymentProcessors } from "@/platform/buttons/payments/processor";
import "@/platform/buttons/payments/processors";

export const runtime = "nodejs";

type LogPayload = {
  provider_id: string;
  brand_id: string | null;
  event_type: string | null;
  external_ref: string | null;
  matched_order_id: string | null;
  signature_verified: boolean;
  http_status: number;
  outcome: "updated" | "ignored" | "failed" | "no-processor" | "no-brands";
  outcome_detail: string;
  payload_preview: string;
  headers_preview: Record<string, string>;
  latency_ms: number;
};

async function logWebhook(payload: LogPayload) {
  try {
    await supabaseAdmin.from("studio_payment_webhook_events").insert(payload);
  } catch {
    // Never let logging break the webhook response — providers will retry
    // and stuck webhooks are worse than a missed log line.
  }
}

function previewHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const interesting = [
    "content-type",
    "user-agent",
    "stripe-signature",
    "paypal-auth-algo",
    "paypal-transmission-id",
    "x-cc-webhook-signature",
    "x-adyen-signature",
    "x-mollie-signature",
    "x-razorpay-signature",
    "x-signature"
  ];
  for (const name of interesting) {
    const v = headers.get(name);
    if (v) out[name] = v.length > 200 ? v.slice(0, 200) + "…" : v;
  }
  return out;
}

function extractEventType(rawBody: string, providerId: string): string | null {
  try {
    const json = JSON.parse(rawBody) as Record<string, unknown>;
    if (providerId === "stripe") return (json.type as string) ?? null;
    if (providerId === "paypal") return (json.event_type as string) ?? null;
    if (providerId === "coinbase") {
      const event = (json.event as { type?: string } | undefined) ?? undefined;
      return event?.type ?? null;
    }
    if (typeof json.event === "string") return json.event;
    if (typeof json.type === "string") return json.type;
    return null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const startedAt = Date.now();
  const { providerId } = await params;
  const rawBody = await req.text();
  const payloadPreview = rawBody.slice(0, 4000);
  const headersPreview = previewHeaders(req.headers);
  const eventType = extractEventType(rawBody, providerId);

  const processor = paymentProcessors.get(providerId);
  if (!processor || !processor.verifyAndParseWebhook) {
    await logWebhook({
      provider_id: providerId,
      brand_id: null,
      event_type: eventType,
      external_ref: null,
      matched_order_id: null,
      signature_verified: false,
      http_status: 501,
      outcome: "no-processor",
      outcome_detail: "processor has no webhook verifier",
      payload_preview: payloadPreview,
      headers_preview: headersPreview,
      latency_ms: Date.now() - startedAt
    });
    return NextResponse.json(
      { ok: false, error: "webhook-not-supported" },
      { status: 501 }
    );
  }

  const rows = await supabaseAdmin
    .from("studio_payment_providers")
    .select("brand_id, credentials")
    .eq("provider_id", providerId)
    .eq("enabled", true);

  if (rows.error || !rows.data || rows.data.length === 0) {
    await logWebhook({
      provider_id: providerId,
      brand_id: null,
      event_type: eventType,
      external_ref: null,
      matched_order_id: null,
      signature_verified: false,
      http_status: 404,
      outcome: "no-brands",
      outcome_detail: "no brands with this provider enabled",
      payload_preview: payloadPreview,
      headers_preview: headersPreview,
      latency_ms: Date.now() - startedAt
    });
    return NextResponse.json(
      { ok: false, error: "no-brands-configured" },
      { status: 404 }
    );
  }

  for (const row of rows.data) {
    let result;
    try {
      result = await processor.verifyAndParseWebhook(
        rawBody,
        req.headers,
        (row.credentials as Record<string, unknown>) ?? {}
      );
    } catch {
      continue;
    }
    if (result.kind === "ignore") {
      await logWebhook({
        provider_id: providerId,
        brand_id: row.brand_id,
        event_type: eventType,
        external_ref: null,
        matched_order_id: null,
        signature_verified: true,
        http_status: 200,
        outcome: "ignored",
        outcome_detail: result.reason,
        payload_preview: payloadPreview,
        headers_preview: headersPreview,
        latency_ms: Date.now() - startedAt
      });
      return NextResponse.json({ ok: true, ignored: result.reason });
    }
    if (result.kind === "update") {
      // Find the order id so the log can link to it.
      const matched = await supabaseAdmin
        .from("studio_payment_orders")
        .select("id")
        .eq("brand_id", row.brand_id)
        .eq("provider_id", providerId)
        .eq("external_ref", result.externalRef)
        .maybeSingle();

      const upd = await supabaseAdmin
        .from("studio_payment_orders")
        .update({ status: result.status, metadata: result.metadata ?? {} })
        .eq("brand_id", row.brand_id)
        .eq("provider_id", providerId)
        .eq("external_ref", result.externalRef);
      if (upd.error) {
        await logWebhook({
          provider_id: providerId,
          brand_id: row.brand_id,
          event_type: eventType,
          external_ref: result.externalRef,
          matched_order_id: matched.data?.id ?? null,
          signature_verified: true,
          http_status: 500,
          outcome: "failed",
          outcome_detail: `order update: ${upd.error.message}`,
          payload_preview: payloadPreview,
          headers_preview: headersPreview,
          latency_ms: Date.now() - startedAt
        });
        return NextResponse.json(
          { ok: false, error: upd.error.message },
          { status: 500 }
        );
      }
      await logWebhook({
        provider_id: providerId,
        brand_id: row.brand_id,
        event_type: eventType,
        external_ref: result.externalRef,
        matched_order_id: matched.data?.id ?? null,
        signature_verified: true,
        http_status: 200,
        outcome: "updated",
        outcome_detail: `status → ${result.status}`,
        payload_preview: payloadPreview,
        headers_preview: headersPreview,
        latency_ms: Date.now() - startedAt
      });
      return NextResponse.json({ ok: true, updated: result.status });
    }
  }

  await logWebhook({
    provider_id: providerId,
    brand_id: null,
    event_type: eventType,
    external_ref: null,
    matched_order_id: null,
    signature_verified: false,
    http_status: 400,
    outcome: "failed",
    outcome_detail: "signature verification failed for all brands",
    payload_preview: payloadPreview,
    headers_preview: headersPreview,
    latency_ms: Date.now() - startedAt
  });
  return NextResponse.json(
    { ok: false, error: "signature-verification-failed-for-all-brands" },
    { status: 400 }
  );
}
