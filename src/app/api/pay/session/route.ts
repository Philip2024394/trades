// Universal payment session endpoint.
//
//   POST /api/pay/session
//     Body: { brandId, providerId, amountMinor, currency, orderRef,
//             description?, customerEmail?, returnUrl, cancelUrl,
//             metadata? }
//     → { ok, kind: "redirect", checkoutUrl } | { ok, kind: "handoff", instructions }
//
// The orchestrator:
//   1. Loads the brand's configured credentials for the provider
//   2. Resolves the processor from paymentProcessors registry
//   3. Delegates to processor.createSession
//   4. Records the attempt in studio_payment_orders
//   5. Returns the checkout URL (or instructions for post-paid methods)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Payment processor registry is loaded on-demand inside the handler
// so Next.js's build-time page-data collection does not evaluate the
// entire processor barrel. This unblocks the production build without
// affecting runtime behaviour.
async function loadRegistry() {
  const [{ paymentProcessors }] = await Promise.all([
    import("@/platform/buttons/payments/processor"),
    import("@/platform/buttons/payments/processors")
  ]);
  return paymentProcessors;
}

type Body = {
  brandId: string;
  providerId: string;
  amountMinor: number;
  currency: string;
  orderRef: string;
  description?: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  if (
    typeof body.brandId !== "string" ||
    typeof body.providerId !== "string" ||
    typeof body.amountMinor !== "number" ||
    !Number.isFinite(body.amountMinor) ||
    body.amountMinor <= 0 ||
    typeof body.currency !== "string" ||
    !body.currency ||
    typeof body.orderRef !== "string" ||
    !body.orderRef ||
    typeof body.returnUrl !== "string" ||
    typeof body.cancelUrl !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }

  const paymentProcessors = await loadRegistry();
  const processor = paymentProcessors.get(body.providerId);
  if (!processor) {
    return NextResponse.json(
      { ok: false, kind: "not-implemented", error: "unknown-provider" },
      { status: 501 }
    );
  }

  // Load provider config for this brand.
  const configRow = await supabaseAdmin
    .from("studio_payment_providers")
    .select("enabled, credentials")
    .eq("brand_id", body.brandId)
    .eq("provider_id", body.providerId)
    .maybeSingle();

  if (!configRow.data) {
    return NextResponse.json(
      { ok: false, error: "provider-not-configured" },
      { status: 400 }
    );
  }
  if (!configRow.data.enabled) {
    return NextResponse.json(
      { ok: false, error: "provider-disabled" },
      { status: 400 }
    );
  }

  // Persist the attempt BEFORE calling the processor so an outage
  // on the provider side still leaves us a trail.
  const orderInsert = await supabaseAdmin
    .from("studio_payment_orders")
    .insert({
      brand_id: body.brandId,
      provider_id: body.providerId,
      order_ref: body.orderRef,
      amount_minor: body.amountMinor,
      currency: body.currency,
      description: body.description ?? null,
      customer_email: body.customerEmail ?? null,
      return_url: body.returnUrl,
      cancel_url: body.cancelUrl,
      metadata: body.metadata ?? {},
      status: "created"
    })
    .select("id")
    .maybeSingle();

  if (orderInsert.error || !orderInsert.data) {
    return NextResponse.json(
      { ok: false, error: orderInsert.error?.message ?? "order-insert-failed" },
      { status: 500 }
    );
  }

  const orderId = orderInsert.data.id as string;

  let result;
  try {
    result = await processor.createSession(
      {
        brandId: body.brandId,
        amountMinor: body.amountMinor,
        currency: body.currency,
        orderRef: body.orderRef,
        description: body.description,
        customerEmail: body.customerEmail,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl,
        metadata: body.metadata
      },
      (configRow.data.credentials as Record<string, unknown>) ?? {}
    );
  } catch (err) {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ status: "failed", metadata: { error: (err as Error).message } })
      .eq("id", orderId);
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "processor-crashed" },
      { status: 500 }
    );
  }

  if (result.kind === "error") {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ status: "failed", metadata: { error: result.error } })
      .eq("id", orderId);
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }
  if (result.kind === "not-implemented") {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ status: "cancelled", metadata: { reason: result.reason } })
      .eq("id", orderId);
    return NextResponse.json(
      { ok: false, kind: "not-implemented", error: result.reason },
      { status: 501 }
    );
  }

  // redirect | handoff
  const externalRef =
    result.kind === "redirect" ? result.externalRef : result.externalRef;
  await supabaseAdmin
    .from("studio_payment_orders")
    .update({ external_ref: externalRef, status: "pending" })
    .eq("id", orderId);

  if (result.kind === "redirect") {
    return NextResponse.json({
      ok: true,
      kind: "redirect",
      checkoutUrl: result.checkoutUrl,
      orderId
    });
  }
  return NextResponse.json({
    ok: true,
    kind: "handoff",
    instructions: result.instructions,
    orderId
  });
}
