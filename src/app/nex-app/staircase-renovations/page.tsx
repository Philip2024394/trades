// NEX Staircase Refacing · customer-facing browsing surface.
//
// Route: /nex-app/staircase-renovations
//
// Not part of Headquarters · not part of G1-G6 · not part of the burn-in.
// Renders the RefacingBrowser (2026-08-12 · rebuilt):
//   · Main image = whole-staircase HERO photo (from data/staircase-renovations
//     manifest.categories · existing library)
//   · Right rail = 4 material family chips (Metal · Painted · Wood · Glass)
//   · Footer = STEP-UNIT swatches (isometric single-step renders) that act
//     as tap-to-filter thumbnails within the selected family
//
// Swatch → hero pool resolution happens here (server-side) so the viewer is
// pure UI. Empty hero pool degrades gracefully to the swatch's own step-unit
// image with an honest coming-soon note.
//
// Architecture per project_nex_refacing_step_unit_taxonomy_2026_08_12.md.
// Parked bundle status per docs/refacing/STAGE-1-REMEDIATION-SPEC.md.

import { StepUnitViewer, type ResolvedFamily, type FamilyKey } from "@/components/nex-app/staircase-renovations/StepUnitViewer";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Staircase Refacing",
  description: "Keep your staircase. Change its appearance. Pick your riser material and browse designs.",
};

// ── Raw manifest shapes ───────────────────────────────────────────────
type RawImage = {
  src: string;
  alt?: string;
  sort?: number;
  materials?: string[];
};
type RawCategory = {
  slug: string;
  label: string;
  description?: string;
  images?: RawImage[];
};
type RawStepUnit = {
  src: string;
  alt?: string;
  sort?: number;
  variant?: string;
  riser_material?: string;
  sub_material?: string;
  pattern?: string;
  tread_species?: string;
  materials?: string[];
};
type RawStepUnitFamily = {
  family: string;
  label: string;
  description?: string;
  sub_material_default?: string | null;
  step_units?: RawStepUnit[];
};
type Manifest = {
  categories?: RawCategory[];
  step_units?: RawStepUnitFamily[];
};

const CANONICAL_FAMILIES: FamilyKey[] = ["metal", "painted", "wood", "glass"];

function normaliseFamily(raw: string): FamilyKey | null {
  const lower = raw.toLowerCase();
  return (CANONICAL_FAMILIES as string[]).includes(lower) ? (lower as FamilyKey) : null;
}

// ── Swatch → hero pool resolution ─────────────────────────────────────
//
// Per family, which hero_scene categories/images map to which swatches.
// Rules kept simple + honest:
//   · WOOD swatches → category slug matching species (oak/walnut/etc)
//     PLUS any image in any category tagged materials.includes(species)
//   · PAINTED swatches → union of `painted` + `white` categories, then
//     filter by species if any image is tagged with the species; otherwise
//     return the full painted+white pool.
//   · GLASS swatches → the `glass` category.
//   · METAL swatches → currently empty (no metal-riser hero photos in the
//     existing library). Viewer degrades to swatch-own image with note.
function resolveHeroPool(
  family: FamilyKey,
  species: string | undefined,
  categories: RawCategory[]
): RawImage[] {
  if (family === "wood" && species) {
    const speciesCat = categories.find((c) => c.slug === species)?.images ?? [];
    if (speciesCat.length > 0) return speciesCat;
    return categories.flatMap((c) =>
      (c.images ?? []).filter((img) => Array.isArray(img.materials) && img.materials.includes(species))
    );
  }
  if (family === "painted") {
    const painted = categories.find((c) => c.slug === "painted")?.images ?? [];
    const white   = categories.find((c) => c.slug === "white")?.images   ?? [];
    // Also pull painted-riser-with-species-tread from oak/walnut categories
    // where the whole-image genuinely shows painted risers (very common).
    const traditionalWithPaintedRiser = categories
      .filter((c) => c.slug === "oak" || c.slug === "walnut" || c.slug === "traditional")
      .flatMap((c) => c.images ?? [])
      .filter((img) => /white risers|white stairparts|painted/i.test(img.alt ?? ""));
    const pool = [...painted, ...white, ...traditionalWithPaintedRiser];
    if (species) {
      const speciesFiltered = pool.filter(
        (img) => Array.isArray(img.materials) && img.materials.includes(species)
      );
      if (speciesFiltered.length > 0) return speciesFiltered;
    }
    return pool;
  }
  if (family === "glass") {
    return categories.find((c) => c.slug === "glass")?.images ?? [];
  }
  // metal → empty for now (honest)
  return [];
}

// Dedup hero pool by src while preserving order.
function dedupBySrc(images: RawImage[]): RawImage[] {
  const seen = new Set<string>();
  const out: RawImage[] = [];
  for (const img of images) {
    if (seen.has(img.src)) continue;
    seen.add(img.src);
    out.push(img);
  }
  return out;
}

async function loadResolvedFamilies(): Promise<ResolvedFamily[]> {
  try {
    const path = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
    const raw  = await readFile(path, "utf8");
    const j    = JSON.parse(raw) as Manifest;
    const categories = Array.isArray(j.categories) ? j.categories : [];
    const stepUnitGroups = Array.isArray(j.step_units) ? j.step_units : [];

    // Index step_unit groups by family.
    const stepUnitsByFamily = new Map<FamilyKey, RawStepUnit[]>();
    for (const g of stepUnitGroups) {
      const family = normaliseFamily(String(g.family));
      if (!family) continue;
      const units = Array.isArray(g.step_units) ? [...g.step_units] : [];
      units.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      stepUnitsByFamily.set(family, units);
    }

    // Build one ResolvedFamily per canonical family (ensures rail always shows 4).
    return CANONICAL_FAMILIES.map((family): ResolvedFamily => {
      const units = stepUnitsByFamily.get(family) ?? [];
      const label = family.charAt(0).toUpperCase() + family.slice(1);
      const swatches = units.map((u) => {
        const heroPool = dedupBySrc(resolveHeroPool(family, u.tread_species, categories));
        return {
          swatch_src:     String(u.src),
          swatch_alt:     u.alt ?? "",
          pattern:        u.pattern,
          tread_species:  u.tread_species,
          sub_material:   u.sub_material,
          hero_pool:      heroPool.map((img) => ({
            src: String(img.src),
            alt: img.alt ?? "",
          })),
        };
      });
      // Family-level hero pool (union of all family's hero photos) for when
      // no swatch is selected · currently unused by viewer but useful data.
      const familyHeroPool = dedupBySrc(
        swatches.flatMap((s) => s.hero_pool.map((h) => ({ src: h.src, alt: h.alt })))
      );
      return {
        family,
        label,
        swatches,
        family_hero_pool: familyHeroPool,
      };
    });
  } catch {
    return CANONICAL_FAMILIES.map((family) => ({
      family,
      label: family.charAt(0).toUpperCase() + family.slice(1),
      swatches: [],
      family_hero_pool: [],
    }));
  }
}

export default async function StaircaseRenovationsPage() {
  const families = await loadResolvedFamilies();
  return <StepUnitViewer families={families} />;
}
