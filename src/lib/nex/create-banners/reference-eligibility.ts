// src/lib/nex/create-banners/reference-eligibility.ts
//
// NEX Create Banners · Reference eligibility gate · Founder Authorisation A · 2026-09-23
// ======================================================================================
// Enforces the NEX-wide no-third-party-AI doctrine at the reference-asset
// boundary. Absorbs the classification produced by the strict-provenance
// resolution wave (see docs/nex-third-party-ai-doctrine-inheritance-banner-
// evaluation-2026-09-23.md). No new rule is invented here — this file only
// inherits and enforces.

import type {
  ReferenceAssetHandle,
  ReferenceProvenance,
} from "./types";

/**
 * Third-party AI markers scanned across URL / prompt / description text.
 * MUST match the reconciliation doc's list. If the doctrine updates its
 * scanned marker set, this list must be updated in lockstep.
 */
export const THIRD_PARTY_AI_MARKERS: readonly string[] = [
  "chatgpt",
  "openai",
  "dall-e",
  "dalle",
  "midjourney",
  "mid-journey",
  "stable diffusion",
  "stable-diffusion",
  "sdxl",
  "adobe firefly",
  "firefly",
  "imagen",
  "gemini image",
  "flux image",
  "leonardo.ai",
  "leonardo ai",
  "runway",
  "ideogram",
  "recraft",
  "canva ai",
  "microsoft designer",
  "bing image",
] as const;

/**
 * Positive human-origin markers scanned across description / notes.
 * Presence of any marker upgrades an UNKNOWN row to KNOWN_HUMAN_LEGITIMATE_SOURCE.
 */
export const HUMAN_PHOTO_MARKERS: readonly string[] = [
  "photograph",
  "photo of",
  "photo taken",
  "captured with",
  "shot on",
  "camera",
  "iphone photo",
  "android photo",
  "canon",
  "nikon",
  "sony camera",
  "dslr",
  "mobile photo",
  "site photo",
  "installation photo",
  "real installation",
  "real merchant",
  "verified photo",
  "customer submitted photo",
  "on-site photograph",
] as const;

export interface ReferenceEligibilityDecision {
  readonly reference_id: string;
  readonly outcome: "ELIGIBLE" | "INELIGIBLE" | "NOT_AUTHORISABLE";
  readonly reason: string;
}

/**
 * Applies the doctrine to a single ReferenceAssetHandle. Returns a
 * decision string that the orchestrator MUST NOT bypass.
 */
export function classifyReferenceHandle(
  handle: ReferenceAssetHandle
): ReferenceEligibilityDecision {
  const c = handle.provenance.classification;
  if (c === "THIRD_PARTY_AI_GENERATED") {
    return {
      reference_id: handle.reference_id,
      outcome: "INELIGIBLE",
      reason:
        "Reference provenance is THIRD_PARTY_AI_GENERATED · violates NEX no-third-party-AI-content doctrine",
    };
  }
  if (c === "UNKNOWN") {
    return {
      reference_id: handle.reference_id,
      outcome: "NOT_AUTHORISABLE",
      reason:
        "Reference provenance is UNKNOWN · absence of AI marker is not proof of human origin · establish legitimate provenance first",
    };
  }
  if (c === "NEX_LOCAL_GENERATION_OUTPUT") {
    return {
      reference_id: handle.reference_id,
      outcome: "INELIGIBLE",
      reason:
        "Reference is NEX_LOCAL_GENERATION_OUTPUT · that is a generation RESULT, not a legitimate INPUT reference for the evaluation of the same engine",
    };
  }
  // KNOWN_HUMAN_LEGITIMATE_SOURCE
  return {
    reference_id: handle.reference_id,
    outcome: "ELIGIBLE",
    reason: `Reference provenance is KNOWN_HUMAN_LEGITIMATE_SOURCE · evidence: ${handle.provenance.evidence}`,
  };
}

/**
 * Classifies raw text (URL + prompt + description + notes concatenated
 * lower-case) using the same rules the strict-resolution wave used.
 * This is the helper NEX ingestion flows can call when constructing a
 * ReferenceProvenance record from raw metadata.
 */
export function classifyRawProvenanceText(
  concatenatedText: string
): ReferenceProvenance["classification"] {
  const text = concatenatedText.toLowerCase();
  for (const marker of THIRD_PARTY_AI_MARKERS) {
    if (text.includes(marker)) {
      return "THIRD_PARTY_AI_GENERATED";
    }
  }
  for (const marker of HUMAN_PHOTO_MARKERS) {
    if (text.includes(marker)) {
      return "KNOWN_HUMAN_LEGITIMATE_SOURCE";
    }
  }
  return "UNKNOWN";
}

/**
 * Batch guard for a campaign's permitted_source_assets. Returns the set
 * of decisions and a flag saying whether the campaign may proceed. A
 * campaign with ANY ineligible reference is refused wholesale — the
 * orchestrator MUST NOT silently drop the ineligible one and continue.
 */
export interface CampaignReferenceGuardResult {
  readonly decisions: readonly ReferenceEligibilityDecision[];
  readonly campaign_may_proceed: boolean;
  readonly refusal_reason: string | null;
}

export function guardCampaignReferences(
  references: readonly ReferenceAssetHandle[]
): CampaignReferenceGuardResult {
  const decisions = references.map(classifyReferenceHandle);
  const bad = decisions.filter((d) => d.outcome !== "ELIGIBLE");
  if (bad.length > 0) {
    return {
      decisions,
      campaign_may_proceed: false,
      refusal_reason: `Campaign contains ${bad.length} non-eligible reference(s) · doctrine bars silent removal · Founder must resolve or replace before campaign proceeds`,
    };
  }
  return {
    decisions,
    campaign_may_proceed: true,
    refusal_reason: null,
  };
}

// Doctrine locks · grep these to prove the guard has not been softened
export const _REFERENCE_ELIGIBILITY_INHERITS_NEX_DOCTRINE = true as const;
export const _REFERENCE_ELIGIBILITY_NEVER_ASKS_FOR_INTERPRETATION =
  true as const;
export const _REFERENCE_ELIGIBILITY_REFUSES_CAMPAIGN_ON_ANY_INELIGIBLE =
  true as const;
export const _REFERENCE_ELIGIBILITY_UNKNOWN_IS_NOT_ELIGIBLE = true as const;
