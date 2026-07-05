// playbookRegistry — the reusable intelligence catalogue.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { evidenceRegistry } from "../evidence/registry";
import { facetKindRegistry } from "../facets";
import { patternRegistry } from "../patterns/registry";
import type { PlaybookManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Reusable single-concern intelligence patterns. Each playbook contributes typed facets. Composed by recipes; merged by StrategyResolver.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7 §Playbooks"],
  adrRefs: ["ADR-017"],
  pmmImpact:
    "Business OS · Layer 1 · Business intelligence patterns spanning Sections, SEO, CTA, Marketing, Automation.",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: ["facetKindRegistry"],
    downstreamDependents: ["websiteRecipeRegistry", "strategyResolver"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type PlaybookRegistration = PlaybookManifest & RegistrationBase;
type FrozenPlaybookRegistration = Frozen<PlaybookRegistration>;

const inner = createRegistry<PlaybookRegistration>({
  label: "playbookRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for playbook "${m.slug}".`);
    if (!m.facets || Object.keys(m.facets).length === 0)
      throw new Error(`playbook "${m.slug}" must contribute at least one facet.`);
    // Every facet kind referenced must exist in facetKindRegistry.
    for (const kind of Object.keys(m.facets)) {
      if (!facetKindRegistry.has(kind)) {
        throw new Error(
          `playbook "${m.slug}" contributes to unknown facet kind "${kind}". Register it in facetKindRegistry first.`
        );
      }
    }
    if (m.evidence.confidence < 0 || m.evidence.confidence > 100)
      throw new Error(`playbook "${m.slug}" confidence must be 0..100.`);
    // If rationale cites patterns or evidence, they must exist.
    if (m.rationale) {
      for (const slug of m.rationale.citesPatterns ?? []) {
        if (!patternRegistry.has(slug)) {
          throw new Error(
            `playbook "${m.slug}" rationale cites unknown pattern "${slug}".`
          );
        }
      }
      for (const slug of m.rationale.citesEvidence ?? []) {
        if (!evidenceRegistry.has(slug)) {
          throw new Error(
            `playbook "${m.slug}" rationale cites unknown evidence "${slug}".`
          );
        }
      }
    }
  },
  indexes: {
    byCategory: (m) => [m.category],
    byTrade: (m) => m.appliesTo.trades,
    byGoal: (m) => m.appliesTo.growthGoals ?? [],
    byFlag: (m) => m.appliesTo.profileFlags ?? []
  }
});

function normalise(m: PlaybookManifest): PlaybookRegistration {
  return {
    ...m,
    id: m.slug,
    tags: [
      m.category,
      m.evidence.evidenceStrength,
      ...(m.appliesTo.profileFlags ?? []),
      ...m.appliesTo.trades
    ],
    searchKeywords: [m.description, m.category, ...m.appliesTo.trades],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const playbookRegistry = {
  register(m: PlaybookManifest): FrozenPlaybookRegistration {
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
  listByCategory(cat: string) {
    return inner.listByIndex("byCategory", cat);
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

  /** Weighted rank against profile + strategy. Evidence dimensions
   *  contribute weight (higher when validated). Placeholder for the
   *  M6 evidenceRegistry integration. */
  rank(input: {
    trade?: string;
    profileFlags?: readonly string[];
    growthGoals?: readonly string[];
    country?: string;
  }): FrozenPlaybookRegistration[] {
    return inner
      .list()
      .map((p) => {
        let score = 0;
        if (input.trade) {
          if (p.appliesTo.trades.includes(input.trade)) score += 30;
          else if (p.appliesTo.trades.includes("*")) score += 8;
        }
        for (const flag of input.profileFlags ?? []) {
          if (p.appliesTo.profileFlags?.includes(flag)) score += 15;
        }
        for (const goal of input.growthGoals ?? []) {
          if (p.appliesTo.growthGoals?.includes(goal)) score += 20;
        }
        if (
          input.country &&
          p.appliesTo.countries?.includes(input.country)
        )
          score += 12;
        // Evidence weighting.
        score += p.evidence.confidence * 0.05;
        if (p.evidence.evidenceStrength === "validated") score += 10;
        else if (p.evidence.evidenceStrength === "measured") score += 5;
        return { p, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.p);
  },

  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
