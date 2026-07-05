// themeRegistry — the Theme layer.
//
// ─── Registry Metadata (RGP-2 + RGP-6) ────────────────────────────
import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { ThemeManifest, ThemePresetId } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of complete visual theme presets. Each theme bundles font pair, radius, spacing rhythm, motion tempo.",
  lifecycle: "stable",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 1 §Themes",
    "Amendment 6 §Business OS layer 3"
  ],
  adrRefs: ["ADR-014"],
  pmmImpact: "Business OS · Theme layer + Design System",
  relationships: {
    businessOsLayer: 3,
    upstreamDependencies: ["designTokenRegistry"],
    downstreamDependents: [
      "designSystemRegistry",
      "sectionRegistry",
      "blueprintRegistry",
      "layoutRegistry"
    ],
    composition: "intermediate",
    pluginCompatible: true,
    /** Planned migration: themes become a facet of a broader Brand
     *  System that also owns typography, icon packs, illustration
     *  packs, animation packs, gradients, shadows, colour systems,
     *  and brand overrides. See ADR-014. */
    futureParent: "brandRegistry"
  }
};

type ThemeRegistration = ThemeManifest & RegistrationBase;
type FrozenThemeRegistration = Frozen<ThemeRegistration>;

const inner = createRegistry<ThemeRegistration>({
  label: "themeRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for theme "${m.slug}".`
      );
    }
    if (!m.vars || !m.vars["--font-heading"] || !m.vars["--font-body"]) {
      throw new Error(
        `theme "${m.slug}" must declare vars with --font-heading + --font-body.`
      );
    }
    if (!Array.isArray(m.bestForVerticals)) {
      throw new Error(
        `theme "${m.slug}" must declare bestForVerticals (may be empty).`
      );
    }
  },
  indexes: {
    byMotion: (m) => [m.motion],
    byVertical: (m) => m.bestForVerticals
  }
});

function normalise(m: ThemeManifest): ThemeRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.motion,
    tags: [m.motion, ...m.bestForVerticals],
    searchKeywords: [m.description, m.motion, ...m.bestForVerticals],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const themeRegistry = {
  register(manifest: ThemeManifest): FrozenThemeRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: ThemePresetId): FrozenThemeRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: ThemePresetId): FrozenThemeRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: ThemePresetId): boolean {
    return inner.has(slug);
  },
  list(): FrozenThemeRegistration[] {
    return inner.list();
  },
  listByMotion(motion: ThemeManifest["motion"]): FrozenThemeRegistration[] {
    return inner.listByIndex("byMotion", motion);
  },
  listByVertical(tradeSlug: string): FrozenThemeRegistration[] {
    return inner.listByIndex("byVertical", tradeSlug);
  },
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  size(): number {
    return inner.size();
  },
  search: inner.search,
  describe: inner.describe,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot,

  /** Domain-specific: pick the best-fit theme for a trade slug.
   *  Preserves the historic suggestThemeForTrade() semantics. */
  rank(tradeSlug: string): ThemePresetId {
    const matches = inner.listByIndex("byVertical", tradeSlug);
    if (matches.length > 0) return matches[0].slug;
    return "modern";
  }
};
