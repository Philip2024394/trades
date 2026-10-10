// src/lib/nex-agent/code-engine/capability-source-selection.ts
//
// NEX · Source-Aware Retrieval Selector · S4 · 2026-09-21.
// Founder-authorised as part of the "Internet as External Knowledge
// Substrate" programme.
//
// PURPOSE
//
//   NEX does NOT "just search the web". Given a specific information
//   need, NEX picks the appropriate allowlisted external source (or
//   an internal source) using a deterministic mapping.
//
//   This module encodes that mapping in one canonical table and
//   exposes a pure decision function selectSourcesForClass(class).
//
// ANTI-CHEATING GUARANTEE
//
//   · Pure declaration + one pure function.
//   · The mapping references source identifiers that already exist
//     in capability-evidence-status.ts SOURCE_RELIABILITY and in
//     src/lib/nex/lab/internet-gate.ts LAB_ALLOWLIST_HOSTS. Adding
//     a source elsewhere without registering it here means NEX
//     cannot select it — deliberate.
//   · Sources are ordered inside a mapping · index 0 is primary,
//     later entries are secondary/cross-check.
//   · An unregistered information class returns an empty list,
//     signalling to the KNOW-or-LOOK layer that no external source
//     is available for this class → verdict falls to INSUFFICIENT.
//
// COMPOSITION
//
//   capability-know-or-look.ts consults `hasSourceForClass()` when
//   computing `external_source_available`. capability-chat-turn.ts
//   consults `selectSourcesForClass()` when dispatching a retrieval.

import type { InformationClass } from "./capability-freshness-policy";

// ── Source identifier ─────────────────────────────────────────────────
//
// Identifiers match capability-evidence-status.ts SOURCE_RELIABILITY
// keys. `internal:*` denotes NEX-owned stores rather than external
// URLs. Anything not in this union cannot be selected.

export type SourceIdentifier =
  // External · allowlisted
  | "nominatim.openstreetmap.org"
  | "query.wikidata.org"
  | "overpass-api.de"
  | "bmkg.go.id"
  | "kemenparekraf.go.id"
  // Internal · NEX-owned
  | "internal:conversation_head"
  | "internal:retained_knowledge_store"
  | "internal:source_outcome_ledger"
  | "internal:nex.accommodation_business";

export interface SourceMapping {
  readonly info_class: InformationClass | "project_knowledge" | "multi_source_geographic";
  readonly sources_in_priority_order: readonly SourceIdentifier[];
  readonly rationale: string;
}

// ── Canonical mapping table ───────────────────────────────────────────

export const SOURCE_MAPPING_TABLE: readonly SourceMapping[] = [
  {
    info_class: "weather_current",
    sources_in_priority_order: ["bmkg.go.id"],
    rationale: "BMKG is the Indonesian government meteorological service · authoritative · currently the only allowlisted weather source.",
  },
  {
    info_class: "geographic_coordinates",
    sources_in_priority_order: ["nominatim.openstreetmap.org", "query.wikidata.org", "overpass-api.de"],
    rationale: "Nominatim primary geodata · Wikidata + Overpass as cross-checks · used by Wave B / K2 multi-source lookup.",
  },
  {
    info_class: "multi_source_geographic",
    sources_in_priority_order: ["nominatim.openstreetmap.org", "query.wikidata.org", "overpass-api.de"],
    rationale: "Alias for the geographic_coordinates class when the caller explicitly wants all three sources fired in parallel (Wave B).",
  },
  {
    info_class: "historical_fact",
    sources_in_priority_order: ["query.wikidata.org"],
    rationale: "Wikidata carries structured historical claims with P-property provenance.",
  },
  {
    info_class: "public_documentation",
    sources_in_priority_order: ["kemenparekraf.go.id"],
    rationale: "Currently the only allowlisted public-documentation source (Indonesian tourism ministry).",
  },
  {
    info_class: "project_knowledge",
    sources_in_priority_order: ["internal:conversation_head", "internal:retained_knowledge_store"],
    rationale: "Project / personal knowledge is NEX-owned · never fetched externally.",
  },
  // Classes that HAVE a freshness policy but currently NO permitted
  // source. Deliberately empty so KNOW-or-LOOK reports INSUFFICIENT
  // honestly rather than pretending we can look.
  {
    info_class: "prices_currency_market",
    sources_in_priority_order: [],
    rationale: "No allowlisted price/market source today. Honest gap: KNOW-or-LOOK will report INSUFFICIENT when asked about live prices.",
  },
  {
    info_class: "public_transport_status",
    sources_in_priority_order: [],
    rationale: "No allowlisted real-time transit source today. Honest gap.",
  },
  {
    info_class: "opening_hours",
    sources_in_priority_order: [],
    rationale: "No allowlisted general opening-hours source today. Nominatim carries some but coverage is uneven — do not claim it as authoritative.",
  },
  {
    info_class: "regulations_laws",
    sources_in_priority_order: [],
    rationale: "No allowlisted regulatory source today. This class combined with 'always_verify' freshness means NEX must ALWAYS report INSUFFICIENT for regulatory questions until a governance action adds an authoritative source.",
  },
];

