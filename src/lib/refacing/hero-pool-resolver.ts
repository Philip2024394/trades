// hero-pool-resolver — the intelligence layer that pairs a step-unit swatch
// (STEP-UNIT taxonomy: riser_material × pattern × tread_species) with the
// whole-staircase hero photos it should preview.
//
// Source of truth: manifest.images_v3[] · material_composition[] (structured).
// NOT the flat categories[].images[].materials[] tag (lossy projection).
//
// STRICT-EXACT contract (2026-08-13 update per Philip):
//   A swatch is ONLY paired with heroes whose riser material AND tread species
//   BOTH match the swatch. No species-only fallbacks. No family-only fallbacks.
//   If the library has no exact match, the pool is EMPTY and the viewer shows
//   the swatch's own step-unit render + "full-staircase photos coming" note.
//
//   Rationale: showing a painted-riser hero when the customer picked a
//   metal-riser swatch is dishonest — the visual on screen doesn't match the
//   design they just selected. That violates NEX truthfulness. Better to show
//   the isometric swatch itself with an honest "coming soon" label than to
//   pretend a species-only match is the design they picked.
//
//   Gap coverage lives in scripts/refacing/gap-report.mjs — regenerating the
//   missing exact-match images is the correct remediation, not diluting the
//   resolver.
//
// Glass family stays an aesthetic bucket (baluster-driven, not riser-driven)
// because there are no glass RISER photos or step-units — glass is genuinely a
// balustrade concept in this library.

import type { FamilyKey, HeroImage } from "@/components/nex-app/staircase-renovations/StepUnitViewer";

export type MaterialCompRow = {
  component_role: string;
  material?: string;
  sub_material?: string;
  style?: string;
  feature?: string | null;
  // Riser-specific — declares the pattern of the riser (arched-wood-inset, arched-painted-inset,
  // flat, monolithic, metal-plate) and, for arched patterns, the species of the inset panel.
  pattern?: string;
  inset_species?: string;
};

export type V3Image = {
  image_id: string;
  src: string;
  alt: string;
  component_role: string;
  material?: string;
  sub_material?: string;
  material_composition?: MaterialCompRow[];
};

// Canonical species buckets · sub-variants collapse to their base species.
const SPECIES_ALIASES: Record<string, string> = {
  "oak": "oak",
  "light-oak": "oak",
  "mid-oak": "oak",
  "dark-oak": "oak",
  "rustic-knotty-oak": "oak",
  "dark-rustic-oak": "oak",
  "walnut": "walnut",
  "dark-walnut": "walnut",
  "mahogany": "mahogany",
  "maple": "maple",
  "blonde-maple": "maple",
  "white": "painted-white",
  "cream": "painted-cream",
};

export function canonicaliseSpecies(sub?: string): string {
  if (!sub) return "";
  const key = String(sub).toLowerCase();
  return SPECIES_ALIASES[key] ?? key;
}

function componentOf(img: V3Image, role: string): MaterialCompRow | undefined {
  return img.material_composition?.find((c) => c.component_role === role);
}

function treadSpeciesOf(img: V3Image): string {
  const tread = componentOf(img, "tread");
  const sub   = tread?.sub_material ?? img.sub_material;
  return canonicaliseSpecies(sub);
}

function riserFamilyOf(img: V3Image): FamilyKey | null {
  const riser = componentOf(img, "riser");
  const material = riser?.material?.toLowerCase();
  if (material === "metal")   return "metal";
  if (material === "painted") return "painted";
  if (material === "wood")    return "wood";
  if (material === "glass")   return "glass";
  // Fallback: infer from image-level material.
  if (img.material === "wood") return "wood";
  return null;
}

function balusterMaterialOf(img: V3Image): string {
  return componentOf(img, "baluster")?.material?.toLowerCase() ?? "";
}

function toHero(img: V3Image): HeroImage {
  return { src: img.src, alt: img.alt };
}

function dedup(images: HeroImage[]): HeroImage[] {
  const seen = new Set<string>();
  const out: HeroImage[] = [];
  for (const h of images) {
    if (seen.has(h.src)) continue;
    seen.add(h.src);
    out.push(h);
  }
  return out;
}

/**
 * Resolve the hero pool for one step-unit swatch.
 * @param family        The step-unit family (metal · painted · wood · glass) — reflects the RISER.
 * @param species       The step-unit tread_species (oak · walnut · mahogany · maple · …).
 * @param images        All whole_staircase entries from manifest.images_v3[].
 * @param pattern       Step-unit pattern (flat · metal-plate · monolithic · arched-wood-inset · arched-painted-inset).
 *                      Arched-* patterns require heroes that visually show an arched panel-inset
 *                      riser · none exist in the library today · so those swatches return [] and
 *                      the viewer honestly shows the swatch fallback. Non-arched patterns fall
 *                      through to family + species matching.
 */
export function resolveHeroPool(
  family: FamilyKey,
  species: string | undefined,
  images: V3Image[],
  pattern?: string
): HeroImage[] {
  const canonSpecies = canonicaliseSpecies(species);
  const wholes = images.filter((i) => i.component_role === "whole_staircase");

  // ARCHED-INSET patterns require a hero whose riser has the same arched-inset
  // pattern AND whose arched panel matches the requested species. The panel species
  // is stored as material_composition[riser].inset_species; the pattern name is
  // stored as material_composition[riser].pattern.
  if (pattern && /arched/i.test(pattern)) {
    const matches = wholes.filter((i) => {
      const riser = componentOf(i, "riser");
      if (riser?.pattern !== pattern) return false;
      const inset = canonicaliseSpecies(riser?.inset_species);
      // For arched-wood-inset, panel species must match the swatch's tread species
      // (that IS the material design choice the customer is picking).
      return canonSpecies ? inset === canonSpecies : true;
    });
    return dedup(matches.map(toHero));
  }

  // STRICT-EXACT: riser family AND tread species BOTH match.
  if (canonSpecies) {
    const exact = wholes.filter(
      (i) => riserFamilyOf(i) === family && treadSpeciesOf(i) === canonSpecies
    );
    return dedup(exact.map(toHero));
  }

  // No species declared on the swatch → riser-only match (rare / used only for
  // family_hero_pool defaults, never for real swatches which always name a species).
  return dedup(
    wholes.filter((i) => riserFamilyOf(i) === family).map(toHero)
  );
}

/**
 * Family-level hero pool (for family chip highlights / previews).
 * Union of every swatch's pool for that family, dedup'd.
 */
export function resolveFamilyHeroPool(family: FamilyKey, images: V3Image[]): HeroImage[] {
  const wholes = images.filter((i) => i.component_role === "whole_staircase");
  const familyRiser = wholes.filter((i) => riserFamilyOf(i) === family);
  if (familyRiser.length > 0) return dedup(familyRiser.map(toHero));
  if (family === "glass") {
    return dedup(wholes.filter((i) => balusterMaterialOf(i) === "glass").map(toHero));
  }
  return [];
}
