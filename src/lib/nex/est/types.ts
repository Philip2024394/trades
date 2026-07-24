// Nex Estimating Intelligence — contracts.
//
// The estimator is a REASONING layer, not a UI calculator. Existing
// per-product calculators (src/lib/calculators/*) render merchant-facing
// PDP cards; this engine produces the cost decomposition an estimator
// wants: materials, labour, plant, waste, overhead, profit, VAT — all
// visible, all explained.
//
// Every line carries an explanation string so Nex can answer "why 18
// boards?" with the actual arithmetic, not a hallucination.

import type { Evidence } from "../pi/types";
export type { Evidence };

export const ESTIMATE_CATEGORIES = [
  "material",
  "labour",
  "plant",
  "delivery",
  "subcontractor",
  "waste",
  "overhead",
  "profit",
  "vat",
  "subtotal",
  "total"
] as const;
export type EstimateCategory = typeof ESTIMATE_CATEGORIES[number];

/** One line on the estimate. */
export type EstimateLine = {
  category:    EstimateCategory;
  label:       string;
  qty?:        number;
  unit?:       "each" | "m" | "m2" | "m3" | "kg" | "bag" | "board" | "tin" | "hour" | "day" | "pct" | "job";
  unit_cost_pence?: number;
  total_pence: number;
  /** The arithmetic + reasoning behind this line. Never fabricated.
   *  If the number is a merchant default it says so ("labour rate
   *  £45/h from your defaults"); if it's engine-level it says so. */
  explanation: string;
  evidence:    Evidence;
};

/** Merchant defaults resolved for the current estimate. `source` on
 *  each field tells the engine (and the user) where the number came
 *  from — a merchant override, the engine default, or a trade-pack. */
export type MerchantDefaults = {
  labour_rate_pence_per_hour: number;
  overhead_pct:               number;   // e.g. 12 = 12%
  profit_margin_pct:          number;   // markup on cost — e.g. 20 = 20%
  default_waste_pct:          number;   // e.g. 10 = 10%
  vat_pct:                    number;   // UK standard 20
  currency:                   "GBP";
  region:                     string;   // "UK" for now
  /** Per-field provenance — never overwrite this without also flipping
   *  the source so callers can trust "was this a merchant default or
   *  engine fallback?". */
  source: {
    labour_rate:     "merchant" | "engine";
    overhead:        "merchant" | "engine";
    profit_margin:   "merchant" | "engine";
    default_waste:   "merchant" | "engine";
    vat:             "merchant" | "engine";
  };
};

/** The pre-waste breakdown a trade adapter produces. The engine wraps
 *  waste/overhead/profit/VAT around it. Trade adapters never touch
 *  those layers themselves so we keep policy in one place. */
export type TradeBase = {
  scope:            string;                     // "42m² skim plaster"
  parameters:       Record<string, unknown>;    // parsed brief
  materialLines:    EstimateLine[];
  labourLines:      EstimateLine[];
  plantLines:       EstimateLine[];
  deliveryLines:    EstimateLine[];
  labour_hours:     number;                     // total, for productivity display
  crew_size:        number;                     // usual crew for this scope
  duration_days:    number;                     // calendar days for this scope
  warnings:         string[];
  /** Optional custom waste rate — some trades (concrete pours) use
   *  higher waste than the merchant default. If unset the engine
   *  uses defaults.default_waste_pct. */
  waste_pct_override?: number;
};

/** Natural-language + structured input to a trade adapter. */
export type TradeInput = {
  natural?:  string;                    // "42m² of plastering"
  parameters?: Record<string, unknown>; // { area_m2: 42, finish: 'skim' }
};

export type EstimateContext = {
  merchantSlug?: string;
  now?:          Date;
  /** Override any subset of merchant defaults for this estimate only. */
  overrides?:    Partial<Omit<MerchantDefaults, "source" | "currency">>;
};

export type TradeAdapter = {
  trade:  string;                       // "plastering", "concreting", "painting"
  label:  string;                       // "Plastering"
  aliases: string[];                    // trade names Nex can recognise
  /** Try to parse a natural brief into a structured TradeInput. Return
   *  null if the brief doesn't look like this trade. */
  parse:  (natural: string) => TradeInput["parameters"] | null;
  /** Build the pre-waste base. Adapter never applies overhead/profit/VAT. */
  compute: (input: TradeInput, defaults: MerchantDefaults, ctx: EstimateContext) => TradeBase;
};

/** The full estimate — what Nex hands back to the merchant. */
export type Estimate = {
  trade:              string;
  trade_label:        string;
  scope:              string;
  parameters:         Record<string, unknown>;
  lines:              EstimateLine[];      // in display order
  materials_pence:    number;
  labour_pence:       number;
  plant_pence:        number;
  delivery_pence:     number;
  waste_pence:        number;
  subtotal_pence:     number;              // materials + labour + plant + delivery + waste
  overhead_pence:     number;
  profit_pence:       number;
  net_pence:          number;              // subtotal + overhead + profit
  vat_pence:          number;
  total_pence:        number;              // net + vat
  labour_hours:       number;
  crew_size:          number;
  duration_days:      number;
  defaults:           MerchantDefaults;
  warnings:           string[];
  explanation:        string;              // one-paragraph story of the estimate
  computed_at:        string;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
