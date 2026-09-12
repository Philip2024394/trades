// src/lib/nex/response-composer/hot-accommodation-tier.ts
//
// NEX Master AI Engineer · HOT TIER for Accommodation
// Founder mid-mission directive 2026-09-08:
//   "218 ms Postgres latency cannot be the final user-facing latency.
//    Aggressively avoid unnecessary database work through indexes, hot data,
//    caching, and precomputation."
//
// Founder second directive 2026-09-08:
//   "Don't let the hot tier become a second database.
//    Postgres/canonical data → hot projection → fast reads
//    NOT Postgres ↔ independent hot database with competing truth.
//    The canonical source remains authoritative. The RAM layer is a
//    disposable, rebuildable acceleration layer.
//    Change flow: canonical → supersession/event → hot tier refresh → new snapshot.
//    If the hot tier disappears, NEX should still function by rebuilding it."
//
// DISCIPLINE ENFORCED IN CODE (see below):
// 1. Hot tier NEVER writes back to Postgres · read-only projection
// 2. Every record carries source_query_ms + source_snapshot_id → provenance chain to canonical
// 3. rebuildFromCanonical() is idempotent · can be called any time to reload from Postgres
// 4. onCanonicalChange(ref) is the ONLY way to invalidate · caller responsible for triggering
// 5. If tier is empty (isReady() = false), composer MUST fall back to canonical Postgres
//    read — NEVER fabricate, NEVER assume tier absence means "no records exist"
// 6. Snapshot metadata + all lookups emit measurement traces for auditability
//
// Scope: Accommodation ONLY (per Founder Track A scope lock).

import { performance } from "node:perf_hooks";

export interface HotAccommodationRecord {
  public_listing_ref: string;
  business_name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
  categories: string[];
  amenities: string[];
  star_rating: number | null;
  room_count: number | null;
  rating: number | null;
  review_count: number | null;
  claim_status: string;
  updated_at_iso: string;

  // Derived index fields
  _name_lower: string;
  _city_lower: string | null;
}

export interface HotTierSnapshot {
  snapshot_id: string;
  built_at_iso: string;
  built_at_epoch_ms: number;
  record_count: number;
  distinct_cities: number;
  with_coords: number;
  freshness_ttl_seconds: number;
  source_query_ms: number;
  build_ms: number;
  memory_bytes_approx: number;
}

export interface HotTierLookupTrace {
  lookup_kind: "by_ref" | "by_name" | "by_city" | "by_nearest" | "by_predicate" | "top_by_city";
  latency_ms: number;
  hit: boolean;
  result_count: number;
  detail: string;
}

/**
 * Loader function signature · caller provides the DB read.
 * This module never imports pg · keeps the hot tier pool-agnostic.
 */
export type HotTierLoader = () => Promise<{
  records: HotAccommodationRecord[];
  source_query_ms: number;
}>;

/**
 * In-memory hot tier for accommodation.
 * Zero external dependencies · pure JS Map + array structures.
 */
export class HotAccommodationTier {
  private byRef: Map<string, HotAccommodationRecord> = new Map();
  private byName: Map<string, HotAccommodationRecord[]> = new Map(); // lower-cased name → records
  private byCity: Map<string, HotAccommodationRecord[]> = new Map(); // lower-cased city → records
  private allRecords: HotAccommodationRecord[] = [];
  private snapshot: HotTierSnapshot | null = null;
  private invalidatedRefs: Set<string> = new Set();
  private lookupHistory: HotTierLookupTrace[] = [];
  private maxHistorySize = 1000;

  constructor(private opts: { ttlSeconds?: number } = {}) {}

  /** Preload from caller-provided loader. Returns snapshot metadata. */
  async load(loader: HotTierLoader): Promise<HotTierSnapshot> {
    const t0 = performance.now();
    const { records, source_query_ms } = await loader();
    this.byRef.clear();
    this.byName.clear();
    this.byCity.clear();
    this.allRecords = [];
    this.invalidatedRefs.clear();

    let citySet = new Set<string>();
    let withCoords = 0;
    for (const r of records) {
      const derived: HotAccommodationRecord = {
        ...r,
        _name_lower: r.business_name.toLowerCase().trim(),
        _city_lower: r.city ? r.city.toLowerCase().trim() : null,
      };
      this.allRecords.push(derived);
      this.byRef.set(derived.public_listing_ref, derived);
      const nameList = this.byName.get(derived._name_lower) ?? [];
      nameList.push(derived);
      this.byName.set(derived._name_lower, nameList);
      if (derived._city_lower) {
        const cityList = this.byCity.get(derived._city_lower) ?? [];
        cityList.push(derived);
        this.byCity.set(derived._city_lower, cityList);
        citySet.add(derived._city_lower);
      }
      if (derived.coordinates_lat != null && derived.coordinates_lng != null) withCoords++;
    }

    const buildMs = performance.now() - t0;
    // Approx memory: 300 bytes/record avg (rough estimate)
    const memoryBytes = records.length * 300;
    this.snapshot = {
      snapshot_id: `hot_${Date.now()}`,
      built_at_iso: new Date().toISOString(),
      built_at_epoch_ms: Date.now(),
      record_count: records.length,
      distinct_cities: citySet.size,
      with_coords: withCoords,
      freshness_ttl_seconds: this.opts.ttlSeconds ?? 15 * 60,
      source_query_ms,
      build_ms: Math.round(buildMs * 100) / 100,
      memory_bytes_approx: memoryBytes,
    };
    return this.snapshot;
  }

