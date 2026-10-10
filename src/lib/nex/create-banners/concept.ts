// src/lib/nex/create-banners/concept.ts
//
// NEX Create Banners · Concept validator · Founder Authorisation A · 2026-09-23

import type { BannerConcept } from "./types";

export interface ConceptValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateBannerConcept(
  concept: BannerConcept
): ConceptValidationResult {
  const errors: string[] = [];
  if (!concept.concept_id) errors.push("concept_id required");
  if (!concept.campaign_id) errors.push("campaign_id required");
  if (!concept.subject || concept.subject.trim().length === 0)
    errors.push("subject required");
  if (!concept.visual_objective || concept.visual_objective.trim().length < 4)
    errors.push("visual_objective required");
  if (!concept.copy_requirements || !concept.copy_requirements.cta)
    errors.push("copy_requirements.cta required (D9 text safety)");

  // Enforce doctrine-locked engine_agnostic_hints
  if (concept.engine_agnostic_hints.text_in_image_allowed !== false) {
    errors.push(
      "engine_agnostic_hints.text_in_image_allowed must be false · D9 text-safety doctrine"
    );
  }
  if (concept.engine_agnostic_hints.logo_in_image_allowed !== false) {
    errors.push(
      "engine_agnostic_hints.logo_in_image_allowed must be false · D6 brand-integrity doctrine"
    );
  }
  return { valid: errors.length === 0, errors };
}
