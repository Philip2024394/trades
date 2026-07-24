// Supplier ranking — from sitebook_costs where kind='supplier' or
// 'materials'. Groups by trade_name (the merchant's own free-text label
// for who supplied the goods). No dedicated supplier catalogue exists,
// so we honestly rank by what appears on the merchant's own ledger.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type SupplierRow, type SupplierSnapshot } from "./types";

const DAY_MS = 86_400_000;

export type BuildSuppliersInput = {
  merchantId:        string;
  merchantListingId: string;
  windowDays?:       number;   // default 90
  now?:              Date;
};

export async function buildSuppliers(opts: BuildSuppliersInput): Promise<SupplierSnapshot> {
  const now = opts.now ?? new Date();
  const window = opts.windowDays ?? 90;
  const fromIso = new Date(now.getTime() - window * DAY_MS).toISOString();
  const evidence = evidenceFor(
    "hammerex_sitebook_costs (kind=supplier|materials)",
    ["hammerex_sitebook_costs"]
  );

  const rows = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("trade_name, agreed_pence, paid_pence, created_at, kind")
    .in("kind", ["supplier", "materials"])
    .eq("trade_listing_id", opts.merchantListingId)
    .gte("created_at", fromIso);

  const byName = new Map<string, SupplierRow>();
  for (const r of rows.data ?? []) {
    const key = String(r.trade_name ?? "(unlabelled)");
    const spend = Number(r.paid_pence ?? 0) > 0
      ? Number(r.paid_pence ?? 0)
      : Number(r.agreed_pence ?? 0);
    const created = r.created_at as string;
    const cur = byName.get(key) ?? { supplier_key: key, spend_pence: 0, cost_count: 0, latest_cost_at: null };
    cur.spend_pence += spend;
    cur.cost_count  += 1;
    if (!cur.latest_cost_at || created > cur.latest_cost_at) cur.latest_cost_at = created;
    byName.set(key, cur);
  }

  const suppliers = Array.from(byName.values()).sort((a, b) => b.spend_pence - a.spend_pence);
  const total = suppliers.reduce((s, r) => s + r.spend_pence, 0);

  return {
    computed_at:       now.toISOString(),
    window_days:       window,
    suppliers,
    total_spend_pence: total,
    evidence
  };
}
