// Procurement scan — "save me money on this project".
//
// Given a merchant's material spend on a project (from Phase 6 costs
// or Phase 7 quote line-items), scan the marketplace for cheaper
// alternatives with the same keyword. Returns a savings list — never
// auto-purchases.
//
// Honest: matching is TEXT-based; without a canonical-product ID we
// can't guarantee the alternative is truly equivalent. Merchant
// approves each swap.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchProducts } from "./search";
import { rankListings } from "./ranking";
import { evidenceFor, type ProcurementAdvice, type ProcurementSaving } from "./types";

export type BuildProcurementInput = {
  projectId:         string;
  merchantListingId: string;
  /** Minimum saving to surface — default £5 (500 pence). */
  minSavingPence?:   number;
  now?:              Date;
};

export async function buildProcurementAdvice(opts: BuildProcurementInput): Promise<ProcurementAdvice> {
  const now = opts.now ?? new Date();
  const minSaving = opts.minSavingPence ?? 500;
  const evidence = evidenceFor("cross-catalogue price scan vs merchant costs", ["hammerex_sitebook_costs", "hammerex_xrated_products", "hammerex_canteen_products"]);

  const costs = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("id, description, agreed_pence, paid_pence")
    .eq("project_id", opts.projectId)
    .eq("trade_listing_id", opts.merchantListingId)
    .eq("kind", "materials")
    .neq("status", "cancelled");

  const savings: ProcurementSaving[] = [];
  const warnings: string[] = [];

  for (const c of costs.data ?? []) {
    const desc = String(c.description ?? "").trim();
    if (desc.length < 3) continue;
    const currentCost = Number(c.paid_pence ?? 0) > 0 ? Number(c.paid_pence) : Number(c.agreed_pence ?? 0);
    if (currentCost <= 0) continue;

    // Pick out the first noun-ish word to keyword-search.
    const keyword = desc.split(/[\s,·+]+/).slice(0, 2).join(" ").trim();
    if (keyword.length < 3) continue;

    const listings = await searchProducts({ keyword, limit: 10 });
    if (listings.length === 0) continue;
    const ranked = await rankListings({ listings });
    // Only surface when there's a cheaper alternative with a real price.
    const cheaper = ranked
      .filter((r) => r.listing.price_pence !== null && r.listing.price_pence < currentCost)
      .sort((a, b) => (a.listing.price_pence ?? 0) - (b.listing.price_pence ?? 0))[0];
    if (!cheaper) continue;
    const saving = currentCost - (cheaper.listing.price_pence ?? currentCost);
    if (saving < minSaving) continue;

    savings.push({
      material_label:      desc,
      current_cost_pence:  currentCost,
      alternative:         cheaper.listing,
      saving_pence:        saving,
      reason:              `Cheaper alternative on the platform: ${cheaper.reason}.`,
      evidence
    });
  }

  if (savings.length === 0) warnings.push("No cheaper alternatives found on the platform for this project's materials. Nothing to swap.");
  warnings.push("Alternatives are matched by text similarity — always check that the substitute is equivalent before ordering.");

  void now;
  return {
    project_id:         opts.projectId,
    savings,
    total_saving_pence: savings.reduce((s, x) => s + x.saving_pence, 0),
    warnings,
    evidence
  };
}
