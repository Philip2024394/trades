// recommendationRegistry — Business OS Layer 16 (Coach).

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import {
  evidenceRegistry,
  patternRegistry,
  playbookRegistry
} from "@/platform/business";
import type { HealthDimension } from "../types";
import type { RecommendationManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Data-driven coaching primitives. Each recommendation declares a condition, an action, an impact band, and provenance. Consumed by BusinessCoach at assess + backlog time.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7"],
  adrRefs: ["ADR-031", "ADR-032"],
  pmmImpact: "Business OS · Layer 16 (Business Operating Coach)",
  relationships: {
    businessOsLayer: 16,
    upstreamDependencies: [
      "playbookRegistry",
      "patternRegistry",
      "evidenceRegistry",
      "tradeIntelligenceRegistry",
      "composerRegistry"
    ],
    downstreamDependents: [],
    composition: "leaf",
    pluginCompatible: true
  }
};

type RecommendationRegistration = RecommendationManifest & RegistrationBase;
type FrozenRecommendationRegistration = Frozen<RecommendationRegistration>;

const inner = createRegistry<RecommendationRegistration>({
  label: "recommendationRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(
        `unsupported manifestVersion for recommendation "${m.slug}".`
      );
    if (typeof m.condition?.check !== "function")
      throw new Error(
        `recommendation "${m.slug}" must supply condition.check function.`
      );
    if (!m.rationale?.whyItMatters || !m.rationale?.expectedOutcome)
      throw new Error(
        `recommendation "${m.slug}" must declare rationale.whyItMatters + expectedOutcome.`
      );
    for (const slug of m.citesPlaybooks ?? []) {
      if (!playbookRegistry.has(slug)) {
        throw new Error(
          `recommendation "${m.slug}" cites unknown playbook "${slug}".`
        );
      }
    }
    for (const slug of m.citesPatterns ?? []) {
      if (!patternRegistry.has(slug)) {
        throw new Error(
          `recommendation "${m.slug}" cites unknown pattern "${slug}".`
        );
      }
    }
    for (const slug of m.citesEvidence ?? []) {
      if (!evidenceRegistry.has(slug)) {
        throw new Error(
          `recommendation "${m.slug}" cites unknown evidence "${slug}".`
        );
      }
    }
  },
  indexes: {
    byDimension: (m) => [m.dimension],
    byCategory: (m) => [m.category],
    byTrade: (m) => m.scope.trades,
    byCountry: (m) => m.scope.countries,
    byGoal: (m) => m.scope.goals ?? [],
    byImpact: (m) => [m.estimatedImpact]
  }
});

function normalise(m: RecommendationManifest): RecommendationRegistration {
  return {
    ...m,
    id: m.slug,
    name: m.title,
    description: m.description,
    category: m.category,
    tags: [
      m.category,
      m.dimension,
      m.estimatedImpact,
      ...m.scope.trades,
      ...m.scope.countries
    ],
    searchKeywords: [m.title, m.description],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const recommendationRegistry = {
  register(m: RecommendationManifest): FrozenRecommendationRegistration {
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
  listByDimension(dim: HealthDimension) {
    return inner.listByIndex("byDimension", dim);
  },
  listByCategory: inner.listByCategory,
  listByTrade(trade: string) {
    return [
      ...inner.listByIndex("byTrade", trade),
      ...inner.listByIndex("byTrade", "*")
    ];
  },
  listByGoal(goal: string) {
    return inner.listByIndex("byGoal", goal);
  },
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
