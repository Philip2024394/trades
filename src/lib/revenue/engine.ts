// Revenue Engine · MRR, ARR, churn, LTV by tier.
//
// Reads os_billing_subscriptions + os_homeowner_subscriptions and maps
// plan_key → monthlyGbp via TIER_CATALOG (single source of truth).
// Everything derived — no fabricated numbers (evidence-or-silence).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TIER_CATALOG, type TierKey } from "@/lib/tierCatalog";

type SubRow = {
  id:                     string;
  plan_key:               string | null;
  status:                 string | null;
  current_period_end:     string | null;
  canceled_at:            string | null;
  cancel_at_period_end:   boolean | null;
  created_at:             string;
};

export type MrrByTier = {
  tier:            TierKey | "unknown";
  activeCount:     number;
  monthlyGbpPence: number;
};

export type RevenueSnapshot = {
  mrrGbpPence:     number;
  arrGbpPence:     number;
  activeCount:     number;
  cancellingCount: number;   // active but cancel_at_period_end = true
  new30dCount:     number;
  churned30dCount: number;   // canceled_at in the last 30d
  byTier:          MrrByTier[];
  homeownerActive: number;   // separate — SiteBook Pro homeowner subs
};

/** Compute revenue snapshot from live subscription rows.
 *  Combines merchant (os_billing_subscriptions) + homeowner
 *  (os_homeowner_subscriptions) sources. */
export async function loadRevenueSnapshot(): Promise<RevenueSnapshot> {
  const [merchantsRes, homeownersRes] = await Promise.all([
    supabaseAdmin.from("os_billing_subscriptions").select("id, plan_key, status, current_period_end, canceled_at, cancel_at_period_end, created_at"),
    supabaseAdmin.from("os_homeowner_subscriptions").select("id, plan_key, status, current_period_end, canceled_at, cancel_at_period_end, created_at")
  ]);
  const merchants  = (merchantsRes.data  as SubRow[]) ?? [];
  const homeowners = (homeownersRes.data as SubRow[]) ?? [];

  const sinceCutoff = Date.now() - 30 * 86_400_000;
  const isActive = (s: SubRow) => s.status === "active" || s.status === "trialing";
  const active = merchants.filter(isActive);

  const byTierAgg = new Map<TierKey | "unknown", { count: number; pence: number }>();
  for (const sub of active) {
    const key = normaliseTier(sub.plan_key);
    const tier = key === "unknown" ? null : TIER_CATALOG[key];
    const pence = tier ? Math.round(tier.monthlyGbp * 100) : 0;
    let b = byTierAgg.get(key);
    if (!b) { b = { count: 0, pence: 0 }; byTierAgg.set(key, b); }
    b.count++; b.pence += pence;
  }

  const byTier: MrrByTier[] = Array.from(byTierAgg.entries())
    .map(([tier, b]) => ({ tier, activeCount: b.count, monthlyGbpPence: b.pence }))
    .sort((a, b) => b.monthlyGbpPence - a.monthlyGbpPence);

  const mrrGbpPence = byTier.reduce((s, r) => s + r.monthlyGbpPence, 0);

  const cancellingCount = active.filter(s => s.cancel_at_period_end).length;
  const new30dCount     = merchants.filter(s => new Date(s.created_at).getTime() > sinceCutoff).length;
  const churned30dCount = merchants.filter(s => s.canceled_at && new Date(s.canceled_at).getTime() > sinceCutoff).length;
  const homeownerActive = homeowners.filter(isActive).length;

  return {
    mrrGbpPence,
    arrGbpPence: mrrGbpPence * 12,
    activeCount: active.length,
    cancellingCount,
    new30dCount,
    churned30dCount,
    byTier,
    homeownerActive
  };
}

function normaliseTier(planKey: string | null): TierKey | "unknown" {
  if (!planKey) return "unknown";
  const k = planKey.toLowerCase();
  if (k === "free" || k === "starter" || k === "professional" || k === "business" || k === "works") return k;
  // Legacy fallbacks — old marketing names
  if (k === "canteen") return "starter";
  if (k === "van")     return "professional";
  if (k === "jeep")    return "business";
  return "unknown";
}

export function penceToGbp(pence: number): string {
  return (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}
