// Marketplace — canonical 17-category rail taxonomy (matches mock).
//
// Every category shows on the left rail. Some map to real fixture
// products; the rest render an empty state that guides the user to a
// populated category. Real merchant onboarding populates these in
// Wave 2.

import {
  Layers,
  PanelTop,
  Grid3x3,
  Hammer,
  Droplets,
  Zap,
  House,
  Grid2x2,
  Trees,
  Shirt,
  Cog,
  Boxes,
  Link2,
  HardHat,
  Wrench,
  Tag,
  Sparkles,
  Flame,
  type LucideIcon
} from "lucide-react";
import { PRODUCT_FIXTURES } from "./products";
import type { MarketplaceProduct, ProductCategorySlug } from "../types";

/** Rail categories in the exact order the mock shows them. */
export type RailCategorySlug =
  | "plastering"
  | "drywall"
  | "bricklaying"
  | "carpentry"
  | "plumbing"
  | "electrical"
  | "roofing"
  | "flooring"
  | "landscaping"
  | "workwear"
  | "machinery"
  | "materials"
  | "fixings-adhesives"
  | "ppe-safety"
  | "tools"
  | "clearance"
  | "new-products"
  | "trending";

export const RAIL_CATEGORIES: ReadonlyArray<{
  slug: RailCategorySlug;
  label: string;
  icon: LucideIcon;
  /** When true, the rail row is rendered without a divider before the
   *  next item — used to visually break "New Products" + "Trending" as
   *  a special section at the bottom. */
  bottomGroup?: boolean;
}> = [
  { slug: "plastering", label: "Plastering", icon: Layers },
  { slug: "drywall", label: "Drywall", icon: PanelTop },
  { slug: "bricklaying", label: "Bricklaying", icon: Grid3x3 },
  { slug: "carpentry", label: "Carpentry", icon: Hammer },
  { slug: "plumbing", label: "Plumbing", icon: Droplets },
  { slug: "electrical", label: "Electrical", icon: Zap },
  { slug: "roofing", label: "Roofing", icon: House },
  { slug: "flooring", label: "Flooring", icon: Grid2x2 },
  { slug: "landscaping", label: "Landscaping", icon: Trees },
  { slug: "workwear", label: "Workwear", icon: Shirt },
  { slug: "machinery", label: "Machinery", icon: Cog },
  { slug: "materials", label: "Materials", icon: Boxes },
  { slug: "fixings-adhesives", label: "Fixings & Adhesives", icon: Link2 },
  { slug: "ppe-safety", label: "PPE & Safety", icon: HardHat },
  { slug: "tools", label: "Tools", icon: Wrench },
  { slug: "clearance", label: "Clearance", icon: Tag, bottomGroup: true },
  { slug: "new-products", label: "New Products", icon: Sparkles, bottomGroup: true },
  { slug: "trending", label: "Trending", icon: Flame, bottomGroup: true }
];

/** Sub-categories rendered as chips at the top of the grid for the
 *  active rail category. Only categories with real product data have
 *  sub-cat chips; empty ones show a placeholder. */
export const SUB_CATEGORIES: Partial<Record<RailCategorySlug, readonly string[]>> = {
  plastering: ["Trowels", "Skimming Blades", "Buckets", "Mixers", "Hawks", "Beads"],
  machinery: ["Mixers", "Breakers", "Compressors"],
  materials: ["Buckets", "Beads", "Scaffolding", "Sponges"],
  "ppe-safety": ["Head Protection", "Hi-Vis", "Gloves", "Boots"],
  tools: ["Trowels", "Skimming Blades", "Mixers", "Hawks"]
};

/** Products belonging to a rail category. Bridges the display slug
 *  (which the user clicked in the rail) to the underlying product
 *  fixture categories.
 *
 *  When the rail category has no direct product mapping (e.g.
 *  Drywall, Bricklaying, Plumbing) we return an empty array and the
 *  view renders an empty state — the same primitive Home uses when a
 *  widget handler is missing. */
export function productsForRailCategory(
  slug: RailCategorySlug
): MarketplaceProduct[] {
  const fromLegacyCategories = (cats: ProductCategorySlug[]): MarketplaceProduct[] =>
    PRODUCT_FIXTURES.filter((p) => cats.includes(p.category));

  switch (slug) {
    case "plastering":
      // Plastering uses hand tools + trowel-shaped bits + skimming beads
      return PRODUCT_FIXTURES.filter(
        (p) =>
          p.category === "hand-tools" ||
          p.subCategory === "beads" ||
          p.subCategory === "sponges"
      );
    case "machinery":
      return fromLegacyCategories(["power-tools"]);
    case "materials":
      return fromLegacyCategories(["site-materials"]);
    case "ppe-safety":
      return fromLegacyCategories(["safety-ppe"]);
    case "tools":
      return fromLegacyCategories(["hand-tools", "power-tools"]);
    case "new-products":
      return PRODUCT_FIXTURES.filter((p) => p.badges?.includes("new"));
    case "trending":
      return PRODUCT_FIXTURES.filter(
        (p) => p.badges?.includes("best-seller") || p.badges?.includes("top-rated")
      );
    case "clearance":
      // No clearance data in fixtures — return empty for now.
      return [];
    default:
      // Drywall, Bricklaying, Carpentry, Plumbing, Electrical, Roofing,
      // Flooring, Landscaping, Workwear, Fixings & Adhesives — not
      // populated by fixtures. Empty state on view.
      return [];
  }
}

/** Total product count per rail category — used by the rail chip
 *  count + the "N products found" header. */
export function countForRailCategory(slug: RailCategorySlug): number {
  return productsForRailCategory(slug).length;
}
