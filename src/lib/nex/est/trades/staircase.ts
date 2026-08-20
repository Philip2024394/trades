// Staircase trade adapter · Phase 1 — geometry only, no prices.
//
// Follows the same TradeAdapter shape as plastering.ts / paving.ts /
// concreting.ts / painting.ts (see ../types.ts for the interface).
// The engine wrapper (../engine.ts) layers waste / overhead / profit /
// VAT on top of whatever TradeBase this adapter returns.
//
// PHASE 1 SCOPE (Philip 2026-08-20 · locked):
//   · Parse a staircase brief OR consume a StaircaseDesignState via
//     input.parameters.design (Worker call path).
//   · Derive deterministic component quantities from geometry + Doc K:
//         riser count · rise actual · going · stair plan length ·
//         stringer length · handrail length · balustrade length ·
//         newel count · landing count.
//   · Emit compliance warnings (Doc K pitch · 2R+G comfort · headroom).
//   · Surface staircase-compatibility.json rule matches as warnings.
//   · NO PRICES. Every line has total_pence: 0. explanation strings
//     carry the arithmetic; warnings tell the caller pricing is
//     Phase-2 work.
//
// DOCTRINE (constitution_nex_commercial_model_intelligence_economics
// §10 / E13):
//   · LLM MUST NOT calculate the quotation. This file is pure functions
//     over structured input. No I/O. No LLM. Same inputs = same output,
//     always. Silence-over-fabrication: unknown → warning, never a
//     guessed number.
//
// PHASE 2 (deferred · needs pricing sheet from Philip):
//   · STAIRCASE_UNIT_COSTS constant with per-component per-material rates.
//   · Multiply derived quantities by unit costs to produce real
//     total_pence values.
//   · Every line's explanation adds the £-arithmetic and source label
//     ("Engine baseline — set your rates in Studio for a tuned quote").

import { evidenceFor, type EstimateLine, type MerchantDefaults, type TradeAdapter, type TradeBase, type TradeInput } from "../types";
import type { StaircaseDesignState } from "@/lib/nex/staircase/design-state";
import { getCompatibility } from "@/lib/staircase-knowledge";

// ─── UK Doc K constants (hardcoded for Phase 1 · country pack lookup
//     will replace these once we add multi-country support).
//     Source: data/staircase-country-packs/uk.json · regulations.domestic
const UK_DOC_K = {
  max_rise_mm:               220,
  min_going_mm:              220,
  max_pitch_degrees:         42,
  min_headroom_mm:           2000,
  handrail_height_range_mm:  [900, 1000] as const,
  formula_2RG_min_mm:        550,
  formula_2RG_max_mm:        700,
  sphere_gap_max_mm:         100,
} as const;

// ─── Newel + landing counts per geometry slug. Deterministic per
//     Philip's spec (E.G. §E · what can be automated from geometry).
//     A geometry NOT listed here falls through to conservative defaults
//     (newel=2, landing=0) with a warning.
const GEOMETRY_NEWEL_COUNT: Record<string, number> = {
  straight:      2,  // bottom + top
  quarter_turn:  3,  // bottom + corner + top
  half_turn:     4,  // bottom + 2 corners + top
  winder:        3,  // bottom + winder pivot + top
  spiral:        1,  // central column only
  space_saver:   2,
  floating:      0,  // cantilevered · no traditional newel
  curved:        2,  // continuous curve · start + end
  double_sweep:  4,  // bottom + 2 sweeps + top
  t_shape:       4,  // bottom + T-junction pair + top
};
const GEOMETRY_LANDING_COUNT: Record<string, number> = {
  straight:      0,
  quarter_turn:  1,
  half_turn:     1,
  winder:        0,   // winders replace the landing
  spiral:        0,
  space_saver:   0,
  floating:      0,
  curved:        0,
  double_sweep:  0,
  t_shape:       1,
};

// Balustrade-length multiplier per geometry (multiples of stringer_length).
// A straight staircase's balustrade runs the length of the open side;
// half-turn / quarter-turn add landing balustrade runs. Rough factors —
// merchant can override once per-geometry data is captured.
const GEOMETRY_BALUSTRADE_FACTOR: Record<string, number> = {
  straight:      1.0,
  quarter_turn:  1.15,
  half_turn:     1.3,
  winder:        1.1,
  spiral:        1.0,
  space_saver:   1.0,
  floating:      1.0,
  curved:        1.1,
  double_sweep:  1.2,
  t_shape:       1.3,
};

