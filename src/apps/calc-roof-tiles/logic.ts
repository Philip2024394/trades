// calc-roof-tiles — logic re-exports + job-scope model + line filter.
//
// The underlying calc's "scenario" is roof SHAPE (gable/hip). The
// app-level "job scope" is a wrapper concept (retile / reslate /
// full strip). Scope filtering happens post-compute — we hide the
// battens line unless scope = full_strip, so the customer isn't
// shown line items they don't need to buy.

export {
  computeRoofTiles,
  roofTilesComplementarySubcategories,
  ROOF_TILES_DEFAULT_INPUTS,
  ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO,
  ROOF_TILES_DEFAULT_SCENARIO,
  ROOF_TILES_SCENARIO_LABEL
} from "@/lib/calculators/roof_tiles";
export type {
  RoofTilesInputs,
  RoofTilesScenario
} from "@/lib/calculators/roof_tiles";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorOutput } from "@/lib/calculators/types";
import type { CalculatorProductRef } from "@/lib/calculators/types";

/** The 3 UK job scopes the app-store wraps around the underlying
 *  gable/hip calc. */
export type RoofJobScope =
  | "retile_with_membrane"
  | "reslate_with_membrane"
  | "full_strip";

export const ROOF_JOB_SCOPE_LABEL: Record<RoofJobScope, string> = {
  retile_with_membrane: "Retile + new membrane",
  reslate_with_membrane: "Reslate + new membrane",
  full_strip: "Full strip + re-roof"
};

/** Underlying calc's TileType — re-exported from this app-level module
 *  for convenience since the lib version doesn't export the type. */
export type RoofMaterial =
  | "concrete_interlocking"
  | "plain_clay"
  | "natural_slate";

export const ROOF_MATERIAL_LABEL: Record<RoofMaterial, string> = {
  concrete_interlocking: "Concrete interlocking tile",
  plain_clay: "Plain clay tile",
  natural_slate: "Natural slate"
};

/** Which materials are appropriate per scope. Reslate = slate only.
 *  Retile = tile only. Full strip = anything. */
export const ROOF_MATERIALS_BY_SCOPE: Record<RoofJobScope, RoofMaterial[]> = {
  retile_with_membrane: ["concrete_interlocking", "plain_clay"],
  reslate_with_membrane: ["natural_slate"],
  full_strip: ["concrete_interlocking", "plain_clay", "natural_slate"]
};

/** Which line labels to hide per scope. Retile / reslate keep existing
 *  battens — so we drop the battens line to avoid confusing the quote. */
const HIDE_LINE_LABELS_BY_SCOPE: Record<RoofJobScope, string[]> = {
  retile_with_membrane: ["Battens (25×50 treated)"],
  reslate_with_membrane: ["Battens (25×50 treated)"],
  full_strip: []
};

/** Valley lining — hip roofs don't have valleys but any other complex
 *  shape does. Priced per linear meter installed. Lead Code 4 is the
 *  UK standard; copper is a premium alternative. */
export type ValleyMaterial = "lead_code_4" | "copper" | "grp_valley";

export const VALLEY_MATERIAL_LABEL: Record<ValleyMaterial, string> = {
  lead_code_4: "Lead code 4 (1.8 mm)",
  copper: "Copper (0.6 mm)",
  grp_valley: "GRP fibreglass valley"
};

/** UK-trade indicative £/m for valley lining installed. */
export const VALLEY_MATERIAL_PENCE_PER_M: Record<ValleyMaterial, number> = {
  lead_code_4: 4500,
  copper: 5000,
  grp_valley: 2500
};

export function filterResultForScope(
  result: CalculatorOutput,
  scope: RoofJobScope
): CalculatorOutput {
  const hide = HIDE_LINE_LABELS_BY_SCOPE[scope];
  if (!hide.length) return result;
  return {
    ...result,
    lines: result.lines.filter((l) => !hide.includes(l.label))
  };
}

/** Add a valley-lining line + roll its cost into materials_total_pence. */
export function addValleyToResult(
  result: CalculatorOutput,
  valleyLengthM: number,
  material: ValleyMaterial
): CalculatorOutput {
  if (valleyLengthM <= 0) return result;
  const perM = VALLEY_MATERIAL_PENCE_PER_M[material];
  const pence = Math.round(valleyLengthM * perM);
  return {
    ...result,
    lines: [
      ...result.lines,
      {
        label: `Valley lining — ${VALLEY_MATERIAL_LABEL[material]}`,
        value: `${valleyLengthM.toFixed(1)} m · £${(pence / 100).toFixed(0)}`,
        detail: `£${(perM / 100).toFixed(2)} / m installed`,
        tone: "muted"
      }
    ],
    materials_total_pence: result.materials_total_pence + pence
  };
}

/** UK trade-price fallback — concrete interlocking tile (Marley Modern
 *  reference — ~£1.50/tile). Product swaps when user changes material. */
export const FALLBACK_ROOF_TILE_PRODUCT: CalculatorProductRef = {
  id: "fallback-roof-tile-concrete-interlocking",
  name: "Concrete interlocking roof tile (reference)",
  price_pence: 150,
  cover_url: null,
  calculator_config: null,
  service_trade_type: "roofer",
  service_rate_pence: 5500,
  service_rate_unit: "m2"
};

export const FALLBACK_ROOF_SLATE_PRODUCT: CalculatorProductRef = {
  id: "fallback-roof-slate-natural",
  name: "Natural slate (Spanish, 400×250 mm — reference)",
  price_pence: 350,
  cover_url: null,
  calculator_config: null,
  service_trade_type: "slater",
  service_rate_pence: 7500,
  service_rate_unit: "m2"
};

export const FALLBACK_ROOF_CLAY_PRODUCT: CalculatorProductRef = {
  id: "fallback-roof-clay-plain",
  name: "Plain clay roof tile (reference)",
  price_pence: 90,
  cover_url: null,
  calculator_config: null,
  service_trade_type: "tiler-roofer",
  service_rate_pence: 6500,
  service_rate_unit: "m2"
};

export function fallbackProductForMaterial(
  material: RoofMaterial
): CalculatorProductRef {
  switch (material) {
    case "concrete_interlocking":
      return FALLBACK_ROOF_TILE_PRODUCT;
    case "plain_clay":
      return FALLBACK_ROOF_CLAY_PRODUCT;
    case "natural_slate":
      return FALLBACK_ROOF_SLATE_PRODUCT;
  }
}