// ── Decision functions ────────────────────────────────────────────────

const MAPPING_BY_CLASS: ReadonlyMap<string, SourceMapping> = new Map(
  SOURCE_MAPPING_TABLE.map((m) => [m.info_class as string, m]),
);

/** Return the ordered list of sources for the class, or [] if none. */
export function selectSourcesForClass(info_class: string): readonly SourceIdentifier[] {
  const mapping = MAPPING_BY_CLASS.get(info_class);
  return mapping ? mapping.sources_in_priority_order : [];
}

/** True iff at least one permitted source is registered for the class. */
export function hasSourceForClass(info_class: string): boolean {
  return selectSourcesForClass(info_class).length > 0;
}

/** Full mapping (for the KNOW-or-LOOK layer to log or audit). */
export function describeSourcesForClass(info_class: string): SourceMapping | null {
  return MAPPING_BY_CLASS.get(info_class) ?? null;
}

// ── M2 · Learned source ranking · Phase 4 · 2026-09-21 ─────────────
//
// Given the static source-selection table AND the source-outcome
// ledger's aggregates, return a reordered list of the SAME sources
// that reflects their actual per-class performance. The static table
// remains the governance boundary — learned ranking may reorder its
// entries but CANNOT introduce new sources.
//
// Ranking formula (deterministic, no ML):
//
//   score = 0.60 * success_rate
//         + 0.20 * recency_bonus         // last_seen within 7 days = 1.0, older decays linearly to 0 at 90 days
//         + 0.20 * (1 - disagreement_rate)
//
// A source with no ledger history retains its static-table position
// (no penalty for being new).
//
// Sources with zero total_calls stay at their static position too.
// This prevents a source that has never been tried from being pushed
// down forever · it needs a chance to accumulate outcomes first.

export interface LearnedRankingInputs {
  readonly info_class: string;
  readonly aggregates: readonly {
    readonly source_identifier: string;
    readonly info_class: string;
    readonly total: number;
    readonly by_outcome: Readonly<Record<string, number>>;
    readonly success_rate: number;
    readonly last_seen_iso: string | null;
  }[];
  readonly now_ms?: number;
}

export interface LearnedRankingResult {
  readonly info_class: string;
  readonly static_order: readonly SourceIdentifier[];
  readonly learned_order: readonly SourceIdentifier[];
  readonly reordered: boolean;
  readonly per_source_scores: readonly {
    readonly source: SourceIdentifier;
    readonly total: number;
    readonly success_rate: number;
    readonly recency_bonus: number;
    readonly disagreement_penalty: number;
    readonly composite: number;
    readonly note: string;
  }[];
}

