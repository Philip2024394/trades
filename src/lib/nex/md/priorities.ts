// Cross-engine priorities ranker.
//
// Merges observations from BI + CX + MD (cash flow, profit, workforce)
// into ONE ranked list. Severity + urgency ordering:
//   alert (1) > warning (2) > notice (3) > info (4)
//
// Deduplication: same key across engines keeps only the highest-severity.

import type { BusinessHealth as BISnapshot } from "../bi/types";
import type { CashflowSnapshot, PriorityItem, ProfitSnapshot, WorkforceSnapshot } from "./types";
import { evidenceFor } from "./types";

const RANK: Record<PriorityItem["severity"], number> = { alert: 0, warning: 1, notice: 2, info: 3 };

export type BuildPrioritiesInput = {
  bi:        BISnapshot | null;
  cashflow:  CashflowSnapshot | null;
  profit:    ProfitSnapshot | null;
  workforce: WorkforceSnapshot | null;
  /** How many to return. Default 10. */
  limit?:    number;
};

export function buildPriorities(input: BuildPrioritiesInput): PriorityItem[] {
  const items: PriorityItem[] = [];

  // ── BI observations (already ranked by severity from Phase 5).
  if (input.bi) {
    for (const o of input.bi.observations) {
      items.push({
        key:      `bi:${o.key}`,
        source:   "bi",
        severity: o.severity,
        headline: o.headline,
        detail:   o.detail,
        action:   o.action,
        evidence: o.evidence
      });
    }
  }

  // ── Cash flow.
  if (input.cashflow) {
    const cf = input.cashflow;
    if (cf.overdue_now_pence >= 100_000) {
      items.push({
        key:      "md_cashflow:overdue",
        source:   "md_cashflow",
        severity: cf.overdue_now_pence >= 500_000 ? "alert" : "warning",
        headline: `£${(cf.overdue_now_pence / 100).toLocaleString("en-GB")} of agreed money is already overdue.`,
        detail:   "Overdue accounts are the fastest cash-flow fix. I can draft chase-up messages.",
        evidence: cf.evidence
      });
    }
    if (cf.buckets[0]?.net_pence < 0) {
      items.push({
        key:      "md_cashflow:next30_negative",
        source:   "md_cashflow",
        severity: "warning",
        headline: `Next-30-day cash-flow projection is £${((cf.buckets[0]?.net_pence ?? 0) / 100).toLocaleString("en-GB")}.`,
        detail:   "Chase overdue, follow up on quoted pipeline, or delay non-essential spend.",
        evidence: cf.evidence
      });
    }
    if (cf.pipeline_weighted_pence > 500_000) {
      items.push({
        key:      "md_cashflow:pipeline_strong",
        source:   "md_cashflow",
        severity: "info",
        headline: `Quoted pipeline (probability-weighted) sits at £${(cf.pipeline_weighted_pence / 100).toLocaleString("en-GB")} — worth chasing to close.`,
        evidence: cf.evidence
      });
    }
  }

  // ── Profit.
  if (input.profit) {
    const p = input.profit;
    for (const low of p.low_margin_jobs.slice(0, 3)) {
      items.push({
        key:      `md_profit:low_margin_${low.quote_id}`,
        source:   "md_profit",
        severity: low.margin_pct_planned < 5 ? "warning" : "notice",
        headline: `"${low.title}" quoted at ${low.margin_pct_planned}% margin — below your ${p.target_margin_pct}% target.`,
        detail:   "Consider re-quoting, adding a variation, or accepting the cost as a strategic loss.",
        evidence: low.evidence
      });
    }
    if (p.totals.weighted_margin_pct > 0 && p.totals.weighted_margin_pct < p.target_margin_pct) {
      items.push({
        key:      "md_profit:weighted_low",
        source:   "md_profit",
        severity: "notice",
        headline: `Weighted margin across accepted jobs is ${p.totals.weighted_margin_pct}% (target ${p.target_margin_pct}%).`,
        evidence: p.evidence
      });
    }
  }

  // ── Workforce.
  if (input.workforce) {
    for (const w of input.workforce.warnings) {
      items.push({
        key:      `md_workforce:${w.slice(0, 20).toLowerCase().replace(/\W+/g, "_")}`,
        source:   "md_workforce",
        severity: "notice",
        headline: w,
        evidence: input.workforce.evidence
      });
    }
  }

  // Dedup by key (keep highest severity when duplicated).
  const bestByKey = new Map<string, PriorityItem>();
  for (const it of items) {
    const cur = bestByKey.get(it.key);
    if (!cur || RANK[it.severity] < RANK[cur.severity]) bestByKey.set(it.key, it);
  }
  const merged = Array.from(bestByKey.values()).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return merged.slice(0, input.limit ?? 10);
}

/** Helper: is a priority list "silent"? Used by the briefing composer
 *  to decide whether to render a "nothing needs your attention" line. */
export function isSilent(list: PriorityItem[]): boolean {
  return list.every((p) => p.severity === "info");
}

/** Adapter helper — synthesise a manual priority item with evidence. */
export function makePriority(input: Omit<PriorityItem, "evidence"> & { evidenceSource?: string; evidenceTables?: string[] }): PriorityItem {
  const { evidenceSource, evidenceTables, ...rest } = input;
  return {
    ...rest,
    evidence: evidenceFor(evidenceSource ?? "engine composition", evidenceTables ?? [])
  };
}
