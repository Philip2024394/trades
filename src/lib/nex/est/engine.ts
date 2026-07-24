// Estimating engine — orchestrates a trade adapter into a full
// Estimate with waste / overhead / profit / VAT layers.
//
// The trade adapter never touches those layers. That guarantees:
//   • Every estimate uses the same policy stack
//   • Merchant defaults change once (in defaults.ts) and every trade
//     inherits them
//   • Explanations can point at the source of every number

import { resolveMerchantDefaults } from "./defaults";
import { findAdapter } from "./registry";
import {
  evidenceFor,
  type Estimate,
  type EstimateContext,
  type EstimateLine,
  type MerchantDefaults,
  type TradeBase
} from "./types";

export type BuildEstimateInput = {
  /** The natural-language brief. "42m² plastering" or "1.5m³ concrete pour". */
  brief:      string;
  /** Force a specific trade adapter. Otherwise the engine tries each
   *  registered adapter's parser and picks the first match. */
  tradeHint?: string;
  /** Merchant + override context. */
  context?:   EstimateContext;
};

export type BuildEstimateResult =
  | { ok: true;  estimate: Estimate }
  | { ok: false; reason: "no_trade_matched" | "adapter_failed"; detail?: string };

export async function buildEstimate(input: BuildEstimateInput): Promise<BuildEstimateResult> {
  const ctx      = input.context ?? {};
  const defaults = await resolveMerchantDefaults(ctx);

  const adapter = findAdapter(input.brief, input.tradeHint);
  if (!adapter) return { ok: false, reason: "no_trade_matched" };

  const parsed = adapter.parse(input.brief);
  if (!parsed) return { ok: false, reason: "no_trade_matched", detail: `${adapter.trade} adapter could not parse the brief` };

  let base: TradeBase;
  try {
    base = adapter.compute({ natural: input.brief, parameters: parsed }, defaults, ctx);
  } catch (err) {
    return { ok: false, reason: "adapter_failed", detail: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true, estimate: assemble(adapter.trade, adapter.label, base, defaults) };
}

/** Public helper: assemble takes an already-built TradeBase and adds
 *  the waste / overhead / profit / VAT layers. Exposed so tests can
 *  construct a synthetic TradeBase without a full adapter run. */
export function assemble(
  tradeSlug:  string,
  tradeLabel: string,
  base:       TradeBase,
  defaults:   MerchantDefaults
): Estimate {
  const materialLines = base.materialLines;
  const labourLines   = base.labourLines;
  const plantLines    = base.plantLines;
  const deliveryLines = base.deliveryLines;

  const materials_pence = sum(materialLines);
  const labour_pence    = sum(labourLines);
  const plant_pence     = sum(plantLines);
  const delivery_pence  = sum(deliveryLines);

  const wastePct = base.waste_pct_override ?? defaults.default_waste_pct;
  const waste_pence = Math.round(materials_pence * (wastePct / 100));
  const wasteLine: EstimateLine = {
    category:    "waste",
    label:       "Materials waste",
    qty:         wastePct,
    unit:        "pct",
    total_pence: waste_pence,
    explanation: `${wastePct}% waste on £${gbp(materials_pence)} of materials.`
                + ` Source: ${defaults.source.default_waste === "merchant" ? "your default" : "engine default"}.`,
    evidence:    evidenceFor("engine defaults + adapter", ["hammerex_nex_estimating_defaults?"])
  };

  const subtotal_pence = materials_pence + labour_pence + plant_pence + delivery_pence + waste_pence;

  const overhead_pence = Math.round(subtotal_pence * (defaults.overhead_pct / 100));
  const overheadLine: EstimateLine = {
    category:    "overhead",
    label:       "Overheads",
    qty:         defaults.overhead_pct,
    unit:        "pct",
    total_pence: overhead_pence,
    explanation: `${defaults.overhead_pct}% overhead on £${gbp(subtotal_pence)} of cost.`
                + ` Source: ${defaults.source.overhead === "merchant" ? "your default" : "engine default"}.`,
    evidence:    evidenceFor("engine defaults", [])
  };

  const profit_base = subtotal_pence + overhead_pence;
  const profit_pence = Math.round(profit_base * (defaults.profit_margin_pct / 100));
  const profitLine: EstimateLine = {
    category:    "profit",
    label:       "Profit margin",
    qty:         defaults.profit_margin_pct,
    unit:        "pct",
    total_pence: profit_pence,
    explanation: `${defaults.profit_margin_pct}% profit markup on £${gbp(profit_base)} (cost + overhead).`
                + ` Source: ${defaults.source.profit_margin === "merchant" ? "your default" : "engine default"}.`,
    evidence:    evidenceFor("engine defaults", [])
  };

  const net_pence = subtotal_pence + overhead_pence + profit_pence;

  const vat_pence = Math.round(net_pence * (defaults.vat_pct / 100));
  const vatLine: EstimateLine = {
    category:    "vat",
    label:       `VAT @ ${defaults.vat_pct}%`,
    qty:         defaults.vat_pct,
    unit:        "pct",
    total_pence: vat_pence,
    explanation: `${defaults.vat_pct}% VAT on £${gbp(net_pence)} net price.`,
    evidence:    evidenceFor("engine defaults (UK standard 20%)", [])
  };

  const total_pence = net_pence + vat_pence;

  const lines: EstimateLine[] = [
    ...materialLines,
    ...labourLines,
    ...plantLines,
    ...deliveryLines,
    wasteLine,
    { category: "subtotal", label: "Subtotal (cost)", total_pence: subtotal_pence, explanation: "Materials + labour + plant + delivery + waste.", evidence: evidenceFor("engine sum", []) },
    overheadLine,
    profitLine,
    { category: "subtotal", label: "Net price (ex-VAT)", total_pence: net_pence, explanation: "Cost + overhead + profit.", evidence: evidenceFor("engine sum", []) },
    vatLine,
    { category: "total", label: "Total (inc VAT)", total_pence, explanation: "Net + VAT — headline price for the customer.", evidence: evidenceFor("engine sum", []) }
  ];

  const explanation = writeExplanation(base, {
    materials: materials_pence, labour: labour_pence, plant: plant_pence, delivery: delivery_pence,
    waste: waste_pence, overhead: overhead_pence, profit: profit_pence, vat: vat_pence, total: total_pence
  }, defaults);

  return {
    trade:          tradeSlug,
    trade_label:    tradeLabel,
    scope:          base.scope,
    parameters:     base.parameters,
    lines,
    materials_pence,
    labour_pence,
    plant_pence,
    delivery_pence,
    waste_pence,
    subtotal_pence,
    overhead_pence,
    profit_pence,
    net_pence,
    vat_pence,
    total_pence,
    labour_hours:   base.labour_hours,
    crew_size:      base.crew_size,
    duration_days:  base.duration_days,
    defaults,
    warnings:       base.warnings,
    explanation,
    computed_at:    new Date().toISOString()
  };
}

function sum(lines: EstimateLine[]): number { return lines.reduce((s, l) => s + l.total_pence, 0); }
function gbp(pence: number): string { return (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

function writeExplanation(base: TradeBase, totals: Record<string, number>, defaults: MerchantDefaults): string {
  const parts: string[] = [];
  parts.push(`${base.scope}.`);
  parts.push(`Materials £${gbp(totals.materials)}, labour £${gbp(totals.labour)} across ${base.crew_size} worker${base.crew_size === 1 ? "" : "s"} over ${base.duration_days.toFixed(1)} day${base.duration_days === 1 ? "" : "s"} (${base.labour_hours.toFixed(0)} hours).`);
  if (totals.plant > 0)    parts.push(`Plant £${gbp(totals.plant)}.`);
  if (totals.delivery > 0) parts.push(`Delivery £${gbp(totals.delivery)}.`);
  parts.push(`Waste £${gbp(totals.waste)} (${defaults.default_waste_pct}%), overheads £${gbp(totals.overhead)} (${defaults.overhead_pct}%), profit £${gbp(totals.profit)} (${defaults.profit_margin_pct}%).`);
  parts.push(`VAT £${gbp(totals.vat)}. Total £${gbp(totals.total)} inc VAT.`);
  const engineOnly = Object.values(defaults.source).every((s) => s === "engine");
  if (engineOnly) parts.push("All rates are engine defaults — set yours in Studio for a tuned quote.");
  return parts.join(" ");
}
