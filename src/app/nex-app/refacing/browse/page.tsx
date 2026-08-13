// /nex-app/refacing/browse · design browser (moved from /nex-app/refacing on 2026-08-13).
//
// Renders the StepUnitViewer · the material/design browsing surface reached AFTER
// the customer clicks ENTER on /nex-app/refacing (the landing page).
//
//   · Main image = whole-staircase hero photo
//   · Right rail = 4 material family chips (Metal · Painted · Wood · Glass)
//   · Footer = STEP-UNIT swatches (isometric single-step renders)
//
// Uses hero-pool-resolver.ts which queries material_composition[] on images_v3[]
// (source of truth) · pattern-aware · strict-exact match (no species-only fallbacks).

import { StepUnitViewer, type ResolvedFamily, type FamilyKey } from "@/components/nex-app/staircase-renovations/StepUnitViewer";
import { resolveHeroPool, resolveFamilyHeroPool, type V3Image } from "@/lib/refacing/hero-pool-resolver";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Refacing · Browse designs",
  description: "Pick your riser material and browse designs. NEX matches you with a suitable local staircase professional to survey, plan and install.",
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
  images_v3?: V3Image[];
  step_units?: RawStepUnitFamily[];
};

const CANONICAL_FAMILIES: FamilyKey[] = ["metal", "painted", "wood", "glass"];

function normaliseFamily(raw: string): FamilyKey | null {
  const lower = raw.toLowerCase();
  return (CANONICAL_FAMILIES as string[]).includes(lower) ? (lower as FamilyKey) : null;
}

async function loadResolvedFamilies(): Promise<ResolvedFamily[]> {
  try {
    const path = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
    const raw  = await readFile(path, "utf8");
    const j    = JSON.parse(raw) as Manifest;
    const images_v3    = Array.isArray(j.images_v3) ? j.images_v3 : [];
    const stepUnitGroups = Array.isArray(j.step_units) ? j.step_units : [];

    const stepUnitsByFamily = new Map<FamilyKey, RawStepUnit[]>();
    for (const g of stepUnitGroups) {
      const family = normaliseFamily(String(g.family));
      if (!family) continue;
      const units = Array.isArray(g.step_units) ? [...g.step_units] : [];
      units.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      stepUnitsByFamily.set(family, units);
    }

    return CANONICAL_FAMILIES.map((family): ResolvedFamily => {
      const units = stepUnitsByFamily.get(family) ?? [];
      const label = family.charAt(0).toUpperCase() + family.slice(1);
      const swatches = units.map((u) => ({
        swatch_src:    String(u.src),
        swatch_alt:    u.alt ?? "",
        pattern:       u.pattern,
        tread_species: u.tread_species,
        sub_material:  u.sub_material,
        hero_pool:     resolveHeroPool(family, u.tread_species, images_v3, u.pattern),
      }));
      return {
        family,
        label,
        swatches,
        family_hero_pool: resolveFamilyHeroPool(family, images_v3),
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

export default async function RefacingBrowsePage() {
  const families = await loadResolvedFamilies();
  return <StepUnitViewer families={families} />;
}
