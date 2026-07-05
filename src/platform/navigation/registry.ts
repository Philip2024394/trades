// Navigation Registry — Milestone 3 · Batch 1.
//
// ─── Registry Metadata (RGP-2) ────────────────────────────────────
// Owner:      Platform Engineering
// Purpose:    Catalogue of page-scale navigation patterns
// Lifecycle:  alpha
// Since:      1.0.0
// Refs:       Constitution Amendments 2, 5; ADR-011
// ──────────────────────────────────────────────────────────────────

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { NavigationManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of page-scale navigation patterns. Composer picks one per (layout × device).",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 2 §Business OS / Navigation",
    "Amendment 5 §RGP",
    "Amendment 6 §Layer 6"
  ],
  adrRefs: [],
  pmmImpact: "Business OS · Navigation layer",
  relationships: {
    businessOsLayer: 6,
    upstreamDependencies: ["designSystemRegistry", "themeRegistry"],
    downstreamDependents: ["layoutRegistry", "appRegistry"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type NavigationRegistration = NavigationManifest & RegistrationBase;
type FrozenNavigationRegistration = Frozen<NavigationRegistration>;

const inner = createRegistry<NavigationRegistration>({
  label: "navigationRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for navigation "${m.slug}".`
      );
    }
    if (!m.pattern) {
      throw new Error(`navigation "${m.slug}" must declare a pattern.`);
    }
    if (!Array.isArray(m.devices) || m.devices.length === 0) {
      throw new Error(
        `navigation "${m.slug}" must declare at least one supported device.`
      );
    }
  },
  indexes: {
    byPattern: (m) => [m.pattern],
    byDevice: (m) => m.devices
  }
});

function normalise(m: NavigationManifest): NavigationRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.pattern,
    tags: [m.pattern, ...m.devices, ...(m.behaviours ?? [])],
    searchKeywords: [m.description, m.pattern, ...m.devices],
    supportedDevices: m.devices,
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const navigationRegistry = {
  register(manifest: NavigationManifest): FrozenNavigationRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenNavigationRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenNavigationRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenNavigationRegistration[] {
    return inner.list();
  },
  listByPattern(
    pattern: NavigationManifest["pattern"]
  ): FrozenNavigationRegistration[] {
    return inner.listByIndex("byPattern", pattern);
  },
  listByDevice(
    device: NavigationManifest["devices"][number]
  ): FrozenNavigationRegistration[] {
    return inner.listByIndex("byDevice", device);
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

  /** Domain-specific: pick the best-fit navigation for a
   *  (layout × device) pair. Scores patterns that declare the layout
   *  as compatible + the device as supported. */
  rank(input: {
    layoutId?: string;
    device: NavigationManifest["devices"][number];
  }): Array<{ nav: FrozenNavigationRegistration; score: number }> {
    return inner
      .list()
      .map((nav) => {
        let score = 0;
        if (nav.devices.includes(input.device)) score += 10;
        if (input.layoutId) {
          const compat = nav.compatibleLayouts ?? [];
          if (compat.includes("*") || compat.includes(input.layoutId)) {
            score += 20;
          }
        }
        return { nav, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  },

  /** Domain-specific: return the top-scoring pattern for the given
   *  layout + device, or undefined if nothing scores. */
  recommend(input: {
    layoutId?: string;
    device: NavigationManifest["devices"][number];
  }): FrozenNavigationRegistration | undefined {
    const ranked = this.rank(input);
    return ranked[0]?.nav;
  },

  /** Domain-specific: expose the relationship graph from metadata. */
  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
