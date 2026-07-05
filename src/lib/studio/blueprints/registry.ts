// Blueprint Registry — singleton store.
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit. All 52
// existing blueprint manifests self-register unchanged; every existing
// caller (browser, wizard, recommender, installer, preview iframe)
// works verbatim.
//
// Domain-specific method preserved: `.rank(input)` — the weighted
// recommender formula from PRD §7.2.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  BlueprintManifest,
  BlueprintRankInput,
  BlueprintRankResult,
  DesignVariant,
  FrozenBlueprintManifest,
  OutcomeSlug
} from "./types";
import { DESIGN_VARIANTS, OUTCOME_SLUGS } from "./types";

type BlueprintRegistration = BlueprintManifest & RegistrationBase;
type FrozenBlueprintRegistration = Frozen<BlueprintRegistration>;

const inner = createRegistry<BlueprintRegistration>({
  label: "blueprintRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for "${m.slug}".`
      );
    }
    if (!m.name || !m.tagline || !m.description) {
      throw new Error(
        `"${m.slug}" missing name/tagline/description.`
      );
    }
    if (m.trades.length === 0) {
      throw new Error(
        `"${m.slug}" must target at least one trade.`
      );
    }
    if (m.outcomes.length === 0) {
      throw new Error(
        `"${m.slug}" must claim at least one outcome.`
      );
    }
    for (const outcome of m.outcomes) {
      if (!(OUTCOME_SLUGS as readonly string[]).includes(outcome)) {
        throw new Error(
          `"${m.slug}" has unknown outcome "${outcome}".`
        );
      }
    }
    if (!(DESIGN_VARIANTS as readonly string[]).includes(m.variant)) {
      throw new Error(
        `"${m.slug}" has unknown variant "${m.variant}".`
      );
    }
    if (!m.layout.home || m.layout.home.length === 0) {
      throw new Error(
        `"${m.slug}" home layout must have at least one section.`
      );
    }
    const dims: Array<keyof typeof m.score> = [
      "conversion",
      "seo",
      "trust",
      "mobile",
      "accessibility",
      "speed"
    ];
    for (const d of dims) {
      const v = m.score[d];
      if (typeof v !== "number" || v < 0 || v > 100) {
        throw new Error(
          `"${m.slug}" score.${String(d)} must be 0..100`
        );
      }
    }
  },
  indexes: {
    byTrade: (m) => m.trades,
    byOutcome: (m) => m.outcomes as readonly string[],
    byVariant: (m) => [m.variant]
  }
});

function normalise(m: BlueprintManifest): BlueprintRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.variant,
    tags: [...m.trades, ...m.outcomes as string[]],
    searchKeywords: [m.tagline, ...m.trades, ...m.outcomes as string[]]
  };
}

export const blueprintRegistry = {
  register(manifest: BlueprintManifest): FrozenBlueprintRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenBlueprintRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenBlueprintRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenBlueprintRegistration[] {
    return inner.list();
  },
  listByTrade(tradeSlug: string): FrozenBlueprintRegistration[] {
    return inner.listByIndex("byTrade", tradeSlug);
  },
  listByOutcome(outcome: OutcomeSlug): FrozenBlueprintRegistration[] {
    return inner.listByIndex("byOutcome", outcome);
  },
  listByVariant(variant: DesignVariant): FrozenBlueprintRegistration[] {
    return inner.listByIndex("byVariant", variant);
  },
  size(): number {
    return inner.size();
  },

  // ─── Domain-specific ranking (preserved verbatim) ───────────────
  //
  // Ranking formula from PRD §7.2:
  //   0.30 * outcomeMatch
  // + 0.20 * tradeMatch
  // + 0.20 * credentialCoverage
  // + 0.15 * scoreVsMerchantWeights
  // + 0.10 * peerPopularity           (0 in v1)
  // + 0.05 * recency                  (0 in v1)
  rank(input: BlueprintRankInput): BlueprintRankResult[] {
    const wizardOutcomes = new Set(input.wizardOutcomes ?? []);
    const held = new Set(input.heldCredentials ?? []);
    const peer = input.peerPopularity ?? new Map<string, number>();
    return inner
      .list()
      .map((manifest) => {
        const reasons: string[] = [];

        let outcomeMatch = 0;
        if (wizardOutcomes.size > 0) {
          const overlap = manifest.outcomes.filter((o) =>
            wizardOutcomes.has(o)
          ).length;
          outcomeMatch = overlap / manifest.outcomes.length;
          if (overlap > 0) reasons.push(`matches ${overlap} outcome(s)`);
        }

        let tradeMatch = 0;
        if (input.merchantTradeSlug) {
          const idx = manifest.trades.indexOf(input.merchantTradeSlug);
          if (idx === 0) {
            tradeMatch = 1;
            reasons.push("designed for your trade");
          } else if (idx > 0) {
            tradeMatch = 0.5;
            reasons.push("compatible with your trade");
          }
        }

        let credentialCoverage = 1;
        const required = manifest.requiredCredentials ?? [];
        if (required.length > 0) {
          const covered = required.filter((c) => held.has(c)).length;
          credentialCoverage = covered / required.length;
          if (covered === required.length && covered > 0) {
            reasons.push("all verified badges available");
          } else if (covered > 0) {
            reasons.push(`${covered}/${required.length} badges available`);
          }
        }

        const scoreProxy = manifest.score.conversion / 100;
        const peerScore = peer.get(manifest.slug) ?? 0;
        if (peerScore >= 0.5) reasons.push("installed by many peers");

        const score =
          0.3 * outcomeMatch +
          0.2 * tradeMatch +
          0.2 * credentialCoverage +
          0.15 * scoreProxy +
          0.1 * peerScore +
          0;

        return { manifest, score, reasons };
      })
      .sort((a, b) => b.score - a.score);
  },

  // ─── New surface inherited from the kit ─────────────────────────
  search: inner.search,
  describe: inner.describe,
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

// Legacy type re-export.
export type { FrozenBlueprintManifest };
