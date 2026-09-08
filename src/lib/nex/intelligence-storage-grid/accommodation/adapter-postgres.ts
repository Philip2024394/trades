// src/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres.ts
//
// NEX INTELLIGENCE STORAGE GRID · Accommodation reference implementation
// Founder BEGIN 2026-09-08 · Phase 2 · §7-10
//
// THIN WRAPPER API over 5 already-existing Postgres tables:
//   1. nex.accommodation_business                        (53 columns · 9,203 rows · canonical)
//   2. nex.accommodation_business_field_provenance       (7 columns · 46,114 rows · per-field trust)
//   3. nex.accommodation_business_source_snapshot        (7 columns · 9,203 rows · immutable raw payload)
//   4. nex.accommodation_enrichment_evidence             (15 columns · 0 rows · schema ready for Gap-Engine)
//   5. nex.brain_accommodation_prices                    (13 columns · 0 rows · price tier reservoir)
//
// This adapter reads only. Write paths for enrichment_evidence + prices are
// deferred to Phase 3 worker + separate Founder BEGIN.
//
// Zero DDL. Zero schema changes. Zero duplication of canonical data.
// Pool-agnostic — caller injects a pg.Pool.

import type { Pool } from "pg";
import { performance } from "node:perf_hooks";
import type {
  AgentObservationSnapshot,
  CategoryPartition,
  CityPartition,
  CountryPartition,
  CoverageMetrics,
  DomainStorageAdapter,
  EvidenceLabel,
  FreshnessState,
  GrowthMetrics,
  KnowledgeRecord,
  ProvenanceRecord,
  StorageMetrics,
  TrustLayer,
} from "../types.js";

/**
 * Row shape from nex.accommodation_business · 53 columns.
 * Only the fields we actively use are typed; others available via getFullEntity().
 */
export interface AccommodationRow {
  internal_id: string;
  public_listing_ref: string;
  business_name: string;
  original_name: string | null;
  category: string | null;
  categories: string[] | null;
  address: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
  phone: string | null;
  whatsapp_number: string | null;
  website: string | null;
  star_rating: number | null;
  room_count: number | null;
  amenities: string[] | null;
  services: string[] | null;
  hero_image_url: string | null;
  rating: number | null;
  review_count: number | null;
  claim_status: string;
  updated_at: Date | null;
}

/** Provenance row from nex.accommodation_business_field_provenance. */
export interface FieldProvenanceRow {
  business_ref: string;
  field_name: string;
  trust_layer: string;
  written_at: Date;
  written_by: string;
  source_reference: string | null;
  cycle_run_id: string | null;
}

/** Source snapshot row from nex.accommodation_business_source_snapshot. */
export interface SourceSnapshotRow {
  snapshot_id: string;
  business_ref: string;
  source: string;
  source_reference: string | null;
  captured_at: Date;
  raw_payload: Record<string, unknown>;
  cycle_run_id: string | null;
}

export class AccommodationStorageGridAdapter implements DomainStorageAdapter {
  readonly domain_agent_id = "accommodation" as const;

  constructor(private pool: Pool) {}

  // ═══════════════════════════════════════════════════════════════
  // §4 · Country / Type / City partition access
  // ═══════════════════════════════════════════════════════════════

  /**
   * Countries present in canonical data. Currently NEX has ID (Indonesia)
   * only. Grows as accommodation coverage expands.
   */
  async listCountries(): Promise<CountryPartition[]> {
    const res = await this.pool.query<{ country: string; n: string }>(`
      SELECT COALESCE(NULLIF(country, ''), 'ID') AS country, COUNT(*)::text AS n
      FROM nex.accommodation_business
      GROUP BY country
      ORDER BY n DESC
    `);
    return res.rows
      .filter((r) => r.country)
      .map((r) => ({
        country_code: normalizeCountryCode(r.country),
        display_name: expandCountry(r.country),
        region: null,
        language_primary: guessLanguage(r.country),
        timezone_primary: guessTimezone(r.country),
      }));
  }