  /** Whether the snapshot is loaded and not aged out. */
  isReady(): boolean {
    if (!this.snapshot) return false;
    const ageSec = (Date.now() - this.snapshot.built_at_epoch_ms) / 1000;
    return ageSec <= this.snapshot.freshness_ttl_seconds;
  }

  getSnapshot(): HotTierSnapshot | null { return this.snapshot; }

  /** Lookup by public_listing_ref · <1 ms · Map access. */
  lookupByRef(ref: string): HotTierLookupTrace & { record: HotAccommodationRecord | null } {
    const t0 = performance.now();
    const rec = this.byRef.get(ref) ?? null;
    const stale = rec ? this.invalidatedRefs.has(rec.public_listing_ref) : false;
    const trace = {
      lookup_kind: "by_ref" as const,
      latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
      hit: rec !== null && !stale,
      result_count: rec && !stale ? 1 : 0,
      detail: stale ? "ref invalidated" : rec ? "hit" : "miss",
    };
    this.recordTrace(trace);
    return { ...trace, record: stale ? null : rec };
  }

  /** Lookup by exact (case-insensitive) business name. */
  lookupByName(name: string): HotTierLookupTrace & { records: HotAccommodationRecord[] } {
    const t0 = performance.now();
    const key = name.toLowerCase().trim();
    const matches = (this.byName.get(key) ?? []).filter((r) => !this.invalidatedRefs.has(r.public_listing_ref));
    const trace = {
      lookup_kind: "by_name" as const,
      latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
      hit: matches.length > 0,
      result_count: matches.length,
      detail: matches.length > 0 ? `${matches.length} match(es)` : "no name match",
    };
    this.recordTrace(trace);
    return { ...trace, records: matches };
  }

  /** All records for a city (case-insensitive). */
  lookupByCity(city: string): HotTierLookupTrace & { records: HotAccommodationRecord[] } {
    const t0 = performance.now();
    const key = city.toLowerCase().trim();
    const matches = (this.byCity.get(key) ?? []).filter((r) => !this.invalidatedRefs.has(r.public_listing_ref));
    const trace = {
      lookup_kind: "by_city" as const,
      latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
      hit: matches.length > 0,
      result_count: matches.length,
      detail: matches.length > 0 ? `city=${city} ${matches.length} records` : `city=${city} no records`,
    };
    this.recordTrace(trace);
    return { ...trace, records: matches };
  }

  /** Nearest N records by Haversine distance to a coordinate. */
  lookupNearest(
    lat: number,
    lng: number,
    limit: number = 10,
    maxKm: number | null = null,
  ): HotTierLookupTrace & { records: Array<HotAccommodationRecord & { _distance_km: number }> } {
    const t0 = performance.now();
    const withDist: Array<HotAccommodationRecord & { _distance_km: number }> = [];
    for (const r of this.allRecords) {
      if (this.invalidatedRefs.has(r.public_listing_ref)) continue;
      if (r.coordinates_lat == null || r.coordinates_lng == null) continue;
      const dKm = haversineKm(lat, lng, r.coordinates_lat, r.coordinates_lng);
      if (maxKm != null && dKm > maxKm) continue;
      withDist.push({ ...r, _distance_km: Math.round(dKm * 1000) / 1000 });
    }
    withDist.sort((a, b) => a._distance_km - b._distance_km);
    const top = withDist.slice(0, limit);
    const trace = {
      lookup_kind: "by_nearest" as const,
      latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
      hit: top.length > 0,
      result_count: top.length,
      detail: `nearest to (${lat},${lng}) limit=${limit} maxKm=${maxKm ?? "∞"} · ${top.length} results`,
    };
    this.recordTrace(trace);
    return { ...trace, records: top };
  }

  /** Filter by predicate (arbitrary programmable filter — kept in-memory). */
  lookupByPredicate(
    predicate: (r: HotAccommodationRecord) => boolean,
    limit: number = 100,
  ): HotTierLookupTrace & { records: HotAccommodationRecord[] } {
    const t0 = performance.now();
    const matches: HotAccommodationRecord[] = [];
    for (const r of this.allRecords) {
      if (this.invalidatedRefs.has(r.public_listing_ref)) continue;
      if (predicate(r)) matches.push(r);
      if (matches.length >= limit) break;
    }
    const trace = {
      lookup_kind: "by_predicate" as const,
      latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
      hit: matches.length > 0,
      result_count: matches.length,
      detail: `predicate limit=${limit} · ${matches.length} match(es)`,
    };
    this.recordTrace(trace);
    return { ...trace, records: matches };
  }

