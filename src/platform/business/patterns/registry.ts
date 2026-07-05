// patternRegistry — Stage 2 of the Business Evidence Framework.
//
// Confidence is DERIVED from underlying evidence — never hand-set.
// Confidence formula:
//   base = weighted mean of EVIDENCE_STATE_WEIGHT across
//          supportingEvidence
//   corroboration_boost = min(0.15, 0.02 * corroborationCount_avg)
//   confidence_0_1 = base + corroboration_boost, clamped to [0, 1]
//   confidence_0_100 = round(confidence_0_1 * 100)

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { evidenceRegistry } from "../evidence/registry";
import { EVIDENCE_STATE_WEIGHT } from "../evidence/types";
import type { PatternManifest } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Aggregated conclusions drawn from multiple evidence findings. Confidence derived from underlying evidence, never hand-set. Stage 2 of the Business Evidence Framework.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7 §Business Growth Intelligence"],
  adrRefs: ["ADR-027", "ADR-028"],
  pmmImpact:
    "Business OS · Layer 1 · Evidence Engine. Consumed by playbookRegistry as rationale + strategyExplainer as Why.",
  relationships: {
    businessOsLayer: 1,
    upstreamDependencies: ["evidenceRegistry"],
    downstreamDependents: ["playbookRegistry", "strategyExplainer"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type PatternRegistration = PatternManifest & RegistrationBase;
type FrozenPatternRegistration = Frozen<PatternRegistration>;

const inner = createRegistry<PatternRegistration>({
  label: "patternRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for pattern "${m.slug}".`
      );
    }
    if (!m.statement?.trim()) {
      throw new Error(`pattern "${m.slug}" must declare statement.`);
    }
    if (!m.supportingEvidence?.length) {
      throw new Error(
        `pattern "${m.slug}" must cite at least one piece of supporting evidence.`
      );
    }
    for (const evSlug of m.supportingEvidence) {
      if (!evidenceRegistry.has(evSlug)) {
        throw new Error(
          `pattern "${m.slug}" cites unknown evidence "${evSlug}". Register evidence first.`
        );
      }
    }
  },
  indexes: {
    byStatus: (m) => [m.candidacy.status],
    byTrade: (m) => m.scope.trades,
    byCountry: (m) => m.scope.countries,
    byFacet: (m) => m.informsFacetKinds ?? []
  }
});

function computeConfidence(pattern: PatternManifest): number {
  const weights: number[] = [];
  const corroborationCounts: number[] = [];
  for (const evSlug of pattern.supportingEvidence) {
    const ev = evidenceRegistry.get(evSlug);
    if (!ev) continue;
    weights.push(EVIDENCE_STATE_WEIGHT[ev.validation.state]);
    corroborationCounts.push(ev.validation.corroborationCount);
  }
  if (!weights.length) return 0;
  const base =
    weights.reduce((a, b) => a + b, 0) / weights.length;
  const avgCorroboration =
    corroborationCounts.reduce((a, b) => a + b, 0) /
    corroborationCounts.length;
  const boost = Math.min(0.15, 0.02 * avgCorroboration);
  const raw = Math.min(1, base + boost);
  return Math.round(raw * 100);
}

function normalise(m: PatternManifest): PatternRegistration {
  return {
    ...m,
    id: m.slug,
    name: m.title,
    description: m.statement,
    category: m.candidacy.status,
    tags: [
      m.candidacy.status,
      ...(m.tags ?? []),
      ...m.scope.trades,
      ...m.scope.countries
    ],
    searchKeywords: [m.title, m.statement, ...(m.tags ?? [])],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const patternRegistry = {
  register(m: PatternManifest): FrozenPatternRegistration {
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
  listByStatus(status: PatternManifest["candidacy"]["status"]) {
    return inner.listByIndex("byStatus", status);
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
  },
  /** Derived confidence for a pattern — computed live from underlying
   *  evidence so it always reflects current validation state. */
  confidenceOf(slug: string): number {
    const p = inner.get(slug);
    if (!p) return 0;
    return computeConfidence(p);
  }
};
