// Journey Registry — Decision Engine.
//
// M3 · Batch 8 · Subsystem #3 of the 14-step AI Composition Engine v2.
//
// Every journey self-describes its urgency, trade fit, primary goals,
// and conversion character. The AI composer calls `.rank(input)`
// which returns scored candidates — never guesses. `.selectFor(input)`
// returns the top scoring journey (or undefined if none scored above
// zero).
//
// See M3_PLATFORM_CORE.md §6 "AI Composition Engine v2 flow", step 3.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  FrozenJourneyManifest,
  JourneyManifest,
  JourneyRankInput
} from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Decision engine for customer-journey templates. Composer scores against merchant intent to pick a 3-5 stage plan before layout selection.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 2 §Business OS / Journeys",
    "Amendment 5 §RGP",
    "Amendment 6 §Layer 5"
  ],
  adrRefs: [],
  pmmImpact: "AI Composition Engine — step 3 (Customer Journey)",
  relationships: {
    businessOsLayer: 5,
    upstreamDependencies: [],
    downstreamDependents: ["layoutRegistry", "sectionRegistry"],
    composition: "intermediate",
    pluginCompatible: true
  }
};

type JourneyRegistration = JourneyManifest & RegistrationBase;
type FrozenJourneyRegistration = Frozen<JourneyRegistration>;

const inner = createRegistry<JourneyRegistration>({
  label: "journeyRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for journey "${m.slug}".`
      );
    }
    if (!m.name || !m.tagline || !m.description) {
      throw new Error(`journey "${m.slug}" missing name/tagline/description.`);
    }
    if (!Array.isArray(m.stages) || m.stages.length < 2 || m.stages.length > 6) {
      throw new Error(
        `journey "${m.slug}" must declare 2..6 stages (got ${m.stages?.length ?? 0}).`
      );
    }
    if (!Array.isArray(m.pageSet) || m.pageSet.length === 0) {
      throw new Error(
        `journey "${m.slug}" must declare a non-empty pageSet (at minimum "home").`
      );
    }
    if (!m.pageSet.some((p) => p.id === "home" && p.required)) {
      throw new Error(
        `journey "${m.slug}" pageSet must include a required "home" page.`
      );
    }
    if (!m.chrome || typeof m.chrome !== "object") {
      throw new Error(`journey "${m.slug}" must declare a chrome block.`);
    }
    for (const stage of m.stages) {
      if (!stage.id || !stage.role || !stage.purpose) {
        throw new Error(
          `journey "${m.slug}" has a stage missing id/role/purpose.`
        );
      }
      if (
        !Array.isArray(stage.primarySectionRoles) ||
        stage.primarySectionRoles.length === 0
      ) {
        throw new Error(
          `journey "${m.slug}" stage "${stage.id}" must declare at least one primarySectionRole.`
        );
      }
    }
    if (!m.decision) {
      throw new Error(`journey "${m.slug}" must declare a decision profile.`);
    }
    for (const score of [
      m.decision.mobileSuitability,
      m.decision.urgencyFit
    ]) {
      if (score < 0 || score > 100) {
        throw new Error(
          `journey "${m.slug}" scored suitability must be 0..100.`
        );
      }
    }
  },
  indexes: {
    byUrgency: (m) => [m.decision.urgency],
    byTrade: (m) => m.decision.worksBestFor,
    byGoal: (m) => m.decision.bestGoals as readonly string[],
    byCharacter: (m) => [m.decision.conversionCharacter]
  }
});

