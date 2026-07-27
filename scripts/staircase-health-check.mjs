#!/usr/bin/env node
// STAIRCASE HEALTH CHECK — scores a staircase design 0-100 across
// six dimensions and explains what's dragging each score down.
// Per Philip's Msg 4 (2026-07-25):
//   🟢 Compliance Score (Building Regulations)
//   🟢 Comfort Score (easy to walk)
//   🟢 Safety Score
//   🟢 Manufacturing Score
//   🟢 Installation Score
//   🟢 Cost Efficiency Score
//
// Every score is deterministic — no LLM math. Reads canonical Doc K
// constants from data/staircase-plan-sizes.json via the compliance
// engine, so numbers stay in sync.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fullCompliance } from "./staircase-compliance-engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// SCORING RULES — each dimension can lose points from a starting 100
// ═══════════════════════════════════════════════════════════════

function scoreCompliance(complianceResult) {
  let score = 100;
  const drags = [];
  for (const check of complianceResult.checks) {
    if (check.status === "FAIL") { score -= 25; drags.push(`${check.name} FAIL (-25): ${check.explanation}`); }
    else if (check.status === "WARNING") { score -= 5; drags.push(`${check.name} WARNING (-5): ${check.explanation}`); }
  }
  score = Math.max(0, score);
  return { score, drags };
}

function scoreComfort({ rise, going, pitch }) {
  let score = 100;
  const drags = [];
  // Ideal rise: 175-190mm
  if (rise > 200) { const p = Math.min(30, (rise - 200) * 2); score -= p; drags.push(`Rise ${rise}mm above comfort zone (ideal 175-190mm) — feels steep. -${p}`); }
  else if (rise < 160) { const p = Math.min(15, (160 - rise) * 1); score -= p; drags.push(`Rise ${rise}mm below comfort zone — flight feels very shallow. -${p}`); }
  // Ideal going: 250-280mm
  if (going < 240) { const p = Math.min(25, (240 - going) * 2); score -= p; drags.push(`Going ${going}mm below comfort zone (ideal 250-280mm) — foot lands close to nosing. -${p}`); }
  else if (going > 300) { const p = Math.min(10, (going - 300)); score -= p; drags.push(`Going ${going}mm above comfort zone — starts to feel like walking a stepped platform. -${p}`); }
  // Ideal pitch: 35-40°
  if (pitch > 40) { const p = Math.min(20, (pitch - 40) * 4); score -= p; drags.push(`Pitch ${pitch}° above comfort zone (ideal 35-40°) — feels steep, less safe for elderly users. -${p}`); }
  else if (pitch < 30) { const p = Math.min(10, (30 - pitch)); score -= p; drags.push(`Pitch ${pitch}° very shallow — flight uses more floor space than necessary. -${p}`); }
  // 2R+G: ideal 630mm
  const twoRG = 2 * rise + going;
  if (twoRG < 580 || twoRG > 680) { const p = Math.min(15, Math.abs(twoRG - 630) / 5); score -= p; drags.push(`2R+G = ${twoRG}mm (ideal ~630mm) — proportions feel off underfoot. -${Math.round(p)}`); }
  score = Math.max(0, Math.round(score));
  return { score, drags };
}

function scoreSafety({ pitch, headroom, openRisers, openRiserGap, spindleSpacingMm, hasChildren, hasElderlyOrDisabled, balustradeHeightStair }) {
  let score = 100;
  const drags = [];
  if (pitch > 40) { score -= 10; drags.push(`Steep pitch ${pitch}° — meets Doc K but reduces safety margin. -10`); }
  if (headroom != null && headroom < 2100) { score -= 8; drags.push(`Headroom ${headroom}mm is tight — meets Doc K min but leaves no margin. -8`); }
  if (openRisers && (openRiserGap == null || openRiserGap >= 100)) { score -= 20; drags.push(`Open risers with unsafe gap — CHILD SAFETY RISK. -20`); }
  if (spindleSpacingMm != null && spindleSpacingMm >= 100) { score -= 20; drags.push(`Spindle gap ${spindleSpacingMm}mm fails 100mm sphere test — SAFETY RISK. -20`); }
  if (hasChildren && openRisers && openRiserGap != null && openRiserGap > 90) { score -= 5; drags.push(`Children in household + open risers close to 100mm limit — extra vigilance recommended. -5`); }
  if (hasElderlyOrDisabled && pitch > 38) { score -= 8; drags.push(`Elderly/mobility users with pitch ${pitch}° — steep for daily use. -8`); }
  if (balustradeHeightStair != null && balustradeHeightStair < 900) { score -= 15; drags.push(`Stair balustrade ${balustradeHeightStair}mm below 900mm Doc K min. -15`); }
  score = Math.max(0, Math.round(score));
  return { score, drags };
}