const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENCY_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function selectSourcesForClassLearned(inputs: LearnedRankingInputs): LearnedRankingResult {
  const now = inputs.now_ms ?? Date.now();
  const staticOrder = selectSourcesForClass(inputs.info_class);
  if (staticOrder.length === 0) {
    return {
      info_class: inputs.info_class,
      static_order: staticOrder,
      learned_order: staticOrder,
      reordered: false,
      per_source_scores: [],
    };
  }
  const perSource = staticOrder.map((source, idx) => {
    const agg = inputs.aggregates.find((a) => a.source_identifier === source && a.info_class === inputs.info_class);
    if (!agg || agg.total === 0) {
      return {
        source,
        total: 0,
        success_rate: 0,
        recency_bonus: 0,
        disagreement_penalty: 0,
        composite: NaN, // NaN sentinel · sources with no data hold static position
        note: `no ledger history · holds static position (rank ${idx + 1})`,
      };
    }
    // Recency: full bonus (1.0) inside RECENCY_WINDOW_MS; linear decay
    // to 0 by RECENCY_MAX_AGE_MS.
    let recency = 0;
    if (agg.last_seen_iso) {
      const age = Math.max(0, now - Date.parse(agg.last_seen_iso));
      if (age <= RECENCY_WINDOW_MS) recency = 1;
      else if (age <= RECENCY_MAX_AGE_MS) {
        recency = 1 - (age - RECENCY_WINDOW_MS) / (RECENCY_MAX_AGE_MS - RECENCY_WINDOW_MS);
      }
    }
    const disagreementCount = (agg.by_outcome as any)?.disagreement ?? 0;
    const disagreementRate = agg.total === 0 ? 0 : disagreementCount / agg.total;
    const composite =
      0.60 * agg.success_rate +
      0.20 * recency +
      0.20 * (1 - disagreementRate);
    return {
      source,
      total: agg.total,
      success_rate: Number(agg.success_rate.toFixed(3)),
      recency_bonus: Number(recency.toFixed(3)),
      disagreement_penalty: Number(disagreementRate.toFixed(3)),
      composite: Number(composite.toFixed(3)),
      note: `n=${agg.total} · learned score ${composite.toFixed(3)}`,
    };
  });
  // Reorder: sources with a real composite score sort by score
  // descending; sources with NaN (no history) preserve their static
  // relative order and interleave after scored sources.
  const scored = perSource.filter((s) => !Number.isNaN(s.composite));
  const unscored = perSource.filter((s) => Number.isNaN(s.composite));
  scored.sort((a, b) => b.composite - a.composite);
  // Learned order = scored (by composite) + unscored (in static order)
  const learnedOrder = [...scored.map((s) => s.source), ...unscored.map((s) => s.source)] as readonly SourceIdentifier[];
  const reordered = learnedOrder.some((s, i) => s !== staticOrder[i]);
  return {
    info_class: inputs.info_class,
    static_order: staticOrder,
    learned_order: learnedOrder,
    reordered,
    per_source_scores: perSource,
  };
}

export function emitLearnedRankingTrace(result: LearnedRankingResult): string {
  return `source_selection · class=${result.info_class} · reordered=${result.reordered} · static=[${result.static_order.join(",")}] · learned=[${result.learned_order.join(",")}]`;
}

// ── Inventory ─────────────────────────────────────────────────────────

export interface SourceSelectionInventory {
  readonly total_classes: number;
  readonly classes_with_sources: number;
  readonly classes_without_sources: readonly string[];
  readonly external_source_universe: readonly SourceIdentifier[];
  readonly internal_source_universe: readonly SourceIdentifier[];
}

export function inventorySourceSelection(): SourceSelectionInventory {
  const withSources: string[] = [];
  const withoutSources: string[] = [];
  const external = new Set<SourceIdentifier>();
  const internal = new Set<SourceIdentifier>();
  for (const m of SOURCE_MAPPING_TABLE) {
    if (m.sources_in_priority_order.length > 0) {
      withSources.push(m.info_class);
    } else {
      withoutSources.push(m.info_class);
    }
    for (const s of m.sources_in_priority_order) {
      if (s.startsWith("internal:")) internal.add(s);
      else external.add(s);
    }
  }
  return {
    total_classes: SOURCE_MAPPING_TABLE.length,
    classes_with_sources: withSources.length,
    classes_without_sources: withoutSources,
    external_source_universe: Array.from(external).sort() as readonly SourceIdentifier[],
    internal_source_universe: Array.from(internal).sort() as readonly SourceIdentifier[],
  };
}
