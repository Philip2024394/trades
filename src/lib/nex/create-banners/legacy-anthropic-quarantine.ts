// src/lib/nex/create-banners/legacy-anthropic-quarantine.ts
//
// NEX Create Banners · Legacy Anthropic banner-route quarantine · 2026-09-23
// ==========================================================================
// Documents + machine-checks the isolation between the new NEX Create
// Banners architecture and the legacy merchant-assistant banner route which
// uses Anthropic (a third-party AI provider).
//
// The legacy route violates the NEX no-third-party-AI-content doctrine
// locked in memory 2026-09-23 (feedback_nex_third_party_ai_origin_doctrine).
// It must NOT become the foundation of the new Create Banners product.

export const LEGACY_ANTHROPIC_BANNER_ROUTE_PATH =
  "src/app/api/nex/merchant-assistant/banner/route.ts" as const;

export const LEGACY_ANTHROPIC_BANNER_QUARANTINE_REASONS: readonly string[] = [
  "Uses Anthropic (third-party AI provider) · violates no-third-party-AI-content doctrine",
  "Belongs to earlier Phase 7 Merchant Assistant work · predates the doctrine lock",
  "Under strict rule, its generation output would itself be classified INELIGIBLE",
  "Must NOT be extended · must NOT be inherited from · must NOT be wrapped-and-renamed",
] as const;

/**
 * Static self-check: this file MUST NOT import from the legacy route.
 * The array below is the authoritative "must not import" list for the
 * create-banners module. The engine-independence test asserts this.
 */
export const CREATE_BANNERS_MUST_NOT_IMPORT_FROM: readonly string[] = [
  "@/app/api/nex/merchant-assistant/banner/",
  "src/app/api/nex/merchant-assistant/banner/",
  "@/lib/nex/merchant-assistant/toolExecutors",
  "@/lib/llm/anthropic",
  "@anthropic-ai/sdk",
  "openai",
  "@google/generative-ai",
  "groq-sdk",
] as const;

/**
 * Whether NEX Create Banners is permitted to call, extend, or route
 * through the legacy Anthropic banner route. Constant `false`. Grep for
 * this symbol to prove no code path has flipped it.
 */
export const CREATE_BANNERS_MAY_REUSE_LEGACY_ANTHROPIC_ROUTE = false as const;

/**
 * Deletion policy: the legacy route may exist for historical/production
 * compatibility. It must NOT be casually deleted during Authorisation A.
 * A separate authorised migration wave would be required to remove it.
 */
export const CREATE_BANNERS_MAY_DELETE_LEGACY_ROUTE_UNILATERALLY =
  false as const;

// Doctrine locks
export const _LEGACY_ANTHROPIC_ROUTE_QUARANTINE_ENFORCED = true as const;
export const _LEGACY_ANTHROPIC_ROUTE_NEVER_BECOMES_CREATE_BANNERS_FOUNDATION =
  true as const;
