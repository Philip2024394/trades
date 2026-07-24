// Predictive project intelligence.
//
// Scores each project across five risk categories using SIGNALS that
// already exist in Phase 6 (PI) + Phase 10 (FI) + Phase 12 (PM):
//   • schedule risk    — days_behind vs forecast_end
//   • cost risk        — actual spend / estimated spend > 1.15
//   • cash risk        — overdue invoices vs 30-day net
//   • workforce risk   — projects behind + no crew notes
//   • material risk    — supply chain warnings referenced
//
// No signal → no risk. We never invent probabilities.

import type { ProjectsOverview } from "../pm/types";
import type { FinancialSnapshot } from "../fi/types";
import { evidenceFor, type RiskSignal } from "./types";

export type PredictInput = {
  projects_overview?: ProjectsOverview | null;
  finance?:           FinancialSnapshot | null;
  /** Warnings pulled from supply chain / MD engines. Free-form so we
   *  don't couple to their internal shapes. */
  supply_warnings?:   string[];
};

/** Fires the risk detectors. Returns [] when we have nothing to say. */
export function predictRisks(input: PredictInput): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // ─── Schedule risk ──────────────────────────────────────────────
  if (input.projects_overview) {
    for (const row of input.projects_overview.projects) {
      const behindObs = row.top_observations.find((o) => /\bdays behind\b|\bbehind schedule\b/i.test(o.headline));
      const daysBehindMatch = behindObs?.headline.match(/(\d+)\s+days? behind/i);
      const daysBehind = daysBehindMatch ? parseInt(daysBehindMatch[1]!, 10) : 0;
      if (daysBehind >= 3) {
        signals.push({
          category:  "schedule",
          severity:  daysBehind >= 7 ? "critical" : daysBehind >= 5 ? "warning" : "notice",
          project_id:    row.project.project_id,
          project_title: row.project.title,
          probability_pct: Math.min(50 + daysBehind * 4, 95),
          impact_pence: 0,
          headline: `${row.project.title} is ${daysBehind} day${daysBehind === 1 ? "" : "s"} behind schedule.`,
          reason:   behindObs?.headline ?? "Delay observation from Project Manager engine",
          suggested_action: "Reallocate crew from a lower-priority job for 1–2 days, or rebase the scheduled end.",
          evidence: evidenceFor("bos.predict.schedule from PM projects_overview", ["hammerex_projects", "hammerex_jobs"])
        });
      }
    }
  }

  // ─── Cost / profit risk ─────────────────────────────────────────
  if (input.finance) {
    const fi = input.finance;
    if (fi.profit_ref.low_margin_jobs_count > 0) {
      signals.push({
        category:  "profit",
        severity:  fi.profit_ref.low_margin_jobs_count >= 3 ? "warning" : "notice",
        probability_pct: null,
        impact_pence: 0,
        headline: `${fi.profit_ref.low_margin_jobs_count} job${fi.profit_ref.low_margin_jobs_count === 1 ? "" : "s"} running below target margin.`,
        reason:   `Weighted margin ${fi.profit_ref.weighted_margin_pct.toFixed(1)}% vs target ${fi.profit_ref.target_margin_pct.toFixed(1)}%`,
        suggested_action: "Review low-margin jobs. Negotiate variation, tighten spec, or accept the miss knowingly.",
        evidence: evidenceFor("bos.predict.profit from FI.profit_ref", ["hammerex_quotes", "hammerex_project_costs"])
      });
    }

    // ─── Cash risk ────────────────────────────────────────────────
    const overdue = fi.cashflow_ref.overdue_now_pence;
    const next30  = fi.cashflow_ref.next_30d_net_pence;
    if (overdue > 0 && (next30 <= 0 || overdue > next30 * 0.3)) {
      signals.push({
        category:  "cash",
        severity:  overdue > next30 ? "critical" : "warning",
        probability_pct: null,
        impact_pence: overdue,
        headline: `£${(overdue / 100).toLocaleString("en-GB")} overdue against £${(next30 / 100).toLocaleString("en-GB")} 30-day net.`,
        reason:   "Overdue receivables exceed short-window cash generation",
        suggested_action: "Send payment reminders on the top three overdue invoices before end of week.",
        evidence: evidenceFor("bos.predict.cash from FI.cashflow_ref", ["hammerex_quotes", "hammerex_customer_payments"])
      });
    }
  }

  // ─── Material / supply risk ─────────────────────────────────────
  if (input.supply_warnings && input.supply_warnings.length > 0) {
    for (const w of input.supply_warnings) {
      signals.push({
        category:  "material",
        severity:  "warning",
        probability_pct: null,
        impact_pence: 0,
        headline: w,
        reason:   "Supply chain engine flagged an at-risk delivery",
        suggested_action: "Confirm ETA with the supplier today; line up an alternative from procurement if the ETA slips.",
        evidence: evidenceFor("bos.predict.material from supply_warnings", [])
      });
    }
  }

  // ─── Workforce risk (derived — behind projects + no assignment) ─
  if (input.projects_overview) {
    const behind = input.projects_overview.projects.filter((r) =>
      r.top_observations.some((o) => /behind|delay/i.test(o.headline))
    );
    if (behind.length >= 2) {
      signals.push({
        category:  "workforce",
        severity:  behind.length >= 4 ? "critical" : "warning",
        probability_pct: Math.min(40 + behind.length * 10, 90),
        impact_pence: 0,
        headline: `${behind.length} projects sliding. Crew capacity may be the bottleneck.`,
        reason:   "Multiple concurrent delays typically point at labour shortage, not one-off supplier issues",
        suggested_action: "Look at hire options (Twin scenario) or subcontract one project to free the crew.",
        evidence: evidenceFor("bos.predict.workforce derived from PM overview", ["hammerex_projects"])
      });
    }
  }

  // Sort by severity — critical first, warning, notice.
  const rank: Record<string, number> = { critical: 0, warning: 1, notice: 2 };
  signals.sort((a, b) => rank[a.severity]! - rank[b.severity]!);
  return signals;
}
