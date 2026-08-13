// Material Intelligence Platform · query helpers.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import type { MaterialIntelligence, MaterialCategory, FireRating } from "./types";
import { listMaterials } from "./catalog";

export function byCategory(cat: MaterialCategory): readonly MaterialIntelligence[] {
  return listMaterials().filter((m) => m.category === cat);
}

export function byTag(tag: string): readonly MaterialIntelligence[] {
  return listMaterials().filter((m) => (m.tags ?? []).includes(tag));
}

export function byFireRatingAtLeast(rating: FireRating): readonly MaterialIntelligence[] {
  const ORDER: FireRating[] = ["A1", "A2", "B", "C", "D", "E", "F"];
  const threshold = ORDER.indexOf(rating);
  return listMaterials().filter((m) => m.fire_rating && ORDER.indexOf(m.fire_rating) <= threshold);
}

export function underCarbonBudget(kg_co2e_per_kg: number): readonly MaterialIntelligence[] {
  return listMaterials().filter((m) => m.carbon_kg_co2e_per_kg !== undefined && m.carbon_kg_co2e_per_kg <= kg_co2e_per_kg);
}

export function underCostPerM2(gbp: number): readonly MaterialIntelligence[] {
  return listMaterials().filter((m) => m.cost_per_m2_gbp !== undefined && m.cost_per_m2_gbp <= gbp);
}

export function fscCertifiedOnly(): readonly MaterialIntelligence[] {
  return listMaterials().filter((m) => m.fsc_certified === true);
}
