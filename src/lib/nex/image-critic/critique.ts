// Image Critic Brain · MVP heuristics.
//
// Real vision-model scoring is deferred. This MVP applies structural checks
// (grammar violations · reality classification · manifest presence) to compose
// a starter score with evidence. The contract stays stable when a vision model
// is added later.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { CritiqueContext, CritiqueReport, DimensionScore, CritiqueDimension, CritiqueIssue, CritiqueSuggestion } from "./types";
import { CRITIQUE_DIMENSIONS } from "./types";

const CRITIC_VERSION = "e7_critic_mvp_1.0";

function dimensionBaseline(): Record<CritiqueDimension, { score: number; evidence: string[] }> {
  return {
    realism: { score: 80, evidence: ["baseline"] },
    lighting: { score: 80, evidence: ["baseline"] },
    composition: { score: 80, evidence: ["baseline"] },
    typography: { score: 85, evidence: ["baseline"] },
    brand_consistency: { score: 80, evidence: ["baseline"] },
    construction_accuracy: { score: 80, evidence: ["baseline"] },
    anatomy: { score: 90, evidence: ["baseline · no people in most designs"] },
    perspective: { score: 80, evidence: ["baseline"] },
    marketing_quality: { score: 80, evidence: ["baseline"] },
    accessibility: { score: 75, evidence: ["baseline"] },
  };
}

export function critique(ctx: CritiqueContext): CritiqueReport {
  const dims = dimensionBaseline();
  const issues: CritiqueIssue[] = [];
  const suggestions: CritiqueSuggestion[] = [];

  // Grammar violations → typography + composition + marketing_quality
  for (const gv of ctx.grammar_violations ?? []) {
    const penalty = gv.severity === "error" ? 25 : gv.severity === "warn" ? 12 : 4;
    dims.typography.score -= penalty;
    dims.marketing_quality.score -= Math.round(penalty / 2);
    dims.typography.evidence.push(`grammar:${gv.rule}`);
    issues.push({ dimension: "typography", severity: gv.severity as "info" | "warn" | "error", message: `Grammar rule ${gv.rule}` });
  }

  // Reality report → construction_accuracy + realism
  const rr = ctx.reality_report as { classification?: string; scores?: { reality_score?: number; construction_score?: number; safety_score?: number } } | undefined;
  if (rr?.scores) {
    if (rr.scores.construction_score !== undefined) {
      dims.construction_accuracy.score = rr.scores.construction_score;
      dims.construction_accuracy.evidence.push(`reality_advisor.construction_score=${rr.scores.construction_score}`);
    }
    if (rr.scores.reality_score !== undefined) {
      dims.realism.score = Math.round((dims.realism.score + rr.scores.reality_score) / 2);
      dims.realism.evidence.push(`reality_advisor.reality_score=${rr.scores.reality_score}`);
    }
    if (rr.classification === "impossible") {
      dims.realism.score = 0;
      dims.construction_accuracy.score = 0;
      issues.push({ dimension: "realism", severity: "error", message: "Reality Advisor classifies this as impossible" });
    }
  }

  // Render manifest → brand_consistency (fonts + theme presence)
  const rm = ctx.render_manifest as { font_set?: Record<string, string>; theme_pack?: string; layout_family?: string } | undefined;
  if (rm?.font_set && rm?.theme_pack) {
    dims.brand_consistency.score = 92;
    dims.brand_consistency.evidence.push(`theme_pack=${rm.theme_pack} · fonts resolved`);
  } else {
    dims.brand_consistency.score = 60;
    issues.push({ dimension: "brand_consistency", severity: "warn", message: "No render manifest theme + fonts recorded" });
    suggestions.push({ dimension: "brand_consistency", edit_command: "Use the luxury_burgundy theme", expected_gain: 20 });
  }

  // Hero image intelligence → composition + accessibility
  const hero = ctx.hero_intelligence as { safe_areas?: readonly unknown[]; focal_point?: unknown } | undefined;
  if (hero?.safe_areas && hero.safe_areas.length > 0) {
    dims.composition.score = 90;
    dims.composition.evidence.push(`hero has ${hero.safe_areas.length} declared safe areas`);
    dims.accessibility.score = 88;
    dims.accessibility.evidence.push("safe areas allow legible text overlay");
  }

  // Clamp scores to 0..100
  for (const d of CRITIQUE_DIMENSIONS) {
    dims[d].score = Math.max(0, Math.min(100, dims[d].score));
  }

  const scores: DimensionScore[] = CRITIQUE_DIMENSIONS.map((d) => ({
    dimension: d,
    score: dims[d].score,
    evidence: dims[d].evidence,
  }));
  const overall = Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length);

  return {
    overall_score: overall,
    scores,
    issues,
    suggestions,
    critic_version: CRITIC_VERSION,
    generated_at: new Date().toISOString(),
  };
}
