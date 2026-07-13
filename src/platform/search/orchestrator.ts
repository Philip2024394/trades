// Platform Universal Search Orchestrator.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  A universal search bar is a shell primitive. If
//    each App shipped its own search, users would search products in
//    Marketplace but couldn't find a merchant, an order, a message,
//    or a doc in the same box. The orchestrator fans out to every
//    App's declared providers and aggregates results.
//
// 2. Which future Apps benefit?  Every App that declares
//    `searchProviders`. Marketplace (products / merchants /
//    categories), Orders (order ids / delivery ref), Messages
//    (thread search), Knowledge (docs), Users (trades directory),
//    Fleet (drivers / vans). One search, N result kinds.
//
// 3. Which doc authorises?  ADR-041 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Universal Search orchestrator" + TRADE_CENTER_
//    PLATFORM_ARCHITECTURE.md §8 "Universal Search".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Zero registration state. Discovery + orchestration reads from the
// AppManifest's `searchProviders` declarations at query time. Real
// provider handlers (lazy-loaded from manifest handler paths) run in
// parallel; the orchestrator merges, groups, and ranks by declared
// weight. Intent classification (Haiku) lands as ADR-041b in wave 2.

import { appRegistry } from "@/platform/registry";
import { emitBaseline } from "@/platform/telemetry/baseline";
import type { SearchProviderDeclaration } from "@/platform/manifest/types";

// ─── Types ─────────────────────────────────────────────────────

export type SearchResult = {
  /** Unique id — usually `<appSlug>.<kind>.<local-id>`. */
  id: string;
  /** Group the row falls under — matches provider `kind`. */
  kind: SearchProviderDeclaration["kind"];
  /** Rendered title. */
  title: string;
  /** Optional subtitle / muted line. */
  subtitle?: string;
  /** Destination href (or a `command:<id>` scheme for palette-style
   *  actions). */
  href?: string;
  /** Ranking score 0–1 assigned by the provider. */
  score: number;
  /** App that produced the result — always attached. */
  appSlug: string;
  /** Optional structured payload the caller may render inline. */
  payload?: unknown;
};

export type SearchGroup = {
  kind: SearchProviderDeclaration["kind"];
  label: string;
  results: SearchResult[];
};

export type UniversalSearchResponse = {
  query: string;
  groups: SearchGroup[];
  totalResults: number;
  timings: {
    totalMs: number;
    providerTimings: Array<{ providerId: string; ms: number; ok: boolean }>;
  };
};

// ─── Discovery ────────────────────────────────────────────────

export type DiscoveredSearchProvider = SearchProviderDeclaration & {
  appSlug: string;
  appName: string;
};

export function discoverSearchProviders(): DiscoveredSearchProvider[] {
  const out: DiscoveredSearchProvider[] = [];
  for (const app of appRegistry.list()) {
    if (!app.searchProviders?.length) continue;
    for (const sp of app.searchProviders) {
      out.push({ ...sp, appSlug: app.slug, appName: app.name });
    }
  }
  return out;
}

// ─── Provider handler resolution ──────────────────────────────

type ProviderHandler = (q: string) => Promise<SearchResult[]>;

const handlerRegistry = new Map<string, ProviderHandler>();

/** Register a handler for a declared provider. In production the
 *  runtime resolves this lazily from the manifest's `handler` module
 *  path. For Week 2 verification, handlers register directly. */
export function registerProviderHandler(
  providerId: string,
  handler: ProviderHandler
): void {
  handlerRegistry.set(providerId, handler);
}

// ─── Orchestration ────────────────────────────────────────────

const GROUP_LABEL: Record<SearchProviderDeclaration["kind"], string> = {
  products: "Products",
  merchants: "Merchants",
  categories: "Categories",
  actions: "Actions",
  content: "Content",
  files: "Files",
  users: "Users"
};

/** Fan out to every discovered search provider, merge + rank +
 *  group. Silent for query strings shorter than 2 chars. */
export async function universalSearch(
  query: string
): Promise<UniversalSearchResponse> {
  const t0 = Date.now();
  const trimmed = query.trim();
  const providers = discoverSearchProviders();

  const providerTimings: Array<{ providerId: string; ms: number; ok: boolean }> = [];

  if (trimmed.length < 2 || providers.length === 0) {
    return {
      query: trimmed,
      groups: [],
      totalResults: 0,
      timings: { totalMs: Date.now() - t0, providerTimings }
    };
  }

  // Fan-out
  const providerResults = await Promise.all(
    providers.map(async (p) => {
      const handler = handlerRegistry.get(p.id);
      const p0 = Date.now();
      if (!handler) {
        providerTimings.push({ providerId: p.id, ms: 0, ok: false });
        return [] as SearchResult[];
      }
      try {
        const rows = await handler(trimmed);
        providerTimings.push({ providerId: p.id, ms: Date.now() - p0, ok: true });
        // Apply provider weight to each row's score.
        return rows.map((r) => ({ ...r, score: r.score * p.weight, appSlug: p.appSlug }));
      } catch {
        providerTimings.push({ providerId: p.id, ms: Date.now() - p0, ok: false });
        return [] as SearchResult[];
      }
    })
  );

  const flat = providerResults.flat();

  // Group by kind
  const groupsMap = new Map<SearchProviderDeclaration["kind"], SearchResult[]>();
  for (const row of flat) {
    const list = groupsMap.get(row.kind) ?? [];
    list.push(row);
    groupsMap.set(row.kind, list);
  }

  // Sort within each group by score desc, keep top 5 per group
  const groups: SearchGroup[] = [];
  for (const [kind, rows] of groupsMap) {
    const sorted = rows.sort((a, b) => b.score - a.score).slice(0, 5);
    groups.push({ kind, label: GROUP_LABEL[kind], results: sorted });
  }

  // Emit telemetry per invocation
  emitBaseline("plugin.search.queried", 1, {
    app: "shell",
    provider_count: String(providers.length),
    hit_count: String(flat.length)
  });

  return {
    query: trimmed,
    groups,
    totalResults: flat.length,
    timings: { totalMs: Date.now() - t0, providerTimings }
  };
}

/** Reset — used by the verification harness. */
export function resetSearchOrchestratorForTests(): void {
  handlerRegistry.clear();
}
