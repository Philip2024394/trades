// POST /api/os/homeowner-billing/stripe-webhook
//
// Stripe webhook for homeowner (Property Vault) subscriptions only.
// Distinct from the merchant webhook so we can point Stripe at a
// dedicated endpoint with its own signing secret + audit trail.
//
// Handles:
//   • checkout.session.completed          → create/update subscription
//   • customer.subscription.created       → upsert + rebuild ents
//   • customer.subscription.updated       → upsert + rebuild ents
//   • customer.subscription.deleted       → mark canceled + rebuild ents
//   • invoice.paid                        → status → active + rebuild
//   • invoice.payment_failed              → status → past_due
//
// Every handled event is idempotent — Stripe retries safely.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  detectBillingInterval,
  findPartyIdForStripeCustomer,
  markSubscriptionStatus,
  planKeyForStripeSubscription,
  rebuildEntitlements,
  unixToIso,
  upsertSubscription
} from "@/lib/os/vault/homeownerBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function partyIdFromEvent(
  stripe: Stripe,
  event: Stripe.Event
): Promise<string | null> {
  const obj = event.data.object as {
    customer?: string | { id: string };
    client_reference_id?: string | null;
    metadata?: { party_id?: string };
    subscription?: string;
  };
  if (obj.metadata?.party_id) return obj.metadata.party_id;
  if (obj.client_reference_id) return obj.client_reference_id;
  const customerId =
    typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
  if (customerId) {
    const mapped = await findPartyIdForStripeCustomer(customerId);
    if (mapped) return mapped;
    // Fall back to Stripe customer metadata
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer) && customer.metadata?.party_id) {
        return customer.metadata.party_id;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function handleSubscriptionState(
  sub: Stripe.Subscription,
  partyIdFallback: string | null
): Promise<{ partyId: string | null; planKey: string | null }> {
  const partyId =
    sub.metadata?.party_id ??
    partyIdFallback ??
    (typeof sub.customer === "string"
      ? await findPartyIdForStripeCustomer(sub.customer)
      : null);

  if (!partyId) {
    return { partyId: null, planKey: null };
  }

  const planKey = await planKeyForStripeSubscription(sub);
  if (!planKey) {
    return { partyId, planKey: null };
  }

  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price.id ?? "";
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await upsertSubscription({
    partyId,
    planKey,
    stripeSubscriptionId: sub.id,
    stripeCustomerId,
    stripePriceId: priceId,
    status: sub.status,
    billingInterval: detectBillingInterval(sub),
    currentPeriodStart: unixToIso(
      (firstItem as unknown as { current_period_start?: number })
        ?.current_period_start
    ),
    currentPeriodEnd: unixToIso(
      (firstItem as unknown as { current_period_end?: number })
        ?.current_period_end
    ),
    trialEnd: unixToIso(sub.trial_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    canceledAt: unixToIso(sub.canceled_at)
  });

  await rebuildEntitlements(partyId);
  return { partyId, planKey };
}

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret =
    process.env.STRIPE_HOMEOWNER_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !webhookSecret) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 }
    );
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "missing_signature" },
      { status: 400 }
    );
  }
  const raw = await req.text();
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_signature", detail: (e as Error).message },
      { status: 400 }
    );
  }

  // Audit trail — insert once per event id, ignore duplicates.
  // Table schema: id (stripe event id), type, payload, received_at.
  await supabaseAdmin
    .from("os_billing_webhook_events")
    .insert({
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
      received_at: new Date().toISOString()
    })
    .then(
      () => null,
      () => null
    );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const partyIdFallback = await partyIdFromEvent(stripe, event);
          await handleSubscriptionState(sub, partyIdFallback);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const partyIdFallback = await partyIdFromEvent(stripe, event);
        await handleSubscriptionState(sub, partyIdFallback);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markSubscriptionStatus(
          sub.id,
          "canceled",
          new Date().toISOString(),
          false
        );
        const partyId = await partyIdFromEvent(stripe, event);
        if (partyId) await rebuildEntitlements(partyId);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string };
        };
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          await markSubscriptionStatus(subId, "active");
          const partyId = await partyIdFromEvent(stripe, event);
          if (partyId) await rebuildEntitlements(partyId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string };
        };
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          await markSubscriptionStatus(subId, "past_due");
          const partyId = await partyIdFromEvent(stripe, event);
          if (partyId) await rebuildEntitlements(partyId);
        }
        break;
      }

      default:
        // Ignore other events — Stripe replays are safe.
        break;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "handler_failed",
        message: e instanceof Error ? e.message : "unknown"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, event: event.type });
}
