// Painting / decorating adapter — parses "paint 60m² walls",
// "decorate a 4x3 bedroom", "emulsion 40 square metres".

import { evidenceFor, type EstimateLine, type TradeAdapter, type TradeBase, type TradeInput } from "../types";

const PAINT_M2_PER_LITRE       = 12;      // 1 L covers ~12 m² per coat
const COATS                    = 2;
const PAINT_L_PENCE_PER_LITRE  = 900;     // £9/L trade-grade vinyl matt
const PRIMER_L_PER_M2          = 0.08;
const M2_PER_DECORATOR_HOUR    = 8;       // 8 m² per hour incl cutting-in

export const paintingAdapter: TradeAdapter = {
  trade:   "painting",
  label:   "Painting & decorating",
  aliases: ["paint", "painting", "decorate", "decorating", "emulsion", "decorator"],

  parse(natural: string): TradeInput["parameters"] | null {
    const t = natural.toLowerCase();
    // Area form: "60 m²", "60m2"
    let m = t.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sq\.?\s*m|square\s+met(?:re|er)s?|sqm)/);
    if (m && /(paint|decorat|emulsion)/.test(t)) {
      const a = Number(m[1]);
      if (isFinite(a) && a > 0) return { area_m2: a };
    }
    // Dimensional: "4 x 3 bedroom" — walls only (2·(l+w)·h with h=2.4m default)
    m = t.match(/(\d+(?:\.\d+)?)\s*[x×by]\s*(\d+(?:\.\d+)?)/);
    if (m && /(paint|decorat|room|bedroom|lounge|kitchen)/.test(t)) {
      const l = Number(m[1]), w = Number(m[2]);
      const height = 2.4;
      const walls = 2 * (l + w) * height;
      if (isFinite(walls) && walls > 0) return { area_m2: Number(walls.toFixed(1)), room_dims: { l, w, h: height } };
    }
    return null;
  },

  compute(input, defaults): TradeBase {
    const p = (input.parameters ?? {}) as { area_m2: number; room_dims?: { l: number; w: number; h: number } };
    const area = Number(p.area_m2);
    const ev = evidenceFor("painting adapter (UK baseline)", ["hammerex_knowledge_entries"]);

    const litresNeeded = Math.ceil((area * COATS) / PAINT_M2_PER_LITRE);
    const primerLitres = Math.ceil(area * PRIMER_L_PER_M2);

    const materialLines: EstimateLine[] = [
      {
        category: "material", label: "Vinyl matt emulsion",
        qty: litresNeeded, unit: "each", unit_cost_pence: PAINT_L_PENCE_PER_LITRE,
        total_pence: litresNeeded * PAINT_L_PENCE_PER_LITRE,
        explanation: `${area} m² × ${COATS} coats ÷ ${PAINT_M2_PER_LITRE} m²/L, rounded up → ${litresNeeded} L @ £${(PAINT_L_PENCE_PER_LITRE / 100).toFixed(2)}/L.`,
        evidence: ev
      },
      {
        category: "material", label: "Primer / sealer",
        qty: primerLitres, unit: "each", unit_cost_pence: 700,
        total_pence: primerLitres * 700,
        explanation: `${area} m² × ${PRIMER_L_PER_M2} L/m² = ${primerLitres} L primer @ £7.00/L.`,
        evidence: ev
      },
      {
        category: "material", label: "Rollers, brushes, masking",
        total_pence: 4000,
        explanation: "Consumables allowance — ~£40 per single-room decorate.",
        evidence: ev
      }
    ];

    const crew = 1;
    const hours = Math.max(4, Math.ceil((area * COATS) / M2_PER_DECORATOR_HOUR));
    const days = Number((hours / 8).toFixed(1));
    const labourPence = hours * defaults.labour_rate_pence_per_hour;
    const labourLines: EstimateLine[] = [{
      category: "labour", label: "Decorator",
      qty: hours, unit: "hour", unit_cost_pence: defaults.labour_rate_pence_per_hour,
      total_pence: labourPence,
      explanation: `${area} m² × ${COATS} coats ÷ ${M2_PER_DECORATOR_HOUR} m²/hour = ${hours} hours (~${days} day${days === 1 ? "" : "s"}) @ £${(defaults.labour_rate_pence_per_hour / 100).toFixed(0)}/hour.`
                  + ` Labour rate source: ${defaults.source.labour_rate === "merchant" ? "your default" : "engine default"}.`,
      evidence: ev
    }];

    return {
      scope: p.room_dims
        ? `Decorate ${p.room_dims.l}×${p.room_dims.w}×${p.room_dims.h} m room walls (${area} m²)`
        : `Paint ${area} m² of walls (${COATS} coats)`,
      parameters:    { area_m2: area, coats: COATS, litres: litresNeeded, crew, labour_hours: hours },
      materialLines,
      labourLines,
      plantLines:    [],
      deliveryLines: [],
      labour_hours:  hours,
      crew_size:     crew,
      duration_days: days,
      warnings:      area < 8 ? ["Very small area — consider a minimum call-out charge to keep the job viable."] : []
    };
  }
};
