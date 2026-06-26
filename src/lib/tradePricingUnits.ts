// Per-trade pricing unit options used in the premium dashboard.
// Tradies pick a unit from a curated list specific to their primary
// trade — covers the units UK pros actually invoice by. The 'Other'
// option falls back to a free-text input.

export type PricingUnitOption = {
  value: string;   // canonical short label e.g. 'per m²'
  label: string;   // display label, can be slightly longer
  description?: string; // tooltip-style helper, optional
};

export const TRADE_PRICING_UNITS: Record<string, PricingUnitOption[]> = {
  drywaller: [
    { value: "per m²", label: "per m²" },
    { value: "per board", label: "per board (8x4 ft sheet)" },
    { value: "per day", label: "per day" },
    { value: "per room", label: "per room" },
    { value: "per project", label: "per project" }
  ],
  plasterer: [
    { value: "per m²", label: "per m² (skim coat)" },
    { value: "per day", label: "per day" },
    { value: "per room", label: "per room" },
    { value: "per project", label: "per project" }
  ],
  electrician: [
    { value: "per hour", label: "per hour" },
    { value: "per day", label: "per day" },
    { value: "per circuit", label: "per circuit" },
    { value: "per consumer unit", label: "per consumer unit (CU)" },
    { value: "per certificate", label: "per certificate (EICR/PAT)" },
    { value: "callout fee", label: "callout fee" },
    { value: "per project", label: "per project" }
  ],
  scaffolder: [
    { value: "per day", label: "per day (labour)" },
    { value: "per week", label: "per week (hire)" },
    { value: "per lift", label: "per lift" },
    { value: "per bay", label: "per bay" },
    { value: "per stand", label: "per stand" },
    { value: "per project", label: "per project" }
  ],
  tiler: [
    { value: "per m²", label: "per m²" },
    { value: "per day", label: "per day" },
    { value: "per room", label: "per room" },
    { value: "per project", label: "per project" }
  ],
  plumber: [
    { value: "per hour", label: "per hour" },
    { value: "per day", label: "per day" },
    { value: "callout fee", label: "callout fee" },
    { value: "per appliance", label: "per appliance install" },
    { value: "per certificate", label: "per certificate (gas safe)" },
    { value: "per project", label: "per project" }
  ],
  carpenter: [
    { value: "per day", label: "per day" },
    { value: "per hour", label: "per hour" },
    { value: "per door", label: "per door" },
    { value: "per door + frame", label: "per door + frame" },
    { value: "per cabinet", label: "per cabinet/unit" },
    { value: "per linear m", label: "per linear metre (skirting/architrave)" },
    { value: "per project", label: "per project" }
  ],
  joiner: [
    { value: "per day", label: "per day" },
    { value: "per hour", label: "per hour" },
    { value: "per door", label: "per door (hung)" },
    { value: "per staircase", label: "per staircase" },
    { value: "per window", label: "per window" },
    { value: "per linear m", label: "per linear metre" },
    { value: "per project", label: "per project" }
  ],
  painter: [
    { value: "per m²", label: "per m² (walls)" },
    { value: "per room", label: "per room" },
    { value: "per day", label: "per day" },
    { value: "per door", label: "per door" },
    { value: "per house", label: "per house (exterior)" },
    { value: "per project", label: "per project" }
  ],
  roofer: [
    { value: "per m²", label: "per m² (tile/slate)" },
    { value: "per day", label: "per day" },
    { value: "per ridge", label: "per ridge" },
    { value: "per chimney", label: "per chimney" },
    { value: "per gutter run", label: "per gutter run" },
    { value: "per project", label: "per project" }
  ],
  bricklayer: [
    { value: "per 1,000 bricks", label: "per 1,000 bricks laid" },
    { value: "per m²", label: "per m² of wall" },
    { value: "per day", label: "per day" },
    { value: "per chimney stack", label: "per chimney stack" },
    { value: "per project", label: "per project" }
  ],
  stonemason: [
    { value: "per m²", label: "per m²" },
    { value: "per linear m", label: "per linear metre" },
    { value: "per day", label: "per day" },
    { value: "per stone", label: "per stone (cut + dressed)" },
    { value: "per project", label: "per project" }
  ],
  groundworker: [
    { value: "per m²", label: "per m² (slab/screed)" },
    { value: "per m³", label: "per m³ (dig/concrete)" },
    { value: "per day", label: "per day" },
    { value: "per drainage point", label: "per drainage point" },
    { value: "per project", label: "per project" }
  ],
  "general-builder": [
    { value: "per day", label: "per day" },
    { value: "per m²", label: "per m² (extensions)" },
    { value: "per week", label: "per week" },
    { value: "per project", label: "per project" }
  ],
  "concrete-specialist": [
    { value: "per m²", label: "per m² (slab)" },
    { value: "per m³", label: "per m³ (volume)" },
    { value: "per pour", label: "per pour" },
    { value: "per day", label: "per day" },
    { value: "per project", label: "per project" }
  ],
  renderer: [
    { value: "per m²", label: "per m²" },
    { value: "per day", label: "per day" },
    { value: "per house", label: "per house (full render)" },
    { value: "per project", label: "per project" }
  ],
  "taper-and-finisher": [
    { value: "per m²", label: "per m² (taping + skim)" },
    { value: "per day", label: "per day" },
    { value: "per project", label: "per project" }
  ]
};

// Universal fallback when the primary_trade doesn't appear in the map.
export const GENERIC_PRICING_UNITS: PricingUnitOption[] = [
  { value: "per hour", label: "per hour" },
  { value: "per day", label: "per day" },
  { value: "per project", label: "per project" },
  { value: "from", label: "from (starting price)" }
];

export const PRICING_UNIT_OTHER_VALUE = "__other";

export function unitsForTrade(tradeSlug: string | null | undefined): PricingUnitOption[] {
  if (!tradeSlug) return GENERIC_PRICING_UNITS;
  return TRADE_PRICING_UNITS[tradeSlug] ?? GENERIC_PRICING_UNITS;
}
