// Overnight payments detector.
//
// Reads hammerex_sitebook_cost_payments where paid_at is between a
// cutoff (default: 18h ago) and now. Joins to hammerex_sitebook_costs
// (kind, project_id, trade_listing_id) so we only count payments
// where this merchant is the trade + surface the parent project title.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type OvernightPayment } from "./types";

export type FindOvernightPaymentsInput = {
  merchantListingId: string;
  /** Hours to look back. Default 18 (overnight window). */
  hoursBack?:        number;
  now?:              Date;
};

export async function findOvernightPayments(opts: FindOvernightPaymentsInput): Promise<OvernightPayment[]> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - (opts.hoursBack ?? 18) * 3_600_000).toISOString();

  const payments = await supabaseAdmin
    .from("hammerex_sitebook_cost_payments")
    .select("cost_id, amount_pence, paid_at, method, hammerex_sitebook_costs!inner(trade_listing_id, project_id, hammerex_sitebook_projects(title))")
    .eq("hammerex_sitebook_costs.trade_listing_id", opts.merchantListingId)
    .gte("paid_at", cutoff);

  const evidence = evidenceFor("hammerex_sitebook_cost_payments (paid_at ≥ cutoff)", ["hammerex_sitebook_cost_payments", "hammerex_sitebook_costs"]);
  const out: OvernightPayment[] = [];
  for (const p of payments.data ?? []) {
    const cost = (p as { hammerex_sitebook_costs?: { hammerex_sitebook_projects?: { title?: string | null } | null } | null }).hammerex_sitebook_costs ?? null;
    out.push({
      cost_id:       String(p.cost_id),
      project_title: (cost?.hammerex_sitebook_projects?.title ?? null) as string | null,
      amount_pence:  Number(p.amount_pence ?? 0),
      paid_at:       String(p.paid_at),
      method:        String(p.method ?? "unknown"),
      evidence
    });
  }
  // Newest first.
  out.sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  return out;
}
