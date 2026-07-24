// Concreting adapter — parses "1.5m³ concrete pour", "6 cubic metres
// of concrete", "concrete slab 5m × 4m × 0.15m".

import { evidenceFor, type EstimateLine, type TradeAdapter, type TradeBase, type TradeInput } from "../types";

const M3_PER_MIXER_LOAD = 6;
const CONCRETE_M3_PENCE = 12500;   // £125 per m³ delivered ready-mix (UK ballpark)
const MIXER_PUMP_PENCE  = 25000;   // £250 pump surcharge per pour > 1m³
const M3_PER_LABOURER_HOUR = 0.6;  // pouring + finishing productivity

export const concretingAdapter: TradeAdapter = {
  trade:   "concreting",
  label:   "Concreting",
  aliases: ["concrete", "concreting", "concreter", "slab"],

  parse(natural: string): TradeInput["parameters"] | null {
    // "1.5 m³" / "1.5 m3" / "1.5 cubic metres"
    let m = natural.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:m3|m³|cubic\s+met(?:re|er)s?)/);
    if (m) {
      const vol = Number(m[1]);
      if (isFinite(vol) && vol > 0) return { volume_m3: vol };
    }
    // Dimensional form: "5m x 4m x 0.15m" (× or x)
    m = natural.toLowerCase().match(/(\d+(?:\.\d+)?)\s*m?\s*[x×]\s*(\d+(?:\.\d+)?)\s*m?\s*[x×]\s*(\d+(?:\.\d+)?)\s*m/);
    if (m && /(concrete|slab|pour|foundation)/i.test(natural)) {
      const vol = Number(m[1]) * Number(m[2]) * Number(m[3]);
      if (isFinite(vol) && vol > 0) return { volume_m3: Number(vol.toFixed(2)), dims: { l: Number(m[1]), w: Number(m[2]), d: Number(m[3]) } };
    }
    return null;
  },

  compute(input, defaults): TradeBase {
    const p = (input.parameters ?? {}) as { volume_m3: number; dims?: { l: number; w: number; d: number } };
    const volume = Number(p.volume_m3);
    const ev = evidenceFor("concreting adapter (UK baseline)", ["hammerex_knowledge_entries"]);

    const concretePence = Math.round(volume * CONCRETE_M3_PENCE);
    const materialLines: EstimateLine[] = [{
      category: "material",
      label: "Ready-mix concrete C25",
      qty: Number(volume.toFixed(2)),
      unit: "m3",
      unit_cost_pence: CONCRETE_M3_PENCE,
      total_pence: concretePence,
      explanation: `${volume.toFixed(2)} m³ × £${(CONCRETE_M3_PENCE / 100).toFixed(0)}/m³ ready-mix.`,
      evidence: ev
    }];

    const plantLines: EstimateLine[] = [];
    if (volume > 1) {
      plantLines.push({
        category: "plant",
        label: "Concrete pump / mixer surcharge",
        total_pence: MIXER_PUMP_PENCE,
        explanation: `Pours over 1 m³ typically use a pump or larger delivery — £${(MIXER_PUMP_PENCE / 100).toFixed(0)} surcharge.`,
        evidence: ev
      });
    }

    const crew = 2;
    const hours = Math.max(2, Math.ceil(volume / M3_PER_LABOURER_HOUR / crew));
    const days = Number((hours / 8).toFixed(1));
    const labourPence = hours * crew * defaults.labour_rate_pence_per_hour;
    const labourLines: EstimateLine[] = [{
      category: "labour",
      label: `${crew} groundworkers`,
      qty: hours * crew,
      unit: "hour",
      unit_cost_pence: defaults.labour_rate_pence_per_hour,
      total_pence: labourPence,
      explanation: `${volume.toFixed(2)} m³ ÷ ${M3_PER_LABOURER_HOUR} m³/hour ÷ ${crew} = ${hours} hours per worker (~${days} day${days === 1 ? "" : "s"}) × ${crew} workers @ £${(defaults.labour_rate_pence_per_hour / 100).toFixed(0)}/hour.`
                  + ` Labour rate source: ${defaults.source.labour_rate === "merchant" ? "your default" : "engine default"}.`,
      evidence: ev
    }];

    const warnings: string[] = [];
    if (volume > M3_PER_MIXER_LOAD) warnings.push(`Pour is larger than one mixer load (${M3_PER_MIXER_LOAD} m³) — schedule multiple deliveries and confirm access.`);
    if (volume < 0.5) warnings.push("Very small pour — consider bagged mix instead of ready-mix (surcharge may exceed material saving).");

    return {
      scope:         p.dims ? `${p.dims.l}×${p.dims.w}×${p.dims.d} m concrete slab (${volume.toFixed(2)} m³)` : `${volume.toFixed(2)} m³ concrete pour`,
      parameters:    { volume_m3: volume, crew, labour_hours: hours * crew },
      materialLines,
      labourLines,
      plantLines,
      deliveryLines: [],
      labour_hours:  hours * crew,
      crew_size:     crew,
      duration_days: days,
      warnings,
      waste_pct_override: 5   // ready-mix waste is tight
    };
  }
};