function scoreManufacturing({ layout, hasWinders, hasGlass, openRisers, treadThicknessMm, stringLength }) {
  let score = 100;
  const drags = [];
  const complexLayouts = { spiral: 15, helical_curved: 25, split_double_return: 20, floating_cantilever: 20 };
  if (layout in complexLayouts) { const p = complexLayouts[layout]; score -= p; drags.push(`${layout.replace(/_/g, " ")} is a specialist manufacturing job — longer lead time, higher skill required. -${p}`); }
  if (hasWinders) { score -= 8; drags.push(`Winders add machining complexity — walking-line geometry must be exact. -8`); }
  if (hasGlass) { score -= 5; drags.push(`Glass panels need precise pre-manufacture measurement + toughening before install. -5`); }
  if (openRisers && (treadThicknessMm == null || treadThicknessMm < 40)) { score -= 8; drags.push(`Open riser + tread thickness ${treadThicknessMm ?? "unspecified"}mm — needs chunky treads (usually 50mm+) for structural self-support. -8`); }
  if (stringLength != null && stringLength > 4500) { score -= 5; drags.push(`Long string ${stringLength}mm — approaches typical machinery capacity, may need scarf joint. -5`); }
  score = Math.max(0, Math.round(score));
  return { score, drags };
}

function scoreInstallation({ layout, width, hasGlass, hasCustomShape, floorLevelConsistency, wallAccessConstraint }) {
  let score = 100;
  const drags = [];
  if (layout === "spiral" || layout === "helical_curved") { score -= 15; drags.push(`${layout.replace(/_/g, " ")} requires specialist fit — not a general-carpenter job. -15`); }
  if (layout === "floating_cantilever") { score -= 20; drags.push(`Floating cantilever needs structural anchor points designed and prepped BEFORE fit — coordination-heavy install. -20`); }
  if (width > 1100) { score -= 5; drags.push(`Wide flight ${width}mm — heavy components, may need lifting equipment. -5`); }
  if (hasGlass) { score -= 8; drags.push(`Glass balustrade adds a specialist trade to the install (glazier) — extra coordination. -8`); }
  if (hasCustomShape) { score -= 5; drags.push(`Custom shape requires more site adjustment time. -5`); }
  if (floorLevelConsistency === false) { score -= 10; drags.push(`Floors not level between top and bottom — significant packing/scribing work. -10`); }
  if (wallAccessConstraint === true) { score -= 8; drags.push(`Restricted wall access at install location — trickier fit-up. -8`); }
  score = Math.max(0, Math.round(score));
  return { score, drags };
}

