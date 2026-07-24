// Delivery planner — suggests when to place the order so materials
// arrive in time for a scheduled job.
//
// Lead time = median days between (cost.created_at) and (cost.due_at)
// for the same supplier — a proxy since no actual delivery-date column
// exists. If history is thin (<3 rows) we fall back to a 3-day default
// and label the source honestly.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type DeliverySuggestion } from "./types";

const DAY_MS = 86_400_000;

export type SuggestDeliveryInput = {
  merchantListingId: string;
  supplierName:      string;
  materialHint:      string;
  needBy:            Date;      // when materials must be on site
  now?:              Date;
};

export async function suggestDelivery(opts: SuggestDeliveryInput): Promise<DeliverySuggestion> {
  const now      = opts.now ?? new Date();
  const evidence = evidenceFor("hammerex_sitebook_costs (lead-time proxy from created→due)", ["hammerex_sitebook_costs"]);

  // Pull recent cost rows for this supplier where both created_at and
  // due_at exist — treat (due_at - created_at) as a lead-time proxy.
  const rows = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("created_at, due_at")
    .eq("trade_listing_id", opts.merchantListingId)
    .eq("trade_name", opts.supplierName)
    .not("due_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const leads: number[] = [];
  for (const r of rows.data ?? []) {
    const created = new Date(r.created_at as string).getTime();
    const due     = new Date(r.due_at as string).getTime();
    const days    = Math.round((due - created) / DAY_MS);
    if (isFinite(days) && days >= 0 && days <= 60) leads.push(days);
  }

  let leadDays: number;
  let source: DeliverySuggestion["lead_time_source"];
  if (leads.length >= 3) {
    leads.sort((a, b) => a - b);
    const mid = Math.floor(leads.length / 2);
    leadDays = leads.length % 2 === 1 ? leads[mid] : Math.round((leads[mid - 1] + leads[mid]) / 2);
    source   = "history_median";
  } else {
    leadDays = 3;
    source   = "engine_default";
  }

  // Target delivery = day BEFORE need-by (buffer of 1 day for staging).
  const targetDelivery = new Date(opts.needBy.getTime() - 1 * DAY_MS);
  const orderBy        = new Date(targetDelivery.getTime() - leadDays * DAY_MS);

  const reason = source === "history_median"
    ? `Median of ${leads.length} recent orders to ${opts.supplierName} took ${leadDays} days — schedule the order by ${orderBy.toISOString().slice(0, 10)} to land ${targetDelivery.toISOString().slice(0, 10)}, one day before you need it on site.`
    : `No lead-time history with ${opts.supplierName} yet — using the engine default of ${leadDays} days. Order by ${orderBy.toISOString().slice(0, 10)}.`;

  return {
    supplier_key:       opts.supplierName,
    material_hint:      opts.materialHint,
    lead_time_days:     leadDays,
    lead_time_source:   source,
    target_delivery:    targetDelivery.toISOString().slice(0, 10),
    suggested_order_by: orderBy.toISOString().slice(0, 10),
    reason,
    evidence
  };
}
