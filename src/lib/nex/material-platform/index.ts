// Material Intelligence Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export { MATERIAL_CATALOG, getMaterial, listMaterials, countMaterials } from "./catalog";
export { byCategory, byTag, byFireRatingAtLeast, underCarbonBudget, underCostPerM2, fscCertifiedOnly } from "./queries";
export type {
  MaterialIntelligence, MaterialCategory, FireRating, SlipRating, PriceStability, CareFrequency, Manufacturer,
} from "./types";
export { MATERIAL_PHYSICS, getPhysics, listPhysics } from "./physics";
export type { MaterialPhysics, Grain, MachiningEase } from "./physics";
