// OS — Homeowner billing helpers.
//
// Applies subscription state changes from Stripe webhooks + rebuilds
// the derived entitlement cache (os_homeowner_entitlements) so
// runtime checks stay O(1).

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

const FREE_INCLUDED_BYTES = 524_288_000; // 500 MB baseline for free tier

type PlanEntitlements = {
  storage_bytes?: number;
  addon_storage_bytes?: number;
  video_enabled?: boolean;
  bundle_export_enabled?: boolean;
  share_grants_max?: number;
  passport_transferable?: boolean;
  requires_plan?: string;
};

type PlanRow = {
  plan_key: string;
  plan_type: string;
  entitlements: PlanEntitlements;
};

export async function findPartyIdForStripeCustomer(
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("os_homeowner_subscriptions")
    .select("party_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .not("party_id", "is", null)
    .limit(1)
    .maybeSingle();
  return (data?.party_id as string) ?? null;
}

export async function upsertSubscription(params: {
  partyId: string;
  planKey: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: string;
  billingInterval: "monthly" | "annual" | "one_off" | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}): Promise<void> {
  const { data: plan } = await supabaseAdmin
    .from("os_homeowner_plans")
    .select("plan_key, plan_type, entitlements")
    .eq("plan_key", params.planKey)
    .maybeSingle();
  const entitlementsSnapshot = (plan?.entitlements ?? {}) as PlanEntitlements;

  const { error } = await supabaseAdmin
    .from("os_homeowner_subscriptions")
    .upsert(
      {
        party_id: params.partyId,
        plan_key: params.planKey,
        stripe_subscription_id: params.stripeSubscriptionId,
        stripe_customer_id: params.stripeCustomerId,
        stripe_price_id: params.stripePriceId,
        status: params.status,
        billing_interval: params.billingInterval,
        current_period_start: params.currentPeriodStart,
        current_period_end: params.currentPeriodEnd,
        trial_end: params.trialEnd,
        cancel_at_period_end: params.cancelAtPeriodEnd,
        canceled_at: params.canceledAt,
        entitlements_snapshot: entitlementsSnapshot
      },
      { onConflict: "stripe_subscription_id" }
    );
  if (error) throw error;
}

export async function markSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  canceledAt: string | null = null,
  cancelAtPeriodEnd: boolean | null = null
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (canceledAt) patch.canceled_at = canceledAt;
  if (cancelAtPeriodEnd !== null) patch.cancel_at_period_end = cancelAtPeriodEnd;
  await supabaseAdmin
    .from("os_homeowner_subscriptions")
    .update(patch)
    .eq("stripe_subscription_id", stripeSubscriptionId);
}

// Rebuild the derived entitlement cache for one party. Aggregates every
// active subscription's entitlements_snapshot into a single row.
export async function rebuildEntitlements(partyId: string): Promise<void> {
  const { data: subs } = await supabaseAdmin
    .from("os_homeowner_subscriptions")
    .select("id, plan_key, status, entitlements_snapshot")
    .eq("party_id", partyId)
    .in("status", ["active", "trialing"]);

  let vaultActive = false;
  let vaultTier: "none" | "basic" | "lifetime" | "trial" = "none";
  let includedBytes = FREE_INCLUDED_BYTES;
  let addonBytes = 0;
  let videoEnabled = false;
  let bundleExportEnabled = true; // free default
  let shareGrantsMax = 5;
  let passportTransferable = false;
  const activeSubIds: string[] = [];
  const activePlanKeys: string[] = [];

  const { data: allPlans } = await supabaseAdmin
    .from("os_homeowner_plans")
    .select("plan_key, plan_type, entitlements");
  const planByKey = new Map<string, PlanRow>();
  for (const p of (allPlans ?? []) as PlanRow[]) {
    planByKey.set(p.plan_key, p);
  }

  for (const s of subs ?? []) {
    activeSubIds.push(s.id as string);
    activePlanKeys.push(s.plan_key as string);
    const plan = planByKey.get(s.plan_key as string);
    if (!plan) continue;
    const ents = (plan.entitlements ?? {}) as PlanEntitlements;

    if (plan.plan_type === "base" || plan.plan_type === "lifetime") {
      vaultActive = true;
      if (plan.plan_type === "lifetime") vaultTier = "lifetime";
      else if (vaultTier !== "lifetime") vaultTier = "basic";
      if (typeof ents.storage_bytes === "number") {
        includedBytes = Math.max(includedBytes, ents.storage_bytes);
      }
      if (ents.bundle_export_enabled !== undefined) {
        bundleExportEnabled = ents.bundle_export_enabled;
      }
      if (typeof ents.share_grants_max === "number") {
        shareGrantsMax = Math.max(shareGrantsMax, ents.share_grants_max);
      }
      if (ents.passport_transferable) passportTransferable = true;
    } else if (plan.plan_type === "trial") {
      vaultActive = true;
      if (vaultTier === "none") vaultTier = "trial";
    }

    if (plan.plan_type === "addon") {
      if (typeof ents.addon_storage_bytes === "number") {
        addonBytes += ents.addon_storage_bytes;
      }
      if (ents.video_enabled) videoEnabled = true;
    }

    // Lifetime plans may also expose addon capacity + video enabled
    if (
      plan.plan_type === "lifetime" &&
      typeof ents.addon_storage_bytes === "number"
    ) {
      addonBytes += ents.addon_storage_bytes;
    }
    if (plan.plan_type === "lifetime" && ents.video_enabled) {
      videoEnabled = true;
    }
  }

  const { error } = await supabaseAdmin
    .from("os_homeowner_entitlements")
    .upsert(
      {
        party_id: partyId,
        vault_active: vaultActive,
        vault_tier: vaultTier,
        storage_included_bytes: includedBytes,
        storage_addon_bytes: addonBytes,
        video_enabled: videoEnabled,
        bundle_export_enabled: bundleExportEnabled,
        share_grants_max: shareGrantsMax,
        passport_transferable: passportTransferable,
        active_subscription_ids: activeSubIds,
        active_plan_keys: activePlanKeys,
        last_calculated_at: new Date().toISOString()
      },
      { onConflict: "party_id" }
    );
  if (error) throw error;
}

// Extract plan_key from a Stripe subscription — reads the metadata
// or looks up by price id.
export async function planKeyForStripeSubscription(
  sub: Stripe.Subscription
): Promise<string | null> {
  if (sub.metadata?.plan_key) return sub.metadata.plan_key;
  const firstItem = sub.items.data[0];
  if (!firstItem) return null;
  const priceId = firstItem.price.id;
  const { data } = await supabaseAdmin
    .from("os_homeowner_plans")
    .select("plan_key")
    .or(
      `stripe_price_id_monthly.eq.${priceId},stripe_price_id_annual.eq.${priceId},stripe_price_id_one_off.eq.${priceId}`
    )
    .maybeSingle();
  return (data?.plan_key as string) ?? null;
}

export function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

export function detectBillingInterval(
  sub: Stripe.Subscription
): "monthly" | "annual" | null {
  const price = sub.items.data[0]?.price;
  const interval = price?.recurring?.interval;
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  return null;
}
