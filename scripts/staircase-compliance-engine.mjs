#!/usr/bin/env node
// STAIRCASE COMPLIANCE ENGINE — 20-check deterministic validator for
// UK Approved Document K. Per Philip's spec (2026-07-25):
//
//   - NEVER AI reasoning for compliance decisions
//   - Fixed mathematical formulas + rule validation
//   - Returns PASS / WARNING / FAIL per check
//   - Each rule = own validation function
//   - Configurable constants (not hard-coded)
//   - Extensible: adding a new rule doesn't change existing logic
//   - Returns numerical values AND human-readable explanations
//
// Architecture:
//   RULES (constants)  ← configurable, sourced from data/staircase-plan-sizes.json
//   check_*() functions  ← one per Doc K clause / rule
//   fullCompliance()  ← orchestrator, returns { checks[], overall }
//
// The calculator (staircase-calculator.mjs) computes DIMENSIONS.
// This engine VALIDATES those dimensions against Doc K.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "staircase-plan-sizes.json"), "utf8"));

// ═══════════════════════════════════════════════════════════════
// RULES — configurable constants, sourced from canonical data
// Add or change a rule here; no check function changes needed.
// ═══════════════════════════════════════════════════════════════

function v(field) { return field == null ? null : (typeof field === "object" && "value" in field ? field.value : field); }
const P = DATA.doc_k_key_numbers_private_stair;
const U = DATA.doc_k_key_numbers_utility_stair;
const C = DATA.doc_k_key_numbers_common_stair;

