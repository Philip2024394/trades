#!/usr/bin/env node
// STAIRCASE CALCULATOR — takes user inputs and returns exact numbers
// for their specific project. Reads the canonical data from
// data/staircase-plan-sizes.json so numbers stay in sync with the
// reference file and the brain FAQ entries.
//
// Usage (CLI):
//   node scripts/staircase-calculator.mjs \
//     --ftf 2500 \
//     --down solid_timber \
//     --up carpet_with_underlay \
//     --layout straight \
//     --width 900 \
//     --going 250 \
//     [--stair-type private|utility|common]
//
// Or as a JS module (for a serving layer):
//   import { calculate } from "./scripts/staircase-calculator.mjs";
//   const result = calculate({ ftf: 2500, downFlooring: "solid_timber", ... });
//
// Returns a structured result object with rises, exact rise per step,
// going, flight length, total footprint, Doc K compliance flags, and
// honest warnings.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "..", "data", "staircase-plan-sizes.json");
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// ── Helper: get scalar value from clause-annotated field ──
function v(field) {
  if (field == null) return null;
  return typeof field === "object" && "value" in field ? field.value : field;
}

// ── Flooring thickness lookup ──
function flooringThickness(key, position = "typical") {
  if (!key || key === "none" || key === "existing") return 0;
  const entry = DATA.flooring_thickness_reference_mm?.[key];
  if (!entry) return null;
  if (position === "min") return entry.min;
  if (position === "max") return entry.max;
  return Math.round((entry.min + entry.max) / 2);
}

