// formRegistry — strategy-aware form templates.
//
// Every form declares the ResolvedStrategy facets it consumes.
// Registration validates facet references against facetKindRegistry.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { facetKindRegistry } from "@/platform/business/facets";
import type { FormManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of strategy-aware form templates. Each form declares business intent + facets it consumes.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 2 §Business OS / Forms",
    "Amendment 5 §RGP",
    "Amendment 7 §Playbooks"
  ],
  adrRefs: ["ADR-006", "ADR-017"],
  pmmImpact: "Business OS · Forms layer (10)",
  relationships: {
    businessOsLayer: 10,
    upstreamDependencies: [
      "designSystemRegistry",
      "facetKindRegistry",
      "strategyResolver"
    ],
    downstreamDependents: ["bookingRegistry", "sectionRegistry", "appRegistry"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type FormRegistration = FormManifest & RegistrationBase;
type FrozenFormRegistration = Frozen<FormRegistration>;

const inner = createRegistry<FormRegistration>({
  label: "formRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for form "${m.slug}".`);
    if (!m.purpose) throw new Error(`form "${m.slug}" must declare purpose.`);
    if (!m.intent) throw new Error(`form "${m.slug}" must declare intent.`);
    if (!Array.isArray(m.fields) || m.fields.length === 0)
      throw new Error(`form "${m.slug}" must declare at least one field.`);
    const seenKeys = new Set<string>();
    for (const field of m.fields) {
      if (seenKeys.has(field.key))
        throw new Error(
          `form "${m.slug}" has duplicate field key "${field.key}".`
        );
      seenKeys.add(field.key);
    }
    if (m.steps) {
      const validKeys = new Set(m.fields.map((f) => f.key));
      for (const step of m.steps) {
        for (const key of step.fieldKeys) {
          if (!validKeys.has(key))
            throw new Error(
              `form "${m.slug}" step "${step.key}" references unknown field "${key}".`
            );
        }
      }
    }
    if (!m.submit) throw new Error(`form "${m.slug}" must declare submit.`);
    // Every declared facet must be a registered facet kind.
    for (const facet of m.consumesFacets) {
      if (!facetKindRegistry.has(facet.kind)) {
        throw new Error(
          `form "${m.slug}" consumes unknown facet kind "${facet.kind}".`
        );
      }
    }
  },
  indexes: {
    byPurpose: (m) => [m.purpose],
    byTrade: (m) => m.appliesTo.trades
  }
});

function normalise(m: FormManifest): FormRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.purpose,
    tags: [
      m.purpose,
      ...m.appliesTo.trades,
      m.submit.kind,
      ...(m.steps ? ["multi-step"] : ["single-page"]),
      ...m.consumesFacets.map((f) => f.kind)
    ],
    searchKeywords: [m.description, m.purpose, m.intent, ...m.appliesTo.trades],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const formRegistry = {
  register(manifest: FormManifest): FrozenFormRegistration {
    return inner.register(normalise(manifest));
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
  listByPurpose(purpose: string) {
    return inner.listByIndex("byPurpose", purpose);
  },
  listByTrade(tradeSlug: string) {
    return [
      ...inner.listByIndex("byTrade", tradeSlug),
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
  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
