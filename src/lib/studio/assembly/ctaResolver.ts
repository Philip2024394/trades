// Assembly CTA reader — server-side helper for renderers.
//
// Hero + section renderers query this to check whether the merchant has
// an assembly-driven override for a given slot. When a row exists, the
// caller renders the assembly CTA instead of its default. When no row
// exists, the caller renders whatever it would have rendered before —
// zero-cost adoption for the existing hero blueprints.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ResolvedAssemblyCta = {
  label: string;
  href: string;
  priority: number;
  sourceModuleId: string;
  sourceProposalId: string;
  rationaleSnapshot: string;
};

/** Return the highest-priority non-hidden CTA the assembly executor has
 *  written for this (brand, slot). Null when nothing is on record —
 *  callers keep their default. Ties broken deterministically by
 *  source_proposal_id ascending. */
export async function getAssemblyCta(
  brandId: string,
  slotId: string
): Promise<ResolvedAssemblyCta | null> {
  const res = await supabaseAdmin
    .from("studio_assembly_ctas")
    .select(
      "label, href, priority, source_module_id, source_proposal_id, rationale_snapshot"
    )
    .eq("brand_id", brandId)
    .eq("slot_id", slotId)
    .is("hidden_at", null)
    .order("priority", { ascending: false })
    .order("source_proposal_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (res.error || !res.data) return null;

  return {
    label: res.data.label as string,
    href: res.data.href as string,
    priority: res.data.priority as number,
    sourceModuleId: res.data.source_module_id as string,
    sourceProposalId: res.data.source_proposal_id as string,
    rationaleSnapshot: res.data.rationale_snapshot as string
  };
}

/** One-shot batch load — return every winning CTA for the brand, keyed
 *  by slot id. Use this at the top of a storefront render so section
 *  renderers can look up their slot without a per-slot roundtrip. */
export async function loadAssemblyCtasForBrand(
  brandId: string
): Promise<Record<string, ResolvedAssemblyCta>> {
  const res = await supabaseAdmin
    .from("studio_assembly_ctas")
    .select(
      "slot_id, label, href, priority, source_module_id, source_proposal_id, rationale_snapshot"
    )
    .eq("brand_id", brandId)
    .is("hidden_at", null)
    .order("priority", { ascending: false })
    .order("source_proposal_id", { ascending: true });

  const out: Record<string, ResolvedAssemblyCta> = {};
  if (res.error || !res.data) return out;

  // Higher-priority + lower proposal_id already wins because of the
  // ORDER BY; only accept the FIRST row we see for each slot.
  for (const row of res.data) {
    const slot = row.slot_id as string;
    if (out[slot]) continue;
    out[slot] = {
      label: row.label as string,
      href: row.href as string,
      priority: row.priority as number,
      sourceModuleId: row.source_module_id as string,
      sourceProposalId: row.source_proposal_id as string,
      rationaleSnapshot: row.rationale_snapshot as string
    };
  }
  return out;
}