function normalise(m: JourneyManifest): JourneyRegistration {
  return {
    ...m,
    id: m.slug,
    tags: [
      m.category,
      m.decision.urgency,
      m.decision.conversionCharacter,
      ...m.decision.worksBestFor,
      ...(m.decision.bestGoals as readonly string[])
    ],
    searchKeywords: [
      m.tagline,
      m.category,
      ...m.decision.keywords,
      ...(m.decision.bestGoals as readonly string[])
    ],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

/** Scoring formula — points per matching dimension. Reasons surfaced
 *  so composer can explain the pick to the merchant. */
function scoreJourney(
  reg: FrozenJourneyRegistration,
  input: JourneyRankInput
): { score: number; reasons: string[] } {
  const d = reg.decision;
  let score = 0;
  const reasons: string[] = [];

  // Trade match — the strongest signal.
  if (input.trade) {
    if (d.worksBestFor.includes(input.trade)) {
      score += 50;
      reasons.push(`designed for ${input.trade}`);
    } else if (d.worksBestFor.includes("*")) {
      score += 10;
      reasons.push("universal fit");
    }
  }

  // Urgency match — anchors the pick for emergency vs planned traffic.
  if (input.urgency) {
    if (input.urgency === d.urgency) {
      score += 35;
      reasons.push(`${d.urgency} urgency match`);
    } else if (
      (input.urgency === "planned" && d.urgency === "browse") ||
      (input.urgency === "browse" && d.urgency === "planned")
    ) {
      score += 8;
      reasons.push(`compatible urgency (${d.urgency})`);
    } else {
      score -= 15;
      reasons.push(`urgency mismatch (${d.urgency} vs ${input.urgency})`);
    }
  }

  // Business-goal overlap.
  if (input.goals && input.goals.length > 0) {
    const declared = new Set(d.bestGoals);
    let matched = 0;
    for (const g of input.goals) if (declared.has(g)) matched += 1;
    if (matched > 0) {
      score += matched * 15;
      reasons.push(`matches ${matched} goal(s)`);
    }
  }

  // Feature wants — journey stage roles hint capability.
  const stageRoles = new Set(reg.stages.map((s) => s.role));
  if (input.wantsBooking && stageRoles.has("action")) {
    score += 10;
    reasons.push("supports booking action");
  }
  if (input.wantsPortfolio && stageRoles.has("consider")) {
    score += 8;
    reasons.push("supports portfolio consider stage");
  }
  const stageIds = new Set(reg.stages.map((s) => s.id));
  if (input.wantsEcommerce && (stageIds.has("cart") || stageIds.has("checkout"))) {
    score += 12;
    reasons.push("ecommerce-ready");
  }
  if (input.wantsSearch && stageIds.has("search")) {
    score += 10;
    reasons.push("search-anchored");
  }

  // Conversion character preference — small edge on match.
  if (
    input.preferredCharacter &&
    input.preferredCharacter === d.conversionCharacter
  ) {
    score += 6;
    reasons.push(`${d.conversionCharacter} character`);
  }

  // Keyword overlap — tie-breaker.
  if (input.keywords && input.keywords.length > 0) {
    const declared = new Set(d.keywords);
    let matched = 0;
    for (const k of input.keywords) if (declared.has(k)) matched += 1;
    if (matched > 0) {
      score += matched * 2;
      reasons.push(`${matched} keyword(s)`);
    }
  }

  // Suitability bonus — journeys stronger on urgency + mobile get an edge.
  const strengths = (d.mobileSuitability + d.urgencyFit) / 20;
  score += strengths;

  return { score, reasons };
}

export const journeyRegistry = {
  register(manifest: JourneyManifest): FrozenJourneyRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenJourneyRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenJourneyRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenJourneyRegistration[] {
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

  /** Score every registered journey and return sorted matches. */
  rank(
    input: JourneyRankInput
  ): Array<{
    journey: FrozenJourneyRegistration;
    score: number;
    reasons: readonly string[];
  }> {
    return inner
      .list()
      .map((journey) => {
        const { score, reasons } = scoreJourney(journey, input);
        return { journey, score, reasons };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  },

  /** Top-scoring journey. Undefined when nothing scores above zero. */
  selectFor(input: JourneyRankInput): FrozenJourneyManifest | undefined {
    return this.rank(input)[0]?.journey;
  },

  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};