// ── Main calculation ──
export function calculate(opts) {
  const {
    ftf,                        // floor-to-floor height in mm (structural, before flooring)
    downFlooring   = "none",    // key from flooring_thickness_reference_mm
    upFlooring     = "none",
    layout         = "straight",
    width          = 900,       // flight width in mm
    going          = null,      // optional preferred going in mm
    rise           = null,      // optional preferred rise in mm
    stairType      = "private", // private | utility | common
    availableRun   = null,      // optional available floor length for the flight (mm)
    topStepLevelWithLanding = false
  } = opts;

  const result = {
    inputs: { ...opts },
    warnings: [],
    errors: [],
    doc_k_source: DATA.doc_k_source
  };

  // Validate stair type + pull the applicable limits
  const limitsKey = ({
    private: "doc_k_key_numbers_private_stair",
    utility: "doc_k_key_numbers_utility_stair",
    common:  "doc_k_key_numbers_common_stair"
  })[stairType];
  const limits = DATA[limitsKey];
  if (!limits) {
    result.errors.push(`Unknown stair type: ${stairType} (use private, utility or common)`);
    return result;
  }

  const RISE_MAX  = v(limits.rise_max_mm)  ?? (stairType === "private" ? 220 : 190);
  const RISE_MIN  = v(limits.rise_min_mm)  ?? 150;
  const GOING_MIN = v(limits.going_min_mm) ?? (stairType === "private" ? 220 : 250);
  const PITCH_MAX = v(limits.pitch_max_deg) ?? (stairType === "private" ? 42 : 38);
  const TRG_MIN   = v(DATA.doc_k_key_numbers_private_stair.two_r_plus_g_min_mm) ?? 550;
  const TRG_MAX   = v(DATA.doc_k_key_numbers_private_stair.two_r_plus_g_max_mm) ?? 700;

  // Validate FTF
  if (typeof ftf !== "number" || ftf < 1500 || ftf > 5000) {
    result.errors.push(`Floor-to-floor height must be a number between 1500 and 5000 mm (got ${ftf}). If your build is outside this range, check the measurement — most UK homes sit 2400-3300 mm.`);
    return result;
  }

  // ── Step 1: adjust FTF for flooring (finished-floor to finished-floor) ──
  const downThickness = flooringThickness(downFlooring);
  const upThickness   = flooringThickness(upFlooring);
  if (downThickness === null) result.warnings.push(`Unknown downstairs flooring key "${downFlooring}"; assumed 0mm — pass a known key from data/staircase-plan-sizes.json for accuracy.`);
  if (upThickness === null)   result.warnings.push(`Unknown upstairs flooring key "${upFlooring}"; assumed 0mm — pass a known key from data/staircase-plan-sizes.json for accuracy.`);
  const dT = downThickness ?? 0;
  const uT = upThickness ?? 0;

  // Effective (finished-floor) height = structural height - downstairs floor + upstairs floor
  // Rationale: staircase rise is from top of finished downstairs floor to top of finished upstairs floor.
  // If structural height was measured shell-to-shell, downstairs floor RAISES the bottom of the flight
  // and upstairs floor LOWERS the top (from the perspective of the flight). But actually if FTF was
  // measured joist-top to joist-top, upstairs floor sits ON the top joist, so top of finished upstairs
  // floor = top of joist + upstairs floor thickness. Bottom of finished downstairs = ground floor slab
  // + downstairs floor. Effective rise = (structural + upstairs) - downstairs.
  // Simplest & correct interpretation: user provides STRUCTURAL FTF (joist top to joist top);
  // effective rise = ftf + upFlooring - downFlooring.
  const effectiveFtf = Math.round(ftf + uT - dT);
  result.finished_floor_calculation = {
    structural_ftf_mm:              ftf,
    downstairs_flooring:            downFlooring,
    downstairs_flooring_thickness:  dT,
    upstairs_flooring:              upFlooring,
    upstairs_flooring_thickness:    uT,
    effective_rise_mm:              effectiveFtf,
    note: "Effective rise = structural FTF + upstairs flooring - downstairs flooring. Assumes structural FTF was measured joist-top to joist-top."
  };

  // ── Step 2: work out number of rises ──
  const risesFromMax = Math.ceil(effectiveFtf / RISE_MAX);
  const numRises = rise ? Math.round(effectiveFtf / rise) : risesFromMax;
  const actualRise = Math.round(effectiveFtf / numRises);

  if (actualRise > RISE_MAX) {
    result.errors.push(`Computed rise of ${actualRise}mm exceeds Doc K max of ${RISE_MAX}mm for ${stairType} stair. Add more rises or reduce floor-to-floor.`);
  }
  if (actualRise < RISE_MIN) {
    result.warnings.push(`Computed rise of ${actualRise}mm is below Doc K min of ${RISE_MIN}mm — flight would be very shallow. Consider fewer rises.`);
  }

  // ── Step 3: work out number of goings + flight length ──
  // Default rule: rises = goings + 1 (top rise onto landing).
  // Exception: if topStepLevelWithLanding, rises = goings.
  const numGoings = topStepLevelWithLanding ? numRises : numRises - 1;

  const chosenGoing = going ?? Math.max(GOING_MIN, 250); // default to 250mm if not specified
  if (chosenGoing < GOING_MIN) {
    result.errors.push(`Chosen going ${chosenGoing}mm is below Doc K min of ${GOING_MIN}mm for ${stairType} stair.`);
  }

  const flightLength = numGoings * chosenGoing;

  // ── Step 4: 2R+G check ──
  const twoRG = 2 * actualRise + chosenGoing;
  if (twoRG < TRG_MIN || twoRG > TRG_MAX) {
    result.warnings.push(`2R+G comfort formula: ${twoRG}mm falls outside the Doc K comfort band ${TRG_MIN}-${TRG_MAX}mm. Doc K clause 1.4 — adjust rise or going for better walking comfort.`);
  }

  // ── Step 5: pitch check ──
  const pitchDeg = Math.round(Math.atan(actualRise / chosenGoing) * (180 / Math.PI) * 10) / 10;
  if (pitchDeg > PITCH_MAX) {
    result.errors.push(`Computed pitch ${pitchDeg}° exceeds Doc K max of ${PITCH_MAX}° for ${stairType} stair.`);
  }

  // ── Step 6: layout-specific footprint ──
  const layoutData = DATA.layouts.find(l => l.id === layout);
  if (!layoutData) {
    result.warnings.push(`Unknown layout "${layout}"; falling back to straight-flight footprint.`);
  }

  let footprint_m2 = null;
  let footprintNote = "";
  const widthM = width / 1000;
  const flightLengthM = flightLength / 1000;

  if (layout === "straight") {
    // Straight flight: width × (flight length + top landing)
    const landing = widthM;
    footprint_m2 = Math.round(widthM * (flightLengthM + landing) * 100) / 100;
    footprintNote = `Straight flight: ${width}mm wide × (${flightLength}mm flight + ${width}mm top landing) = ${Math.round(widthM * (flightLengthM + landing) * 1000)}mm total length`;
  } else if (layout === "quarter_turn_landing" || layout === "quarter_turn_winder") {
    // L-shape — approximated
    const preset = layoutData?.presets?.find(p => p.config === "modern_typical");
    footprint_m2 = preset?.footprint_m2 ?? 3.6;
    footprintNote = `Quarter-turn (${layout.includes("winder") ? "winder" : "landing"}): approximately ${footprint_m2}m² at typical modern spec. Exact geometry depends on landing/winder position.`;
  } else if (layout === "half_turn_landing" || layout === "half_turn_winder") {
    const preset = layoutData?.presets?.find(p => p.config === "modern_typical");
    footprint_m2 = preset?.footprint_m2 ?? 3.6;
    footprintNote = `Half-turn (${layout.includes("winder") ? "winder" : "half-landing"}): approximately ${footprint_m2}m² at typical modern spec.`;
  } else if (layout === "split_double_return") {
    footprint_m2 = 12.25;
    footprintNote = `Split staircase: approximately ${footprint_m2}m² at typical modern spec — needs a wide, tall hallway.`;
  } else if (layout === "spiral") {
    footprint_m2 = 2.54;
    footprintNote = `Spiral: approximately ${footprint_m2}m² at 1800mm comfortable diameter. Doc K restrictions apply for use as sole staircase.`;
  } else if (layout === "helical_curved") {
    footprint_m2 = 9.6;
    footprintNote = `Curved (helical): approximately ${footprint_m2}m² at 3500mm generous diameter. Top-of-market bespoke joinery.`;
  } else {
    footprint_m2 = Math.round(widthM * (flightLengthM + widthM) * 100) / 100;
    footprintNote = `Default straight-flight footprint calculation (layout not in table).`;
  }

  // ── Step 7: fitting tolerance ──
  const fittingTol = layout === "straight" ? v(DATA.professional_measurement_rules?.fitting_tolerance_straight_mm) ?? 10 : v(DATA.professional_measurement_rules?.fitting_tolerance_l_shape_mm) ?? 25;

  // ── Step 8: check against available run if provided ──
  let fitsInRun = null;
  if (availableRun) {
    const requiredRun = flightLength + width /* top landing */ + fittingTol;
    fitsInRun = availableRun >= requiredRun;
    if (!fitsInRun) {
      result.errors.push(`Chosen layout needs ${requiredRun}mm total run (${flightLength}mm flight + ${width}mm landing + ${fittingTol}mm fitting tolerance) but available run is only ${availableRun}mm. Reduce going, add winders, or choose a compact layout.`);
    }
  }

  // ── Assemble output ──
  result.result = {
    number_of_rises:        numRises,
    number_of_goings:       numGoings,
    actual_rise_mm:         actualRise,
    chosen_going_mm:        chosenGoing,
    pitch_deg:              pitchDeg,
    two_r_plus_g_mm:        twoRG,
    flight_length_mm:       flightLength,
    flight_width_mm:        width,
    footprint_m2,
    footprint_note:         footprintNote,
    top_step_level_with_landing: topStepLevelWithLanding,
    fitting_tolerance_mm:   fittingTol,
    fits_in_available_run:  fitsInRun,
    doc_k_compliance: {
      rise_within_limits:         actualRise >= RISE_MIN && actualRise <= RISE_MAX,
      going_within_limits:        chosenGoing >= GOING_MIN,
      pitch_within_limits:        pitchDeg <= PITCH_MAX,
      two_r_plus_g_within_limits: twoRG >= TRG_MIN && twoRG <= TRG_MAX,
      overall:                    result.errors.length === 0
    }
  };

  return result;
}

// ── CLI ──
const invokedAsScript = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (invokedAsScript) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-/g, "_");
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) { args[key] = isNaN(next) ? next : Number(next); i++; }
      else args[key] = true;
    }
  }
  const opts = {
    ftf:          args.ftf,
    downFlooring: args.down,
    upFlooring:   args.up,
    layout:       args.layout,
    width:        args.width,
    going:        args.going,
    rise:         args.rise,
    stairType:    args.stair_type ?? "private",
    availableRun: args.run,
    topStepLevelWithLanding: Boolean(args.top_step_level)
  };
  const out = calculate(opts);
  console.log(JSON.stringify(out, null, 2));
}
