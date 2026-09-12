// src/lib/nex/agents/nex-food/types.ts
//
// WAVE-S-4 · Food specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-4 · 2026-09-08
//
// Domain: food safety · dietary restrictions · allergens · hygiene ·
// temperature discipline · recipe assistance · cultural food practices.
// Failure modes: allergen unawareness · unsafe temperature guidance ·
// medical/dietary boundary (not a nutritionist) · unsupported health
// claim · raw/undercooked risk (poultry · seafood · pork · eggs).

export type FoodRequestKind =
  | "recipe_help"
  | "food_safety"
  | "dietary_restriction"
  | "allergen_check"
  | "temperature_guidance"
  | "storage_shelf_life"
  | "cultural_practice"
  | "hygiene_practice"
  | "unknown";

export type FoodSafetySignal =
  | { kind: "allergen_present"; allergen: string; description: string }         // common allergen mentioned · flag for allergy-aware review
  | { kind: "raw_undercooked_risk"; ingredient: string; description: string }   // chicken · pork · fish · eggs · shellfish
  | { kind: "medical_dietary_boundary"; description: string }                   // diagnosis / prescription / clinical nutrition
  | { kind: "unsupported_health_claim"; description: string }                   // "cures cancer" / "guaranteed weight loss"
  | { kind: "cross_contamination_risk"; description: string }                   // raw + ready-to-eat surfaces / utensils
  | { kind: "temperature_out_of_range"; description: string }                   // food-safe temp window violated
  | { kind: "cultural_religious_awareness"; practice: string; description: string } // halal · kosher · Hindu vegetarianism · Buddhist practices
  | { kind: "no_food_safety_concern" };

export type FoodRequest = {
  request_id: string;
  request_text: string;
  cuisine_context?: string;        // "indonesian" · "british" · "japanese"
  dietary_context?: string;        // "vegan" · "gluten_free" · "halal"
  jurisdiction?: string;           // "UK" · "US" · "ID"
};

export type FoodResponse = {
  request_id: string;
  detected_kind: FoodRequestKind;
  safety_signals: readonly FoodSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;
};

export type FoodRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "no_medical_diagnosis_or_prescription"; ok: boolean; detail?: string }
  | { check: "no_unsupported_health_claim"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type FoodCorpusCase = {
  case_id: string;
  request: FoodRequest;
  expected: {
    detected_kind: FoodRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly FoodSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type FoodCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly FoodCorpusCase[];
  content_hash: string;
};

export type FoodEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly FoodRubricCheck[];
  actual: FoodResponse;
};