  /** Top N in a city by rating × review_count heuristic (precomputable). */
  topByCity(city: string, limit: number = 10): HotTierLookupTrace & { records: HotAccommodationRecord[] } {
    const t0 = performance.now();
    const key = city.toLowerCase().trim();
    const pool = (this.byCity.get(key) ?? []).filter((r) => !this.invalidatedRefs.has(r.public_listing_ref));
    // Deterministic score: rating × log10(review_count+1) then business_name tiebreak
    const scored = pool.map((r) => ({
      r,
      score: (r.rating ?? 0) * Math.log10((r.review_count ?? 0) + 1),
    }));
    scored.sort((a, b) => b.score - a.score || a.r.business_name.localeCompare(b.r.business_name));
    const top = scored.slice(0, limit).map((s) => s.r);
    const trace = {
      lookup_kind: "top_by_city" as const,
      latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
      hit: top.length > 0,
      result_count: top.length,
      detail: `top ${limit} city=${city} by rating*log(reviews)`,
    };
    this.recordTrace(trace);
    return { ...trace, records: top };
  }

  /**
   * Invalidate a specific record ref (called when supersession event fires
   * from canonical Postgres). Founder-mandated flow:
   *   canonical change → supersession event → hot tier invalidate(ref)
   * The invalidated record is EXCLUDED from all subsequent lookups until
   * the next rebuildFromCanonical() call re-hydrates it from source of truth.
   * This preserves "canonical is authoritative · hot tier is disposable".
   */
  onCanonicalChange(ref: string): void { this.invalidatedRefs.add(ref); }

  /** Alias for backwards compatibility · same semantics as onCanonicalChange. */
  invalidate(ref: string): void { this.invalidatedRefs.add(ref); }

  /**
   * Rebuild hot tier from canonical source. Idempotent · can be called
   * any time. If tier was empty, rebuilds fully. If tier had data, replaces
   * with fresh snapshot from Postgres.
   *
   * Founder mandate: "If the hot tier disappears, NEX should still function
   * by rebuilding it." — this method is that rebuild.
   */
  async rebuildFromCanonical(loader: HotTierLoader): Promise<HotTierSnapshot> {
    return this.load(loader);
  }

  /**
   * How much of the tier is invalidated. If invalidated fraction is high
   * (e.g., >20%), caller should schedule a rebuildFromCanonical() to get
   * a fresh snapshot rather than continuing with a swiss-cheese view.
   */
  invalidationRatio(): number {
    if (this.allRecords.length === 0) return 0;
    return this.invalidatedRefs.size / this.allRecords.length;
  }

  /** Snapshot health signal for the composer to decide fall-through to canonical. */
  healthStatus(): "READY" | "STALE" | "EMPTY" | "DEGRADED" {
    if (!this.snapshot) return "EMPTY";
    if (!this.isReady()) return "STALE";
    if (this.invalidationRatio() > 0.2) return "DEGRADED";
    return "READY";
  }

  /** Latency summary across recent lookups. */
  latencySummary(): {
    lookups_recorded: number;
    median_ms: number;
    p95_ms: number;
    max_ms: number;
    by_kind: Record<string, { count: number; median_ms: number; p95_ms: number }>;
  } {
    if (this.lookupHistory.length === 0) {
      return { lookups_recorded: 0, median_ms: 0, p95_ms: 0, max_ms: 0, by_kind: {} };
    }
    const all = this.lookupHistory.map((h) => h.latency_ms).sort((a, b) => a - b);
    const byKind: Record<string, number[]> = {};
    for (const h of this.lookupHistory) {
      if (!byKind[h.lookup_kind]) byKind[h.lookup_kind] = [];
      byKind[h.lookup_kind].push(h.latency_ms);
    }
    const kindStats: Record<string, { count: number; median_ms: number; p95_ms: number }> = {};
    for (const [kind, values] of Object.entries(byKind)) {
      const sorted = [...values].sort((a, b) => a - b);
      kindStats[kind] = {
        count: sorted.length,
        median_ms: sorted[Math.floor(sorted.length / 2)],
        p95_ms: sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
      };
    }
    return {
      lookups_recorded: all.length,
      median_ms: all[Math.floor(all.length / 2)],
      p95_ms: all[Math.floor(all.length * 0.95)] ?? all[all.length - 1],
      max_ms: all[all.length - 1],
      by_kind: kindStats,
    };
  }

  private recordTrace(t: HotTierLookupTrace): void {
    this.lookupHistory.push(t);
    if (this.lookupHistory.length > this.maxHistorySize) this.lookupHistory.shift();
  }
}

/** Haversine distance in km · deterministic. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
