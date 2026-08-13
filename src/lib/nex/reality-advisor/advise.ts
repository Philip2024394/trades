// Reality Advisor · MVP advise() implementation.
//
// This is a lightweight rules-driven advisor · full domain-specific rulesets
// (staircase · kitchen · joinery · roofing) are phased into Reality Advisor
// domain packs. This MVP demonstrates the CONTRACT · downstream capability
// providers plug into the same shape.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import type {
  RealityQuery, RealityReport, AdvisoryConcern, RealismClassification, ValidationScore,
} from "./types";

const ADVISOR_VERSION = "e2_advisor_mvp_1.0";

/** Very small starter ruleset · illustrative not exhaustive. Domain packs will
 *  replace this with authored rules per Rule c. */
function starterConcerns(q: RealityQuery): AdvisoryConcern[] {
  const concerns: AdvisoryConcern[] = [];
  const text = q.design_summary.toLowerCase();

  if (text.includes("floating") && text.includes("no support")) {
    concerns.push({
      category: "structural",
      severity: "warn",
      message: "A truly unsupported floating staircase is not realistic. Concealed steelwork is normally required.",
      suggested_action: "Introduce a hidden central spine or wall-embedded steel plate.",
    });
  }
  if (text.includes("glass tread")) {
    concerns.push({
      category: "safety",
      severity: "info",
      message: "Glass treads require laminated structural glass. Slip resistance and edge treatment must be specified.",
    });
  }
  if (text.includes("4 metre") && text.includes("island") && text.includes("no support")) {
    concerns.push({
      category: "structural",
      severity: "warn",
      message: "A 4 metre unsupported island worktop needs concealed steel and floor loading assessment.",
    });
    concerns.push({ category: "installation", severity: "info", message: "Four installers recommended. Verify delivery access." });
  }
  if (q.location === "commercial" && text.includes("staircase") && !text.includes("width")) {
    concerns.push({
      category: "building_regulations",
      severity: "warn",
      message: "Commercial staircase widths are subject to means-of-escape rules. Confirm width against occupancy.",
    });
  }
  if (q.budget_estimate_gbp !== undefined && q.budget_estimate_gbp < 1500 && (text.includes("bespoke") || text.includes("walnut"))) {
    concerns.push({
      category: "cost",
      severity: "warn",
      message: `Bespoke or walnut work is unlikely to fit within £${q.budget_estimate_gbp} for the described scope.`,
      suggested_action: "Consider oak-veneer or standard sizes to hit the budget.",
    });
  }

  return concerns;
}

function classify(concerns: readonly AdvisoryConcern[]): RealismClassification {
  const hasStructural = concerns.some((c) => c.category === "structural" && c.severity !== "info");
  const hasRegs = concerns.some((c) => c.category === "building_regulations" && c.severity !== "info");
  const hasError = concerns.some((c) => c.severity === "error");
  if (hasError) return "impossible";
  if (hasStructural && hasRegs) return "requires_structural_changes";
  if (hasStructural) return "requires_engineering";
  if (hasRegs) return "building_regulations_required";
  if (concerns.some((c) => c.severity === "warn")) return "possible";
  return "realistic";
}

function scoresFrom(concerns: readonly AdvisoryConcern[]): ValidationScore {
  // Simple deterministic scoring · concerns subtract from 100 by severity+category.
  const penalty = (severity: "info" | "warn" | "error") => severity === "error" ? 40 : severity === "warn" ? 15 : 3;
  let structural = 100, safety = 100, budget = 100, maintenance = 100, regs = 100;
  for (const c of concerns) {
    const p = penalty(c.severity);
    if (c.category === "structural" || c.category === "installation" || c.category === "manufacturing") structural -= p;
    if (c.category === "safety" || c.category === "accessibility" || c.category === "durability") safety -= p;
    if (c.category === "cost") budget -= p;
    if (c.category === "maintenance" || c.category === "material_compatibility") maintenance -= p;
    if (c.category === "building_regulations") regs -= p;
  }
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const construction = clamp(structural);
  const safetyScore = clamp(safety);
  const budgetScore = clamp(budget);
  const maintenanceScore = clamp(maintenance);
  const regsScore = clamp(regs);
  const reality = Math.round((construction * 0.35 + safetyScore * 0.20 + budgetScore * 0.15 + maintenanceScore * 0.10 + regsScore * 0.20));
  return {
    design_score: 100,                   // starter MVP · design scoring lands with the design packs
    construction_score: construction,
    safety_score: safetyScore,
    budget_score: budgetScore,
    maintenance_score: maintenanceScore,
    building_regulation_score: regsScore,
    reality_score: reality,
  };
}

export function advise(query: RealityQuery): RealityReport {
  const concerns = starterConcerns(query);
  const classification = classify(concerns);
  const scores = scoresFrom(concerns);
  const reasoning: string[] = [
    `advisor=${ADVISOR_VERSION}`,
    `domain=${query.domain} location=${query.location ?? "unspecified"} budget=${query.budget_estimate_gbp ?? "unspecified"}`,
    `concerns=${concerns.length} classification=${classification} reality_score=${scores.reality_score}`,
  ];
  return {
    classification,
    scores,
    concerns,
    reasoning,
    advisor_version: ADVISOR_VERSION,
    generated_at: new Date().toISOString(),
  };
}
