// tradeIntelligenceRegistry — the moat.
//
// Registered at Layer 1 alongside profile / strategy / facets /
// playbooks / recipes. Structured KNOWLEDGE per trade, consumed by
// the resolver BEFORE playbook merging.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { TradeIntelligenceManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Structured trade-specific knowledge. Business goals, service economics, image strategy, trust builders, SEO templates, FAQs, seasonality — encoded as data, per trade. The moat.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7 §Business Growth Intelligence"],
  adrRefs: ["ADR-025"],
  pmmImpact:
    "Business OS · Layer 1 · Trade Intelligence. Cascades into every downstream layer.",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: [],
    downstreamDependents: [
      "playbookRegistry",
      "websiteRecipeRegistry",
      "strategyResolver",
      "strategyExplainer"
    ],
    composition: "leaf",
    pluginCompatible: true
  }
};

type TradeRegistration = TradeIntelligenceManifest & RegistrationBase;
type FrozenTradeRegistration = Frozen<TradeRegistration>;

const inner = createRegistry<TradeRegistration>({
  label: "tradeIntelligenceRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for trade "${m.slug}".`
      );
    }
    if (!m.businessGoals?.length) {
      throw new Error(`trade "${m.slug}" must declare at least one business goal.`);
    }
    if (!m.services?.length) {
      throw new Error(`trade "${m.slug}" must declare at least one service.`);
    }
    if (!m.imageStrategy?.priorityOrder?.length) {
      throw new Error(`trade "${m.slug}" must declare imageStrategy.priorityOrder.`);
    }
    if (m.imageStrategy.galleryMix) {
      const sum = Object.values(m.imageStrategy.galleryMix).reduce(
        (a, b) => a + b,
        0
      );
      if (Math.abs(sum - 100) > 1) {
        throw new Error(
          `trade "${m.slug}" galleryMix must sum to 100 (got ${sum}).`
        );
      }
    }
    if (m.evidence.confidence < 0 || m.evidence.confidence > 100) {
      throw new Error(`trade "${m.slug}" evidence.confidence must be 0..100.`);
    }
    // Cross-check business goals reference declared services.
    const serviceSlugs = new Set(m.services.map((s) => s.slug));
    for (const goal of m.businessGoals) {
      for (const service of goal.pushesServices) {
        if (!serviceSlugs.has(service)) {
          throw new Error(
            `trade "${m.slug}" goal "${goal.slug}" pushes service "${service}" not declared in services[].`
          );
        }
      }
    }
  },
  indexes: {
    byCountry: (m) => m.countries,
    byAlias: (m) => m.aliases ?? []
  }
});

function normalise(m: TradeIntelligenceManifest): TradeRegistration {
  return {
    ...m,
    id: m.slug,
    category: "trade-intelligence",
    tags: [
      "trade-intelligence",
      m.evidence.strength,
      ...m.countries,
      ...(m.aliases ?? [])
    ],
    searchKeywords: [m.description, m.name, ...(m.aliases ?? [])],
    author: m.publisher?.name ?? "Xrated Trades Platform",
    aliases: m.aliases
  };
}

export const tradeIntelligenceRegistry = {
  register(m: TradeIntelligenceManifest): FrozenTradeRegistration {
    return inner.register(normalise(m));
  },
  get(slug: string): FrozenTradeRegistration | undefined {
    // Try direct + alias.
    const direct = inner.get(slug);
    if (direct) return direct;
    const [byAlias] = inner.listByIndex("byAlias", slug);
    return byAlias;
  },
  getOrThrow(slug: string): FrozenTradeRegistration {
    const found = this.get(slug);
    if (!found) throw new Error(`no trade intelligence for "${slug}".`);
    return found;
  },
  has(slug: string): boolean {
    return this.get(slug) !== undefined;
  },
  list(): FrozenTradeRegistration[] {
    return inner.list();
  },
  listByCountry(country: string): FrozenTradeRegistration[] {
    return inner.listByIndex("byCountry", country);
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
  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
