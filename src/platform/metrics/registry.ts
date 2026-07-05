// metricRegistry — reusable metric definitions.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { MetricManifest, MetricValue } from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Universal metric definitions. Consumed by dashboards, reports, AI assistants, benchmarking, notifications, automation rules, monthly summaries.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 2 §Layer 11", "Amendment 7"],
  adrRefs: [],
  pmmImpact: "Business OS · Dashboard + Analytics layers",
  relationships: {
    businessOsLayer: 11,
    upstreamDependencies: [],
    downstreamDependents: [
      "dashboardBlockRegistry",
      "appRegistry"
    ],
    composition: "root",
    pluginCompatible: true
  }
};

type MetricRegistration = MetricManifest & RegistrationBase;
type FrozenMetricRegistration = Frozen<MetricRegistration>;

const inner = createRegistry<MetricRegistration>({
  label: "metricRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for metric "${m.slug}".`);
    if (!m.kind || !m.unit || !m.aggregation)
      throw new Error(`metric "${m.slug}" missing kind/unit/aggregation.`);
  },
  indexes: {
    byCategory: (m) => [m.category],
    byTrade: (m) => m.relevantTo.trades,
    byGoal: (m) => m.relevantTo.goals
  }
});

function normalise(m: MetricManifest): MetricRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.category,
    tags: [
      m.category,
      m.kind,
      m.unit,
      ...m.relevantTo.trades,
      ...m.relevantTo.goals
    ],
    searchKeywords: [m.description, m.kind, m.unit],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const metricRegistry = {
  register(m: MetricManifest): FrozenMetricRegistration {
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
  listByGoal(goal: string) {
    return inner.listByIndex("byGoal", goal);
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

  /** Rank metrics by relevance to a strategy. Placeholder — M6/M8
   *  evidenceRegistry will improve this. */
  rank(input: {
    trade?: string;
    goals?: readonly string[];
    profileFlags?: readonly string[];
    limit?: number;
  }): FrozenMetricRegistration[] {
    const results = inner
      .list()
      .map((m) => {
        let score = 0;
        if (input.trade) {
          if (m.relevantTo.trades.includes(input.trade)) score += 30;
          else if (m.relevantTo.trades.includes("*")) score += 10;
        }
        for (const goal of input.goals ?? []) {
          if (m.relevantTo.goals.includes(goal)) score += 25;
        }
        for (const flag of input.profileFlags ?? []) {
          if (m.relevantTo.profileFlags?.includes(flag)) score += 12;
        }
        return { m, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.m);
    return input.limit ? results.slice(0, input.limit) : results;
  },

  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};

/** Mock value generator — used until the analytics warehouse (M8+)
 *  lands. Deterministic per metric slug so previews are stable. */
export function mockValueFor(slug: string): MetricValue {
  const seed = [...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const raw = Math.abs(seed % 5000) + 12;
  const deltaAbs = Math.abs(seed % 400) - 200;
  const deltaPct = deltaAbs === 0 ? 0 : (deltaAbs / raw) * 100;
  const m = metricRegistry.get(slug);
  const formatted = formatMetric(raw, m);
  return {
    metricSlug: slug,
    raw,
    formatted,
    window: m?.defaultWindow ?? { days: 7, label: "7d" },
    delta: {
      absolute: deltaAbs,
      percent: Math.round(deltaPct * 10) / 10,
      direction: deltaAbs > 0 ? "up" : deltaAbs < 0 ? "down" : "flat",
      label: "vs prev period"
    }
  };
}

function formatMetric(raw: number, m: FrozenMetricRegistration | undefined): string {
  const f = m?.format;
  const prefix = f?.prefix ?? "";
  const suffix = f?.suffix ?? (m?.unit === "percent" ? "%" : "");
  const decimals = f?.decimals ?? 0;
  const compact =
    f?.compact ?? (m?.unit === "count" && raw > 999);
  let value: string;
  if (compact && raw >= 1000) {
    value = (raw / 1000).toFixed(raw >= 10000 ? 0 : 1) + "k";
  } else {
    value = raw.toFixed(decimals);
  }
  return `${prefix}${value}${suffix}`;
}
