// Paving adapter — driveways, patios, paths in block paving.
// Parses "block paving driveway 8m x 5m", "40m² patio", "paving 6 by 4".

import { evidenceFor, type EstimateLine, type TradeAdapter, type TradeBase, type TradeInput } from "../types";

const BLOCK_M2_PENCE     = 2200;    // £22/m² block paving (mixed)
const SUBBASE_M2_PENCE   = 800;     // MOT type 1 + sand
const EDGING_M_PENCE     = 950;     // kerb / edging restraint per m
const M2_PER_LABOURER_HOUR = 1.2;

export const pavingAdapter: TradeAdapter = {
  trade:   "paving",
  label:   "Block paving / patios",
  aliases: ["paving", "paved", "block paving", "driveway", "patio", "path"],

  parse(natural: string): TradeInput["parameters"] | null {
    const t = natural.toLowerCase();
    // Dimensional first: "8m x 5m", "8 x 5 metres"
    let m = t.match(/(\d+(?:\.\d+)?)\s*(?:m|metres?)?\s*[x×by]\s*(\d+(?:\.\d+)?)\s*(?:m|metres?)?/);
    if (m && /(paving|paved|driveway|patio|path)/.test(t)) {
      const l = Number(m[1]), w = Number(m[2]);
      if (isFinite(l) && isFinite(w) && l > 0 && w > 0) {
        return { area_m2: Number((l * w).toFixed(2)), length_m: l, width_m: w };
      }
    }
    // Area form: "40 m²", "40m2 patio"
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sq\.?\s*m|square\s+met(?:re|er)s?|sqm)/);
    if (m && /(paving|paved|driveway|patio|path)/.test(t)) {
      const area = Number(m[1]);
      if (isFinite(area) && area > 0) return { area_m2: area };
    }
    return null;
  },

  compute(input, defaults): TradeBase {
    const p = (input.parameters ?? {}) as { area_m2: number; length_m?: number; width_m?: number };
    const area = Number(p.area_m2);
    const ev = evidenceFor("paving adapter (UK baseline)", ["hammerex_knowledge_entries"]);

    const perimeter = p.length_m && p.width_m ? 2 * (p.length_m + p.width_m) : Math.ceil(Math.sqrt(area) * 4);

    const materialLines: EstimateLine[] = [
      {
        category: "material", label: "Block paving units",
        qty: area, unit: "m2", unit_cost_pence: BLOCK_M2_PENCE,
        total_pence: Math.round(area * BLOCK_M2_PENCE),
        explanation: `${area} m² × £${(BLOCK_M2_PENCE / 100).toFixed(0)}/m² for standard block paving.`,
        evidence: ev
      },
      {
        category: "material", label: "MOT Type 1 sub-base + kiln-dried sand",
        qty: area, unit: "m2", unit_cost_pence: SUBBASE_M2_PENCE,
        total_pence: Math.round(area * SUBBASE_M2_PENCE),
        explanation: `${area} m² × £${(SUBBASE_M2_PENCE / 100).toFixed(0)}/m² for 150 mm MOT-1 sub-base + jointing sand.`,
        evidence: ev
      },
      {
        category: "material", label: "Edge restraint / kerb",
        qty: perimeter, unit: "m", unit_cost_pence: EDGING_M_PENCE,
        total_pence: Math.round(perimeter * EDGING_M_PENCE),
        explanation: `${perimeter} m perimeter × £${(EDGING_M_PENCE / 100).toFixed(0)}/m for concrete edging.`,
        evidence: ev
      }
    ];

    const crew = 3;   // 1 excavator op + 2 layers
    const hours = Math.ceil(area / M2_PER_LABOURER_HOUR / crew);
    const days = Number((hours / 8).toFixed(1));
    const labourPence = hours * crew * defaults.labour_rate_pence_per_hour;
    const labourLines: EstimateLine[] = [{
      category: "labour", label: `${crew}-person paving crew`,
      qty: hours * crew, unit: "hour",
      unit_cost_pence: defaults.labour_rate_pence_per_hour,
      total_pence: labourPence,
      explanation: `${area} m² ÷ ${M2_PER_LABOURER_HOUR} m²/hour ÷ ${crew} = ${hours} hours per worker (~${days} day${days === 1 ? "" : "s"}), × ${crew} workers @ £${(defaults.labour_rate_pence_per_hour / 100).toFixed(0)}/hour.`
                  + ` Labour rate source: ${defaults.source.labour_rate === "merchant" ? "your default" : "engine default"}.`,
      evidence: ev
    }];

    const plantLines: EstimateLine[] = [{
      category: "plant", label: "Mini-digger + plate compactor hire",
      total_pence: 18000,
      explanation: "Two-day hire of a 1.5t mini-digger + wacker plate — typical £180 for a small driveway.",
      evidence: ev
    }];

    const warnings: string[] = [];
    if (area > 100) warnings.push("Large area — planning permission may apply for driveways over 5 m² of impermeable paving without proper drainage.");

    return {
      scope: p.length_m && p.width_m
        ? `${p.length_m} × ${p.width_m} m block paving (${area} m²)`
        : `${area} m² block paving`,
      parameters:    { area_m2: area, perimeter_m: perimeter, crew, labour_hours: hours * crew },
      materialLines,
      labourLines,
      plantLines,
      deliveryLines: [],
      labour_hours:  hours * crew,
      crew_size:     crew,
      duration_days: days,
      warnings
    };
  }
};
