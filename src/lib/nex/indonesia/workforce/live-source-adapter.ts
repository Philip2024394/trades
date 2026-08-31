// live-source-adapter · bridges a proven LiveSourceConnector into
// the workforce as a first-class KnowledgeWalker.
//
// Stage C (Philip 2026-08-30) · hard boundaries:
//   · adapter only · does NOT re-implement any connector logic
//   · one source · BMKG earthquake · other connectors adapt later
//   · does NOT merge the live-source runtime and workforce architectures
//   · does NOT introduce a second EntityRecord path · records flow
//     through the same pipeline + publish-corpus every other walker uses
//   · preserves Tier-A provenance via inferSourceTier("BMKG") → "A"
//   · preserves the connector's own gating (NEX_LIVE_SOURCES_ENABLED
//     env flag, httpFetch timeouts + retries)
//
// Failure semantics · matches what the workforce already knows:
//   · LiveFetchError → adapter throws · workforce handleFailure applies
//     retry/backoff/breaker (existing behaviour, no new code path)
//   · Empty observation → returns [] · workforce treats as
//     "walker_returned_no_chunks" failure (existing behaviour) ·
//     protects against silent no-ops
//   · Disabled (env flag off) → propagates as failure so the operator
//     sees why the walker isn't producing

import type { KnowledgeWalker, RawFactChunk, KnowledgeDomain } from "../walkers/types";
import type { LiveSourceConnector, LiveObservation } from "../live/types";
import { isLiveFetchError } from "../live/types";
import type { EntityRecord } from "../data/types";
import { listProvinces } from "../data/geo";
import type { BudgetRegistry } from "../live/budget";

/**
 * Session-scoped cache of the raw EntityRecords produced by the most
 * recent successful acquire() per walker id. Populated by the adapter,
 * read by run-supervisor.mjs's custom onPublish so live-source records
 * can be published directly (via publishEntitiesDirect) rather than
 * round-tripping through the lossy RawFactChunk pipeline. Cleared
 * after each successful publish.
 *
 * Stage 3 (Philip 2026-08-31) · fixes the OSM fidelity bug where
 * migrateRecord derived names/categories from topic strings.
 */
const LIVE_SOURCE_LAST_ACQUIRE = new Map<string, EntityRecord[]>();

/** Read + clear the cached entities from the most recent acquire()
 *  for a walker. Returns [] when nothing cached. run-supervisor uses
 *  this to detect "this is a live-source walker" and publish directly. */
export function consumeLiveSourceEntities(walkerId: string): EntityRecord[] {
  const entities = LIVE_SOURCE_LAST_ACQUIRE.get(walkerId) ?? [];
  LIVE_SOURCE_LAST_ACQUIRE.delete(walkerId);
  return entities;
}

export type LiveSourceAdapterOptions = {
  /** Override the walker's KnowledgeDomain · defaults to "safety" for
   *  BMKG/MAGMA · override when adapting a non-safety live source. */
  domain?: KnowledgeDomain;
  /** Override the walker's refresh cadence in days (fractional OK).
   *  Defaults to connector.pollIntervalMs converted to days so the
   *  workforce respects the connector's declared polling rate. */
  refreshCadenceDays?: number;
  /** Override the walker id used by the workforce. Defaults to the
   *  connector's config.id. Set this when the taxonomy uses a
   *  different naming convention (e.g. walker.safety.earthquakes) so
   *  fleet-planner picks up the walker without renaming the connector. */
  walkerId?: string;
  /**
   * Optional BudgetRegistry · Stage-D accounting fix (Philip 2026-08-31).
   * When provided, every successful workforce acquisition through this
   * adapter records a poll against connector.config.id so HQ shows the
   * true poll count regardless of which runtime made the call.
   *
   * Does NOT enforce the budget · that would change workforce behaviour
   * (turn budget-exhausted into a walker failure, tripping circuit
   * breakers). Accounting only · same connector, same runtime, one
   * extra recordPoll call.
   */
  budget?: BudgetRegistry;
};

/**
 * Wrap a proven LiveSourceConnector as a workforce KnowledgeWalker.
 * The workforce pipeline (validate → dedupe → enrich → publish-corpus)
 * then handles the rest exactly as it does for fixture walkers.
 *
 * IMPORTANT · this adapter does NOT re-implement fetch(), parse(),
 * dedupe(), or provenance logic. It delegates to the existing connector.
 */
