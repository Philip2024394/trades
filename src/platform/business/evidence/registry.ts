// evidenceRegistry — Stage 1 of the Business Evidence Framework.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  EvidenceFindingManifest,
  EvidenceValidationState
} from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Structured findings — one atomic observation each — with typed source, scope, validation lifecycle, and reviewer audit trail. Stage 1 of the Business Evidence Framework.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7 §Business Growth Intelligence"],
  adrRefs: ["ADR-027"],
  pmmImpact:
    "Business OS · Layer 1 · Evidence Engine. Feeds patternRegistry.",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: [],
    downstreamDependents: [
      "patternRegistry",
      "playbookRegistry",
      "strategyExplainer"
    ],
    composition: "leaf",
    pluginCompatible: true
  }
};

type EvidenceRegistration = EvidenceFindingManifest & RegistrationBase;
type FrozenEvidenceRegistration = Frozen<EvidenceRegistration>;

const inner = createRegistry<EvidenceRegistration>({
  label: "evidenceRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for evidence "${m.slug}".`
      );
    }
    if (!m.observation?.trim()) {
      throw new Error(`evidence "${m.slug}" must declare observation.`);
    }
    if (!m.source?.citation?.trim()) {
      throw new Error(`evidence "${m.slug}" must declare source.citation.`);
    }
    if (!m.scope?.trades?.length) {
      throw new Error(`evidence "${m.slug}" must declare scope.trades.`);
    }
    if (!m.scope?.countries?.length) {
      throw new Error(`evidence "${m.slug}" must declare scope.countries.`);
    }
    if (m.validation.corroborationCount < 0) {
      throw new Error(
        `evidence "${m.slug}" corroborationCount must be >= 0.`
      );
    }
    // Reviewers audit-trail sanity.
    for (const r of m.validation.reviews) {
      if (!r.reviewer?.trim() || !r.reviewedAt?.trim()) {
        throw new Error(
          `evidence "${m.slug}" review missing reviewer/reviewedAt.`
        );
      }
    }
  },
  indexes: {
    byState: (m) => [m.validation.state],
    bySource: (m) => [m.source.kind],
    byTrade: (m) => m.scope.trades,
    byCountry: (m) => m.scope.countries,
    byFacet: (m) => m.informsFacetKinds ?? [],
    byPlaybook: (m) => m.supportsPlaybooks ?? []
  }
});

function normalise(m: EvidenceFindingManifest): EvidenceRegistration {
  return {
    ...m,
    id: m.slug,
    name: m.title,
    description: m.observation,
    category: m.source.kind,
    tags: [
      m.source.kind,
      m.validation.state,
      ...(m.tags ?? []),
      ...m.scope.trades,
      ...m.scope.countries
    ],
    searchKeywords: [m.title, m.observation, ...(m.tags ?? [])],
    author: m.publisher?.name ?? m.source.collectedBy
  };
}

export const evidenceRegistry = {
  register(m: EvidenceFindingManifest): FrozenEvidenceRegistration {
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
  listByState(state: EvidenceValidationState) {
    return inner.listByIndex("byState", state);
  },
  listBySource(source: string) {
    return inner.listByIndex("bySource", source);
  },
  listByTrade(trade: string) {
    return inner.listByIndex("byTrade", trade);
  },
  listByCountry(country: string) {
    return inner.listByIndex("byCountry", country);
  },
  listByFacet(facetKind: string) {
    return inner.listByIndex("byFacet", facetKind);
  },
  listByPlaybook(playbookSlug: string) {
    return inner.listByIndex("byPlaybook", playbookSlug);
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
