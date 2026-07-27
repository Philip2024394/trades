// 6-Metric Axes per image — Phase 5 of the Roadmap.
//
// Every image carries 6 metrics not one. Each answers a different
// question about the image's value in the knowledge system.
//
// Philosophy: single-number scoring hides the improvement opportunity.
// If Vision Confidence is 96% but Knowledge Completeness is 41%, we
// know the vision worked but the description hasn't been updated to
// capture what vision saw. That's actionable.

import type { ImageKnowledge } from "../images/knowledgeParser";
import type { VisionExtraction } from "./visionExtractor";
import { INTENT_VOCAB } from "../knowledge/userIntentTokens";

export type SixMetrics = {
  image_intelligence: number; // 0-100
  knowledge_completeness: number; // 0-100
  vision_confidence: number; // 0-100
  search_coverage: number; // 0-100
  generation_readiness: number; // 0-100
  designer_value: number; // 0-100
  // per-metric explanations for the UI
  reasons: {
    image_intelligence: string;
    knowledge_completeness: string;
    vision_confidence: string;
    search_coverage: string;
    generation_readiness: string;
    designer_value: string;
  };
};

/** Compute total known intent vocab size — the denominator for
 *  Search Coverage. Cached once because vocab is static. */
let TOTAL_INTENT_TOKENS = 0;
for (const cat of Object.keys(INTENT_VOCAB) as Array<keyof typeof INTENT_VOCAB>) {
  TOTAL_INTENT_TOKENS += INTENT_VOCAB[cat].length;
}

/** Compute the 6 metrics for an image row. Vision extraction is
 *  optional — passes back zero for Vision Confidence when not yet
 *  wired, which honestly represents the current state. */
export function computeSixMetrics(
  knowledge: ImageKnowledge,
  masterScore: number,
  vision?: VisionExtraction | null,
  intentTokenCountForRow?: number
): SixMetrics {
  // 1 · Image Intelligence — reuses the MASTER SCORE from ADR-0032
  const image_intelligence = masterScore;

  // 2 · Knowledge Completeness — how much of what's knowable has been
  // extracted. Combines authored-description completeness + vision.
  // Uses the DNA-fields-filled ratio as a proxy for authored side +
  // vision extraction depth on the vision side.
  const dnaFilled = countFilled([
    knowledge.image_dna.STYLE.primary,
    knowledge.image_dna.STYLE.secondary,
    knowledge.image_dna.STYLE.photographic,
    knowledge.image_dna.CAMERA.view,
    knowledge.image_dna.CAMERA.orientation,
    knowledge.image_dna.CAMERA.height,
    knowledge.image_dna.MATERIALS.primary,
    knowledge.image_dna.MATERIALS.secondary,
    knowledge.image_dna.LIGHTING.primary,
    knowledge.image_dna.QUALITY.realism,
    knowledge.image_dna.QUALITY.rendering,
    knowledge.image_dna.SETTING.primary,
  ]);
  const authoredCompleteness = (dnaFilled / 12) * 60; // authored side up to 60 pts
  const visionCompleteness = vision
    ? Math.min(
        40,
        (vision.materials.length +
          vision.components.length +
          vision.construction.length +
          vision.styles.length +
          vision.interior_context.length) *
          2
      )
    : 0;
  const knowledge_completeness = Math.round(authoredCompleteness + visionCompleteness);

  // 3 · Vision Confidence — vision model's own certainty. 0 when
  // vision hasn't run yet (honest, not punitive).
  const vision_confidence = vision?.vision_confidence ?? 0;

  // 4 · Search Coverage — how many distinct intent tokens this image
  // covers relative to the whole known vocab. Uses parser's inferred
  // tags + vision's search_intent_predictions.
  const tokensCovered = intentTokenCountForRow ?? knowledge.tags.length;
  const search_coverage = Math.round(
    Math.min(100, (tokensCovered / Math.max(TOTAL_INTENT_TOKENS, 1)) * 100 * 5)
    // × 5 amplifier — realistic coverage is 5-30 tokens per image; without
    // amplifier the % would always look tiny relative to the 185+ vocab.
  );

  // 5 · Generation Readiness — can another AI recreate this image
  // faithfully from just the manifest row?
  const promptOK =
    knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 200 ? 40 : 10;
  const lockedOK = (knowledge.locked_attributes?.must_keep?.length ?? 0) >= 3 ? 25 : 5;
  const canBecomeOK = Math.min(20, (knowledge.can_become?.length ?? 0) * 3);
  const dnaCoverage = Math.min(15, dnaFilled);
  const generation_readiness = Math.round(promptOK + lockedOK + canBecomeOK + dnaCoverage);

  // 6 · Designer Value — weighted composite tuned for designer utility.
  // High image_intelligence + search_coverage + generation_readiness = high value.
  const designer_value = Math.round(
    image_intelligence * 0.4 +
      search_coverage * 0.25 +
      generation_readiness * 0.25 +
      vision_confidence * 0.1
  );

  return {
    image_intelligence,
    knowledge_completeness,
    vision_confidence,
    search_coverage,
    generation_readiness,
    designer_value,
    reasons: {
      image_intelligence: `${image_intelligence}/100 · MASTER SCORE across 5 axes (ADR-0032)`,
      knowledge_completeness: `${knowledge_completeness}/100 · ${dnaFilled}/12 DNA fields filled + vision contribution`,
      vision_confidence:
        vision_confidence === 0
          ? "0/100 · Vision extractor not yet wired · see Phase 5 roadmap"
          : `${vision_confidence}/100 · Vision model self-reported certainty`,
      search_coverage: `${search_coverage}/100 · ${tokensCovered} intent tokens covered`,
      generation_readiness: `${generation_readiness}/100 · MASTER AI PROMPT + locked + can_become + DNA`,
      designer_value: `${designer_value}/100 · Weighted composite (0.4 image · 0.25 search · 0.25 generation · 0.1 vision)`,
    },
  };
}

function countFilled(values: (string | undefined)[]): number {
  return values.filter((v) => v && v.length > 0).length;
}