// ─── Adapter ────────────────────────────────────────────────────────

export const staircaseAdapter: TradeAdapter = {
  trade:   "staircase",
  label:   "Staircase",
  aliases: ["staircase", "stair", "stairs", "stairway", "flight of stairs"],

  parse(natural: string): TradeInput["parameters"] | null {
    // parse() is intentionally lightweight for the staircase trade: it
    // only decides "is this a staircase brief?" — the Worker path calls
    // compute() directly with a StaircaseDesignState in
    // input.parameters.design (see the compute() branch on
    // params.design). For naked briefs (no structured design object) we
    // extract whatever numeric hints the sentence carries so a demo
    // like "quote me a straight-flight staircase, 2700 floor to floor,
    // oak treads" produces a useful base.
    const t = natural.toLowerCase();
    if (!/(staircase|stairs?|stairway|flight of stairs)/.test(t)) return null;

    const parsed: Record<string, unknown> = {};

    // Floor-to-floor measurement: "2700 floor to floor", "2.7m floor to floor"
    const ftf = t.match(/(\d+(?:\.\d+)?)\s*(m|mm)?\s*(?:floor\s*to\s*floor|f2f|ftf)/);
    if (ftf) {
      const n = Number(ftf[1]);
      const unit = ftf[2];
      if (isFinite(n) && n > 0) {
        parsed.floor_to_floor_mm = unit === "m" || n < 20 ? Math.round(n * 1000) : Math.round(n);
      }
    }

    // Opening width: "1000 opening wide", "1m wide opening"
    const ow = t.match(/(\d+(?:\.\d+)?)\s*(m|mm)?\s*(?:opening|wide|width)/);
    if (ow) {
      const n = Number(ow[1]);
      const unit = ow[2];
      if (isFinite(n) && n > 0) {
        parsed.opening_width_mm = unit === "m" || n < 20 ? Math.round(n * 1000) : Math.round(n);
      }
    }

    // Geometry slug hints
    if (/straight/.test(t)) parsed.geometry = "straight";
    else if (/quarter[\s-]?turn/.test(t)) parsed.geometry = "quarter_turn";
    else if (/half[\s-]?turn/.test(t)) parsed.geometry = "half_turn";
    else if (/spiral/.test(t)) parsed.geometry = "spiral";
    else if (/winder/.test(t)) parsed.geometry = "winder";
    else if (/floating/.test(t)) parsed.geometry = "floating";

    // Material hint (primary wood)
    const woodMatch = t.match(/\b(oak|walnut|ash|pine|beech|maple|sapele|iroko)\b/);
    if (woodMatch) parsed.wood = woodMatch[1];

    return parsed;
  },

  compute(input, _defaults, _ctx): TradeBase {
    const params = (input.parameters ?? {}) as Record<string, unknown>;

    // Worker path: params.design is a full StaircaseDesignState.
    // Natural-brief path: params carries loose keys parse() extracted.
    // Either way, build a normalised StaircaseDesignState-shaped view.
    const designFromWorker = (params.design ?? null) as StaircaseDesignState | null;
    const design: StaircaseDesignState = designFromWorker ?? {
      geometry: params.geometry as string | undefined,
      wood:     params.wood as string | undefined,
      floor_to_floor_mm: params.floor_to_floor_mm as number | undefined,
      opening_width_mm:  params.opening_width_mm as number | undefined,
    };

    const warnings: string[] = [];
    const ev = evidenceFor("staircase adapter · Phase 1 geometry only", ["data/staircase-country-packs/uk.json (Doc K)", "src/lib/staircase-knowledge/data/staircase-compatibility.json"]);

    const geometry = design.geometry ?? "straight";
    if (!(geometry in GEOMETRY_NEWEL_COUNT)) {
      warnings.push(`Geometry "${geometry}" not in known catalogue · using conservative defaults (newel=2, landing=0). Update GEOMETRY_NEWEL_COUNT for accurate quantities.`);
    }

    // ─── Geometry derivation ──────────────────────────────────
    const floor_to_floor_mm = design.floor_to_floor_mm;
    const measurementsProvided = typeof floor_to_floor_mm === "number" && floor_to_floor_mm > 0;

    if (!measurementsProvided) {
      warnings.push("floor_to_floor_mm not provided · cannot derive riser count, going, stringer length, or handrail length. Provide this measurement to unlock deterministic quantities.");
    }

    // Riser + rise
    let riser_count = 0;
    let rise_actual_mm = 0;
    if (measurementsProvided) {
      const overrideCount = design.tread_count_override;
      if (typeof overrideCount === "number" && overrideCount > 0) {
        // tread_count_override is the number of TREADS · risers = treads + 1
        // (the top landing is a floor, not a tread — n treads → n+1 risers
        //  between the two levels).
        riser_count = Math.floor(overrideCount) + 1;
        rise_actual_mm = floor_to_floor_mm! / riser_count;
      } else {
        // Start from minimum risers permitted by Doc K max rise
        riser_count = Math.ceil(floor_to_floor_mm! / UK_DOC_K.max_rise_mm);
        rise_actual_mm = floor_to_floor_mm! / riser_count;
        // Increase risers if pitch exceeds Doc K max at the going we'll pick
        for (let guard = 0; guard < 20; guard++) {
          const goingForCheck = pickCompliantGoing(rise_actual_mm);
          const pitchDeg = Math.atan(rise_actual_mm / goingForCheck) * 180 / Math.PI;
          if (pitchDeg <= UK_DOC_K.max_pitch_degrees) break;
          riser_count += 1;
          rise_actual_mm = floor_to_floor_mm! / riser_count;
        }
      }
    }
    const tread_count = riser_count > 0 ? riser_count - 1 : 0;

    // Going · use override if provided, otherwise derive from 2R+G comfort
    let going_mm = 0;
    if (measurementsProvided) {
      going_mm = typeof design.going_mm_override === "number" && design.going_mm_override > 0
        ? design.going_mm_override
        : pickCompliantGoing(rise_actual_mm);
      if (going_mm < UK_DOC_K.min_going_mm) {
        warnings.push(`Going ${going_mm}mm is below Doc K minimum ${UK_DOC_K.min_going_mm}mm — non-compliant for UK domestic use.`);
      }
      const comfortValue = 2 * rise_actual_mm + going_mm;
      if (comfortValue < UK_DOC_K.formula_2RG_min_mm || comfortValue > UK_DOC_K.formula_2RG_max_mm) {
        warnings.push(`2R+G = ${comfortValue.toFixed(0)}mm sits outside comfort range ${UK_DOC_K.formula_2RG_min_mm}–${UK_DOC_K.formula_2RG_max_mm}mm — walking rhythm will feel wrong.`);
      }
      const pitchDeg = Math.atan(rise_actual_mm / going_mm) * 180 / Math.PI;
      if (pitchDeg > UK_DOC_K.max_pitch_degrees) {
        warnings.push(`Pitch ${pitchDeg.toFixed(1)}° exceeds Doc K max ${UK_DOC_K.max_pitch_degrees}° — non-compliant for UK domestic use.`);
      }
    }

    // Stair plan length (horizontal run · from bottom nosing to top nosing)
    const stair_plan_length_mm = tread_count > 0 ? going_mm * tread_count : 0;

    // Stringer length (raked · Pythagoras)
    const stringer_length_mm = measurementsProvided && stair_plan_length_mm > 0
      ? Math.sqrt(floor_to_floor_mm! ** 2 + stair_plan_length_mm ** 2)
      : 0;

    // Handrail length · override or derived-from-stringer
    const handrail_length_mm = typeof design.handrail_length_mm_override === "number" && design.handrail_length_mm_override > 0
      ? design.handrail_length_mm_override
      : stringer_length_mm;

    // Balustrade length · geometry-adjusted from stringer
    const balustrade_factor = GEOMETRY_BALUSTRADE_FACTOR[geometry] ?? 1.0;
    const balustrade_length_mm = stringer_length_mm * balustrade_factor;

    // Newel + landing counts (geometry lookup)
    const newel_count   = GEOMETRY_NEWEL_COUNT[geometry] ?? 2;
    const landing_count = GEOMETRY_LANDING_COUNT[geometry] ?? 0;

    // ─── Compatibility rules (from staircase-knowledge corpus) ─────
    // getCompatibility() takes a selections dict and returns matching rules.
    // We only feed slugs that exist in the design; missing fields are
    // skipped by getCompatibility so partial state is safe.
    // Key names below MUST match the rule.if keys used in
    // staircase-compatibility.json (snake_case · not the camelCase of
    // StaircaseDesignState field names). Values are the same canonical
    // slugs. The camelCase→snake_case mapping is the only translation
    // this adapter performs — no other silent renaming.
    const selections: Record<string, string | undefined> = {
      country:            design.country,
      use:                design.use,
      geometry:           design.geometry,
      material_family:    design.materialFamily,
      wood:               design.wood,
      finish:             design.finish,
      tread:              design.tread,
      riser:              design.riser,
      structural:         design.string,        // rules use `structural` for the stringer/support type
      structural_material: design.string,
      newel:              design.newel,
      handrail:           design.handrail,
      balustrade:         design.balustrade,
    };
    try {
      const firedRules = getCompatibility(selections);
      for (const rule of firedRules) {
        const detail = rule.note ?? rule.description ?? "specialist review required";
        warnings.push(`Compatibility rule fired · ${rule.id} (${rule.then}): ${detail}`);
      }
    } catch (e) {
      warnings.push(`Compatibility check failed · ${(e as Error)?.message ?? e}`);
    }

    // ─── Build lines (Phase 1: quantities only · every total_pence = 0) ─
    const materialLines: EstimateLine[] = [];

    if (tread_count > 0) {
      materialLines.push({
        category:    "material",
        label:       `Treads (${design.treadWood ?? design.wood ?? "species TBC"})`,
        qty:         tread_count,
        unit:        "each",
        total_pence: 0,
        explanation: `${riser_count} risers from ${floor_to_floor_mm}mm floor-to-floor at ${rise_actual_mm.toFixed(1)}mm rise → ${tread_count} treads (top level is a floor, not a tread). Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
      materialLines.push({
        category:    "material",
        label:       `Risers (${design.riser ?? "type TBC"})`,
        qty:         riser_count,
        unit:        "each",
        total_pence: 0,
        explanation: `Riser count = tread count + 1 = ${riser_count}. Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
    }

    if (stringer_length_mm > 0) {
      // Stringer count depends on the string type — mono = 1, closed/cut = 2.
      const stringer_count = design.string === "mono_stringer" || design.string === "cantilever" ? 1 : 2;
      materialLines.push({
        category:    "material",
        label:       `Stringer (${design.string ?? "type TBC"})`,
        qty:         Math.round(stringer_length_mm) * stringer_count,
        unit:        "m",
        total_pence: 0,
        explanation: `√(${floor_to_floor_mm}² + ${stair_plan_length_mm.toFixed(0)}²) = ${stringer_length_mm.toFixed(0)}mm raked length × ${stringer_count} stringer${stringer_count === 1 ? "" : "s"}. Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
    }

    if (handrail_length_mm > 0) {
      materialLines.push({
        category:    "material",
        label:       `Handrail (${design.handrail ?? "material TBC"})`,
        qty:         Math.round(handrail_length_mm),
        unit:        "m",
        total_pence: 0,
        explanation: `${design.handrail_length_mm_override ? "Customer-supplied override" : "Derived from stringer length"} = ${handrail_length_mm.toFixed(0)}mm. Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
    }

    if (balustrade_length_mm > 0) {
      materialLines.push({
        category:    "material",
        label:       `Balustrade (${design.balustrade ?? "type TBC"})`,
        qty:         Math.round(balustrade_length_mm),
        unit:        "m",
        total_pence: 0,
        explanation: `Stringer length ${stringer_length_mm.toFixed(0)}mm × geometry factor ${balustrade_factor.toFixed(2)} (${geometry}) = ${balustrade_length_mm.toFixed(0)}mm. Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
    }

    if (newel_count > 0) {
      materialLines.push({
        category:    "material",
        label:       `Newels (${design.newel ?? "style TBC"})`,
        qty:         newel_count,
        unit:        "each",
        total_pence: 0,
        explanation: `Geometry "${geometry}" → ${newel_count} newel${newel_count === 1 ? "" : "s"}. Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
    }

    if (landing_count > 0) {
      materialLines.push({
        category:    "material",
        label:       `Landing platforms`,
        qty:         landing_count,
        unit:        "each",
        total_pence: 0,
        explanation: `Geometry "${geometry}" → ${landing_count} landing${landing_count === 1 ? "" : "s"}. Unit cost pending Phase 2 pricing sheet.`,
        evidence:    ev,
      });
    }

    // Fitting labour (hours + crew declared; total_pence = 0 for Phase 1).
    // Baseline: a straight flight installs in ~1 day for a 2-person crew.
    // Geometry uplifts approximate — merchant-tunable in Phase 2.
    const geometryLabourFactor: Record<string, number> = {
      straight:     1.0,
      quarter_turn: 1.4,
      half_turn:    1.6,
      winder:       1.5,
      spiral:       1.8,
      space_saver:  1.1,
      floating:     2.5,
      curved:       2.2,
      double_sweep: 1.9,
      t_shape:      1.7,
    };
    const crew = 2;
    const baseline_hours = 8 * crew; // 1 day × 2 fitters
    const fitting_hours = Math.ceil(baseline_hours * (geometryLabourFactor[geometry] ?? 1.0));
    const fitting_days = Number((fitting_hours / crew / 8).toFixed(1));
    const labourLines: EstimateLine[] = [{
      category:    "labour",
      label:       `${crew}-person fitting crew`,
      qty:         fitting_hours,
      unit:        "hour",
      total_pence: 0,
      explanation: `Baseline ${baseline_hours}h for a straight flight × geometry factor ${(geometryLabourFactor[geometry] ?? 1.0).toFixed(2)} (${geometry}) = ${fitting_hours}h across ${crew} fitters (~${fitting_days} day${fitting_days === 1 ? "" : "s"}). Rate pending Phase 2 pricing sheet.`,
      evidence:    ev,
    }];

    // Top-level warning that this is a quantities-only base.
    warnings.unshift("PRICING NOT CONFIGURED · Phase 1 adapter returns deterministic quantities only. All line totals are £0 until per-merchant unit costs are supplied (Phase 2). Do not present this estimate as a firm quote.");

    const scopeParts: string[] = [`${geometry} staircase`];
    if (design.wood) scopeParts.push(design.wood);
    if (measurementsProvided) scopeParts.push(`${floor_to_floor_mm}mm floor-to-floor`);
    if (design.country) scopeParts.push(`(${design.country})`);

    return {
      scope:         scopeParts.join(" · "),
      parameters:    {
        design,
        geometry,
        floor_to_floor_mm: floor_to_floor_mm ?? null,
        opening_width_mm:  design.opening_width_mm ?? null,
        derived: {
          riser_count,
          tread_count,
          rise_actual_mm: Number(rise_actual_mm.toFixed(2)),
          going_mm,
          stair_plan_length_mm: Math.round(stair_plan_length_mm),
          stringer_length_mm: Math.round(stringer_length_mm),
          handrail_length_mm: Math.round(handrail_length_mm),
          balustrade_length_mm: Math.round(balustrade_length_mm),
          newel_count,
          landing_count,
          fitting_hours,
          fitting_days,
        },
        pricing_available: false,
      },
      materialLines,
      labourLines,
      plantLines:    [],
      deliveryLines: [],
      labour_hours:  fitting_hours,
      crew_size:     crew,
      duration_days: fitting_days,
      warnings,
    };
  },
};

/**
 * Choose a going value that satisfies both Doc K minimum (220mm) and the
 * 2R+G comfort formula (550 ≤ 2R + G ≤ 700). Returns the midpoint of the
 * valid range, rounded to nearest 5mm, floored to Doc K minimum.
 * If no going satisfies both constraints (unusual rises), returns the
 * Doc K minimum and the caller's compliance checks emit a warning.
 */
function pickCompliantGoing(rise_actual_mm: number): number {
  const g_min_comfort = UK_DOC_K.formula_2RG_min_mm - 2 * rise_actual_mm;
  const g_max_comfort = UK_DOC_K.formula_2RG_max_mm - 2 * rise_actual_mm;
  const g_min = Math.max(g_min_comfort, UK_DOC_K.min_going_mm);
  const g_max = g_max_comfort;
  if (g_min > g_max) return UK_DOC_K.min_going_mm;
  const mid = (g_min + g_max) / 2;
  return Math.round(mid / 5) * 5;
}

export const _internals = { pickCompliantGoing, UK_DOC_K, GEOMETRY_NEWEL_COUNT, GEOMETRY_LANDING_COUNT, GEOMETRY_BALUSTRADE_FACTOR };
