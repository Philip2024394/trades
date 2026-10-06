// src/lib/nex/theme-brain/intent.ts
//
// Theme Brain · intent + result contract.
//
// Phase 1 · reasoning-only. The Brain accepts a WorldIntent and
// returns a ThemeBrainResult · either a ThemePackage proposal, a
// missing_capability report, a refinement, a validation failure, or
// a decline.
//
// Nothing in this file imports from src/app · the Brain layer is
// decoupled from the UI layer. The ThemePackage type comes from the
// core-owned contract at src/lib/nex-native/theme-package.

import type { ThemePackage } from "@/lib/nex-native/theme-package/types";

/** Who is asking · drives governance decisions · a worker/agent must
 *  carry a role so authority can decide what they are allowed to do. */
export type ThemeBrainCallerRole =
  | "chat"            // NEX Chat / Cortex per-turn invocation
  | "worker"          // authorised Cortex-connected worker (async job)
  | "agent"           // authorised Cortex-connected agent (multi-turn)
  | "founder";        // founder tooling (admin surface)

export interface ThemeBrainCaller {
  readonly role: ThemeBrainCallerRole;
  /** Stable identifier for the caller · used for audit trail. */
  readonly id: string;
}

/** Structured input the Brain reasons about. Natural-language inputs
 *  may also be accepted via the optional creativeSeed · the Brain
 *  parses them deterministically in Phase 1 (no LLM) and defers
 *  LLM-based intent extraction to a future phase where the provider
 *  is wired. */
export interface WorldIntent {
  /** Free-form natural-language description from the caller.
   *  Example: "Botanical Café — fresh, natural, beautiful" */
  readonly creativeSeed: string;
  /** Optional structured hints that bypass natural-language parsing. */
  readonly businessCategories?: readonly string[];
  readonly emotionalAdjectives?: readonly string[];
  readonly worldName?: string;
  /** When refining, the previous proposal to adjust. */
  readonly existingPackage?: ThemePackage;
  /** When refining, the requested change in free text. */
  readonly refinementRequest?: string;
}

/** Operation the caller wants to perform. */
export type ThemeBrainAction =
  | "propose"      // produce a new ThemePackage from WorldIntent
  | "refine"       // adjust an existing ThemePackage per refinementRequest
  | "validate"     // check capability coverage without producing a package
  | "publish"      // DENIED in Phase 1 · founder-gated
  | "modify_vocabulary"; // DENIED in Phase 1 · founder-gated

export interface ThemeBrainRequest {
  readonly caller: ThemeBrainCaller;
  readonly action: ThemeBrainAction;
  readonly intent: WorldIntent;
}

/** What the Brain reports when the Engine's current vocabulary cannot
 *  express a part of the requested world. Load-bearing · the Brain
 *  MUST NOT silently invent vocabulary. */
export interface CapabilityGap {
  /** Which part of the vocabulary is missing · e.g. "material",
   *  "personality", "ambient-family", "sticker-concept". */
  readonly category:
    | "material"
    | "personality"
    | "ambient-family"
    | "bubble-shape"
    | "shop-card-style"
    | "shop-product-framing"
    | "sticker-concept"
    | "motion-token";
  /** The requested but unavailable token (if the Brain was able to
   *  name it) · e.g. "wax-seal", "holographic". */
  readonly requested: string;
  /** Human-readable reason the vocabulary is needed. */
  readonly whyNeeded: string;
  /** Nearest existing token the Brain considered as a fallback, or
   *  null if nothing is close. */
  readonly suggestedFallback: string | null;
}

/** The authoritative output shape · a discriminated union so callers
 *  must handle every path explicitly. */
export type ThemeBrainResult =
  | {
      readonly kind: "package_proposal";
      readonly package: ThemePackage;
      readonly rationale: string;
      readonly vocabularyUsed: VocabularyUsageTrace;
    }
  | {
      readonly kind: "missing_capability";
      readonly gaps: readonly CapabilityGap[];
      readonly partialPackage: ThemePackage | null;
      readonly rationale: string;
    }
  | {
      readonly kind: "refinement";
      readonly package: ThemePackage;
      readonly changesFromPrevious: readonly string[];
      readonly rationale: string;
    }
  | {
      readonly kind: "validation_report";
      readonly fullyExpressible: boolean;
      readonly gaps: readonly CapabilityGap[];
      readonly rationale: string;
    }
  | {
      readonly kind: "declined";
      readonly reason: "unauthorised" | "not_supported" | "invalid_input";
      readonly detail: string;
    };

/** Audit trail of what vocabulary tokens the Brain selected · used
 *  by tests + telemetry to prove no vocabulary was silently invented. */
export interface VocabularyUsageTrace {
  readonly materials: readonly string[];
  readonly personality: string;
  readonly ambientFamilies: readonly string[];
  readonly bubbleShapes: readonly string[];
  readonly shopCardStyle: string | null;
  readonly shopProductFraming: string | null;
  readonly stickerKeywords: readonly string[];
}