export function createLiveSourceWorker(
  connector: LiveSourceConnector,
  opts: LiveSourceAdapterOptions = {},
): KnowledgeWalker {
  const pollMs = connector.config.pollIntervalMs ?? 60_000;
  // Convert ms → days · workforce supervisor uses fractional days for
  // per-tick job scheduling.
  const defaultCadenceDays = pollMs / 86_400_000;
  return {
    id: opts.walkerId ?? connector.config.id,
    domain: opts.domain ?? "safety",
    defaultStability: "live",
    description: connector.config.description,
    refreshCadenceDays: opts.refreshCadenceDays ?? defaultCadenceDays,
    async acquire(): Promise<RawFactChunk[]> {
      const result = await connector.fetch();
      if (isLiveFetchError(result)) {
        // Throw so the workforce runOneCycle catches it and applies
        // retry/backoff/circuit-breaker · same behaviour as any other
        // walker failure. Reason is preserved for HQ + dead-letter.
        //
        // Failed polls are NOT recorded against the budget · the budget
        // measures actual HTTP calls that produced a response; a
        // pre-flight httpFetch("disabled") error never touched the wire.
        // (If we wanted rate-limit strictness we'd record all attempts ·
        // deferred to a future stage per the "accounting only" scope.)
        throw new Error(`live_source_${result.reason}${result.detail ? `:${result.detail.slice(0, 120)}` : ""}`);
      }
      // Successful poll · record against the persistent BudgetRegistry
      // when the adapter was constructed with one. Best-effort · never
      // block acquisition on a budget-write failure.
      if (opts.budget) {
        try { opts.budget.recordPoll(connector.config.id); }
        catch { /* accounting is best-effort · never break the walker */ }
      }
      // Stage 3 fidelity fix · stash the RAW EntityRecords so the
      // supervisor's onPublish can bypass the lossy chunk pipeline
      // and publish them directly. Keyed by the walker's public id
      // (walkerId option override respected).
      const walkerIdKey = opts.walkerId ?? connector.config.id;
      LIVE_SOURCE_LAST_ACQUIRE.set(walkerIdKey, result.entities);
      return liveObservationToChunks(result, connector);
    },
  };
}

/**
 * Convert a LiveObservation's EntityRecords into RawFactChunks the
 * workforce pipeline expects. This is a pure re-shape · the connector
 * already produced canonical EntityRecords with Tier-A provenance and
 * live freshness; we lift the fields the pipeline needs and let the
 * publisher round-trip them back through migrateRecord (which
 * re-derives Tier A from source="BMKG" via inferSourceTier).
 */
export function liveObservationToChunks(
  obs: LiveObservation,
  connector: LiveSourceConnector,
): RawFactChunk[] {
  const chunks: RawFactChunk[] = [];
  for (const e of obs.entities) {
    const chunk = entityToChunk(e, connector, obs.observedAt);
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function entityToChunk(
  e: EntityRecord,
  connector: LiveSourceConnector,
  fetchedAt: string,
): RawFactChunk | null {
  if (!e.id || !e.name) return null;
  const prov0 = e.provenance?.[0];
  const source = prov0?.sourceName ?? connector.config.kind.toUpperCase();
  const observedAt = prov0?.observedAt ?? fetchedAt;
  const content = e.description ?? e.name;
  const region = deriveRegionDisplay(e);
  // Topic keeps the entity's category + a slug from the id so
  // repeated observations of the SAME event get the same
  // topic|region key at pipeline dedupe.
  const topic = e.category
    ? `${e.category}:${e.id.replace(/[^a-z0-9]+/gi, "_")}`
    : `live.${connector.config.kind}:${e.id.replace(/[^a-z0-9]+/gi, "_")}`;
  return {
    externalId: e.id,
    domain: mapKindToDomain(e.kind, e.category),
    topic,
    region,
    language: "en",
    stability: "live",
    confidence: typeof e.quality?.overall === "number" ? e.quality.overall : 0.95,
    source,
    observedAt,
    content,
    keywords: e.keywords ?? [],
  };
}

function mapKindToDomain(kind: string, category?: string): KnowledgeDomain {
  if (category?.startsWith("safety.")) return "safety";
  if (category?.startsWith("food.")) return "food";
  if (category?.startsWith("geo.") || category?.startsWith("landmark.")) return "landmark";
  if (kind === "government") return "safety";
  if (kind === "place") return "landmark";
  return "practical";
}

function deriveRegionDisplay(e: EntityRecord): string {
  const slug = e.geo?.province;
  if (!slug) return "Indonesia";
  const p = listProvinces().find((pp) => pp.slug === slug);
  return p?.name ?? "Indonesia";
}
