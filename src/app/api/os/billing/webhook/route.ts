// POST /api/os/billing/webhook — Stripe webhook endpoint.
//
// Verifies the signature, parses the event, dispatches to the handler.
// Returns 200 on any received-and-logged event even if the internal
// handler errored — Stripe retries on non-2xx so we must ACK once we
// have durably logged the event.
import { NextResponse, type NextRequest } from "next/server";
import { constructWebhookEvent } from "@/lib/os/billing/stripe";
import { handleWebhookEvent } from "@/lib/os/billing/webhookHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing-signature" },
      { status: 400 }
    );
  }
  const rawBody = await req.text();

  try {
    const event = constructWebhookEvent(rawBody, signature);
    const result = await handleWebhookEvent(event);
    return NextResponse.json({ ok: result.ok, ignored: result.ok ? result.ignored ?? false : false });
  } catch (err) {
    console.error("[os.billing.webhook] signature verify failed", err);
    return NextResponse.json(
      { ok: false, error: "invalid-signature" },
      { status: 400 }
    );
  }
}
