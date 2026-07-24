// Plastering trade adapter — the spec's worked example.
//
// Parses "42m² plaster", "plaster 55 square metres", "42 m2 skim
// plastering". Produces a fully-decomposed base with plasterboards +
// finish plaster + tape + primer + beads + labour + waste warning.
//
// Rates + coverage constants derive from UK-standard plasterer's
// merchant baselines. Every line's explanation includes the arithmetic
// so Nex can answer "why 18 boards?" with the actual formula.

import { evidenceFor, type EstimateLine, type MerchantDefaults, type TradeAdapter, type TradeBase, type TradeInput } from "../types";

// ─── Constants (all UK-standard merchant baselines) ─────────────────

/** Standard 2400×1200 mm plasterboard = 2.88 m² coverage each. */
const BOARD_COVERAGE_M2       = 2.88;
/** 25 kg bag of finish plaster covers ~9 m² at skim thickness. */
const PLASTER_BAG_COVERAGE_M2 = 9;
/** Joint tape used at ~1.5 m per m² of skim (joints × 2 sides). */
const TAPE_M_PER_M2           = 1.5;
/** Primer coverage — 1 L primer per ~10 m² undercoat. */
const PRIMER_L_PER_M2         = 0.1;
/** Bead per m² — mostly perimeter beads (windows/doors). Rule of thumb. */
const BEAD_M_PER_M2           = 0.35;

/** Merchant baseline unit costs (pence). These are the "trade-pack"
 *  numbers — merchants can override via context.overrides once we
 *  wire per-merchant supplier prices. */
const UNIT_COSTS = {
  board_pence:       850,     // £8.50 per 2400×1200 board
  plaster_bag_pence: 1150,    // £11.50 per 25 kg bag finish plaster
  tape_roll_pence:   350,     // £3.50 per 90 m roll
  tape_roll_m:       90,
  primer_l_pence:    650,     // £6.50 per litre PVA primer
  bead_m_pence:      150      // £1.50 per m corner/angle bead
};

/** Productivity — a two-plasterer crew skims 20 m² per plasterer per
 *  day at 8 hours (~2.5 m²/hour). Used for hours + duration. */
const M2_PER_PLASTERER_HOUR = 2.5;

// ─── Adapter ────────────────────────────────────────────────────────

