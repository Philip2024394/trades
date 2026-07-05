// growthStrategyRegistry — the "what they want now" catalogue.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { GrowthStrategyManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of quarter-scale growth strategy templates. Per-merchant active + historical instances persist in studio_growth_strategy.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 2 §Layer 1", "Amendment 7"],
  adrRefs: ["ADR-016"],
  pmmImpact: "Business OS · Layer 1 · Growth Strategy",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: ["businessProfileRegistry"],
    downstreamDependents: ["websiteRecipeRegistry", "playbookRegistry"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type GrowthStrategyRegistration = GrowthStrategyManifest & RegistrationBase;
type FrozenGrowthStrategyRegistration = Frozen<GrowthStrategyRegistration>;

const inner = createRegistry<GrowthStrategyRegistration>({
  label: "growthStrategyRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for strategy "${m.slug}".`);
    if (!m.currentGoal) throw new Error(`strategy "${m.slug}" missing currentGoal.`);
    if (m.pushServices.length === 0)
      throw new Error(`strategy "${m.slug}" must push at least one service.`);
  },
  indexes: {
    byGoal: (m) => [m.currentGoal],
    byTrade: (m) => m.appliesToTrades
  }
});

function normalise(
  m: GrowthStrategyManifest
): GrowthStrategyRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.currentGoal,
    tags: [
      m.currentGoal,
      ...(m.secondaryGoal ? [m.secondaryGoal] : []),
      ...m.appliesToTrades,
      ...m.pushServices
    ],
    searchKeywords: [m.description, m.currentGoal, ...m.pushServices],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const growthStrategyRegistry = {
  register(m: GrowthStrategyManifest): FrozenGrowthStrategyRegistration {
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
  listByGoal(goal: string) {
    return inner.listByIndex("byGoal", goal);
  },
  listByTrade(trade: string) {
    return [
      ...inner.listByIndex("byTrade", trade),
      ...inner.listByIndex("byTrade", "*")
    ];
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

  /** Pick the best strategy given a profile. Placeholder rank —
   *  M6 evidenceRegistry will weight this properly. */
  rank(input: {
    trade: string;
    positioning?: string;
    hint?: string;
  }): FrozenGrowthStrategyRegistration[] {
    return inner
      .list()
      .map((s) => {
        let score = 0;
        if (s.appliesToTrades.includes(input.trade)) score += 30;
        else if (s.appliesToTrades.includes("*")) score += 5;
        if (input.positioning && s.appliesToPositioning?.includes(input.positioning))
          score += 15;
        if (input.hint && s.slug.includes(input.hint)) score += 40;
        return { s, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.s);
  },

  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
