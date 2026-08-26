// NEX Mascot type contract · 2026-08-27.
//
// The mascot library is an ADAPTER over the authoritative NEX_ACTIONS
// registry (src/lib/nex-actions/registry.ts). We NEVER duplicate mascot
// identity — every mascot displayed here derives from a NexAction row.
//
// Optional augmentation lives in /data/nex-mascot-manifest.json:
// theme-recommendation tags · featured pins · extra tags for search.
// Augmentation NEVER overrides identity — id/name/imageUrl always come
// from the authoritative registry.
//
// Doctrine (spec §5, §14, §15): "THEME = ENVIRONMENT. MASCOT = PERSONALITY."
// One universal library. Themes influence recommendation, never availability.

import type { NexActionTier, NexMascotExpression } from "../nex-actions/types";

/** Grouping key from the NEX Actions section (react · ask-nex · discover · special). */
export type MascotSection = "react" | "ask-nex" | "discover" | "special";

/** Adapter view of a mascot for the Mascot Drawer UI. */
export interface Mascot {
  /** Stable id · identical to the source NexAction.id. */
  id: string;
  /** Display name · from NexAction.mascot.label. */
  name: string;
  /** Public image URL · from NexAction.mascot.imageUrl. Never invented. */
  asset: string;
  /** Optional smaller variant. Falls back to `asset`. */
  thumb?: string;
  /** Provenance from the NEX_ACTIONS row. */
  tier: NexActionTier;
  section?: MascotSection;
  expression: NexMascotExpression;
  /** Free-form searchable descriptors. Augmentation manifest may add to these. */
  tags: string[];
  /** Explicit theme ids where this mascot is surfaced first. Augmentation-only. */
  recommendedThemes?: string[];
  /** Subset of tags that should score higher against a theme's tag set. */
  recommendedTagsMatch?: string[];
  /** Pinned to the top of Recommended regardless of theme. */
  featured?: boolean;
  /** False when the source row is still using the mascot-placeholder image URL. */
  hasArtwork: boolean;
}

/** Row shape inside /data/nex-mascot-manifest.json · augmentation only. */
export interface MascotAugmentation {
  id: string;                           // must match a NEX_ACTIONS id
  extraTags?: string[];
  recommendedThemes?: string[];
  recommendedTagsMatch?: string[];
  featured?: boolean;
}

export interface MascotManifest {
  version: number;
  generated?: string;
  /** Augmentation rows only — never identity. */
  mascots: MascotAugmentation[];
}
