// Layout Registry — Decision Engine.
//
// Not a catalogue. A DECISION ENGINE. Every layout self-describes its
// business fit, structural rules, feature support, navigation
// preferences, and conversion character. The AI composer calls
// `.rank(input)` which returns scored candidates — never guesses.
//
// See ADR-011 (layouts vs blueprints) and the M3 architecture pack.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { LayoutManifest, LayoutRankInput } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Decision engine for page-scale layout patterns. Every layout self-describes business fit; composer scores against merchant intent.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 2 §Business OS / Layouts",
    "Amendment 5 §RGP",
    "Amendment 6 §Layer 5"
  ],
  adrRefs: ["ADR-011"],
  pmmImpact: "Business OS · Layouts layer + AI Composition Engine",
  relationships: {
    businessOsLayer: 5,
    upstreamDependencies: [
      "designSystemRegistry",
      "sectionRegistry",
      "navigationRegistry",
      "themeRegistry"
    ],
    downstreamDependents: ["blueprintRegistry", "appRegistry"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type LayoutRegistration = LayoutManifest & RegistrationBase;
type FrozenLayoutRegistration = Frozen<LayoutRegistration>;

const inner = createRegistry<LayoutRegistration>({
  label: "layoutRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for layout "${m.slug}".`
      );
    }
    if (!m.name || !m.tagline || !m.description) {
      throw new Error(`layout "${m.slug}" missing name/tagline/description.`);
    }
    if (!Array.isArray(m.sequence) || m.sequence.length === 0) {
      throw new Error(`layout "${m.slug}" must declare a non-empty sequence.`);
    }
    for (const step of m.sequence) {
      if (!step.containerId) {
        throw new Error(
          `layout "${m.slug}" has a sequence step missing containerId.`
        );
      }
      if (!step.role) {
        throw new Error(
          `layout "${m.slug}" has a sequence step missing role.`
        );
      }
    }
    if (!m.decision) {
      throw new Error(
        `layout "${m.slug}" must declare a decision profile.`
      );
    }
    const d = m.decision;
    if (m.sequence.length < d.minSections || m.sequence.length > d.maxSections) {
      throw new Error(
        `layout "${m.slug}" sequence length ${m.sequence.length} is outside declared bounds [${d.minSections}, ${d.maxSections}].`
      );
    }
    for (const score of [
      d.mobileSuitability,
      d.seoStrength,
      d.conversionStrength,
      d.trustSignalStrength
    ]) {
      if (score < 0 || score > 100) {
        throw new Error(
          `layout "${m.slug}" scored suitability must be 0..100.`
        );
      }
    }
  },
  indexes: {
    byTrade: (m) => m.decision.worksBestFor,
    byIndustry: (m) => m.decision.bestIndustries,
    byGoal: (m) => m.decision.primaryGoals as readonly string[],
    byHeroType: (m) => [m.decision.heroType]
  }
});

