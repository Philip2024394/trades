// NEX Mascot Registry · adapter over NEX_ACTIONS · 2026-08-27.
//
// SINGLE SOURCE OF TRUTH RESPECTED:
//   Mascot identity lives in src/lib/nex-actions/registry.ts (NEX_ACTIONS).
//   That file is compile-time-locked (Philip 2026-08-25 PR rule · no functions,
//   no cross-layer imports, one row per mascot). We NEVER duplicate rows.
//
// This module adapts NEX_ACTIONS rows into a UI-friendly `Mascot` shape and
// overlays optional augmentation from /data/nex-mascot-manifest.json —
// theme-recommendation tags, featured pins, extra tags. Augmentation never
// overrides identity fields.
//
// Doctrine (spec §5, §14, §15): "THEME = ENVIRONMENT. MASCOT = PERSONALITY."

import { NEX_ACTIONS } from "../nex-actions/registry";
import type { NexAction } from "../nex-actions/types";
import augmentationManifest from "../../../data/nex-mascot-manifest.json";
import { resolveMeaning } from "./meaning";
import type { Mascot, MascotAugmentation, MascotManifest, MascotSection } from "./types";

const AUGMENTATION: MascotManifest = augmentationManifest as MascotManifest;
const PLACEHOLDER_URL_MARKER = "mascot-placeholder.png";

// Default tags automatically derived from a NexAction row. Search + basic
// theme matching work out of the box without any augmentation entry.
function autoTagsFor(row: NexAction): string[] {
  const t = new Set<string>();
  t.add(row.tier);                    // "reaction" | "intelligence" | "action" | "consumable"
  if (row.section) t.add(row.section);
  t.add(row.mascot.expression);       // "laugh" | "romantic" | ... etc.
  if (row.mascot.expression === "romantic") { t.add("love"); }
  if (row.mascot.expression === "sunny")    { t.add("warm"); t.add("light"); }
  if (row.mascot.expression === "rainy")    { t.add("cozy"); }
  if (row.mascot.expression === "birthday") { t.add("celebrate"); }
  return Array.from(t);
}

function augmentationFor(id: string): MascotAugmentation | undefined {
  return AUGMENTATION.mascots?.find((a) => a.id === id);
}

function adapt(row: NexAction): Mascot {
  const aug = augmentationFor(row.id);
  const tags = new Set<string>([...autoTagsFor(row), ...(aug?.extraTags ?? [])]);
  // Expression is the AUTHORITATIVE source · meaning + templates default from
  // it. Augmentation manifest may override on a per-mascot basis, but the
  // dictionary in meaning.ts covers all 12 expression values so unknown
  // paths never produce robotic sentences (Philip 2026-08-27).
  const base = resolveMeaning(row.mascot.expression);
  return {
    id:                   row.id,
    name:                 row.mascot.label,
    asset:                row.mascot.imageUrl,
    tier:                 row.tier,
    section:              row.section as MascotSection | undefined,
    expression:           row.mascot.expression,
    tags:                 Array.from(tags),
    recommendedThemes:    aug?.recommendedThemes,
    recommendedTagsMatch: aug?.recommendedTagsMatch,
    featured:             aug?.featured ?? false,
    hasArtwork:           !row.mascot.imageUrl.includes(PLACEHOLDER_URL_MARKER),
    meaning:              aug?.meaning ?? base.meaning,
    personalTemplates:    aug?.personalTemplates ?? base.templates,
  };
}

/** All mascots derived from NEX_ACTIONS, in registry order · zero filtering. */
export function listAll(): Mascot[] {
  return NEX_ACTIONS.map(adapt);
}

/** Only mascots whose source row has real artwork (skips TBD placeholders). */
export function listAllWithArtwork(): Mascot[] {
  return listAll().filter((m) => m.hasArtwork);
}

export function findById(id: string): Mascot | undefined {
  return listAll().find((m) => m.id === id);
}

export function listBySection(section: MascotSection): Mascot[] {
  return listAll().filter((m) => m.section === section);
}

/** Case-insensitive substring match against name + section + tier + tags. */
export function search(query: string): Mascot[] {
  const q = query.trim().toLowerCase();
  if (!q) return listAll();
  return listAll().filter((m) => {
    if (m.name.toLowerCase().includes(q)) return true;
    if (m.tier.toLowerCase().includes(q)) return true;
    if (m.section?.toLowerCase().includes(q)) return true;
    if (m.expression.toLowerCase().includes(q)) return true;
    if (m.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

/**
 * Score a mascot against a theme's recommended tags + explicit theme match.
 * Higher = surfaces first in the Recommended row. Deterministic total order.
 *
 * Points:
 *   - featured                                       → +100
 *   - recommendedThemes includes themeId             → +50
 *   - each recommendedTagsMatch hit                  → +6
 *   - each generic tag overlap                       → +2
 *   - mascot without artwork                         → -1000 (sinks to bottom)
 *   - id-based tiebreak                              → deterministic
 */
function scoreForTheme(m: Mascot, themeId: string, themeTags: string[]): number {
  let s = 0;
  if (m.featured) s += 100;
  if (m.recommendedThemes?.includes(themeId)) s += 50;
  const themeTagSet = new Set(themeTags.map((t) => t.toLowerCase()));
  if (m.recommendedTagsMatch) {
    for (const t of m.recommendedTagsMatch) if (themeTagSet.has(t.toLowerCase())) s += 6;
  }
  const mTags = new Set(m.tags.map((t) => t.toLowerCase()));
  for (const t of mTags) if (themeTagSet.has(t)) s += 2;
  if (!m.hasArtwork) s -= 1000;
  const charSum = m.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  s -= charSum * 0.0001;
  return s;
}

/** Recommended-first ordering of the FULL library for the given theme. */
export function recommendedForTheme(themeId: string, themeTags: string[] = []): Mascot[] {
  const scored = listAll().map((m) => ({ m, s: scoreForTheme(m, themeId, themeTags) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.map(({ m }) => m);
}

/** Split into Recommended (theme-relevant) + Browse All (rest, still shown). */
export function recommendationSplit(
  themeId: string,
  themeTags: string[] = [],
  maxRecommended = 12,
): { recommended: Mascot[]; browseAll: Mascot[] } {
  const ordered = recommendedForTheme(themeId, themeTags);
  const themeTagSet = new Set(themeTags.map((t) => t.toLowerCase()));
  const recommendedCandidates = ordered.filter((m) => {
    if (!m.hasArtwork) return false; // never Recommended if no artwork · always in Browse All (bottom)
    if (m.featured) return true;
    if (m.recommendedThemes?.includes(themeId)) return true;
    return m.tags.some((t) => themeTagSet.has(t.toLowerCase()));
  });
  const recommended = recommendedCandidates.slice(0, maxRecommended);
  const recommendedIds = new Set(recommended.map((m) => m.id));
  const browseAll = ordered.filter((m) => !recommendedIds.has(m.id));
  return { recommended, browseAll };
}

export const MASCOT_MANIFEST_VERSION = AUGMENTATION.version;
