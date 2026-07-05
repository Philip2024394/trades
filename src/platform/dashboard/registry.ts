// dashboardBlockRegistry — strategy-aware tile catalogue.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { metricRegistry } from "@/platform/metrics";
import { facetKindRegistry } from "@/platform/business/facets";
import type { DashboardBlockManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of dashboard tile blocks. Each block consumes metricRegistry metrics + facet kinds.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 2 §Business OS / Dashboards",
    "Amendment 5 §RGP",
    "Amendment 7"
  ],
  adrRefs: [],
  pmmImpact: "Business OS · Dashboards layer (11)",
  relationships: {
    businessOsLayer: 11,
    upstreamDependencies: [
      "metricRegistry",
      "facetKindRegistry",
      "designSystemRegistry"
    ],
    downstreamDependents: ["appRegistry"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type DashboardBlockRegistration = DashboardBlockManifest & RegistrationBase;
type FrozenDashboardBlockRegistration = Frozen<DashboardBlockRegistration>;

const inner = createRegistry<DashboardBlockRegistration>({
  label: "dashboardBlockRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for block "${m.slug}".`);
    if (!m.blockType) throw new Error(`block "${m.slug}" missing blockType.`);
    if (!Array.isArray(m.supportedSizes) || m.supportedSizes.length === 0)
      throw new Error(`block "${m.slug}" must declare ≥1 supportedSize.`);
    for (const metric of m.consumesMetrics) {
      if (!metricRegistry.has(metric))
        throw new Error(
          `block "${m.slug}" consumes unknown metric "${metric}".`
        );
    }
    for (const facet of m.consumesFacets) {
      if (!facetKindRegistry.has(facet))
        throw new Error(
          `block "${m.slug}" consumes unknown facet "${facet}".`
        );
    }
  },
  indexes: {
    byBlockType: (m) => [m.blockType],
    byDomain: (m) => [m.domain],
    byMetric: (m) => m.consumesMetrics
  }
});

function normalise(
  m: DashboardBlockManifest
): DashboardBlockRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.domain,
    tags: [m.blockType, m.domain, ...m.supportedSizes, ...m.consumesMetrics],
    searchKeywords: [m.description, m.blockType, m.domain, ...m.consumesMetrics],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const dashboardBlockRegistry = {
  register(m: DashboardBlockManifest): FrozenDashboardBlockRegistration {
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
  listByBlockType(blockType: DashboardBlockManifest["blockType"]) {
    return inner.listByIndex("byBlockType", blockType);
  },
  listByDomain(domain: string) {
    return inner.listByIndex("byDomain", domain);
  },
  listByMetric(metricSlug: string) {
    return inner.listByIndex("byMetric", metricSlug);
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

  /** Given a set of metric slugs the strategy prioritises, return
   *  blocks that cover them, ranked by coverage. */
  rank(input: {
    metrics: readonly string[];
  }): FrozenDashboardBlockRegistration[] {
    return inner
      .list()
      .map((block) => {
        const covered = block.consumesMetrics.filter((s) =>
          input.metrics.includes(s)
        ).length;
        return { block, covered };
      })
      .filter((r) => r.covered > 0)
      .sort((a, b) => b.covered - a.covered)
      .map((r) => r.block);
  },

  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