function normalise(m: LayoutManifest): LayoutRegistration {
  return {
    ...m,
    id: m.slug,
    tags: [
      m.category,
      m.decision.heroType,
      m.decision.imageDensity,
      m.decision.pageLength,
      ...m.decision.worksBestFor,
      ...m.decision.bestIndustries,
      ...(m.decision.primaryGoals as readonly string[])
    ],
    searchKeywords: [
      m.tagline,
      m.category,
      ...m.decision.keywords,
      ...m.decision.primaryGoals as readonly string[]
    ],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

/** Scoring formula. Points awarded per matching dimension. Reason
 *  strings surfaced so the composer can explain the pick. */
function scoreLayout(
  reg: FrozenLayoutRegistration,
  input: LayoutRankInput
): { score: number; reasons: string[] } {
  const d = reg.decision;
  let score = 0;
  const reasons: string[] = [];

  // Hard filters — if merchant sets a minimum threshold, layouts that
  // fail it score 0 immediately.
  if (
    input.minMobileSuitability &&
    d.mobileSuitability < input.minMobileSuitability
  )
    return { score: 0, reasons: ["fails mobile suitability floor"] };
  if (input.minSeoStrength && d.seoStrength < input.minSeoStrength)
    return { score: 0, reasons: ["fails SEO strength floor"] };
  if (
    input.minConversionStrength &&
    d.conversionStrength < input.minConversionStrength
  )
    return { score: 0, reasons: ["fails conversion strength floor"] };

  // Trade match
  if (input.trade) {
    if (d.worksBestFor.includes(input.trade)) {
      score += 50;
      reasons.push(`designed for ${input.trade}`);
    } else if (d.worksBestFor.includes("*")) {
      score += 10;
      reasons.push("universal fit");
    }
  }

  // Industry match
  if (input.industry && d.bestIndustries.includes(input.industry)) {
    score += 30;
    reasons.push(`strong for ${input.industry}`);
  }

  // Business goals overlap
  if (input.goals && input.goals.length > 0) {
    const declared = new Set(d.primaryGoals);
    let matched = 0;
    for (const g of input.goals) if (declared.has(g)) matched += 1;
    if (matched > 0) {
      score += matched * 20;
      reasons.push(`matches ${matched} goal(s)`);
    }
  }

  // Feature support
  const wantMap: [keyof LayoutRankInput, keyof typeof d, string][] = [
    ["wantsBooking", "supportsBooking", "booking-ready"],
    ["wantsEcommerce", "supportsEcommerce", "ecommerce-ready"],
    ["wantsPortfolio", "supportsPortfolio", "portfolio-ready"],
    ["wantsSearch", "supportsSearch", "search-anchored"],
    ["wantsMap", "supportsMap", "map-integrated"],
    ["wantsFloatingCta", "supportsFloatingCta", "floating-cta"]
  ];
  for (const [wantKey, supportKey, reason] of wantMap) {
    if (input[wantKey] && d[supportKey]) {
      score += 15;
      reasons.push(reason);
    } else if (input[wantKey] && !d[supportKey]) {
      score -= 10;
      reasons.push(`missing ${reason}`);
    }
  }

  // Preference matches
  if (input.preferredImageDensity === d.imageDensity) {
    score += 8;
    reasons.push(`${d.imageDensity} image density`);
  }
  if (input.preferredHero === d.heroType) {
    score += 12;
    reasons.push(`${d.heroType} hero`);
  }
  if (input.preferredPageLength === d.pageLength) {
    score += 6;
    reasons.push(`${d.pageLength} length`);
  }

  // Keyword overlap
  if (input.keywords && input.keywords.length > 0) {
    const declared = new Set(d.keywords);
    let matched = 0;
    for (const k of input.keywords) if (declared.has(k)) matched += 1;
    if (matched > 0) {
      score += matched * 3;
      reasons.push(`${matched} keyword(s)`);
    }
  }

  // Suitability bonus — layouts stronger on the dimensions the composer
  // pushes get a small edge.
  const strengths = (d.mobileSuitability + d.seoStrength + d.conversionStrength + d.trustSignalStrength) / 40;
  score += strengths;

  return { score, reasons };
}

export const layoutRegistry = {
  register(manifest: LayoutManifest): FrozenLayoutRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenLayoutRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenLayoutRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenLayoutRegistration[] {
    return inner.list();
  },
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  listByIndex: inner.listByIndex,
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

  /** Score every registered layout against the merchant intent and
   *  return sorted results. Highest score first. Empty return = no
   *  candidate scored above 0. */
  rank(
    input: LayoutRankInput
  ): Array<{
    layout: FrozenLayoutRegistration;
    score: number;
    reasons: readonly string[];
  }> {
    return inner
      .list()
      .map((layout) => {
        const { score, reasons } = scoreLayout(layout, input);
        return { layout, score, reasons };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  },

  /** Convenience: top-scoring layout, or undefined if none scores. */
  recommend(input: LayoutRankInput): FrozenLayoutRegistration | undefined {
    return this.rank(input)[0]?.layout;
  },

  /** Domain-specific: expose the relationship graph from metadata. */
  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
