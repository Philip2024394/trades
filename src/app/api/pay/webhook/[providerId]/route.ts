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

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { paymentProcessors } from "@/platform/buttons/payments/processor";
import "@/platform/buttons/payments/processors";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
  const processor = paymentProcessors.get(providerId);
  if (!processor || !processor.verifyAndParseWebhook) {
    return NextResponse.json(
      { ok: false, error: "webhook-not-supported" },
      { status: 501 }
    );
  }

  const rawBody = await req.text();

  // Try every brand's credentials until one signature verifies.
  // For providers with a per-brand endpoint (e.g. Shopify /store.myshopify)
  // we'd narrow the query; for now, brand-agnostic providers scan all.
  const rows = await supabaseAdmin
    .from("studio_payment_providers")
    .select("brand_id, credentials")
    .eq("provider_id", providerId)
    .eq("enabled", true);

  if (rows.error || !rows.data || rows.data.length === 0) {
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
      return NextResponse.json({ ok: true, ignored: result.reason });
    }
    if (result.kind === "update") {
      const upd = await supabaseAdmin
        .from("studio_payment_orders")
        .update({ status: result.status, metadata: result.metadata ?? {} })
        .eq("brand_id", row.brand_id)
        .eq("provider_id", providerId)
        .eq("external_ref", result.externalRef);
      if (upd.error) {
        return NextResponse.json(
          { ok: false, error: upd.error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, updated: result.status });
    }
  }

  return NextResponse.json(
    { ok: false, error: "signature-verification-failed-for-all-brands" },
    { status: 400 }
  );
}
