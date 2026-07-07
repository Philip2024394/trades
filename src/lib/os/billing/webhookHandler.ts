// OS Billing — Stripe webhook handler.
//
// One entry point per event type. Every handler is idempotent —
// receiving the same event twice never changes state.
//
// Persisted events in os_billing_webhook_events act as a durable log
// so if this process crashes mid-handler, we know which events were
// received but never processed.
import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeClient } from "./stripe";
import {
  reflectSubscription,
  upsertCustomer
} from "./subscriptions";
import { publish } from "@/lib/os/events";

export type WebhookHandlerResult =
  | { ok: true; ignored?: boolean }
  | { ok: false; error: string };

export async function handleWebhookEvent(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  // Idempotent log — INSERT ON CONFLICT DO NOTHING (unique on id)
  const { error: logErr } = await supabaseAdmin
    .from("os_billing_webhook_events")
    .upsert(
      {
        id: event.id,
        type: event.type,
        payload: event as unknown as Record<string, unknown>,
        status: "received"
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (logErr) {
    return { ok: false, error: `log-failed: ${logErr.message}` };
  }

  try {
    switch (event.type) {
      case "customer.created":
      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;
        const merchantId =
          (customer.metadata?.merchant_id as string | undefined) ?? null;
        if (!merchantId) {
          await markProcessed(event.id, "ignored");
          return { ok: true, ignored: true };
        }
        await upsertCustomer({
          merchantId,
          stripeCustomerId: customer.id,
          email: customer.email
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await reflectSubscription({
          stripeSubscription: sub,
          stripeCustomerId: customerId
        });
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const merchantId =
          (session.metadata?.merchant_id as string | undefined) ?? null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (merchantId && customerId) {
          await upsertCustomer({
            merchantId,
            stripeCustomerId: customerId,
            email: session.customer_details?.email ?? null
          });
        }
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripeClient().subscriptions.retrieve(subId);
          const subCustomerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          await reflectSubscription({
            stripeSubscription: sub,
            stripeCustomerId: subCustomerId
          });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          await publish({
            eventType: "billing.payment.succeeded",
            publisherApp: "billing",
            dedupKey: `invoice:${invoice.id}:paid`,
            subjectType: "invoice",
            subjectId: invoice.id ?? null,
            payload: {
              stripe_customer_id: customerId,
              amount_paid: invoice.amount_paid,
              currency: invoice.currency
            }
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          await publish({
            eventType: "billing.payment.failed",
            publisherApp: "billing",
            dedupKey: `invoice:${invoice.id}:failed`,
            subjectType: "invoice",
            subjectId: invoice.id ?? null,
            payload: {
              stripe_customer_id: customerId,
              amount_due: invoice.amount_due,
              attempt_count: invoice.attempt_count
            }
          });
        }
        break;
      }
      default: {
        await markProcessed(event.id, "ignored");
        return { ok: true, ignored: true };
      }
    }

    await markProcessed(event.id, "processed");
    return { ok: true };
  } catch (err) {
    console.error("[os.billing.webhook] handler failed", event.type, err);
    await supabaseAdmin
      .from("os_billing_webhook_events")
      .update({
        status: "failed",
        last_error: String(err).slice(0, 1024),
        attempt_count: (
          await supabaseAdmin
            .from("os_billing_webhook_events")
            .select("attempt_count")
            .eq("id", event.id)
            .single()
        ).data?.attempt_count
          ? undefined
          : 1
      })
      .eq("id", event.id);
    return { ok: false, error: String(err) };
  }
}

async function markProcessed(
  eventId: string,
  status: "processed" | "ignored"
): Promise<void> {
  await supabaseAdmin
    .from("os_billing_webhook_events")
    .update({
      status,
      processed_at: new Date().toISOString()
    })
    .eq("id", eventId);
}
