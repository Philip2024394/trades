// src/lib/nex/theme-brain/capability.ts
//
// Capability identity for the Theme Brain.
//
// The authoritative capability registry lives at
//   src/lib/nex/brain/capabilities.ts
// where the sealed BrainCapability union adds the "theme_intelligence"
// member and the REGISTRY carries the CapabilityRecord. This file is
// the Theme-Brain-local reference to the capability ID so test code,
// loggers, and future gateway-route code can refer to it symbolically
// without string-literal drift.

export const THEME_BRAIN_CAPABILITY_ID = "theme_intelligence" as const;
export type ThemeBrainCapabilityId = typeof THEME_BRAIN_CAPABILITY_ID;

/** Human-readable metadata for logging + telemetry. Mirrors the
 *  entry in the central registry. */
export const THEME_BRAIN_CAPABILITY_METADATA = {
  id: THEME_BRAIN_CAPABILITY_ID,
  name: "Theme Intelligence",
  baby: "Choose and build worlds that match the business",
  status: "PARTIAL" as const,
  files: [
    "src/lib/nex/theme-brain/intent.ts",
    "src/lib/nex/theme-brain/vocabulary.ts",
    "src/lib/nex/theme-brain/vocabulary-selector.ts",
    "src/lib/nex/theme-brain/capability-validator.ts",
    "src/lib/nex/theme-brain/package-compiler.ts",
    "src/lib/nex/theme-brain/authority.ts",
    "src/lib/nex/theme-brain/index.ts",
  ],
  activatesWhen: "a caller invokes requestThemeProposal via the shared capability contract",
  notes:
    "Phase 1 reasoning-only · emits ThemePackage proposals + missing_capability reports · uses NexBrainProvider when provided · never publishes · never modifies engine vocabulary",
} as const;
