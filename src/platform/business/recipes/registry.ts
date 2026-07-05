// websiteRecipeRegistry — recipes as lightweight orchestrators.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { playbookRegistry } from "../playbooks";
import type { WebsiteRecipeManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Lightweight orchestrator layer. Recipes REFERENCE playbooks; they never duplicate decision logic. Composed at resolution time by StrategyResolver.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7 §Recipes"],
  adrRefs: ["ADR-018"],
  pmmImpact: "Business OS · Layer 1 · Recipe orchestration",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: [
      "playbookRegistry",
      "businessProfileRegistry",
      "growthStrategyRegistry"
    ],
    downstreamDependents: ["strategyResolver"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type WebsiteRecipeRegistration = WebsiteRecipeManifest & RegistrationBase;
type FrozenWebsiteRecipeRegistration = Frozen<WebsiteRecipeRegistration>;

const inner = createRegistry<WebsiteRecipeRegistration>({
  label: "websiteRecipeRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for recipe "${m.slug}".`);
    if (!Array.isArray(m.playbooks) || m.playbooks.length === 0)
      throw new Error(`recipe "${m.slug}" must reference at least one playbook.`);
    for (const pb of m.playbooks) {
      if (!playbookRegistry.has(pb)) {
        throw new Error(
          `recipe "${m.slug}" references unknown playbook "${pb}".`
        );
      }
    }
  },
  indexes: {
    byTrade: (m) => m.appliesTo.trades,
    byFlag: (m) => m.appliesTo.profileFlags ?? [],
    byGoal: (m) => m.appliesTo.growthGoals ?? []
  }
});

function normalise(
  m: WebsiteRecipeManifest
): WebsiteRecipeRegistration {
  return {
    ...m,
    id: m.slug,
    category: "recipe",
    tags: [
      m.evidence.evidenceStrength,
      ...(m.appliesTo.profileFlags ?? []),
      ...m.appliesTo.trades,
      ...m.playbooks
    ],
    searchKeywords: [m.description, ...m.playbooks, ...m.appliesTo.trades],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const websiteRecipeRegistry = {
  register(m: WebsiteRecipeManifest): FrozenWebsiteRecipeRegistration {
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
  listByTrade(trade: string) {
    return [
      ...inner.listByIndex("byTrade", trade),
      ...inner.listByIndex("byTrade", "*")
    ];
  },
  listByFlag(flag: string) {
    return inner.listByIndex("byFlag", flag);
  },
  listByGoal(goal: string) {
    return inner.listByIndex("byGoal", goal);
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

  /** Rank recipes for a (profile, strategy) pair. */
  rank(input: {
    trade?: string;
    profileFlags?: readonly string[];
    growthGoals?: readonly string[];
    country?: string;
  }): FrozenWebsiteRecipeRegistration[] {
    return inner
      .list()
      .map((r) => {
        let score = 0;
        if (input.trade) {
          if (r.appliesTo.trades.includes(input.trade)) score += 40;
          else if (r.appliesTo.trades.includes("*")) score += 8;
        }
        for (const flag of input.profileFlags ?? []) {
          if (r.appliesTo.profileFlags?.includes(flag)) score += 20;
        }
        for (const goal of input.growthGoals ?? []) {
          if (r.appliesTo.growthGoals?.includes(goal)) score += 25;
        }
        if (
          input.country &&
          r.appliesTo.countries?.includes(input.country)
        )
          score += 15;
        score += r.evidence.confidence * 0.04;
        return { r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
  },

  /** Convenience: top-scoring recipe. */
  recommend(input: {
    trade?: string;
    profileFlags?: readonly string[];
    growthGoals?: readonly string[];
    country?: string;
  }): FrozenWebsiteRecipeRegistration | undefined {
    return this.rank(input)[0];
  },

  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
