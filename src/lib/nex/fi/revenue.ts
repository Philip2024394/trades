// Revenue rollups — per-customer / per-project / per-kind.
//
// Sources:
//   • app_quote_workspace_quotes (accepted)                — the sold
//   • hammerex_sitebook_costs (kind breakdown)              — how it split
//
// Per-customer aggregation joins accepted quotes on merchant_id +
// homeowner_party_id then hydrates to app_crm_contacts.display_name.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type RevenueBreakdown, type RevenueRow } from "./types";

const DAY_MS = 86_400_000;

export type BuildRevenueInput = {
  merchantId:        string;
  merchantListingId: string;
  windowDays?:       number;   // default 90
  topN?:             number;   // default 5
  now?:              Date;
};

export async function buildRevenue(opts: BuildRevenueInput): Promise<RevenueBreakdown> {
  const now      = opts.now ?? new Date();
  const window   = opts.windowDays ?? 90;
  const topN     = opts.topN ?? 5;
  const fromIso  = new Date(now.getTime() - window * DAY_MS).toISOString();
  const evidence = evidenceFor(
    "app_quote_workspace_quotes (accepted) + hammerex_sitebook_costs (kind)",
    ["app_quote_workspace_quotes", "hammerex_sitebook_costs", "app_crm_contacts"]
  );

  const quotes = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id, title, total_pence, homeowner_party_id, project_id")
    .eq("merchant_id", opts.merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", fromIso);

  const rows = quotes.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total_pence ?? 0), 0);

  // ── Per-project (title of the quote as the project label).
  const byProject = new Map<string, { label: string; amount: number; count: number }>();
  for (const q of rows) {
    const key = String(q.project_id ?? `quote_${q.id}`);
    const cur = byProject.get(key) ?? { label: String(q.title ?? "(untitled)"), amount: 0, count: 0 };
    cur.amount += Number(q.total_pence ?? 0);
    cur.count  += 1;
    byProject.set(key, cur);
  }
  const projectRows: RevenueRow[] = Array.from(byProject.entries())
    .map(([key, v]) => ({ key, label: v.label, amount_pence: v.amount, count: v.count }))
    .sort((a, b) => b.amount_pence - a.amount_pence)
    .slice(0, topN);

  // ── Per-customer: hydrate homeowner_party_id → app_crm_contacts.display_name.
  const partyIds = Array.from(new Set(rows.map((r) => r.homeowner_party_id).filter((x): x is string => !!x)));
  let customerRows: RevenueRow[] = [];
  if (partyIds.length > 0) {
    const contacts = await supabaseAdmin
      .from("app_crm_contacts")
      .select("party_id, display_name")
      .eq("merchant_id", opts.merchantId)
      .in("party_id", partyIds);
    const nameByParty = new Map<string, string>();
    for (const c of contacts.data ?? []) nameByParty.set(String(c.party_id), String(c.display_name));

    const byCustomer = new Map<string, { label: string; amount: number; count: number }>();
    for (const q of rows) {
      const partyId = q.homeowner_party_id as string | null;
      if (!partyId) continue;
      const label = nameByParty.get(partyId) ?? "(unnamed)";
      const cur = byCustomer.get(partyId) ?? { label, amount: 0, count: 0 };
      cur.amount += Number(q.total_pence ?? 0);
      cur.count  += 1;
      byCustomer.set(partyId, cur);
    }
    customerRows = Array.from(byCustomer.entries())
      .map(([key, v]) => ({ key, label: v.label, amount_pence: v.amount, count: v.count }))
      .sort((a, b) => b.amount_pence - a.amount_pence)
      .slice(0, topN);
  }

  // ── Per-kind: from sitebook_costs where this merchant is the trade.
  const costs = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("kind, agreed_pence, paid_pence, created_at")
    .eq("trade_listing_id", opts.merchantListingId)
    .gte("created_at", fromIso);

  const byKind = new Map<string, { amount: number; count: number }>();
  for (const c of costs.data ?? []) {
    const k = String(c.kind ?? "other");
    const amt = Number(c.paid_pence ?? 0) > 0 ? Number(c.paid_pence) : Number(c.agreed_pence ?? 0);
    const cur = byKind.get(k) ?? { amount: 0, count: 0 };
    cur.amount += amt;
    cur.count  += 1;
    byKind.set(k, cur);
  }
  const kindRows: RevenueRow[] = Array.from(byKind.entries())
    .map(([key, v]) => ({ key, label: labelKind(key), amount_pence: v.amount, count: v.count }))
    .sort((a, b) => b.amount_pence - a.amount_pence)
    .slice(0, topN);

  return {
    window_days: window,
    total_pence: total,
    by_customer: customerRows,
    by_project:  projectRows,
    by_kind:     kindRows,
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
