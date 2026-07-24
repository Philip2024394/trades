// Waste variance — estimated materials vs actual material spend.
//
// Data flow:
//   • ESTIMATED: sum(app_quote_workspace_quote_items.total_pence) where
//     kind='material' AND quote_id in (merchant's accepted quotes).
//   • ACTUAL:    sum(hammerex_sitebook_costs.paid_pence) where
//     kind='materials' AND trade_listing_id = merchant.
//
// Grouped per project (via app_quote_workspace_quotes.project_id).
// Variance = actual - estimated. Positive variance = you spent more
// on materials than you estimated (waste, over-purchase, or price
// change since quoting).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type WasteRow, type WasteSummary } from "./types";

const DAY_MS = 86_400_000;

export type BuildWasteInput = {
  merchantId:        string;
  merchantListingId: string;
  windowDays?:       number;    // default 90
  now?:              Date;
};

export async function buildWaste(opts: BuildWasteInput): Promise<WasteSummary> {
  const now       = opts.now ?? new Date();
  const window    = opts.windowDays ?? 90;
  const fromIso   = new Date(now.getTime() - window * DAY_MS).toISOString();
  const evidence  = evidenceFor(
    "app_quote_workspace_quote_items (estimated) + hammerex_sitebook_costs (actual)",
    ["app_quote_workspace_quote_items", "hammerex_sitebook_costs", "app_quote_workspace_quotes"]
  );

  // ── Accepted quotes in window with material line-items.
  const quotes = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id, title, project_id, accepted_at")
    .eq("merchant_id", opts.merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", fromIso);

  const quoteRows = quotes.data ?? [];
  if (quoteRows.length === 0) {
    return {
      window_days:           window,
      projects:              [],
      total_variance_pence:  0,
      average_variance_pct:  null,
      warnings:              ["No accepted quotes in the window — nothing to compare against."],
      evidence
    };
  }

  const quoteIds = quoteRows.map((q) => String(q.id));

  // ── Estimated material spend by project.
  const items = await supabaseAdmin
    .from("app_quote_workspace_quote_items")
    .select("quote_id, total_pence")
    .in("quote_id", quoteIds)
    .eq("kind", "material");

  const estByProject = new Map<string, number>();
  const projectOfQuote = new Map<string, string>();
  const titleOfProject = new Map<string, string>();
  for (const q of quoteRows) {
    const pid = String(q.project_id);
    projectOfQuote.set(String(q.id), pid);
    titleOfProject.set(pid, String(q.title ?? "(untitled)"));
  }
  for (const it of items.data ?? []) {
    const pid = projectOfQuote.get(String(it.quote_id));
    if (!pid) continue;
    estByProject.set(pid, (estByProject.get(pid) ?? 0) + Number(it.total_pence ?? 0));
  }

  // ── Actual material spend by project.
  const actuals = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("project_id, paid_pence, agreed_pence")
    .eq("trade_listing_id", opts.merchantListingId)
    .eq("kind", "materials")
    .in("project_id", Array.from(estByProject.keys()));

  const actByProject = new Map<string, number>();
  for (const a of actuals.data ?? []) {
    const pid = String(a.project_id);
    const amt = Number(a.paid_pence ?? 0) > 0 ? Number(a.paid_pence) : Number(a.agreed_pence ?? 0);
    actByProject.set(pid, (actByProject.get(pid) ?? 0) + amt);
  }

  const projects: WasteRow[] = [];
  for (const [pid, est] of estByProject) {
    const act = actByProject.get(pid) ?? 0;
    const variance = act - est;
    const variancePct = est === 0 ? null : Number(((variance / est) * 100).toFixed(1));
    projects.push({
      project_id:                pid,
      project_title:             titleOfProject.get(pid) ?? "(untitled)",
      estimated_materials_pence: est,
      actual_materials_pence:    act,
      variance_pence:            variance,
      variance_pct:              variancePct,
      evidence
    });
  }
  projects.sort((a, b) => b.variance_pence - a.variance_pence);

  const totalVariance = projects.reduce((s, r) => s + r.variance_pence, 0);
  const validPcts = projects.map((r) => r.variance_pct).filter((n): n is number => n !== null);
  const avgPct = validPcts.length === 0 ? null : Number((validPcts.reduce((s, n) => s + n, 0) / validPcts.length).toFixed(1));

  const warnings: string[] = [];
  const zeroActuals = projects.filter((p) => p.actual_materials_pence === 0).length;
  if (zeroActuals > 0) warnings.push(`${zeroActuals} project${zeroActuals === 1 ? "" : "s"} have no actual material costs recorded yet — variance may look large only because actuals haven't been logged.`);

  return {
    window_days:          window,
    projects,
    total_variance_pence: totalVariance,
    average_variance_pct: avgPct,
    warnings,
    evidence
  };
}
