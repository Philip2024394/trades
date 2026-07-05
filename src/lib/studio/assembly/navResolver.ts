// Assembly Nav reader — server-side helper for renderers.
//
// The storefront header + Studio drawer + any other nav consumer calls
// this to get the merchant's assembly-driven nav entries for a slot.
// Returns [] when nothing is on record so the consumer can just spread
// into their existing list.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ResolvedAssemblyNavEntry = {
  id: string;
  label: string;
  href: string;
  icon: string | null;
  orderIndex: number;
  sourceModuleId: string;
  sourceProposalId: string;
  rationaleSnapshot: string;
};

/** Return every non-hidden assembly nav entry for a slot, ordered by
 *  order_index ascending (smaller = higher priority in the source
 *  proposal). Empty array is the "no assembly entries" fast path so
 *  callers can spread the result into their existing list. */
export async function loadAssemblyNavEntriesForBrand(
  brandId: string,
  targetSlot: string
): Promise<ResolvedAssemblyNavEntry[]> {
  const res = await supabaseAdmin
    .from("studio_assembly_nav_entries")
    .select(
      "source_proposal_id, label, href, icon, order_index, source_module_id, rationale_snapshot"
    )
    .eq("brand_id", brandId)
    .eq("target_slot", targetSlot)
    .is("hidden_at", null)
    .order("order_index", { ascending: true });

  if (res.error || !res.data) return [];

  return res.data.map((row) => ({
    id: row.source_proposal_id as string,
    label: row.label as string,
    href: row.href as string,
    icon: (row.icon as string | null) ?? null,
    orderIndex: row.order_index as number,
    sourceModuleId: row.source_module_id as string,
    sourceProposalId: row.source_proposal_id as string,
    rationaleSnapshot: row.rationale_snapshot as string
  }));
}