export const RULES = {
  private: {
    rise_min_mm:                    { value: v(P.rise_min_mm),                    clause: "1.3 + Table 1.1", severity: "FAIL"    },
    rise_max_mm:                    { value: v(P.rise_max_mm),                    clause: "1.3 + Table 1.1", severity: "FAIL"    },
    rise_recommended_max_mm:        { value: 190,                                 clause: "trade guidance",  severity: "WARNING" },
    going_min_mm:                   { value: v(P.going_min_mm),                   clause: "1.3 + Table 1.1", severity: "FAIL"    },
    going_recommended_min_mm:       { value: 240,                                 clause: "trade guidance",  severity: "WARNING" },
    going_recommended_max_mm:       { value: 300,                                 clause: "trade guidance",  severity: "WARNING" },
    pitch_max_deg:                  { value: v(P.pitch_max_deg),                  clause: "1.3 + Table 1.1", severity: "FAIL"    },
    two_r_plus_g_min_mm:            { value: v(P.two_r_plus_g_min_mm),            clause: "1.4",             severity: "WARNING" },
    two_r_plus_g_max_mm:            { value: v(P.two_r_plus_g_max_mm),            clause: "1.4",             severity: "WARNING" },
    headroom_min_mm:                { value: v(P.headroom_min_mm),                clause: "1.6",             severity: "FAIL"    },
    headroom_loft_min_mm:           { value: 1900,                                clause: "1.7",             severity: "FAIL"    },
    handrail_height_min_mm:         { value: v(P.handrail_height_min_mm),         clause: "TBC",             severity: "FAIL"    },
    handrail_height_max_mm:         { value: v(P.handrail_height_max_mm),         clause: "TBC",             severity: "FAIL"    },
    handrail_both_sides_threshold_mm:{value: v(P.handrail_both_sides_threshold_mm),clause: "1.36",           severity: "FAIL"    },
    balustrade_height_stair_mm:     { value: v(P.balustrade_height_stair_mm),     clause: "TBC",             severity: "FAIL"    },
    balustrade_height_landing_mm:   { value: v(P.balustrade_height_landing_mm),   clause: "TBC",             severity: "FAIL"    },
    balustrade_landing_drop_threshold_mm: { value: v(P.balustrade_landing_drop_threshold_mm), clause: "TBC", severity: "FAIL"    },
    max_gap_sphere_mm:              { value: v(P.balustrade_max_gap_mm),          clause: "1.39",            severity: "FAIL"    },
    landing_min_dimension_rule:     { value: "≥ flight width both directions",    clause: "TBC",             severity: "FAIL"    },
    width_practical_min_mm:         { value: v(P.width_practical_min_mm),         clause: "trade guidance",  severity: "WARNING" },
    winder_walking_line_offset_mm:  { value: 270,                                 clause: "1.9-1.12",        severity: "FAIL"    },
    winder_walking_line_going_min_mm:{value: 220,                                 clause: "1.9-1.12",        severity: "FAIL"    },
    uniformity_tolerance_mm:        { value: 5,                                   clause: "1.1",             severity: "FAIL"    },
    glass_acceptable_types:         { value: ["toughened", "laminated", "toughened_laminated"], clause: "safety", severity: "FAIL" }
  },
  utility: {
    rise_max_mm:  { value: v(U.rise_max_mm),  clause: "Table 1.1", severity: "FAIL" },
    going_min_mm: { value: v(U.going_min_mm), clause: "Table 1.1", severity: "FAIL" },
    pitch_max_deg:{ value: v(U.pitch_max_deg),clause: "Table 1.1", severity: "FAIL" }
  },
  common: {
    rise_max_mm:  { value: v(C.rise_max_mm),  clause: "Table 1.1", severity: "FAIL" },
    going_min_mm: { value: v(C.going_min_mm), clause: "Table 1.1", severity: "FAIL" },
    pitch_max_deg:{ value: v(C.pitch_max_deg),clause: "Table 1.1", severity: "FAIL" }
  }
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function verdict(actual, ruleObj, condition, explanation) {
  return {
    status: condition ? "PASS" : ruleObj.severity,
    actual,
    limit:  ruleObj.value,
    clause: `Doc K clause ${ruleObj.clause}`,
    explanation
  };
}

function pitchDeg(rise, going) {
  return Math.round(Math.atan(rise / going) * (180 / Math.PI) * 10) / 10;
}

// ═══════════════════════════════════════════════════════════════
// THE 20 CHECKS — each returns { name, status, actual, limit, clause, explanation }
// ═══════════════════════════════════════════════════════════════

// 1. Rise Height
export function checkRise(rise, stairType = "private") {
  const rules = RULES[stairType];
  const min = rules.rise_min_mm ?? RULES.private.rise_min_mm;
  const max = rules.rise_max_mm ?? RULES.private.rise_max_mm;
  const rec = RULES.private.rise_recommended_max_mm;
  let status = "PASS", explanation = `Rise ${rise}mm sits comfortably within Doc K limits (${min.value}-${max.value}mm).`;
  if (rise > max.value) { status = "FAIL"; explanation = `Rise ${rise}mm EXCEEDS Doc K max ${max.value}mm — flight will fail Building Control inspection.`; }
  else if (rise < min.value) { status = "FAIL"; explanation = `Rise ${rise}mm is BELOW Doc K min ${min.value}mm — extremely shallow steps.`; }
  else if (rise > rec.value) { status = "WARNING"; explanation = `Rise ${rise}mm is within Doc K limits but above recommended max ${rec.value}mm — flight will feel steep. Comfortable range: 170-190mm.`; }
  return { name: "Rise Height", status, actual: rise, limit: `${min.value}-${max.value}mm (recommended ≤${rec.value}mm)`, clause: `Doc K clause ${min.clause}`, explanation };
}

// 2. Going Depth
export function checkGoing(going, stairType = "private") {
  const rules = RULES[stairType];
  const min = rules.going_min_mm ?? RULES.private.going_min_mm;
  const recMin = RULES.private.going_recommended_min_mm;
  const recMax = RULES.private.going_recommended_max_mm;
  let status = "PASS", explanation = `Going ${going}mm within recommended range (${recMin.value}-${recMax.value}mm).`;
  if (going < min.value) { status = "FAIL"; explanation = `Going ${going}mm BELOW Doc K min ${min.value}mm — fails Building Control.`; }
  else if (going < recMin.value) { status = "WARNING"; explanation = `Going ${going}mm meets Doc K min but is below comfort range ${recMin.value}mm — foot lands close to the nosing.`; }
  else if (going > recMax.value) { status = "WARNING"; explanation = `Going ${going}mm above comfort range ${recMax.value}mm — flight may feel like walking a stepped platform.`; }
  return { name: "Going Depth", status, actual: going, limit: `≥${min.value}mm (recommended ${recMin.value}-${recMax.value}mm)`, clause: `Doc K clause ${min.clause}`, explanation };
}

// 3. Stair Pitch
export function checkPitch(rise, going, stairType = "private") {
  const rules = RULES[stairType];
  const max = rules.pitch_max_deg ?? RULES.private.pitch_max_deg;
  const actual = pitchDeg(rise, going);
  const pass = actual <= max.value;
  return { name: "Stair Pitch", status: pass ? "PASS" : "FAIL", actual: `${actual}°`, limit: `≤${max.value}°`, clause: `Doc K clause ${max.clause}`,
    explanation: pass ? `Pitch ${actual}° within Doc K max ${max.value}° for ${stairType} stair.` : `Pitch ${actual}° EXCEEDS Doc K max ${max.value}° — reduce rise or increase going.` };
}

// 4. Number of Risers (uniformity + total-rise consistency)
export function checkRiserCount(numRises, rise, ftfEffective) {
  const computedTotal = numRises * rise;
  const drift = Math.abs(computedTotal - ftfEffective);
  const pass = drift <= 5;
  return { name: "Number of Risers", status: pass ? "PASS" : "WARNING", actual: `${numRises} risers × ${rise}mm = ${computedTotal}mm`, limit: `= ${ftfEffective}mm (±5mm)`, clause: "Doc K clause 1.1",
    explanation: pass ? `Total rise (${computedTotal}mm) matches effective FTF (${ftfEffective}mm) within tolerance.` : `Total rise drifts ${drift}mm from effective FTF — one or more rises will need to differ. Doc K clause 1.1 requires uniform rises.` };
}

// 5. Number of Goings
export function checkGoingCount(numGoings, numRises, topStepLevelWithLanding) {
  const expected = topStepLevelWithLanding ? numRises : numRises - 1;
  const pass = numGoings === expected;
  return { name: "Number of Goings", status: pass ? "PASS" : "FAIL", actual: numGoings, limit: expected, clause: "trade rule (rises = goings + 1 unless top-level design)",
    explanation: pass ? `Going count ${numGoings} matches expected (rises ${topStepLevelWithLanding ? "=" : "= goings + 1"}).` : `Expected ${expected} goings for ${numRises} rises; got ${numGoings}.` };
}

// 6. Headroom
export function checkHeadroom(headroom, isLoft = false) {
  const rule = isLoft ? RULES.private.headroom_loft_min_mm : RULES.private.headroom_min_mm;
  if (headroom == null) return { name: "Headroom", status: "WARNING", actual: null, limit: `≥${rule.value}mm`, clause: `Doc K clause ${rule.clause}`,
    explanation: `No headroom value provided. Measure the vertical clearance from the pitch line to the ceiling above and re-run.` };
  const pass = headroom >= rule.value;
  return { name: "Headroom", status: pass ? "PASS" : "FAIL", actual: `${headroom}mm`, limit: `≥${rule.value}mm`, clause: `Doc K clause ${rule.clause}`,
    explanation: pass ? `Headroom ${headroom}mm meets Doc K min ${rule.value}mm${isLoft ? " (loft-conversion exception)" : ""}.` : `Headroom ${headroom}mm BELOW Doc K min ${rule.value}mm — flight fails Building Control.` };
}

// 7. Landing Requirements
export function checkLanding(landingWidth, landingDepth, flightWidth) {
  if (landingWidth == null || landingDepth == null) return { name: "Landing Requirements", status: "WARNING", actual: "not provided", limit: `≥${flightWidth}mm both directions`, clause: "Doc K",
    explanation: `No landing dimensions provided. Every direction-change landing must be at least the flight width in both directions.` };
  const pass = landingWidth >= flightWidth && landingDepth >= flightWidth;
  return { name: "Landing Requirements", status: pass ? "PASS" : "FAIL", actual: `${landingWidth} × ${landingDepth}mm`, limit: `≥${flightWidth} × ${flightWidth}mm`, clause: "Doc K",
    explanation: pass ? `Landing ${landingWidth}×${landingDepth}mm meets minimum (flight width ${flightWidth}mm).` : `Landing ${landingWidth}×${landingDepth}mm BELOW min — must be at least ${flightWidth}mm in both directions.` };
}

// 8. Winder Compliance
export function checkWinders(hasWinders, walkingLineGoing) {
  if (!hasWinders) return { name: "Winder Compliance", status: "PASS", actual: "no winders", limit: "n/a", clause: "Doc K clauses 1.9-1.12", explanation: "Layout has no winders — check not applicable." };
  const rule = RULES.private.winder_walking_line_going_min_mm;
  if (walkingLineGoing == null) return { name: "Winder Compliance", status: "WARNING", actual: null, limit: `≥${rule.value}mm along walking line`, clause: `Doc K clauses ${rule.clause}`,
    explanation: `Winder layout selected but walking-line going not provided. Measure going along the walking line (about 270mm out from inside handrail) and re-run.` };
  const pass = walkingLineGoing >= rule.value;
  return { name: "Winder Compliance", status: pass ? "PASS" : "FAIL", actual: `${walkingLineGoing}mm at walking line`, limit: `≥${rule.value}mm`, clause: `Doc K clauses ${rule.clause}`,
    explanation: pass ? `Walking-line going ${walkingLineGoing}mm meets Doc K min.` : `Walking-line going ${walkingLineGoing}mm BELOW Doc K min ${rule.value}mm — winder set will feel unsafe on the turn.` };
}

// 9. Open Riser Rules (100mm sphere test)
export function checkOpenRisers(openRisers, openRiserGap) {
  if (!openRisers) return { name: "Open Riser Rules", status: "PASS", actual: "closed risers", limit: "n/a", clause: "Doc K clause 1.39", explanation: "Closed risers — 100mm sphere test doesn't apply." };
  const rule = RULES.private.max_gap_sphere_mm;
  if (openRiserGap == null) return { name: "Open Riser Rules", status: "WARNING", actual: null, limit: `<${rule.value}mm gap`, clause: `Doc K clause ${rule.clause}`,
    explanation: `Open risers declared but gap between treads not provided. Doc K 100mm sphere test applies — no gap that a 100mm sphere can pass through.` };
  const pass = openRiserGap < rule.value;
  return { name: "Open Riser Rules", status: pass ? "PASS" : "FAIL", actual: `${openRiserGap}mm gap`, limit: `<${rule.value}mm`, clause: `Doc K clause ${rule.clause}`,
    explanation: pass ? `Open-riser gap ${openRiserGap}mm passes 100mm sphere test.` : `Open-riser gap ${openRiserGap}mm FAILS 100mm sphere test — a child can slip through.` };
}

// 10. Balustrade Height
export function checkBalustradeHeight(stairHeight, landingHeight, landingDrop = 0) {
  const stairRule = RULES.private.balustrade_height_stair_mm;
  const landingRule = RULES.private.balustrade_height_landing_mm;
  const dropThreshold = RULES.private.balustrade_landing_drop_threshold_mm;
  const results = [];
  if (stairHeight != null) {
    const pass = stairHeight >= stairRule.value;
    results.push(`Stair balustrade ${stairHeight}mm ${pass ? "meets" : "BELOW"} Doc K min ${stairRule.value}mm`);
  }
  if (landingHeight != null && landingDrop > dropThreshold.value) {
    const pass = landingHeight >= landingRule.value;
    results.push(`Landing balustrade ${landingHeight}mm ${pass ? "meets" : "BELOW"} Doc K min ${landingRule.value}mm (drop >${dropThreshold.value}mm)`);
  }
  const anyFail = results.some(r => r.includes("BELOW"));
  const status = anyFail ? "FAIL" : (results.length ? "PASS" : "WARNING");
  return { name: "Balustrade Height", status, actual: `stair ${stairHeight ?? "n/a"}mm, landing ${landingHeight ?? "n/a"}mm`, limit: `≥${stairRule.value}mm stair / ≥${landingRule.value}mm landing over ${dropThreshold.value}mm drop`, clause: `Doc K (clauses TBC)`,
    explanation: results.length ? results.join("; ") : "Balustrade heights not provided." };
}

// 11. Spindle Spacing (100mm sphere test on balustrade)
export function checkSpindleSpacing(spacingMm) {
  const rule = RULES.private.max_gap_sphere_mm;
  if (spacingMm == null) return { name: "Spindle Spacing", status: "WARNING", actual: null, limit: `<${rule.value}mm gap`, clause: `Doc K clause ${rule.clause}`,
    explanation: `Spindle spacing not provided. Doc K 100mm sphere test — max spacing typically 99mm centres allowing for spindle thickness.` };
  const pass = spacingMm < rule.value;
  return { name: "Spindle Spacing", status: pass ? "PASS" : "FAIL", actual: `${spacingMm}mm`, limit: `<${rule.value}mm`, clause: `Doc K clause ${rule.clause}`,
    explanation: pass ? `Spindle spacing ${spacingMm}mm passes 100mm sphere test.` : `Spindle spacing ${spacingMm}mm FAILS 100mm sphere test — safety risk to small children.` };
}

// 12. Glass Compliance
export function checkGlass(hasGlass, glassType) {
  if (!hasGlass) return { name: "Glass Compliance", status: "PASS", actual: "no glass", limit: "n/a", clause: "safety spec", explanation: "No glass balustrade — check not applicable." };
  const acceptable = RULES.private.glass_acceptable_types.value;
  if (!glassType) return { name: "Glass Compliance", status: "WARNING", actual: null, limit: `one of: ${acceptable.join(", ")}`, clause: "safety spec",
    explanation: `Glass balustrade declared but glass type not specified. Must be toughened, laminated, or toughened-laminated safety glass. Ordinary annealed glass is unsafe.` };
  const norm = String(glassType).toLowerCase().replace(/[- ]/g, "_");
  const pass = acceptable.includes(norm);
  return { name: "Glass Compliance", status: pass ? "PASS" : "FAIL", actual: glassType, limit: acceptable.join(" / "), clause: "safety spec",
    explanation: pass ? `Glass type '${glassType}' is a permitted safety-glass spec.` : `Glass type '${glassType}' is NOT permitted safety glass. Must be toughened, laminated, or toughened-laminated.` };
}

// 13. Handrail Requirements
export function checkHandrail(width, handrailHeight, handrailSides) {
  const heightMin = RULES.private.handrail_height_min_mm;
  const heightMax = RULES.private.handrail_height_max_mm;
  const bothSidesThreshold = RULES.private.handrail_both_sides_threshold_mm;
  const requiredSides = width >= bothSidesThreshold.value ? 2 : 1;
  const problems = [];
  if (handrailHeight != null) {
    if (handrailHeight < heightMin.value || handrailHeight > heightMax.value) problems.push(`Handrail height ${handrailHeight}mm outside Doc K range ${heightMin.value}-${heightMax.value}mm`);
  }
  if (handrailSides != null && handrailSides < requiredSides) problems.push(`Only ${handrailSides} handrail side(s); flight width ${width}mm requires ${requiredSides}`);
  const status = problems.length ? "FAIL" : (handrailHeight != null && handrailSides != null ? "PASS" : "WARNING");
  return { name: "Handrail Requirements", status, actual: `${handrailSides ?? "?"} side(s), ${handrailHeight ?? "?"}mm high`, limit: `${requiredSides} side(s), ${heightMin.value}-${heightMax.value}mm high`, clause: `Doc K clause ${bothSidesThreshold.clause}`,
    explanation: problems.length ? problems.join("; ") : (handrailHeight != null && handrailSides != null ? `Handrail meets Doc K spec for ${width}mm flight width.` : `Provide handrail height and side-count to fully validate.`) };
}

// 14. Stair Width Validation
export function checkWidth(width) {
  const rec = RULES.private.width_practical_min_mm;
  const common = [760, 800, 900, 1000];
  let advice = "";
  if (width < 760) advice = "Very narrow — awkward to move furniture; Doc K permits since 2010 revision but not recommended.";
  else if (width < 800) advice = "Narrow — meets practical minimum but tight for daily use.";
  else if (width < 900) advice = "Standard UK terrace width — comfortable.";
  else if (width < 1000) advice = "Generous width — well suited to most modern homes.";
  else if (width >= 1000) advice = `Wide flight — Doc K clause 1.36 requires handrail on BOTH sides at ≥1000mm width.`;
  return { name: "Stair Width Validation", status: "PASS", actual: `${width}mm`, limit: `no legal min since 2010; practical ≥800mm`, clause: `Doc K (2010 revision removed min width)`, explanation: advice };
}

// 15. Nosing Projection
export function checkNosing(nosingMm) {
  if (nosingMm == null) return { name: "Nosing Projection", status: "WARNING", actual: null, limit: "typically 15-25mm, uniform", clause: "trade guidance",
    explanation: "Nosing overhang not specified. Typical bullnose 22-25mm. Doc K rule: uniform across all treads." };
  if (nosingMm < 10 || nosingMm > 30) return { name: "Nosing Projection", status: "WARNING", actual: `${nosingMm}mm`, limit: "typically 15-25mm",
    clause: "trade guidance", explanation: `Nosing ${nosingMm}mm is outside typical 15-25mm range — check with maker.` };
  return { name: "Nosing Projection", status: "PASS", actual: `${nosingMm}mm`, limit: "15-25mm typical", clause: "trade guidance",
    explanation: `Nosing ${nosingMm}mm within typical range. Remember: nosing overhang is NOT part of the Doc K going measurement.` };
}

// 16. Uniformity Check
export function checkUniformity(rises, goings) {
  const tol = RULES.private.uniformity_tolerance_mm;
  const problems = [];
  if (Array.isArray(rises) && rises.length > 1) {
    const range = Math.max(...rises) - Math.min(...rises);
    if (range > tol.value) problems.push(`Rises vary by ${range}mm — Doc K clause 1.1 requires uniform rises (tolerance ${tol.value}mm)`);
  }
  if (Array.isArray(goings) && goings.length > 1) {
    const range = Math.max(...goings) - Math.min(...goings);
    if (range > tol.value) problems.push(`Goings vary by ${range}mm — Doc K clause 1.1 requires uniform goings`);
  }
  const status = problems.length ? "FAIL" : "PASS";
  return { name: "Uniformity Check", status, actual: `rises: ${rises?.length ?? "?"} steps, goings: ${goings?.length ?? "?"} steps`, limit: `all identical within ${tol.value}mm`, clause: `Doc K clause ${tol.clause}`,
    explanation: problems.length ? problems.join("; ") : "All rises and all goings within uniformity tolerance." };
}

// 17. Floor Finish Adjustment (already computed by calculator — check here it was accounted for)
export function checkFloorFinishAdjustment(downFinishMm, upFinishMm, wasAdjusted) {
  if (downFinishMm == null && upFinishMm == null) return { name: "Floor Finish Adjustment", status: "WARNING", actual: "not specified", limit: "must account for finished floors",
    clause: "trade rule", explanation: "Downstairs and upstairs floor finish thicknesses not specified. Effective rise depends on both — provide values or the top/bottom step will be wrong." };
  const status = wasAdjusted ? "PASS" : "WARNING";
  return { name: "Floor Finish Adjustment", status, actual: `down ${downFinishMm ?? 0}mm, up ${upFinishMm ?? 0}mm`, limit: "must be applied to structural FTF",
    clause: "trade rule", explanation: wasAdjusted ? `Floor finishes accounted for in effective rise calculation (down ${downFinishMm}mm + up ${upFinishMm}mm).` : `Floor finishes provided but not confirmed applied — verify calculator adjusted the effective rise.` };
}

// 18. Structural Validation (advisory only)
export function checkStructural(stringLength, layout) {
  if (stringLength == null) return { name: "Structural Validation", status: "WARNING", actual: null, limit: "advisory only", clause: "engineer",
    explanation: "String length not computed. For anything above a simple straight flight, structural sign-off from a qualified engineer is recommended, especially for cantilever, floating and helical designs." };
  const advisory = layout === "floating_cantilever" || layout === "helical_curved"
    ? "This layout requires structural engineer sign-off — the maths of the tread-to-support fixings is not a DIY calculation."
    : "Standard timber staircase — structural design falls within experienced staircase-maker's remit.";
  return { name: "Structural Validation", status: "PASS", actual: `string ~${stringLength}mm long, layout: ${layout}`, limit: "advisory only", clause: "engineer",
    explanation: advisory };
}

// 19. User Safety Warnings (roll-up of concern conditions)
export function checkSafetyWarnings({ rise, going, pitch, headroom, openRisers, hasChildren, hasElderlyOrDisabled }) {
  const warnings = [];
  if (rise > 200) warnings.push(`High rise (${rise}mm) — steeper than most people find comfortable; consider more rises.`);
  if (going < 240) warnings.push(`Small going (${going}mm) — foot lands close to nosing.`);
  if (pitch > 40) warnings.push(`Steep pitch (${pitch}°) — approaching Doc K limit, may feel unsafe for elderly users.`);
  if (headroom != null && headroom < 2100) warnings.push(`Low headroom (${headroom}mm) — meets Doc K min but tight; tall users may duck.`);
  if (openRisers && hasChildren) warnings.push(`Open risers + young children — 100mm sphere test compliance is essential; also worth teaching kids not to climb the flight.`);
  if (hasElderlyOrDisabled && rise > 180) warnings.push(`Rise ${rise}mm may be difficult for elderly or mobility-limited users — consider a shallower rise.`);
  const status = warnings.length === 0 ? "PASS" : "WARNING";
  return { name: "User Safety Warnings", status, actual: `${warnings.length} advisory item(s)`, limit: "advisory only", clause: "user experience",
    explanation: warnings.length ? warnings.join(" ") : "No user-safety concerns flagged based on provided inputs." };
}

// 20. Overall Compliance Result — orchestrator
export function fullCompliance(inputs) {
  const {
    stairType = "private",
    rise, going, numRises, numGoings, ftfEffective, topStepLevelWithLanding = false,
    headroom, isLoft = false,
    landingWidth, landingDepth, flightWidth,
    hasWinders = false, walkingLineGoing,
    openRisers = false, openRiserGap,
    balustradeHeightStair, balustradeHeightLanding, landingDrop = 0,
    spindleSpacingMm,
    hasGlass = false, glassType,
    handrailHeight, handrailSides,
    width, nosingMm,
    rises = null, goings = null,
    downFinishMm, upFinishMm, floorFinishAdjusted = true,
    stringLength, layout,
    hasChildren = false, hasElderlyOrDisabled = false
  } = inputs;

  const pitch = rise && going ? pitchDeg(rise, going) : null;

  const checks = [
    checkRise(rise, stairType),
    checkGoing(going, stairType),
    checkPitch(rise, going, stairType),
    checkRiserCount(numRises, rise, ftfEffective),
    checkGoingCount(numGoings, numRises, topStepLevelWithLanding),
    checkHeadroom(headroom, isLoft),
    checkLanding(landingWidth, landingDepth, flightWidth ?? width),
    checkWinders(hasWinders, walkingLineGoing),
    checkOpenRisers(openRisers, openRiserGap),
    checkBalustradeHeight(balustradeHeightStair, balustradeHeightLanding, landingDrop),
    checkSpindleSpacing(spindleSpacingMm),
    checkGlass(hasGlass, glassType),
    checkHandrail(width, handrailHeight, handrailSides),
    checkWidth(width),
    checkNosing(nosingMm),
    checkUniformity(rises, goings),
    checkFloorFinishAdjustment(downFinishMm, upFinishMm, floorFinishAdjusted),
    checkStructural(stringLength, layout),
    checkSafetyWarnings({ rise, going, pitch, headroom, openRisers, hasChildren, hasElderlyOrDisabled })
  ];

  const summary = checks.reduce((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, { PASS: 0, WARNING: 0, FAIL: 0 });
  const overall = summary.FAIL > 0 ? { status: "NOT_APPROVED", emoji: "🔴", label: "Non-Compliant" }
                : summary.WARNING > 0 ? { status: "REQUIRES_ATTENTION", emoji: "🟡", label: "Requires Attention" }
                : { status: "APPROVED", emoji: "🟢", label: "Approved" };

  return {
    engine_version: "1.0",
    doc_k_source: DATA.doc_k_source,
    inputs,
    checks,
    summary,
    overall
  };
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════
const invokedAsScript = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (invokedAsScript) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-/g, "_");
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) { args[key] = isNaN(next) ? (next === "true" ? true : next === "false" ? false : next) : Number(next); i++; }
      else args[key] = true;
    }
  }
  const result = fullCompliance(args);
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n${result.overall.emoji} OVERALL: ${result.overall.label} (${result.summary.PASS} PASS · ${result.summary.WARNING} WARNING · ${result.summary.FAIL} FAIL)`);
}