function scoreCostEfficiency({ layout, hasGlass, hasWinders, treadThicknessMm, timberSpecies, bespokeElements }) {
  let score = 100;
  const drags = [];
  const layoutCostMultiplier = {
    straight: 0,
    quarter_turn_landing: 5, quarter_turn_winder: 3,
    half_turn_landing: 8, half_turn_winder: 5,
    split_double_return: 30,
    spiral: 15, helical_curved: 40, floating_cantilever: 30
  };
  const layoutDrag = layoutCostMultiplier[layout] ?? 5;
  if (layoutDrag > 0) { score -= layoutDrag; drags.push(`${layout.replace(/_/g, " ")} adds cost vs straight-flight baseline. -${layoutDrag}`); }
  if (hasGlass) { score -= 10; drags.push(`Glass balustrade is one of the most expensive balustrade options. -10`); }
  if (hasWinders) { score -= 3; drags.push(`Winders add small cost vs equivalent landing turn. -3`); }
  if (treadThicknessMm != null && treadThicknessMm > 50) { score -= 5; drags.push(`Chunky treads ${treadThicknessMm}mm add material cost vs standard 30-40mm. -5`); }
  const expensiveTimbers = ["walnut", "american_walnut", "mahogany", "sapele", "cherry", "iroko"];
  if (timberSpecies && expensiveTimbers.includes(String(timberSpecies).toLowerCase().replace(/[- ]/g, "_"))) {
    score -= 10; drags.push(`${timberSpecies} is a premium hardwood — adds meaningfully vs oak or pine. -10`);
  }
  if (bespokeElements && bespokeElements > 3) { score -= 5; drags.push(`Multiple bespoke elements (${bespokeElements}) each add design + machining time. -5`); }
  score = Math.max(0, Math.round(score));
  return { score, drags };
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR — one call, six scores, actionable suggestions
// ═══════════════════════════════════════════════════════════════

function generateSuggestions(scores) {
  const s = [];
  if (scores.comfort.score < 70) {
    const drag = scores.comfort.drags[0] ?? "";
    if (drag.includes("Rise") && drag.includes("above")) s.push("Reduce the rise by adding one more riser to the flight (lowers each rise by a few mm).");
    if (drag.includes("Going") && drag.includes("below")) s.push("Increase the going by 10-20mm — feet land more comfortably.");
    if (drag.includes("Pitch")) s.push("Reducing rise or increasing going will bring the pitch down into the comfort zone (35-40°).");
  }
  if (scores.safety.score < 70) {
    s.push("Safety score is materially compromised — resolve every FAIL before ordering; recheck balustrade gaps and headroom.");
  }
  if (scores.compliance.score < 100) {
    s.push("Any compliance drag needs closing before Building Control inspection — treat as blocking, not advisory.");
  }
  if (scores.cost.score < 70) {
    s.push("Simpler layout or a less-premium timber can meaningfully reduce cost without sacrificing safety.");
  }
  return s;
}

export function healthCheck(inputs) {
  // Run the full compliance engine first — its checks feed into the compliance score
  const compliance = fullCompliance(inputs);

  const scores = {
    compliance:      scoreCompliance(compliance),
    comfort:         scoreComfort({ rise: inputs.rise, going: inputs.going, pitch: inputs.pitch ?? (inputs.rise && inputs.going ? Math.round(Math.atan(inputs.rise / inputs.going) * 180 / Math.PI * 10) / 10 : null) }),
    safety:          scoreSafety(inputs),
    manufacturing:   scoreManufacturing(inputs),
    installation:    scoreInstallation(inputs),
    cost:            scoreCostEfficiency(inputs)
  };

  // Emoji for each score band
  const emoji = (s) => s >= 85 ? "🟢" : s >= 60 ? "🟡" : "🔴";

  const bands = {
    compliance:    { score: scores.compliance.score,     emoji: emoji(scores.compliance.score),    drags: scores.compliance.drags },
    comfort:       { score: scores.comfort.score,        emoji: emoji(scores.comfort.score),       drags: scores.comfort.drags },
    safety:        { score: scores.safety.score,         emoji: emoji(scores.safety.score),        drags: scores.safety.drags },
    manufacturing: { score: scores.manufacturing.score,  emoji: emoji(scores.manufacturing.score), drags: scores.manufacturing.drags },
    installation:  { score: scores.installation.score,   emoji: emoji(scores.installation.score),  drags: scores.installation.drags },
    cost:          { score: scores.cost.score,           emoji: emoji(scores.cost.score),          drags: scores.cost.drags }
  };

  const overallScore = Math.round((bands.compliance.score * 0.30 + bands.comfort.score * 0.20 + bands.safety.score * 0.25 +
                                     bands.manufacturing.score * 0.10 + bands.installation.score * 0.075 + bands.cost.score * 0.075));
  const overallBand = overallScore >= 85 ? { emoji: "🟢", label: "Excellent" }
                    : overallScore >= 70 ? { emoji: "🟢", label: "Good" }
                    : overallScore >= 55 ? { emoji: "🟡", label: "Needs attention" }
                    : { emoji: "🔴", label: "Poor — redesign" };

  return {
    engine_version: "1.0",
    doc_k_source: compliance.doc_k_source,
    inputs,
    scores: bands,
    overall: { score: overallScore, ...overallBand },
    suggestions: generateSuggestions(bands),
    compliance_detail: compliance
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
  const result = healthCheck(args);
  console.log(`\n═══ STAIRCASE HEALTH CHECK ═══`);
  console.log(`\n${result.overall.emoji} OVERALL: ${result.overall.score}/100 · ${result.overall.label}\n`);
  for (const [name, band] of Object.entries(result.scores)) {
    console.log(`${band.emoji} ${name.padEnd(15)} ${String(band.score).padStart(3)}/100`);
    for (const drag of band.drags.slice(0, 3)) console.log(`     · ${drag}`);
  }
  if (result.suggestions.length) {
    console.log(`\nSuggestions:`);
    for (const s of result.suggestions) console.log(`  → ${s}`);
  }
  console.log();
}
