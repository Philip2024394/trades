// facetKindRegistry — schema + merge rules per facet kind.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { FacetKindManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Extensibility spine — every playbook facet KIND registers its schema + merge rule here. New subsystems add facet kinds without touching Playbook code.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7 §RGP-8"],
  adrRefs: ["ADR-020"],
  pmmImpact: "Business OS · Layer 1 · Facet extensibility",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: [],
    downstreamDependents: ["playbookRegistry", "strategyResolver"],
    composition: "root",
    pluginCompatible: true
  }
};

type FacetKindRegistration = FacetKindManifest & RegistrationBase;
type FrozenFacetKindRegistration = Frozen<FacetKindRegistration>;

const inner = createRegistry<FacetKindRegistration>({
  label: "facetKindRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for facet "${m.slug}".`);
    if (!m.slug.includes("."))
      throw new Error(`facet slug "${m.slug}" must be dotted (domain.field).`);
    if (m.mergeStrategy === "custom" && !m.mergeFn)
      throw new Error(`facet "${m.slug}" declares custom merge but no mergeFn.`);
  },
  indexes: {
    byDomain: (m) => [m.domain],
    byOwnerLayer: (m) => [String(m.ownerLayer)]
  }
});

function normalise(m: FacetKindManifest): FacetKindRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.domain,
    tags: [m.domain, m.mergeStrategy, `layer-${m.ownerLayer}`],
    searchKeywords: [m.description, m.domain, m.field]
  };
}

export const facetKindRegistry = {
  register(m: FacetKindManifest): FrozenFacetKindRegistration {
    return inner.register(normalise(m));
  },
  get(slug: string) {
    return inner.get(slug);
  },
  getOrThrow(slug: string) {
    return inner.getOrThrow(slug);
  },
  has(slug: string) {
    return inner.has(slug);
  },
  list() {
    return inner.list();
  },
  listByDomain(domain: string) {
    return inner.listByIndex("byDomain", domain);
  },
  listByOwnerLayer(layer: number) {
    return inner.listByIndex("byOwnerLayer", String(layer));
  },
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  size() {
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
  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
