// src/lib/nex-native/business/engine.ts
//
// NEX Business Experience · the engine.
// Rev 6 FROZEN · 2026-10-02.
//
// Phase 2 clarifications (locked 2026-10-02):
//   1 · `profile IS NULL` means NEVER ACTIVATED. Deactivation is out of
//       scope until a dedicated build ships; until then, NO CODE PATH
//       may null a non-null profile. Phase 2 server actions enforce this.
//   2 · Welcome-dismissed flag + wizard draft live in `localStorage`,
//       keyed by account id. Device-specific; promote to DB only if a
//       dedicated migration later authorises it.
//   3 · Universal-catalog READ is unauthenticated-adjacent (any signed-in
//       NEX account). Business-config WRITE requires ownership of the
//       target `nex_business.id`. See `_authorization.ts`.
//   4 · Owner-override state has THREE visible kinds in the Phase 2 UI:
//       NEX-recommendation / saved-choice / unsaved-wizard-change. The
//       engine itself only knows "override vs recommendation"; the chip
//       state machine lives on the UI side.
//
// The engine's job is to compute EFFECTIVE STATE for a business from:
//   · its profile (primary + secondary subtypes)
//   · its owner-override blobs (capability / content / terminology)
//   · its capability-data blob (per-capability configuration)
//   · its content-counts (how many items of each type the business has)
//
// It never mutates. It is a pure read-side computation layer.
//
// NAMING DISCIPLINE (Finding #4 · hidden-permission defence):
//   get Available   · universal · from the catalog
//   get Recommended · subtype-sourced suggestion
//   get Enabled     · effective state after owner overrides
//   isReady         · data-sufficiency for a specific capability
//   isFeasible      · semantic completeness of a CTA intent
//
// These names are not interchangeable. The engineering test applies to
// every PR touching this surface area:
//   "Is this recommendation, or is this permission?"
// If the answer is unclear, the code is wrong.

import type {
  BusinessEngineInput,
  BusinessProfile,
  BusinessSubtype,
  CapabilityKey,
  ContentTypeKey,
  CtaIntent,
  TerminologyConcept,
  TerminologyContext,
} from "./types";

import {
  getAvailableCapabilities,
  getEffectiveCapability,
  getEnabledCapabilities,
  getFeasibleCapabilities,
  getRecommendedCapabilities,
  isCapabilityReady,
} from "./capabilities";

import {
  getAvailableContentTypes,
  getEffectiveContentType,
  getEnabledContentTypes,
  getRecommendedContentTypes,
  hasContentItems,
} from "./content";

import {
  resolveTerm,
  resolveTermString,
  type TerminologyResolution,
} from "./terminology";

import {
  getRecommendedPrimaryCta,
  isCtaFeasible,
  resolvePrimaryCta,
  type CtaResolution,
} from "./cta";

// -----------------------------------------------------------------------------
// Profile → subtypes utility · primary first, then secondary in order.
// -----------------------------------------------------------------------------

export function subtypesOfProfile(profile: BusinessProfile | null): readonly BusinessSubtype[] {
  if (!profile) return [];
  return [profile.primary.subtype, ...profile.secondary.map((s) => s.subtype)];
}

// -----------------------------------------------------------------------------
// The single bundle a caller computes once per business for a render pass.
// Avoids repeated subtype derivation + repeated recommendation unions.
// -----------------------------------------------------------------------------

export interface EffectiveBusinessState {
  subtypes: readonly BusinessSubtype[];

  // Capabilities
  availableCapabilities: readonly CapabilityKey[];
  recommendedCapabilities: readonly CapabilityKey[];
  enabledCapabilities: Set<CapabilityKey>;
  feasibleCapabilities: Set<CapabilityKey>;

  // Content types
  availableContentTypes: readonly ContentTypeKey[];
  recommendedContentTypes: readonly ContentTypeKey[];
  enabledContentTypes: Set<ContentTypeKey>;

  // CTA
  cta: CtaResolution;
}

export function computeEffectiveBusinessState(
  input: BusinessEngineInput,
): EffectiveBusinessState {
  const subtypes = subtypesOfProfile(input.owner_state.profile);
  return {
    subtypes,

    availableCapabilities: getAvailableCapabilities(),
    recommendedCapabilities: getRecommendedCapabilities(subtypes),
    enabledCapabilities: getEnabledCapabilities(input, subtypes),
    feasibleCapabilities: getFeasibleCapabilities(input, subtypes),

    availableContentTypes: getAvailableContentTypes(),
    recommendedContentTypes: getRecommendedContentTypes(subtypes),
    enabledContentTypes: getEnabledContentTypes(input, subtypes),

    cta: resolvePrimaryCta(input, subtypes),
  };
}

// -----------------------------------------------------------------------------
// Terminology helper · thin convenience wrapper for callers that already
// hold the business owner_state + subtypes.
// -----------------------------------------------------------------------------

export function resolveBusinessTerm(
  context: TerminologyContext,
  concept: TerminologyConcept,
  input: BusinessEngineInput,
  locale: "en" | "id" = "en",
): string {
  const subtypes = subtypesOfProfile(input.owner_state.profile);
  return resolveTermString(context, concept, input.owner_state, subtypes, locale);
}

export function resolveBusinessTermFull(
  context: TerminologyContext,
  concept: TerminologyConcept,
  input: BusinessEngineInput,
): TerminologyResolution {
  const subtypes = subtypesOfProfile(input.owner_state.profile);
  return resolveTerm(context, concept, input.owner_state, subtypes);
}

// -----------------------------------------------------------------------------
// Re-exports · the engine's exported surface is a single flat module so
// callers don't need to know which internal file a helper lives in.
// Keeps the public API tight and resistant to accidental misuse.
// -----------------------------------------------------------------------------

export {
  // capabilities
  getAvailableCapabilities,
  getRecommendedCapabilities,
  getEffectiveCapability,
  getEnabledCapabilities,
  isCapabilityReady,
  getFeasibleCapabilities,
  // content
  getAvailableContentTypes,
  getRecommendedContentTypes,
  getEffectiveContentType,
  getEnabledContentTypes,
  hasContentItems,
  // terminology
  resolveTerm,
  resolveTermString,
  // CTA
  getRecommendedPrimaryCta,
  isCtaFeasible,
  resolvePrimaryCta,
};

// -----------------------------------------------------------------------------
// Deliberately NOT exported from this file (names that would make the
// hidden-permission attack easy):
//
//   · "getBusinessContent"            · ambiguous · which layer?
//   · "allowedCapabilities"           · uses the word "allowed" → smells like permission
//   · "getCapabilitiesForSubtype"     · subtype → cap IS a recommendation,
//                                       not an allow-list. If you need this,
//                                       call getRecommendedCapabilities().
//   · "getContentForBusiness"         · ambiguous · available? recommended? enabled?
//
// If an existing caller wants a function with one of those names, it is
// a doctrine violation to add it. The caller must say Available / Recommended
// / Enabled / Effective explicitly.
// -----------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-unused-vars */
// Compile-time guard · referenced below but prefixed with underscore so the
// linter doesn't complain. These names must stay FORBIDDEN at the engine
// boundary (not even as internal helpers). If any ship, the engineering test
// has failed.
type _ForbiddenNames =
  | "getBusinessContent"
  | "allowedCapabilities"
  | "getCapabilitiesForSubtype"
  | "getContentForBusiness";
/* eslint-enable @typescript-eslint/no-unused-vars */
