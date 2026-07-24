// Cash-flow forecast — forward-looking money-in projection.
//
// Sources of INFLOW we can honestly read today:
//   • app_quote_workspace_quotes — sent-but-not-accepted (pipeline,
//     weighted by an acceptance probability derived from prior history)
//   • hammerex_sitebook_costs — agreed but not fully paid, keyed on the
//     merchant's own listing_id, distributed to the due_at date bucket
//
// OUTFLOW we can honestly read today:
//   • No dedicated expense/purchase-order table exists yet, so outflow
//     is 0 with an honest warning until a source lands.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type CashflowBucket, type CashflowSnapshot } from "./types";

const DAY_MS = 86_400_000;
const HORIZON_DAYS = 90;

/** Historical acceptance rate over the last N days — used to weight
 *  the pipeline. Falls back to a conservative 35% when data is thin. */
async function historicalAcceptanceRate(merchantId: string, now: Date, days = 180): Promise<number> {
  const fromIso = new Date(now.getTime() - days * DAY_MS).toISOString();
  const sent = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .not("sent_at", "is", null)
    .gte("sent_at", fromIso);
  const accepted = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", fromIso);
  const s = sent.count ?? 0;
  const a = accepted.count ?? 0;
  if (s < 3) return 0.35;
  return Math.max(0.05, Math.min(0.9, a / s));
}

export type BuildCashflowInput = {
  merchantId:        string;   // hammerex_trade_off_listings.id (also used as CRM merchant_id)
  merchantListingId: string;
  now?:              Date;
};

export async function buildCashflow(opts: BuildCashflowInput): Promise<CashflowSnapshot> {
  const now = opts.now ?? new Date();
  const evidence = evidenceFor(
    "app_quote_workspace_quotes + hammerex_sitebook_costs",
    ["app_quote_workspace_quotes", "hammerex_sitebook_costs"]
  );

  // ── Outstanding costs owed to this merchant, distributed to due_at
  //    buckets (30 / 60 / 90 days from now).
  const costs = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("agreed_pence, paid_pence, due_at")
    .eq("trade_listing_id", opts.merchantListingId)
    .neq("status", "cancelled");

  const buckets: CashflowBucket[] = [30, 60, 90].map((days) => ({
    end_date: new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10),
    inflow_pence:  0,
    outflow_pence: 0,
    net_pence:     0
  }));

  let outstandingNow = 0;
  let overdueNow     = 0;
  for (const c of costs.data ?? []) {
    const agreed = Number(c.agreed_pence ?? 0);
    const paid   = Number(c.paid_pence ?? 0);
    const outstanding = Math.max(0, agreed - paid);
    if (outstanding === 0) continue;
    outstandingNow += outstanding;
    const dueIso = c.due_at as string | null;
    if (dueIso && new Date(dueIso).getTime() < now.getTime()) overdueNow += outstanding;

    // Assign to the earliest bucket whose end_date is on/after due_at.
    // No due_at → assume it comes in over the 30d bucket (conservative).
    let assigned = false;
    if (dueIso) {
      const dueMs = new Date(dueIso).getTime();
      for (const b of buckets) {
        if (dueMs <= new Date(b.end_date).getTime() + DAY_MS) {
          b.inflow_pence += outstanding;
          assigned = true;
          break;
        }
      }
    }
    if (!assigned) buckets[0].inflow_pence += outstanding;   // no due_at → 30d bucket
  }

  // ── Pipeline: quotes sent but not yet accepted/rejected × probability.
  //    Distributed evenly across the first two buckets (conservative:
  //    typical acceptance falls within 30-60d).
  const pipeline = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("total_pence, sent_at")
    .eq("merchant_id", opts.merchantId)
    .not("sent_at", "is", null)
    .is("accepted_at", null)
    .is("rejected_at", null);

  const rate = await historicalAcceptanceRate(opts.merchantId, now);
  const pipelineRaw = (pipeline.data ?? []).reduce((sum, q) => sum + Number(q.total_pence ?? 0), 0);
  const pipelineWeighted = Math.round(pipelineRaw * rate);

  // Half in 30d bucket, half in 60d.
  const half = Math.round(pipelineWeighted / 2);
  buckets[0].inflow_pence += half;
  buckets[1].inflow_pence += pipelineWeighted - half;

  // Recompute net.
  for (const b of buckets) b.net_pence = b.inflow_pence - b.outflow_pence;

  const horizon = buckets.reduce((s, b) => s + b.net_pence, 0);

  const warnings: string[] = [];
  if (overdueNow > 100_000)   warnings.push(`£${(overdueNow / 100).toLocaleString("en-GB")} is already overdue.`);
  if (buckets[0].net_pence < 0) warnings.push("Next-30-day forecast is negative on visible sources.");
  warnings.push("Outflow tracking (expenses/purchase orders) not yet wired — figures show money-in only.");

  return {
    currency:                "GBP",
    computed_at:             now.toISOString(),
    buckets,
    horizon_pence:           horizon,
    outstanding_now_pence:   outstandingNow,
    overdue_now_pence:       overdueNow,
    pipeline_weighted_pence: pipelineWeighted,
    warnings,
    evidence
  };
}
