// UK stair-industry company registry — aggregated index.
//
// Combines every category file into a single searchable registry
// while preserving the ability to filter or list by category. Each
// category file stays independently maintainable (add a new stair
// maker without touching wood-supplier data etc).

import type { CompanyEntry, CompanyCategory } from "./_types";
import { STAIRCASE_MAKERS }     from "./staircase_makers";
import { STAIRPARTS_SUPPLIERS } from "./stairparts_suppliers";
import { BUILDING_MERCHANTS }   from "./building_merchants";
import { DIY_RETAILERS }        from "./diy_retailers";
import { WOOD_SUPPLIERS }       from "./wood_suppliers";
import { TIMBER_IMPORTERS }     from "./timber_importers";

export type { CompanyEntry, CompanyCategory } from "./_types";

/** Aggregated registry — every UK stair-industry company Nex knows
 *  about, across all six categories. Detection scans this whole list. */
export const INDUSTRY_REGISTRY: CompanyEntry[] = [
  ...STAIRCASE_MAKERS,
  ...STAIRPARTS_SUPPLIERS,
  ...BUILDING_MERCHANTS,
  ...DIY_RETAILERS,
  ...WOOD_SUPPLIERS,
  ...TIMBER_IMPORTERS
];

/** Fetch every company in a given category — useful for future
 *  member-matching features and category-level listings. */
export function companiesByCategory(category: CompanyCategory): CompanyEntry[] {
  return INDUSTRY_REGISTRY.filter((c) => c.category === category);
}

/** Look up a specific company by canonical name (case-insensitive). */
export function findCompany(name: string): CompanyEntry | undefined {
  const lower = name.trim().toLowerCase();
  return INDUSTRY_REGISTRY.find((c) => c.canonical.toLowerCase() === lower);
}

/** Detect all companies mentioned in a text — used by the competitor
 *  query handler. Returns matched entries in order of pattern
 *  detection with duplicates removed. */
export function detectCompaniesInText(text: string): CompanyEntry[] {
  const found: CompanyEntry[] = [];
  const seen = new Set<string>();
  for (const entry of INDUSTRY_REGISTRY) {
    if (seen.has(entry.canonical)) continue;
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) {
        found.push(entry);
        seen.add(entry.canonical);
        break;
      }
    }
  }
  return found;
}

/** Registry statistics — useful for admin visibility and testing. */
export function registryStats(): { total: number; byCategory: Record<CompanyCategory, number> } {
  const byCategory: Record<string, number> = {};
  for (const c of INDUSTRY_REGISTRY) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  }
  return {
    total: INDUSTRY_REGISTRY.length,
    byCategory: byCategory as Record<CompanyCategory, number>
  };
}
