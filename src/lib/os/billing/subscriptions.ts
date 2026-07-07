// OS Billing — subscription lifecycle.
//
// Reflect Stripe subscription state into os_billing_subscriptions.
// Recompute os_billing_entitlements from the active-subscription set
// after every mutation. Entitlements are the runtime hot path — every
// route check reads one row.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";
import {
  FREE_TIER_APPS,
  OS_BILLING_PLANS_BY_KEY,
  planForStripePrice
} from "./plans";
import { publish } from "@/lib/os/events";

export type BillingSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export async function upsertCustomer(input: {
  merchantId: string;
  stripeCustomerId: string;
  email?: string | null;
}): Promise<void> {
  await supabaseAdmin.from("os_billing_customers").upsert(
    {
      merchant_id: input.merchantId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email ?? null
    },
    { onConflict: "merchant_id" }
  );
}

export async function findMerchantByStripeCustomer(
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("os_billing_customers")
    .select("merchant_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return (data?.merchant_id as string) ?? null;
}

/** Reflect a Stripe subscription into our table. Handles create + update. */
export async function reflectSubscription(input: {
  stripeSubscription: Stripe.Subscription;
  stripeCustomerId: string;
}): Promise<void> {
  const sub = input.stripeSubscription;
  const merchantId = await findMerchantByStripeCustomer(input.stripeCustomerId);
  if (!merchantId) {
    console.error(
      "[os.billing] reflectSubscription: no merchant for customer",
      input.stripeCustomerId
    );
    return;
  }

  const item = sub.items.data[0];
  if (!item) return;
  const priceId = item.price.id;
  const plan = planForStripePrice(priceId);
  if (!plan) {
    console.warn(
      "[os.billing] reflectSubscription: unknown price id",
      priceId
    );
    return;
  }

  const status = sub.status as BillingSubscriptionStatus;
  await supabaseAdmin
    .from("os_billing_subscriptions")
    .upsert(
      {
        merchant_id: merchantId,
        stripe_customer_id: input.stripeCustomerId,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        plan_key: plan.key,
        app_slug: plan.appSlug,
        status,
        quantity: item.quantity ?? 1,
        current_period_start: new Date(
          sub.current_period_start * 1000
        ).toISOString(),
        current_period_end: new Date(
          sub.current_period_end * 1000
        ).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
        trial_end: sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null,
        metadata: sub.metadata as Record<string, unknown>
      },
      { onConflict: "stripe_subscription_id" }
    );

  await recomputeEntitlements(merchantId);

  await publish({
    eventType: "billing.subscription.updated",
    publisherApp: "billing",
    dedupKey: `stripe:${sub.id}:${sub.status}`,
    actorBusinessId: merchantId,
    subjectType: "subscription",
    subjectId: sub.id,
    payload: {
      status,
      plan_key: plan.key,
      app_slug: plan.appSlug,
      current_period_end: sub.current_period_end
    }
  });
}

/** Recompute the merchant's entitlement rows from their active subs. */
export async function recomputeEntitlements(merchantId: string): Promise<void> {
  const { data: subs } = await supabaseAdmin
    .from("os_billing_subscriptions")
    .select(
      "id, plan_key, app_slug, status, current_period_end, cancel_at_period_end"
    )
    .eq("merchant_id", merchantId)
    .in("status", ["trialing", "active", "past_due"]);

  const derived = new Map<
    string,
    {
      planKey: string;
      appSlug: string;
      monthlyQuota: number | null;
      overageRatePence: number;
      currentPeriodEnd: string | null;
      sourceSubscriptionId: string;
      active: boolean;
    }
  >();

  for (const sub of subs || []) {
    const plan = OS_BILLING_PLANS_BY_KEY[sub.plan_key as string];
    if (!plan) continue;
    const active = sub.status !== "past_due" ? true : true; // past_due keeps access for grace window
    // Bundles expand to their contained apps.
    const targetApps = plan.bundledAppSlugs?.length
      ? plan.bundledAppSlugs
      : [plan.appSlug];
    for (const appSlug of targetApps) {
      const existing = derived.get(appSlug);
      const candidate = {
        planKey: plan.key,
        appSlug,
        monthlyQuota: plan.monthlyQuota,
        overageRatePence: plan.overageRatePence,
        currentPeriodEnd:
          (sub.current_period_end as string | null) ?? null,
        sourceSubscriptionId: sub.id as string,
        active
      };
      // Higher-tier plan wins if both exist (bundle < starter <
      // growth < unlimited by pricePence ordering).
      if (!existing) {
        derived.set(appSlug, candidate);
      } else {
        const existingPlan = OS_BILLING_PLANS_BY_KEY[existing.planKey];
        if (plan.pricePence > (existingPlan?.pricePence ?? 0)) {
          derived.set(appSlug, candidate);
        }
      }
    }
  }

  // Free-tier apps are always present.
  for (const appSlug of FREE_TIER_APPS) {
    if (derived.has(appSlug)) continue;
    derived.set(appSlug, {
      planKey: `${appSlug}.free`,
      appSlug,
      monthlyQuota: null,
      overageRatePence: 0,
      currentPeriodEnd: null,
      sourceSubscriptionId: "",
      active: true
    });
  }

  // Delete then upsert — small volume per merchant so cheap.
  await supabaseAdmin
    .from("os_billing_entitlements")
    .delete()
    .eq("merchant_id", merchantId);

  const rows = Array.from(derived.values()).map((e) => ({
    merchant_id: merchantId,
    app_slug: e.appSlug,
    plan_key: e.planKey,
    active: e.active,
    monthly_quota: e.monthlyQuota,
    overage_rate_pence: e.overageRatePence,
    current_period_end: e.currentPeriodEnd,
    source_subscription_id: e.sourceSubscriptionId || null
  }));
  if (rows.length > 0) {
    await supabaseAdmin.from("os_billing_entitlements").insert(rows);
  }
}
