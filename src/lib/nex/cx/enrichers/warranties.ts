// Warranties enricher — reads hammerex_sitebook_home_care_items for
// this customer IF they're a homeowner on a project this merchant
// worked on. Merchants who never touched a project see zero warranties.
//
// Fields sourced from the Home Care Items table:
//   • title, next_due_at, cadence_days, last_done_at, previous_trade_listing_id

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type WarrantyItem } from "../types";

const DAY_MS = 86_400_000;

export async function loadWarranties(opts: {
  merchantListingId: string;
  partyId:           string | null;
  now?:              Date;
}): Promise<WarrantyItem[]> {
  if (!opts.partyId) return [];

  // Find the homeowner_id via os_parties → hammerex_homeowners.
  // If the OS linkage isn't in place, skip silently.
  const party = await supabaseAdmin
    .from("os_parties")
    .select("id, supabase_user_id, email_hash, whatsapp_hash")
    .eq("id", opts.partyId)
    .maybeSingle();
  if (!party.data) return [];

  const partyRow = party.data as { email_hash?: string | null; whatsapp_hash?: string | null; supabase_user_id?: string | null };
  const homeownerQuery = supabaseAdmin.from("hammerex_homeowners").select("id");
  const filter = partyRow.supabase_user_id
    ? homeownerQuery.eq("supabase_user_id", partyRow.supabase_user_id)
    : partyRow.email_hash
      ? homeownerQuery.eq("email_hash", partyRow.email_hash)
      : partyRow.whatsapp_hash
        ? homeownerQuery.eq("whatsapp_hash", partyRow.whatsapp_hash)
        : null;
  if (!filter) return [];
  const ho = await filter.maybeSingle();
  if (!ho.data) return [];

  // Load the homeowner's care items. Merchants only see items where
  // they were the previous trade (permission-safe).
  const rows = await supabaseAdmin
    .from("hammerex_sitebook_home_care_items")
    .select("title, next_due_at, cadence_days, last_done_at, previous_trade_listing_id, previous_trade_name")
    .eq("homeowner_id", (ho.data as { id: string }).id)
    .eq("previous_trade_listing_id", opts.merchantListingId)
    .order("next_due_at", { ascending: true });

  const now = opts.now ?? new Date();
  const ev = evidenceFor("hammerex_sitebook_home_care_items (previous_trade = you)", ["hammerex_sitebook_home_care_items"]);
  return (rows.data ?? []).map((r) => {
    const nextDue = r.next_due_at ? new Date(r.next_due_at as string).getTime() : null;
    return {
      title:       String(r.title),
      trade_name:  (r.previous_trade_name ?? null) as string | null,
      next_due_at: r.next_due_at as string | null,
      days_until:  nextDue ? Math.round((nextDue - now.getTime()) / DAY_MS) : null,
      evidence:    ev
    };
  });
}
