// Warranty-expiring window.
//
// Reads hammerex_sitebook_home_care_items where the merchant was the
// previous_trade AND next_due_at falls within the next N days.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type WarrantyExpiring } from "./types";

const DAY_MS = 86_400_000;

export type FindWarrantiesExpiringInput = {
  merchantListingId: string;
  windowDays?:       number;   // default 14
  now?:              Date;
};

export async function findWarrantiesExpiring(opts: FindWarrantiesExpiringInput): Promise<WarrantyExpiring[]> {
  const now = opts.now ?? new Date();
  const window = opts.windowDays ?? 14;
  const fromIso = now.toISOString();
  const toIso = new Date(now.getTime() + window * DAY_MS).toISOString();

  const rows = await supabaseAdmin
    .from("hammerex_sitebook_home_care_items")
    .select("title, next_due_at")
    .eq("previous_trade_listing_id", opts.merchantListingId)
    .gte("next_due_at", fromIso)
    .lte("next_due_at", toIso);

  const evidence = evidenceFor("hammerex_sitebook_home_care_items (next_due_at ≤ +N days)", ["hammerex_sitebook_home_care_items"]);
  const out: WarrantyExpiring[] = [];
  for (const r of rows.data ?? []) {
    const dueIso = r.next_due_at as string | null;
    if (!dueIso) continue;
    const days = Math.round((new Date(dueIso).getTime() - now.getTime()) / DAY_MS);
    out.push({
      title:       String(r.title),
      next_due_at: dueIso,
      days_until:  Math.max(0, days),
      evidence
    });
  }
  out.sort((a, b) => a.days_until - b.days_until);
  return out;
}
