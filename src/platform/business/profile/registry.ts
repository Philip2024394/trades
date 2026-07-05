// businessProfileRegistry — the merchant identity catalogue.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { BusinessProfileManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of merchant identity templates. Per-merchant instances persist in studio_business_profile.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 2 §Layer 1", "Amendment 7"],
  adrRefs: ["ADR-016"],
  pmmImpact: "Business OS · Layer 1 · Business Profile",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: ["knowledgePackageRegistry"],
    downstreamDependents: [
      "growthStrategyRegistry",
      "websiteRecipeRegistry",
      "playbookRegistry"
    ],
    composition: "root",
    pluginCompatible: true
  }
};

type BusinessProfileRegistration = BusinessProfileManifest & RegistrationBase;
type FrozenBusinessProfileRegistration = Frozen<BusinessProfileRegistration>;

const inner = createRegistry<BusinessProfileRegistration>({
  label: "businessProfileRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for profile "${m.slug}".`);
    if (!m.trade || !m.country || !m.currency)
      throw new Error(`profile "${m.slug}" missing trade/country/currency.`);
    if (m.primaryServices.length === 0)
      throw new Error(`profile "${m.slug}" must declare primaryServices.`);
  },
  indexes: {
    byTrade: (m) => [m.trade],
    byCountry: (m) => [m.country],
    byPositioning: (m) => [m.positioning]
  }
});

function normalise(
  m: BusinessProfileManifest
): BusinessProfileRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.positioning,
    tags: [
      m.trade,
      m.country,
      m.positioning,
      m.customerType,
      m.size,
      ...(m.isPremium ? ["premium"] : []),
      ...(m.isLuxury ? ["luxury"] : []),
      ...(m.isEmergency ? ["emergency"] : []),
      ...(m.isCommercial ? ["commercial"] : []),
      ...(m.isResidential ? ["residential"] : [])
    ],
    searchKeywords: [
      m.description,
      m.trade,
      ...m.primaryServices,
      ...(m.secondaryServices ?? [])
    ],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const businessProfileRegistry = {
  register(m: BusinessProfileManifest): FrozenBusinessProfileRegistration {
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
    return inner.listByIndex("byTrade", trade);
  },
  listByCountry(country: string) {
    return inner.listByIndex("byCountry", country);
  },
  listByPositioning(pos: string) {
    return inner.listByIndex("byPositioning", pos);
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
