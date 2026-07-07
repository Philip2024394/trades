// POST /api/licenses/webhook
//
// Stripe webhook. Verifies signature, activates the pending licence
// row, and (for external buyers) triggers the delivery email with a
// signed download link.
//
// The webhook is the only place we accept ground-truth payment
// confirmation. The success page is UX only.

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/licenses/stripe";
import {
  activateLicenseBySessionId
} from "@/lib/licenses/loader";
import { sendLicenseDeliveryEmail } from "@/lib/licenses/delivery";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bodyText = await request.text();
  const sig = (await headers()).get("stripe-signature") ?? "";
  const event = verifyWebhookSignature(bodyText, sig);
  if (!event) {
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 400 }
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as {
      id: string;
      payment_intent?: string | null;
      metadata?: {
        license_id?: string;
        image_id?: string;
        tier?: string;
        buyer_merchant_id?: string;
      } | null;
      customer_email?: string | null;
      customer_details?: { email?: string | null } | null;
    };
    const licenseId = session.metadata?.license_id ?? null;
    const paymentIntent = (session.payment_intent as string) ?? "";
    if (!licenseId) {
      return NextResponse.json({ received: true, note: "no license_id" });
    }
    await activateLicenseBySessionId(session.id, paymentIntent);
    // External buyer delivery — email a signed download link.
    const email =
      session.customer_email ??
      session.customer_details?.email ??
      null;
    const isExternal = !session.metadata?.buyer_merchant_id;
    if (isExternal && email && session.metadata?.image_id) {
      await sendLicenseDeliveryEmail({
        toEmail: email,
        licenseId,
        imageId: session.metadata.image_id,
        tier: session.metadata.tier ?? "standard"
      });
    }
  }

  return NextResponse.json({ received: true });
}
