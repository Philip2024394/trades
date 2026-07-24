// Expenses breakdown.
//
// Sources today: hammerex_sitebook_costs (this merchant's cost lines
// on their own projects). Categories come from cost.kind.
//
// The spec lists many expense categories we cannot honestly source
// today (vehicles, fuel, insurance, subscriptions, training). We
// SURFACE that gap in `untracked_note` — no fabricated numbers, no
// silent omission.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type ExpenseBreakdown, type ExpenseCategoryRow } from "./types";

const DAY_MS = 86_400_000;

const UNTRACKED_CATEGORIES = [
  "vehicles", "fuel", "insurance", "subscriptions", "training", "utilities", "office costs"
];

export type BuildExpensesInput = {
  merchantListingId: string;
  windowDays?:       number;   // default 90
  now?:              Date;
};

export async function buildExpenses(opts: BuildExpensesInput): Promise<ExpenseBreakdown> {
  const now      = opts.now ?? new Date();
  const window   = opts.windowDays ?? 90;
  const fromIso  = new Date(now.getTime() - window * DAY_MS).toISOString();
  const evidence = evidenceFor("hammerex_sitebook_costs (grouped by kind)", ["hammerex_sitebook_costs"]);

  const costs = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("kind, agreed_pence, paid_pence, created_at")
    .eq("trade_listing_id", opts.merchantListingId)
    .gte("created_at", fromIso)
    .neq("status", "cancelled");

  const byKind = new Map<string, { spend: number; count: number }>();
  for (const c of costs.data ?? []) {
    const key = String(c.kind ?? "other");
    const spend = Number(c.paid_pence ?? 0) > 0 ? Number(c.paid_pence) : Number(c.agreed_pence ?? 0);
    const cur = byKind.get(key) ?? { spend: 0, count: 0 };
    cur.spend += spend;
    cur.count += 1;
    byKind.set(key, cur);
  }

  const categories: ExpenseCategoryRow[] = Array.from(byKind.entries())
    .map(([key, v]) => ({ key, label: labelKind(key), spend_pence: v.spend, cost_count: v.count }))
    .sort((a, b) => b.spend_pence - a.spend_pence);

  const total = categories.reduce((s, r) => s + r.spend_pence, 0);

  return {
    window_days:    window,
    total_pence:    total,
    categories,
    untracked_note: `Not yet tracked in Trade OS: ${UNTRACKED_CATEGORIES.join(", ")}. Add these categories when an expense source lands.`,
    evidence
  };
}

function labelKind(k: string): string {
  switch (k) {
    case "labour":    return "Labour";
    case "materials": return "Materials";
    case "supplier":  return "Supplier";
    case "deposit":   return "Deposit";
    case "final":     return "Final invoice";
    case "extra":     return "Variation / extra";
    default:          return k.charAt(0).toUpperCase() + k.slice(1);
  }
}
