// Cross-sell engine for Material Calculators.
//
// Each calculator scenario declares the subcategories of complementary
// products its output implies (a Paint Full-Room needs brushes, rollers,
// trays, masking tape, drop sheets, sandpaper, filler). This module
// matches those required subcategories against the merchant's other
// products and returns:
//   - matches: products the merchant DOES stock, grouped by subcategory
//   - missing: subcategories the merchant DOESN'T stock, surfaced as
//     plain advisory tips so the customer still knows what they need
//
// Pure function — operates on an already-loaded list of siblings (the
// PDP loads them already for the "Compare" section, so no extra DB hit).

import { getSubcategory } from "@/lib/merchantCategories";

export type CrossSellProductRef = {
  id: string;
  slug: string | null;
  name: string;
  price_pence: number;
  cover_url: string | null;
  status: "live" | "archived";
  merchant_subcategory: string | null;
};

export type CrossSellMatch = {
  subcategory_slug: string;
  subcategory_label: string;
  products: CrossSellProductRef[];
};

export type CrossSellResult = {
  matches: CrossSellMatch[];
  missing: { slug: string; label: string }[];
};

/** Given a set of subcategory slugs the scenario needs, return matches
 *  + the subcategories that aren't stocked. Excludes the current product
 *  from the match set (so the paint product doesn't recommend itself). */
export function crossSellFor(
  required_subcategories: string[],
  current_product_id: string,
  siblings: CrossSellProductRef[]
): CrossSellResult {
  const live = siblings.filter(
    (s) => s.status === "live" && s.id !== current_product_id
  );
  const matches: CrossSellMatch[] = [];
  const missing: { slug: string; label: string }[] = [];

  for (const slug of required_subcategories) {
    const def = getSubcategory(slug);
    if (!def) continue;
    const products = live.filter((p) => p.merchant_subcategory === slug);
    if (products.length > 0) {
      matches.push({
        subcategory_slug: slug,
        subcategory_label: def.label,
        products
      });
    } else {
      missing.push({ slug, label: def.label });
    }
  }

  return { matches, missing };
}
