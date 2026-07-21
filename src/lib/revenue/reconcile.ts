// Stripe Reconciliation · flags DB↔Stripe drift.
//
// A subscription can drift when:
//   * Webhook fails silently (Stripe status changes, DB doesn't)
//   * Manual DB edit doesn't update Stripe
//   * Trial expiry not synced
//   * Legacy plan_key still on the row but Stripe price already migrated
//
// V1 flags row-shape anomalies without hitting the Stripe API (fast,
// no rate-limit). Phase 6.5+ adds live Stripe API pull for canonical
// diff. Everything here reads-only — no auto-fix (audit-log-first ethos).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TIER_CATALOG, type TierKey } from "@/lib/tierCatalog";

export type ReconciliationIssue = {
  subscriptionId:  string;
  merchantId:      string | null;
  stripeSubId:     string | null;
  issueKind:
    | "no_plan_key"                     // Stripe sub exists, no plan_key locally
    | "plan_key_unknown"                // plan_key doesn't match any TIER_CATALOG key
    | "expired_period"                  // current_period_end in the past but status still active
    | "cancelled_still_active"          // canceled_at set but status = active
    | "trial_expired_no_status_change"  // trial_end in the past but status still trialing
    | "no_stripe_id";                   // status = active but no stripe_subscription_id
  severity:        "low" | "normal" | "high";
  detail:          string;
  observedAt:      string;
};

export async function loadReconciliationIssues(): Promise<ReconciliationIssue[]> {
  const res = await supabaseAdmin
    .from("os_billing_subscriptions")
    .select("id, merchant_id, stripe_subscription_id, plan_key, status, current_period_end, canceled_at, trial_end");
  const rows = (res.data as Array<{
    id: string; merchant_id: string | null;
    stripe_subscription_id: string | null;
    plan_key: string | null; status: string | null;
    current_period_end: string | null; canceled_at: string | null; trial_end: string | null;
  }>) ?? [];

  const now = new Date();
  const issues: ReconciliationIssue[] = [];
  const knownTiers = new Set<TierKey>(Object.keys(TIER_CATALOG) as TierKey[]);

  for (const r of rows) {
    const base = {
      subscriptionId: r.id,
      merchantId:     r.merchant_id,
      stripeSubId:    r.stripe_subscription_id,
      observedAt:     now.toISOString()
    };

    if (r.stripe_subscription_id && !r.plan_key) {
      issues.push({ ...base, issueKind: "no_plan_key", severity: "high", detail: "Stripe subscription linked but plan_key is null" });
    }
    if (r.plan_key && !knownTiers.has(r.plan_key as TierKey) && r.plan_key !== "canteen" && r.plan_key !== "van" && r.plan_key !== "jeep") {
      issues.push({ ...base, issueKind: "plan_key_unknown", severity: "normal", detail: `plan_key "${r.plan_key}" not in TIER_CATALOG` });
    }
    if (r.status === "active" && r.current_period_end && new Date(r.current_period_end) < now) {
      issues.push({ ...base, issueKind: "expired_period", severity: "high", detail: `Status active but period ended ${r.current_period_end}` });
    }
    if (r.canceled_at && r.status === "active") {
      issues.push({ ...base, issueKind: "cancelled_still_active", severity: "normal", detail: `canceled_at set (${r.canceled_at}) but status still active` });
    }
    if (r.status === "trialing" && r.trial_end && new Date(r.trial_end) < now) {
      issues.push({ ...base, issueKind: "trial_expired_no_status_change", severity: "normal", detail: `Trial ended ${r.trial_end} but status still trialing` });
    }
    if (r.status === "active" && !r.stripe_subscription_id) {
      issues.push({ ...base, issueKind: "no_stripe_id", severity: "high", detail: "Status active but no Stripe subscription ID — likely manual seed / test data" });
    }
  }
  return issues.sort((a, b) => (severityRank(b.severity) - severityRank(a.severity)));
}

function severityRank(s: "low" | "normal" | "high"): number {
  return s === "high" ? 3 : s === "normal" ? 2 : 1;
}
