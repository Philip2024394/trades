// Brain integration adapters — wire the loaded Brain into the existing
// Phase 13 Vision engine and Phase 28 Estimator engine.
//
// The Brain never re-implements Vision or Estimator. It supplies the
// specialist prompts, defect vocabulary, and pricing rules, and the
// existing engines do the work. This keeps the Brain runtime a thin
// domain layer over engines that are already production code.

import { analyzeConstructionImage } from "@/lib/nex/cv/analyze";
import type { VisionAnalysis } from "@/lib/nex/cv/types";
import type { LoadedBrain } from "./_types";

// ─── Vision integration ─────────────────────────────────────────

export type BrainVisionInput = {
  brain:    LoadedBrain;
  imageUrl: string;
  region?:  string;
};

export type BrainVisionResult = {
  analysis:         VisionAnalysis;
  matched_defects:  Array<{
    defect_id: string;
    name:      string;
    severity:  "cosmetic" | "functional" | "safety_critical";
    reason:    string;
  }>;
  provenance: {
    brain_slug:    string;
    brain_version: string;
    module:        "defects";
  };
};

/** Analyse an image through the platform Vision engine, then match
 *  detected observations against the Brain's Defects module vision
 *  hints. No fabrication — a matched defect must appear in
 *  brain.defects.defects with vision_hints that overlap the analysis
 *  output. */
export async function analyseImageWithBrain(input: BrainVisionInput): Promise<BrainVisionResult> {
  const analysis = await analyzeConstructionImage({
    imageUrl: input.imageUrl,
    context:  { trade: input.brain.manifest.slug }
  });

  const observationTexts = collectObservationText(analysis);
  const matches: BrainVisionResult["matched_defects"] = [];

  for (const defect of input.brain.defects.defects) {
    const hitHint = defect.vision_hints.find((hint) =>
      observationTexts.some((t) => t.toLowerCase().includes(hint.toLowerCase()))
    );
    if (hitHint) {
      matches.push({
        defect_id: defect.id,
        name:      defect.name,
        severity:  defect.severity,
        reason:    `Vision observation matched hint '${hitHint}'`
      });
    }
  }

  return {
    analysis,
    matched_defects: matches,
    provenance: {
      brain_slug:    input.brain.manifest.slug,
      brain_version: input.brain.manifest.version,
      module:        "defects"
    }
  };
}

function collectObservationText(analysis: VisionAnalysis): string[] {
  const out: string[] = [];
  if (analysis.summary) out.push(analysis.summary);
  for (const item of analysis.detected ?? []) out.push(item.label);
  for (const obs of analysis.observations ?? []) {
    out.push(obs.headline);
    if (obs.detail) out.push(obs.detail);
  }
  for (const def of analysis.defects ?? []) {
    out.push(def.headline);
    if (def.detail) out.push(def.detail);
  }
  return out;
}

// ─── Estimator integration ──────────────────────────────────────

export type BrainEstimateInput = {
  brain:   LoadedBrain;
  scope: {
    rule_key:    string;                              // "labour.per_riser.oak"
    quantity:    number;
    region?:     string;
    context?:    Record<string, unknown>;
  };
};

export type BrainEstimateLine = {
  rule_key:            string;
  unit:                string;
  base_value:          number;
  regional_multiplier: number;
  quantity:            number;
  computed:            number;
  evidence:            Array<{ source: string; url?: string }>;
};

export type BrainEstimateResult =
  | { ok: true;  line: BrainEstimateLine; brain_version: string }
  | { ok: false; reason: "rule_not_found" | "region_not_supported"; detail: string };

/** Resolve one pricing rule from the Brain against a quantity + region.
 *  This intentionally returns a single line — the Phase 28 Estimator
 *  engine composes multiple lines into a full estimate. The Brain does
 *  not own waste/overhead/profit/VAT policy — that belongs to the
 *  existing engine per Phase 28. */
export function estimateWithBrain(input: BrainEstimateInput): BrainEstimateResult {
  const rule = input.brain.pricing_model.rules.find((r) => r.rule_key === input.scope.rule_key);
  if (!rule) {
    return {
      ok: false,
      reason: "rule_not_found",
      detail: `Brain '${input.brain.manifest.slug}' has no rule with rule_key='${input.scope.rule_key}'`
    };
  }

  const region = input.scope.region;
  const multiplier = region && rule.regional_multipliers[region] != null
    ? rule.regional_multipliers[region]
    : 1;

  const computed = rule.base_value * multiplier * input.scope.quantity;

  return {
    ok: true,
    brain_version: input.brain.manifest.version,
    line: {
      rule_key:            rule.rule_key,
      unit:                rule.unit,
      base_value:          rule.base_value,
      regional_multiplier: multiplier,
      quantity:            input.scope.quantity,
      computed,
      evidence:            rule.evidence.map((e) => ({ source: e.source, url: e.url }))
    }
  };
}
