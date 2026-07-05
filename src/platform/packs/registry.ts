// Pack Registry — Industry Pack manifests.
//
// Milestone 1 · Registry Kit migration:
// This registry now composes over `createRegistry` from
// @/platform/registryKit. The public API is preserved verbatim so
// existing callers (packInstall.ts, /api/platform/packs/*, essentials-
// pack registration) work unchanged. New capabilities inherited from
// the kit: `.search()`, `.describe()`, `.selfCheck()`, `.listByTag()`,
// `.snapshot()`, alias resolution, telemetry + analytics hooks.
//
// Manifest shape (`PackManifest`) is unchanged — the facade normalises
// each manifest into a full `RegistrationBase` at register time by
// mapping `slug → id`. Every existing manifest field carries through.

import type {
  Frozen,
  MarketplaceMetadata,
  RegistrationBase
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { PackManifest } from "./types";

/** Adapter shape stored inside the registry — PackManifest facts +
 *  the RegistrationBase fields the kit requires. Callers never see
 *  this: `.get()` still returns the original PackManifest shape. */
type PackRegistration = PackManifest & RegistrationBase;

type FrozenPackRegistration = Frozen<PackRegistration>;

const inner = createRegistry<PackRegistration>({
  label: "packRegistry",
  idFormat: "slug",
  validate: validatePackManifest,
  indexes: {
    // Preserve the byIndustry behaviour the previous class provided.
    byIndustry: (m) => [m.industry]
  }
});

/** Public facade — preserves the previous PackRegistry class surface
 *  1:1. Every method used by existing callers remains identical. */
export const packRegistry = {
  register(manifest: PackManifest): FrozenPackRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenPackRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenPackRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenPackRegistration[] {
    return inner.list();
  },
  listByIndustry(industry: string): FrozenPackRegistration[] {
    if (industry === "*") return inner.list();
    // Preserve legacy "wildcard packs surface in every industry" rule.
    const industryMatches = inner.listByIndex("byIndustry", industry);
    const wildcardMatches = inner
      .listByIndex("byIndustry", "*")
      .filter((p) => p.industry === "*");
    return [...industryMatches, ...wildcardMatches];
  },
  size(): number {
    return inner.size();
  },
  // ─── New surface inherited from the kit ─────────────────────────
  search: inner.search,
  describe: inner.describe,
  listByTag: inner.listByTag,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

// ─── Facade internals ─────────────────────────────────────────────

function normalise(m: PackManifest): PackRegistration {
  const marketplace: MarketplaceMetadata = {
    displayName: m.name,
    tagline: m.tagline,
    author: m.publisher.name,
    previewImageUrl: m.packStore.screenshots[0],
    tags: m.packStore.benefits
  };
  return {
    ...m,
    // RegistrationBase fields
    id: m.slug,
    version: m.version,
    name: m.name,
    description: m.description,
    category: "industry-pack",
    tags: [m.industry, ...(m.packStore.benefits ?? [])].filter(Boolean),
    searchKeywords: [m.industry, m.tagline, ...(m.packStore.benefits ?? [])],
    marketplace
  };
}

function validatePackManifest(m: PackRegistration): void {
  if (m.manifestVersion !== 1) {
    throw new Error(
      `unsupported manifestVersion ${m.manifestVersion} for pack "${m.slug}".`
    );
  }
  if (!m.name || !m.tagline || !m.description) {
    throw new Error(
      `pack "${m.slug}" missing name/tagline/description.`
    );
  }
  if (!m.industry) {
    throw new Error(`pack "${m.slug}" missing industry slug.`);
  }
  if (m.apps.length === 0) {
    throw new Error(
      `pack "${m.slug}" must install at least one App.`
    );
  }
  const seen = new Set<string>();
  for (const entry of m.apps) {
    if (seen.has(entry.slug)) {
      throw new Error(
        `pack "${m.slug}" lists App "${entry.slug}" twice.`
      );
    }
    seen.add(entry.slug);
  }
}

// `FrozenPackManifest` remains exported from ./types; callers that
// imported it from this file historically get the same shape via
// packRegistry.get() which returns FrozenPackRegistration (a superset
// assignable to FrozenPackManifest by structural typing).
