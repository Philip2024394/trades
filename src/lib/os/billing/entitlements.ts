// OS Billing — entitlement read helpers.
//
// Every route that gates on a plan checks entitlement via one of:
//   • hasActiveEntitlement(merchantId, appSlug)  → boolean
//   • loadEntitlement(merchantId, appSlug)       → row or null
//   • loadAllEntitlements(merchantId)            → all rows
//
// These read the os_billing_entitlements projection — one row per
// (merchant, appSlug). Never call Stripe on the hot path.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type Entitlement = {
  merchantId: string;
  appSlug: string;
  planKey: string;
  active: boolean;
  monthlyQuota: number | null;
  overageRatePence: number;
  currentPeriodEnd: string | null;
};

export async function loadEntitlement(
  merchantId: string,
  appSlug: string
): Promise<Entitlement | null> {
  const { data } = await supabaseAdmin
    .from("os_billing_entitlements")
    .select(
      "merchant_id, app_slug, plan_key, active, monthly_quota, overage_rate_pence, current_period_end"
    )
    .eq("merchant_id", merchantId)
    .eq("app_slug", appSlug)
    .maybeSingle();
  if (!data) return null;
  return {
    merchantId: data.merchant_id,
    appSlug: data.app_slug,
    planKey: data.plan_key,
    active: data.active,
    monthlyQuota: data.monthly_quota,
    overageRatePence: data.overage_rate_pence,
    currentPeriodEnd: data.current_period_end
  };
}

export async function loadAllEntitlements(
  merchantId: string
): Promise<Entitlement[]> {
  const { data } = await supabaseAdmin
    .from("os_billing_entitlements")
    .select(
      "merchant_id, app_slug, plan_key, active, monthly_quota, overage_rate_pence, current_period_end"
    )
    .eq("merchant_id", merchantId);
  return (data || []).map((d) => ({
    merchantId: d.merchant_id,
    appSlug: d.app_slug,
    planKey: d.plan_key,
    active: d.active,
    monthlyQuota: d.monthly_quota,
    overageRatePence: d.overage_rate_pence,
    currentPeriodEnd: d.current_period_end
  }));
}

export async function hasActiveEntitlement(
  merchantId: string,
  appSlug: string
): Promise<boolean> {
  const e = await loadEntitlement(merchantId, appSlug);
  return Boolean(e && e.active);
}
