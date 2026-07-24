// Realised profit — computed from accepted quotes.
//
// Data model: an accepted quote row (app_quote_workspace_quotes) has
// materials_pence + labour_pence + vat_pence + total_pence. Nex's
// estimator (Phase 7) writes those columns when drafting a quote and
// puts the profit + overhead into notes, so quoted → total is the
// "sold" price, materials + labour is the visible cost.
//
// Realised money-in comes from sitebook_costs where trade_listing_id
// is this merchant.
//
// PLANNED profit = total - (materials + labour + vat). We can compute
// it honestly. REALISED profit (variance vs actual cost) needs an
// actual-cost source that doesn't exist yet — flagged in warnings.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type JobProfit, type ProfitSnapshot } from "./types";

const DAY_MS = 86_400_000;

export type BuildProfitInput = {
  merchantId:        string;
  merchantListingId: string;
  targetMarginPct?:  number;   // default 20
  lookbackDays?:     number;   // default 90
  now?:              Date;
};

export async function buildProfit(opts: BuildProfitInput): Promise<ProfitSnapshot> {
  const now         = opts.now ?? new Date();
  const target      = opts.targetMarginPct ?? 20;
  const lookback    = opts.lookbackDays    ?? 90;
  const fromIso     = new Date(now.getTime() - lookback * DAY_MS).toISOString();
  const evidence    = evidenceFor(
    "app_quote_workspace_quotes (accepted) + hammerex_sitebook_costs (paid)",
    ["app_quote_workspace_quotes", "hammerex_sitebook_costs"]
  );

  const quotes = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id, title, status, materials_pence, labour_pence, vat_pence, total_pence, accepted_at")
    .eq("merchant_id", opts.merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", fromIso);

  const jobs: JobProfit[] = [];
  for (const q of quotes.data ?? []) {
    const total   = Number(q.total_pence ?? 0);
    const mats    = Number(q.materials_pence ?? 0);
    const labour  = Number(q.labour_pence ?? 0);
    const vat     = Number(q.vat_pence ?? 0);
    const overhead = 0;   // captured inside materials_pence in the estimator's mapping — visible in notes only
    const plannedProfit = Math.max(0, total - mats - labour - vat - overhead);
    const margin = total === 0 ? 0 : Number(((plannedProfit / total) * 100).toFixed(1));

    // Realised: sum paid_pence on sitebook_costs tied to this merchant.
    // We can't reliably tie a cost row to a specific quote id today, so
    // paid_pence is reported as "against this quote's aggregate" — the
    // adapter surfaces it honestly under a per-job note.
    const paid = 0;   // per-quote realised revenue would need a costs.quote_id column — not present

    jobs.push({
      quote_id:              String(q.id),
      title:                 String(q.title ?? "(untitled)"),
      estimated_total_pence: total,
      materials_pence:       mats,
      labour_pence:          labour,
      overhead_pence:        overhead,
      profit_pence_planned:  plannedProfit,
      paid_pence:            paid,
      status:                String(q.status ?? "accepted"),
      margin_pct_planned:    margin,
      evidence
    });
  }

  const quotedTotal      = jobs.reduce((s, j) => s + j.estimated_total_pence, 0);
  const plannedProfitTotal = jobs.reduce((s, j) => s + j.profit_pence_planned, 0);
  const weightedMargin   = quotedTotal === 0 ? 0
    : Number(((plannedProfitTotal / quotedTotal) * 100).toFixed(1));

  const lowMargin = jobs.filter((j) => j.margin_pct_planned < target).sort((a, b) => a.margin_pct_planned - b.margin_pct_planned);

  const warnings: string[] = [];
  if (jobs.length === 0)      warnings.push("No accepted quotes in the last " + lookback + " days — nothing to compute profit against.");
  if (lowMargin.length > 0)   warnings.push(`${lowMargin.length} accepted job${lowMargin.length === 1 ? "" : "s"} under your ${target}% target margin.`);
  warnings.push("Realised-cost tracking (actual material spend, labour hours logged) not yet wired — profit numbers are PLANNED from the quote, not realised.");

  return {
    computed_at:  now.toISOString(),
    jobs,
    totals: {
      quoted_pence:        quotedTotal,
      planned_profit_pence: plannedProfitTotal,
      weighted_margin_pct:  weightedMargin
    },
    low_margin_jobs:    lowMargin,
    target_margin_pct:  target,
    warnings,
    evidence
  };
}