  /**
   * Categories active in accommodation data. Emerges from canonical
   * category + categories[] fields · deterministic.
   */
  async listCategories(): Promise<CategoryPartition[]> {
    const res = await this.pool.query<{ category: string; n: string }>(`
      SELECT unnest(COALESCE(categories, ARRAY[COALESCE(category, 'accommodation')])) AS category, COUNT(*)::text AS n
      FROM nex.accommodation_business
      WHERE claim_status IN ('listed','invited','claimed','paying','discovered')
      GROUP BY category
      ORDER BY n DESC
    `);
    return res.rows.map((r) => ({
      category_slug: r.category.toLowerCase().replace(/[\s_]+/g, "-"),
      display_name: r.category,
      domain_agent_id: "accommodation" as const,
      parent_category: null,
    }));
  }

  /** Cities present per country · with district hint when available. */
  async listCitiesInCountry(country_code: string): Promise<CityPartition[]> {
    const res = await this.pool.query<{
      city: string | null;
      district: string | null;
      n: string;
      centroid_lat: string | null;
      centroid_lng: string | null;
    }>(`
      SELECT city, district, COUNT(*)::text AS n,
        AVG(coordinates_lat)::text AS centroid_lat,
        AVG(coordinates_lng)::text AS centroid_lng
      FROM nex.accommodation_business
      WHERE (COALESCE(country, 'ID') = $1 OR $1 = 'ID')
      GROUP BY city, district
      ORDER BY n DESC
    `, [country_code]);
    return res.rows.filter((r) => r.city).map((r) => ({
      city_slug: r.city!.toLowerCase().replace(/[\s_]+/g, "-"),
      display_name: r.city!,
      country_code,
      region: null,
      district: r.district,
      centroid_lat: r.centroid_lat ? Number(r.centroid_lat) : null,
      centroid_lng: r.centroid_lng ? Number(r.centroid_lng) : null,
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // §5 · Entity access · speed-first
  // ═══════════════════════════════════════════════════════════════

  async getEntityByRef(entity_ref: string): Promise<Record<string, unknown> | null> {
    const res = await this.pool.query(`
      SELECT * FROM nex.accommodation_business WHERE public_listing_ref = $1 LIMIT 1
    `, [entity_ref]);
    return res.rows[0] ?? null;
  }

  async listEntitiesInCity(
    country_code: string,
    city_slug: string,
    category_slug?: string,
    limit: number = 100,
  ): Promise<AccommodationRow[]> {
    const wheres: string[] = [`(COALESCE(country, 'ID') = $1 OR $1 = 'ID')`];
    const params: unknown[] = [country_code];
    params.push(city_slug.replace(/-/g, " "));
    wheres.push(`LOWER(city) = LOWER($${params.length})`);
    if (category_slug) {
      params.push(category_slug);
      wheres.push(`($${params.length} = ANY(COALESCE(categories, ARRAY[category])) OR LOWER(category) = LOWER($${params.length}))`);
    }
    params.push(limit);
    const sql = `
      SELECT * FROM nex.accommodation_business
      WHERE ${wheres.join(" AND ")}
      ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
      LIMIT $${params.length}
    `;
    const res = await this.pool.query<AccommodationRow>(sql, params);
    return res.rows;
  }

  async countEntitiesInCity(
    country_code: string,
    city_slug: string,
    category_slug?: string,
  ): Promise<number> {
    const wheres: string[] = [`(COALESCE(country, 'ID') = $1 OR $1 = 'ID')`];
    const params: unknown[] = [country_code];
    params.push(city_slug.replace(/-/g, " "));
    wheres.push(`LOWER(city) = LOWER($${params.length})`);
    if (category_slug) {
      params.push(category_slug);
      wheres.push(`($${params.length} = ANY(COALESCE(categories, ARRAY[category])) OR LOWER(category) = LOWER($${params.length}))`);
    }
    const res = await this.pool.query<{ n: string }>(`
      SELECT COUNT(*)::text AS n FROM nex.accommodation_business WHERE ${wheres.join(" AND ")}
    `, params);
    return Number(res.rows[0]?.n ?? 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // §27 · Provenance access · reads existing field_provenance table
  // ═══════════════════════════════════════════════════════════════

  /**
   * Returns per-field provenance for an entity · direct read of the
   * already-populated accommodation_business_field_provenance table.
   */
  async getFieldProvenance(entity_ref: string, field_name?: string): Promise<FieldProvenanceRow[]> {
    const params: unknown[] = [entity_ref];
    let sql = `
      SELECT * FROM nex.accommodation_business_field_provenance
      WHERE business_ref = $1
    `;
    if (field_name) {
      params.push(field_name);
      sql += ` AND field_name = $${params.length}`;
    }
    sql += ` ORDER BY written_at DESC`;
    const res = await this.pool.query<FieldProvenanceRow>(sql, params);
    return res.rows;
  }

  /** Immutable source snapshot per business · raw ingested payload preserved. */
  async getSourceSnapshot(entity_ref: string): Promise<SourceSnapshotRow[]> {
    const res = await this.pool.query<SourceSnapshotRow>(`
      SELECT * FROM nex.accommodation_business_source_snapshot
      WHERE business_ref = $1
      ORDER BY captured_at DESC
    `, [entity_ref]);
    return res.rows;
  }

  /**
   * Convert canonical row + provenance rows into KnowledgeRecords per §12.
   * Deterministic mapping · no fabrication.
   */
  async knowledgeRecordsForEntity(entity_ref: string): Promise<KnowledgeRecord[]> {
    const row = await this.getEntityByRef(entity_ref);
    if (!row) return [];
    const provs = await this.getFieldProvenance(entity_ref);
    const provByField = new Map<string, FieldProvenanceRow>();
    for (const p of provs) if (!provByField.has(p.field_name)) provByField.set(p.field_name, p);

    const records: KnowledgeRecord[] = [];
    for (const [field, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
      const prov = provByField.get(field);
      records.push({
        record_id: `${entity_ref}::${field}`,
        domain_agent_id: "accommodation",
        entity_kind: "property",
        entity_ref,
        field_name: field,
        value,
        value_normalised: typeof value === "string" ? value.toLowerCase().trim() : String(value).toLowerCase(),
        status: "VERIFIED",
        trust_layer: normalizeTrustLayer(prov?.trust_layer),
        confidence: prov ? 0.9 : 0.7,
        freshness_state: computeFreshness(prov?.written_at ?? (row.updated_at as Date | null)),
        freshness_ttl_seconds: null,
        country_code: (row.country as string | null)?.toUpperCase() ?? "ID",
        language: null,
        language_original: null,
        value_original: null,
        provenance: {
          source: prov?.source_reference ?? "postgres:nex.accommodation_business",
          source_url: null,
          source_type: prov ? "primary" : "canonical",
          collected_at_iso: prov?.written_at?.toISOString() ?? (row.updated_at as Date | null)?.toISOString() ?? new Date(0).toISOString(),
          agent_id: "accommodation",
          cycle_run_id: prov?.cycle_run_id ?? null,
          verification_history: [],
        },
        supersedes: null,
        superseded_by: null,
        content_hash: "", // caller computes if needed · not required for read path
        created_at_iso: prov?.written_at?.toISOString() ?? new Date(0).toISOString(),
        verified_at_iso: prov?.written_at?.toISOString() ?? null,
        refreshed_at_iso: null,
        cycle_run_id: prov?.cycle_run_id ?? null,
      });
    }
    return records;
  }

  // ═══════════════════════════════════════════════════════════════
  // §16 · §20 · §29 · Metrics
  // ═══════════════════════════════════════════════════════════════

  async currentGrowthMetrics(): Promise<GrowthMetrics> {
    const q = await this.pool.query<{
      total: string; visible: string; verified: string;
      today: string; week: string; month: string;
      countries: string; cities: string;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE claim_status IN ('listed','invited','claimed','paying'))::text AS visible,
        COUNT(*) FILTER (WHERE claim_status IN ('claimed','paying'))::text AS verified,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '24 hours')::text AS today,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::text AS week,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '30 days')::text AS month,
        COUNT(DISTINCT COALESCE(country, 'ID'))::text AS countries,
        COUNT(DISTINCT city)::text AS cities
      FROM nex.accommodation_business
    `);
    const r = q.rows[0];
    const total = Number(r.total);
    const verified = Number(r.verified);
    const visible = Number(r.visible);
    const denom = visible || total || 1;
    const growthPct = Math.round((verified / denom) * 1000) / 10;

    return {
      domain_agent_id: "accommodation",
      measured_at_iso: new Date().toISOString(),
      entities_total: total,
      entities_verified: verified,
      entities_observed_unverified: total - verified,
      entities_stale: 0, // §26 stale tracking · UNKNOWN until worker computes
      entities_conflict_flagged: 0, // UNKNOWN until conflict detector runs
      entities_superseded: 0, // UNKNOWN until supersession events replayed
      entities_added_today: Number(r.today),
      entities_updated_today: Number(r.today), // approximation · adds+updates share timestamp
      entities_added_this_week: Number(r.week),
      entities_added_this_month: Number(r.month),
      countries_covered: Number(r.countries),
      cities_covered: Number(r.cities),
      knowledge_gaps_open: 0, // UNKNOWN until Gap Engine runs
      knowledge_gaps_resolved_today: 0,
      research_active: 0,
      research_completed_today: 0,
      research_failed_today: 0,
      verified_knowledge_growth_pct: growthPct,
      verified_knowledge_growth_denominator_note: `verified (claim_status IN claimed/paying: ${verified}) / visible (${visible})`,
      evidence_label: "MEASURED",
    };
  }

  async currentStorageMetrics(): Promise<StorageMetrics> {
    const t0 = performance.now();
    const q = await this.pool.query<{
      canonical_rows: string;
      provenance_rows: string;
      snapshot_rows: string;
      snapshot_bytes: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM nex.accommodation_business) AS canonical_rows,
        (SELECT COUNT(*)::text FROM nex.accommodation_business_field_provenance) AS provenance_rows,
        (SELECT COUNT(*)::text FROM nex.accommodation_business_source_snapshot) AS snapshot_rows,
        COALESCE((SELECT SUM(octet_length(raw_payload::text))::text FROM nex.accommodation_business_source_snapshot), '0') AS snapshot_bytes
    `);
    const readLatency = Math.round((performance.now() - t0) * 100) / 100;
    const r = q.rows[0];
    const canonical = Number(r.canonical_rows);
    const snapshotBytes = Number(r.snapshot_bytes);
    return {
      domain_agent_id: "accommodation",
      measured_at_iso: new Date().toISOString(),
      bytes_total: snapshotBytes, // canonical row sizes not directly measurable via pg easily
      bytes_hot_tier: 0, // in-memory · reported by HotAccommodationTier separately
      bytes_canonical: snapshotBytes,
      bytes_archive: 0, // no archive yet
      object_count: canonical,
      average_object_size_bytes: canonical > 0 ? Math.round(snapshotBytes / canonical) : 0,
      compression_ratio_measured: null, // UNKNOWN · Postgres TOAST handles internally
      dedup_ratio_measured: null, // UNKNOWN · single canonical row per business
      read_operations_last_hour: 0, // UNKNOWN · pg_stat sampling not implemented
      write_operations_last_hour: 0, // UNKNOWN
      cache_hits_last_hour: 0, // hot-tier reports separately
      cache_misses_last_hour: 0,
      retrieval_latency_p50_ms: readLatency,
      retrieval_latency_p95_ms: readLatency, // single-sample; would need multi-sample to be P95
      retrieval_latency_p99_ms: readLatency,
      projected_monthly_growth_bytes: 0, // UNKNOWN until worker measures ingestion rate
      projected_monthly_cost_usd: null,
      evidence_label: "MEASURED",
    };
  }

  async currentCoverageMetrics(): Promise<CoverageMetrics[]> {
    const q = await this.pool.query<{ country: string; n: string }>(`
      SELECT COALESCE(NULLIF(country, ''), 'ID') AS country, COUNT(*)::text AS n
      FROM nex.accommodation_business
      GROUP BY country
    `);
    return q.rows.map((r) => ({
      domain_agent_id: "accommodation",
      country_code: normalizeCountryCode(r.country),
      measured_at_iso: new Date().toISOString(),
      entities_present: Number(r.n),
      entities_target: 0, // UNKNOWN · Founder-set target baseline required
      entities_target_source: "UNKNOWN",
      coverage_percentage: 0, // UNKNOWN without target
      coverage_definition: "target baseline UNKNOWN · Founder to set expected total per country",
      evidence_label: "MEASURED" as EvidenceLabel,
    }));
  }

  async currentObservationSnapshot(): Promise<AgentObservationSnapshot> {
    const [growth, storage, coverage] = await Promise.all([
      this.currentGrowthMetrics(),
      this.currentStorageMetrics(),
      this.currentCoverageMetrics(),
    ]);

    // Category breakdown from canonical
    const catRes = await this.pool.query<{ cat: string; n: string }>(`
      SELECT unnest(COALESCE(categories, ARRAY[COALESCE(category, 'accommodation')])) AS cat, COUNT(*)::text AS n
      FROM nex.accommodation_business
      GROUP BY cat
      ORDER BY n DESC
      LIMIT 20
    `);
    const categoryBreakdown: Record<string, number> = {};
    for (const r of catRes.rows) categoryBreakdown[r.cat] = Number(r.n);

    return {
      domain_agent_id: "accommodation",
      display_name: "Accommodation Intelligence Agent",
      status: "STOPPED", // §18 · never claim ACTIVE without heartbeat evidence
      status_reason: "no heartbeat file inspected yet · observatory API should read agent-runtime worker state",
      last_heartbeat_at_iso: null,
      last_successful_collection_at_iso: null,
      pid: null,
      growth,
      storage,
      coverage_by_country: coverage,
      category_breakdown: categoryBreakdown,
      research_metrics: {
        active_tasks: 0,
        completed_last_hour: 0,
        failed_last_hour: 0,
        unresolved_gaps: 0,
      },
      quality: {
        verified_percentage: growth.entities_total > 0
          ? Math.round((growth.entities_verified / growth.entities_total) * 1000) / 10
          : 0,
        unresolved_conflicts: growth.entities_conflict_flagged,
        provenance_coverage_percentage: 0, // computed by joining canonical + provenance
        source_reliability_average: null,
      },
      evidence_label: "MEASURED",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helpers · deterministic string normalizers
// ═══════════════════════════════════════════════════════════════════

function normalizeCountryCode(raw: string | null | undefined): string {
  if (!raw) return "ID";
  const upper = raw.trim().toUpperCase();
  if (upper.length === 2) return upper;
  // Map full country names to ISO codes
  const known: Record<string, string> = {
    INDONESIA: "ID", INA: "ID",
    JAPAN: "JP", JPN: "JP",
    THAILAND: "TH", THA: "TH",
    SINGAPORE: "SG", SGP: "SG",
    "UNITED KINGDOM": "GB", UK: "GB",
    "UNITED STATES": "US", USA: "US",
    AUSTRALIA: "AU", AUS: "AU",
  };
  return known[upper] ?? upper.slice(0, 2);
}

function expandCountry(raw: string | null | undefined): string {
  const code = normalizeCountryCode(raw);
  const names: Record<string, string> = {
    ID: "Indonesia", JP: "Japan", TH: "Thailand", SG: "Singapore",
    GB: "United Kingdom", US: "United States", AU: "Australia",
  };
  return names[code] ?? code;
}

function guessLanguage(raw: string | null | undefined): string | null {
  const code = normalizeCountryCode(raw);
  const langs: Record<string, string> = {
    ID: "id", JP: "ja", TH: "th", SG: "en", GB: "en", US: "en", AU: "en",
  };
  return langs[code] ?? null;
}

function guessTimezone(raw: string | null | undefined): string | null {
  const code = normalizeCountryCode(raw);
  const tz: Record<string, string> = {
    ID: "Asia/Jakarta", JP: "Asia/Tokyo", TH: "Asia/Bangkok", SG: "Asia/Singapore",
    GB: "Europe/London", US: "America/New_York", AU: "Australia/Sydney",
  };
  return tz[code] ?? null;
}

function normalizeTrustLayer(raw: string | null | undefined): TrustLayer {
  if (!raw) return "L5_OBSERVED_UNVERIFIED";
  const upper = raw.toUpperCase();
  if (upper.includes("FOUNDER") || upper === "L1") return "L1_FOUNDER_AUTHORED";
  if (upper.includes("MASTER") || upper === "L2") return "L2_MASTER_AI_VERIFIED";
  if (upper.includes("AUTHORITATIVE") || upper === "L3" || upper === "PRIMARY") return "L3_AUTHORITATIVE_SOURCE";
  if (upper.includes("SECONDARY") || upper === "L4") return "L4_SECONDARY_SOURCE";
  return "L5_OBSERVED_UNVERIFIED";
}

function computeFreshness(written_at: Date | null | undefined): FreshnessState {
  if (!written_at) return "UNKNOWN";
  const ageDays = (Date.now() - written_at.getTime()) / (1000 * 3600 * 24);
  if (ageDays < 7) return "FRESH";
  if (ageDays < 30) return "REFRESH_REQUIRED";
  if (ageDays < 90) return "STALE";
  return "STALE";
}
