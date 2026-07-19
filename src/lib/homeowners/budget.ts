// SiteBook budget summary — server-side loader for SimpleBudgetCard.
//
// Rule 1 (Questions not features): answers ONE question — "How much
// has each project cost, and what's left?" No line-items, no
// categories, no charts.
//
// Rule 2 (Replace work): kills the "am I over budget?" mental load
// and the need for a spreadsheet on the side.
//
// MVP uses existing columns on hammerex_sitebook_projects
// (budget_max_gbp = target, total_spent_gbp = actual). No new DB.
// Line-item power-view comes later in Pro tier per the blueprint.
//
// Blueprint: docs/SITEBOOK_BLUEPRINT_v2_2_FINAL.md · Phase 1 · Slot 2.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProjectBudget = {
  projectId:      string;
  title:          string;
  targetPence:    number;
  spentPence:     number;
  percent:        number;   // 0-999 (999 = way over)
  tone:           "healthy" | "watch" | "over";
};

/** Load budget summaries for every active project belonging to the
 *  homeowner that has a budget target set. Projects without a
 *  budget_max_gbp are omitted (empty state signals: set a budget). */
export async function loadProjectBudgets(homeownerId: string): Promise<ProjectBudget[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, budget_max_gbp, total_spent_gbp, status")
    .eq("homeowner_id", homeownerId)
    .in("status", ["active", "in-progress"])
    .not("budget_max_gbp", "is", null)
    .order("created_at", { ascending: false });

  type Row = {
    id:              string;
    title:           string;
    budget_max_gbp:  number | null;
    total_spent_gbp: number | null;
    status:          string;
  };
  const rows = (res.data as Row[]) ?? [];

  return rows.map((r) => summarise(r.id, r.title, r.budget_max_gbp, r.total_spent_gbp));
}

/** Pure — build a ProjectBudget from raw fields. Exported so callers
 *  can synthesise summaries from fixture data or non-DB sources. */
export function summarise(
  projectId: string,
  title:     string,
  targetGbp: number | null,
  spentGbp:  number | null
): ProjectBudget {
  const targetPence = Math.round(((targetGbp ?? 0) as number) * 100);
  const spentPence  = Math.round(((spentGbp  ?? 0) as number) * 100);
  const percent     = targetPence > 0 ? Math.min(999, Math.round((spentPence / targetPence) * 100)) : 0;
  const tone: ProjectBudget["tone"] =
    percent >= 100 ? "over"
    : percent >= 80 ? "watch"
    : "healthy";
  return { projectId, title, targetPence, spentPence, percent, tone };
}

/** £3,240 formatter. Skips the ".00" on whole pounds. */
export function formatGbp(pence: number): string {
  const gbp = pence / 100;
  const opts: Intl.NumberFormatOptions = { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 };
  return new Intl.NumberFormat("en-GB", opts).format(gbp);
}
