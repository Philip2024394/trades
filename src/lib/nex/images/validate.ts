// Rule #11 validation gate — enforces ADR-0027.
//
// Runs at save time. Returns an array of validation flags describing
// any Rule violations. Empty array = clean row. Non-empty = the tagger
// UI must surface these flags visibly and the row still saves (per
// ADR-0027 "flag for human review", not "refuse to save").

import type { ImageKnowledge, ImageType } from "./knowledgeParser";
import { bandFromDNAScore } from "./knowledgeParser";
import { getCollectionDNA } from "./collectionDNA";

export type ValidationFlag = {
  code: string;
  severity: "critical" | "warning" | "info";
  rule: string; // e.g. "ADR-0027 Rule #11"
  message: string;
};

export async function validateImageKnowledge(
  k: ImageKnowledge,
  opts: {
    // ADR-0030: when the parser ran with inheritance and reached
    // >=85% overall_confidence, the row does NOT need admin. Pass
    // the overall_confidence here so the validator can skip flags
    // that inheritance already resolved.
    overall_confidence?: number;
    master_ai_prompt_auto_generated?: boolean;
    fields_inherited?: string[];
  } = {}
): Promise<ValidationFlag[]> {
  const flags: ValidationFlag[] = [];
  const overall = opts.overall_confidence ?? k.image_dna.score;
  const highConfidence = overall >= 85;

  // Rule #4 — every image must belong to: collection · purpose ·
  // DNA profile · confidence score · material journey (if applicable)
  // · relationship tree.
  if (!k.collection_id) {
    flags.push({
      code: "missing_collection",
      severity: "critical",
      rule: "ADR-0027 Rule #4",
      message:
        "Every image MUST belong to a collection. Add a Category to the description so the parser can derive one.",
    });
  }
  if (!k.ai_intent.purpose) {
    flags.push({
      code: "missing_purpose",
      severity: "critical",
      rule: "ADR-0027 Rule #4",
      message:
        "Every image MUST have a purpose (material_journey / sales_image / installation_guide / education / architectural_showcase).",
    });
  }
  if (!k.image_dna.score) {
    flags.push({
      code: "missing_dna_score",
      severity: "critical",
      rule: "ADR-0027 Rule #4",
      message: "IMAGE DNA score missing — parser failed to compute.",
    });
  }

  // Rule #6 (post-ADR-0030 amendment) — confidence bands.
  // Only flag if OVERALL confidence (inheritance-adjusted) is <85.
  // A row that inherited from a strong collection can pass even with
  // a base DNA score below 85 — that's the whole point of ADR-0030.
  if (!highConfidence) {
    flags.push({
      code: "low_overall_confidence",
      severity: "warning",
      rule: "ADR-0027 Rule #6 (via ADR-0030)",
      message: `Overall confidence ${overall}% — below the 85% "Good" threshold even after collection intelligence + inheritance. Review the parser-extracted fields before shipping.`,
    });
  }

  // Rule #10 (post-ADR-0030 amendment) — master_ai_prompt must exist,
  // but auto-generated prompts from ADR-0030 Level 4 count as valid
  // when overall_confidence >=85 (the auto-generation used real
  // collection intelligence + inferred DNA, not fabrication).
  if (!k.master_ai_prompt || k.master_ai_prompt.trim().length < 40) {
    flags.push({
      code: "missing_master_ai_prompt",
      severity: "critical",
      rule: "ADR-0027 Rule #10",
      message:
        'Missing or too-short MASTER AI PROMPT. Another AI cannot recreate this image in 10 years without it. Add a "MASTER AI PROMPT" section (~500 words) to the description.',
    });
  } else if (opts.master_ai_prompt_auto_generated && overall < 85) {
    // Auto-generated but low confidence → info-level flag
    flags.push({
      code: "auto_generated_prompt_low_confidence",
      severity: "info",
      rule: "ADR-0027 Rule #10 (via ADR-0030)",
      message: `MASTER AI PROMPT was auto-generated from collection intelligence at ${overall}% confidence. Consider authoring a richer prompt to lift confidence above 85%.`,
    });
  }

  // Rule #11 — image_type + can_become + collection_type compatibility
  if (!k.image_type) {
    flags.push({
      code: "missing_image_type",
      severity: "critical",
      rule: "ADR-0027 Rule #11",
      message: "image_type could not be inferred. Every image must know what it IS.",
    });
  }
  if (!k.can_become || k.can_become.length === 0) {
    // Only critical if the image_type is a "source" type (hero_image,
    // transparent_asset, material_journey_stage, product_shot, diagram).
    // Terminal types (banners) legitimately have empty can_become.
    const sourceTypes: ImageType[] = [
      "hero_image",
      "transparent_asset",
      "material_journey_stage",
      "product_shot",
      "diagram",
      "logo",
    ];
    if (sourceTypes.includes(k.image_type)) {
      flags.push({
        code: "missing_can_become",
        severity: "critical",
        rule: "ADR-0027 Rule #11",
        message: `image_type ${k.image_type} is a source asset but can_become is empty. Every source must know what it can be transformed into.`,
      });
    }
  }

  // Rule #11 — image_type must be allowed by the collection's DNA
  if (k.collection_id && k.image_type) {
    const collectionDNA = await getCollectionDNA(k.collection_id);
    if (collectionDNA) {
      if (!collectionDNA.allowed_types.includes(k.image_type)) {
        flags.push({
          code: "image_type_not_allowed_by_collection",
          severity: "warning",
          rule: "ADR-0027 Rule #11",
          message: `Collection "${collectionDNA.display_name}" does not allow image_type "${k.image_type}". Allowed: ${collectionDNA.allowed_types.join(", ")}. Either change the image_type or extend the collection's allowed_types.`,
        });
      }
    } else {
      flags.push({
        code: "collection_dna_not_registered",
        severity: "info",
        rule: "ADR-0027 Rule #11",
        message: `Collection "${k.collection_id}" has no Collection DNA registered at data/nex-collection-dna.json — image will save but downstream generation surfaces cannot infer transformation rules until you register it.`,
      });
    }
  }

  return flags;
}