export const plasteringAdapter: TradeAdapter = {
  trade:   "plastering",
  label:   "Plastering",
  aliases: ["plaster", "skim", "plasterer", "plastering"],

  parse(natural: string): TradeInput["parameters"] | null {
    // Accept: "42m²", "42 m2", "42 sq m", "42 square metres", "42sqm"
    const m = natural
      .toLowerCase()
      .match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sq\.?\s*m|square\s+met(?:re|er)s?|sqm)/);
    if (!m) return null;
    if (!/(plaster|skim)/i.test(natural)) return null;
    const area = Number(m[1]);
    if (!isFinite(area) || area <= 0) return null;

    const finish: "skim_only" | "bonding_skim" | "slab_skim" =
      /bonding/i.test(natural)   ? "bonding_skim" :
      /slab|dot\s+and\s+dab/i.test(natural) ? "slab_skim" :
                                              "skim_only";
    const substrate: "solid" | "timber_studwork" =
      /timber|stud|studwork/i.test(natural) ? "timber_studwork" : "solid";
    return { area_m2: area, finish, substrate };
  },

  compute(input, defaults, _ctx): TradeBase {
    const params    = (input.parameters ?? {}) as { area_m2: number; finish: "skim_only" | "bonding_skim" | "slab_skim"; substrate: "solid" | "timber_studwork" };
    const area      = Number(params.area_m2);
    const finish    = params.finish ?? "skim_only";
    const substrate = params.substrate ?? "solid";

    const boardsNeeded = substrate === "timber_studwork" || finish === "slab_skim"
      ? Math.ceil((area / BOARD_COVERAGE_M2) * 1.08)   // +8% cut/waste
      : 0;                                              // solid wall skim = no boards
    const bagsNeeded    = Math.ceil((area / PLASTER_BAG_COVERAGE_M2) * 1.05);
    const tapeMeters    = Math.ceil(area * TAPE_M_PER_M2);
    const tapeRolls     = Math.ceil(tapeMeters / UNIT_COSTS.tape_roll_m);
    const primerLitres  = Math.ceil(area * PRIMER_L_PER_M2);
    const beadMeters    = Math.ceil(area * BEAD_M_PER_M2);

    const ev = evidenceFor("plastering adapter (UK baseline)", ["hammerex_knowledge_entries (content_type=material)"]);

    const materialLines: EstimateLine[] = [];

    if (boardsNeeded > 0) {
      const pence = boardsNeeded * UNIT_COSTS.board_pence;
      materialLines.push({
        category:    "material",
        label:       "Plasterboard 2400×1200",
        qty:         boardsNeeded,
        unit:        "board",
        unit_cost_pence: UNIT_COSTS.board_pence,
        total_pence: pence,
        explanation: `${area} m² ÷ ${BOARD_COVERAGE_M2} m²/board = ${(area / BOARD_COVERAGE_M2).toFixed(2)} boards; ×1.08 cut allowance, rounded up → ${boardsNeeded} boards @ £${(UNIT_COSTS.board_pence / 100).toFixed(2)}.`,
        evidence:    ev
      });
    }

    {
      const pence = bagsNeeded * UNIT_COSTS.plaster_bag_pence;
      materialLines.push({
        category:    "material",
        label:       `${finish === "bonding_skim" ? "Bonding + finish" : finish === "slab_skim" ? "Finish plaster (slab-and-skim)" : "Finish plaster (skim)"}`,
        qty:         bagsNeeded,
        unit:        "bag",
        unit_cost_pence: UNIT_COSTS.plaster_bag_pence,
        total_pence: pence,
        explanation: `${area} m² ÷ ${PLASTER_BAG_COVERAGE_M2} m²/bag = ${(area / PLASTER_BAG_COVERAGE_M2).toFixed(2)} bags; ×1.05 mix waste, rounded up → ${bagsNeeded} bags @ £${(UNIT_COSTS.plaster_bag_pence / 100).toFixed(2)}.`,
        evidence:    ev
      });
    }

    {
      const pence = tapeRolls * UNIT_COSTS.tape_roll_pence;
      materialLines.push({
        category:    "material",
        label:       "Scrim tape",
        qty:         tapeRolls,
        unit:        "each",
        unit_cost_pence: UNIT_COSTS.tape_roll_pence,
        total_pence: pence,
        explanation: `${area} m² × ${TAPE_M_PER_M2} m tape/m² = ${tapeMeters} m; ÷ ${UNIT_COSTS.tape_roll_m} m per roll, rounded up → ${tapeRolls} roll${tapeRolls === 1 ? "" : "s"} @ £${(UNIT_COSTS.tape_roll_pence / 100).toFixed(2)}.`,
        evidence:    ev
      });
    }

    {
      const pence = primerLitres * UNIT_COSTS.primer_l_pence;
      materialLines.push({
        category:    "material",
        label:       "PVA primer",
        qty:         primerLitres,
        unit:        "each",
        unit_cost_pence: UNIT_COSTS.primer_l_pence,
        total_pence: pence,
        explanation: `${area} m² × ${PRIMER_L_PER_M2} L/m² = ${primerLitres} L @ £${(UNIT_COSTS.primer_l_pence / 100).toFixed(2)}.`,
        evidence:    ev
      });
    }

    {
      const pence = beadMeters * UNIT_COSTS.bead_m_pence;
      materialLines.push({
        category:    "material",
        label:       "Corner & angle beads",
        qty:         beadMeters,
        unit:        "m",
        unit_cost_pence: UNIT_COSTS.bead_m_pence,
        total_pence: pence,
        explanation: `${area} m² × ${BEAD_M_PER_M2} m bead/m² = ${beadMeters} m @ £${(UNIT_COSTS.bead_m_pence / 100).toFixed(2)}/m.`,
        evidence:    ev
      });
    }

    // Labour — two plasterers is the typical crew for skim work.
    const crew = 2;
    const totalHours = Math.ceil(area / M2_PER_PLASTERER_HOUR);
    const days = Number((totalHours / crew / 8).toFixed(1));
    const labourPence = totalHours * defaults.labour_rate_pence_per_hour;

    const labourLines: EstimateLine[] = [{
      category:    "labour",
      label:       `${crew} plasterers`,
      qty:         totalHours,
      unit:        "hour",
      unit_cost_pence: defaults.labour_rate_pence_per_hour,
      total_pence: labourPence,
      explanation: `${area} m² ÷ ${M2_PER_PLASTERER_HOUR} m²/hour = ${totalHours} hours across ${crew} plasterers (~${days} days) @ £${(defaults.labour_rate_pence_per_hour / 100).toFixed(2)}/hour.`
                  + ` Labour rate source: ${defaults.source.labour_rate === "merchant" ? "your default" : "engine default"}.`,
      evidence:    ev
    }];

    const warnings: string[] = [];
    if (finish === "skim_only" && substrate === "timber_studwork") {
      warnings.push("Timber studwork with skim-only — confirm boarding is already in place, otherwise add plasterboards.");
    }
    if (area > 200) warnings.push("Large area — consider splitting into phases or adding a third plasterer.");

    return {
      scope:         `${area} m² ${labelFor(finish)} plastering (${substrate === "timber_studwork" ? "timber studwork" : "solid substrate"})`,
      parameters:    { area_m2: area, finish, substrate, crew, board_count: boardsNeeded, bag_count: bagsNeeded, tape_rolls: tapeRolls, primer_litres: primerLitres, bead_meters: beadMeters, labour_hours: totalHours },
      materialLines,
      labourLines,
      plantLines:    [],
      deliveryLines: [],
      labour_hours:  totalHours,
      crew_size:     crew,
      duration_days: days,
      warnings
    };
  }
};

function labelFor(finish: string): string {
  return finish === "bonding_skim" ? "bonding + skim" :
         finish === "slab_skim"    ? "slab & skim"    : "skim";
}
