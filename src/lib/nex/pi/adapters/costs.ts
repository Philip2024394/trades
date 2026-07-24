// Costs adapter — reads hammerex_sitebook_costs + cost_payments.
//
// KPIs:
//   • agreed_gbp    — total agreed across all costs
//   • paid_gbp      — total paid
//   • outstanding_gbp
//   • overdue_gbp   — costs past due_at, not fully paid
//   • budget_used_pct — paid / budget_max_gbp (project row)
// Permissions:
//   Cash figures (paid_gbp, outstanding_gbp, overdue_gbp, budget_used_pct)
//   are visible_to homeowner only — merchants never see the homeowner
//   ledger. Merchants CAN see agreed_gbp filtered to costs where they
//   are the assigned trade (their own agreed values).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, Metric, Observation, TimelineEvent } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";

export const costsAdapter: PIAdapter = {
  aspect: "costs",
  label:  "Costs",
  weight: 2.0,

  async run(ctx) {
    const now      = ctx.now ?? new Date();
    const evidence = evidenceFor("hammerex_sitebook_costs", ["hammerex_sitebook_costs", "hammerex_sitebook_cost_payments"], `/sitebook/${ctx.projectId}`);

    let costQuery = supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("id, agreed_pence, paid_pence, status, kind, due_at, trade_listing_id, trade_name, description, created_at")
      .eq("project_id", ctx.projectId);

    // Merchants only see costs where they're the assigned trade.
    if (ctx.viewer === "merchant") costQuery = costQuery.eq("trade_listing_id", ctx.viewerId);

    const costs = await costQuery;

    const project = await supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("budget_max_gbp, budget_min_gbp")
      .eq("id", ctx.projectId)
      .maybeSingle();

    const rows = costs.data ?? [];
    const agreedPence = rows.reduce((s, r) => s + Number(r.agreed_pence ?? 0), 0);
    const paidPence   = rows.reduce((s, r) => s + Number(r.paid_pence ?? 0), 0);
    const outstandingPence = Math.max(0, agreedPence - paidPence);
    const overduePence = rows
      .filter((r) => r.due_at && new Date(r.due_at as string).getTime() < now.getTime() && Number(r.paid_pence ?? 0) < Number(r.agreed_pence ?? 0))
      .reduce((s, r) => s + Math.max(0, Number(r.agreed_pence ?? 0) - Number(r.paid_pence ?? 0)), 0);

    const budgetMaxGbp = project.data?.budget_max_gbp ?? null;
    const budgetUsedPct = budgetMaxGbp && budgetMaxGbp > 0
      ? Number((((paidPence / 100) / Number(budgetMaxGbp)) * 100).toFixed(1))
      : null;

    const metrics: Metric[] = [
      { key: "costs_count",   label: "Cost lines",   value: rows.length, unit: "count", direction: "neutral", evidence },
      { key: "agreed_gbp",    label: "Agreed",       value: Number((agreedPence / 100).toFixed(2)), unit: "gbp", direction: "neutral", evidence }
    ];

    // Homeowner-only cash metrics.
    metrics.push(
      { key: "paid_gbp",         label: "Paid",         value: Number((paidPence / 100).toFixed(2)),         unit: "gbp", direction: "neutral",           evidence, visible_to: ["homeowner"] },
      { key: "outstanding_gbp",  label: "Outstanding",  value: Number((outstandingPence / 100).toFixed(2)),  unit: "gbp", direction: "lower_is_better",   evidence, visible_to: ["homeowner"] },
      { key: "overdue_gbp",      label: "Overdue",      value: Number((overduePence / 100).toFixed(2)),      unit: "gbp", direction: "lower_is_better",   evidence, visible_to: ["homeowner"] }
    );
    if (budgetUsedPct !== null) {
      metrics.push({ key: "budget_used_pct", label: "Budget used", value: budgetUsedPct, unit: "pct", direction: "lower_is_better", evidence, visible_to: ["homeowner"] });
    }

    // Kind breakdown — cheap to compute here, useful for "how much on materials?"
    const kindTotals: Record<string, number> = {};
    for (const r of rows) {
      const k = String(r.kind ?? "other");
      kindTotals[k] = (kindTotals[k] ?? 0) + Number(r.agreed_pence ?? 0);
    }
    for (const [kind, pence] of Object.entries(kindTotals)) {
      metrics.push({
        key:      `agreed_${kind}_gbp`,
        label:    `Agreed (${kind})`,
        value:    Number((pence / 100).toFixed(2)),
        unit:     "gbp",
        direction: "neutral",
        evidence
      });
    }

    const observations: Observation[] = [];
    if (overduePence > 0) {
      observations.push({
        key:      "costs_overdue",
        aspect:   "costs",
        severity: overduePence > 100_000 ? "alert" : "warning",
        headline: `£${(overduePence / 100).toLocaleString("en-GB")} is past its due date without full payment.`,
        detail:   "Chase the payment or extend the due date so the ledger stays honest.",
        action:   { label: "Open cost ledger", href: `/sitebook/${ctx.projectId}` },
        evidence,
        visible_to: ["homeowner"]
      });
    }
    if (budgetUsedPct !== null && budgetUsedPct >= 90) {
      observations.push({
        key:      "budget_near_ceiling",
        aspect:   "costs",
        severity: budgetUsedPct >= 100 ? "alert" : "warning",
        headline: budgetUsedPct >= 100
          ? `Spend has passed the budget ceiling (${budgetUsedPct}%).`
          : `Spend has reached ${budgetUsedPct}% of the budget ceiling.`,
        evidence,
        visible_to: ["homeowner"]
      });
    }

    const timeline: TimelineEvent[] = [];
    // No per-cost timeline events — the cost_payments table has paid_at
    // rows; add them as timeline entries.
    if (ctx.viewer === "homeowner") {
      const pays = await supabaseAdmin
        .from("hammerex_sitebook_cost_payments")
        .select("amount_pence, paid_at, method, cost_id, hammerex_sitebook_costs!inner(project_id, trade_name)")
        // Supabase joins fail silently on some versions — fall back to a project-scoped filter.
        .eq("hammerex_sitebook_costs.project_id", ctx.projectId)
        .order("paid_at", { ascending: false })
        .limit(20);
      for (const p of pays.data ?? []) {
        const parent = (p as { hammerex_sitebook_costs?: { trade_name?: string | null } | null }).hammerex_sitebook_costs ?? null;
        timeline.push({
          at:         p.paid_at as string,
          event_type: "payment_made",
          actor_type: "homeowner",
          actor_name: null,
          headline:   `Paid £${(Number(p.amount_pence) / 100).toLocaleString("en-GB")}${parent?.trade_name ? ` to ${parent.trade_name}` : ""}.`,
          evidence,
          visible_to: ["homeowner"]
        });
      }
    }

    // Sub-score: homeowner leans on budget-used; merchant leans on
    // agreed-count activity. Merchants who see nothing get null.
    const merchantHasData = ctx.viewer === "merchant" && rows.length > 0;
    let sub_score: number | null;
    if (ctx.viewer === "homeowner") {
      if (rows.length === 0) sub_score = 50;
      else if (budgetUsedPct === null) sub_score = overduePence > 0 ? 40 : 75;
      else sub_score = scoreMetric(budgetUsedPct, { floor: 120, ceiling: 40, direction: "lower_is_better" });
    } else {
      sub_score = merchantHasData ? 70 : null;
    }

    return {
      aspect: "costs",
      label:  "Costs",
      sub_score,
      weight: 2.0,
      metrics,
      observations,
      timeline
    };
  }
};
