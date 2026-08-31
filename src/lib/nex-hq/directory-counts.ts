// src/lib/nex-hq/directory-counts.ts
//
// Phase 3 · 2026-08-24 · Admin directory visibility helper.
//
// Reads REAL PERSISTED DIRECTORY ROWS from the canonical business tables
// (nex.food_business · nex.accommodation_business · nex.mp_seller ·
// nex.transport_acquisition_record). Never derived from cycle counts,
// scoring candidates, matched_exact, new_candidates, or records_new
// counters — only actual rows the DB accepted.
//
// A row appearing here means a walker's `insertNewRecord()` (or equivalent
// upsert) returned rowCount>0 after `ON CONFLICT DO NOTHING` — the same
// truth the P1 records_new fix uses. This is the ONE metric that increases
// only when NEX genuinely discovers a new business.

import type { Pool } from "pg";

// Philip 2026-08-27 · A1: extend HQ directory with 6 service categories from
// nex.service_business (the Phase 1 workforce output table). Each service
// category becomes a first-class DIRECTORY_CATEGORIES entry sharing the same
// underlying table but filtered by category_slug column. HQ admin only ·
// public /services routes come later once card design is settled.
export const LEGACY_DIRECTORY_CATEGORIES = ["food", "accommodation", "market", "transport"] as const;
export const SERVICE_DIRECTORY_CATEGORIES = [
  "services-gyms",
  "services-salons",
  "services-dentists",
  "services-opticians",
  "services-pharmacies",
  "services-car-repair",
] as const;
export const DIRECTORY_CATEGORIES = [
  ...LEGACY_DIRECTORY_CATEGORIES,
  ...SERVICE_DIRECTORY_CATEGORIES,
] as const;
export type DirectoryCategory = typeof DIRECTORY_CATEGORIES[number];

interface TableSpec {
  table:            string;   // e.g. "nex.food_business"
  nameColumn:       string;   // display name column
  cityColumn:       string;   // city column
  districtColumn:   string | null;
  createdAtColumn:  string;
  sourceColumn:     string | null;
  idColumn:         string;
  /** Optional constant WHERE fragment (e.g. category_slug filter) · appended after user filters. */
  extraWhere?:      string;
}

const TABLE_MAP: Record<DirectoryCategory, TableSpec> = {
  food: {
    table: "nex.food_business",
    nameColumn: "business_name",
    cityColumn: "city",
    districtColumn: "district",
    createdAtColumn: "created_at",
    sourceColumn: "source",
    idColumn: "internal_id",
  },
  accommodation: {
    table: "nex.accommodation_business",
    nameColumn: "business_name",
    cityColumn: "city",
    districtColumn: "district",
    createdAtColumn: "created_at",
    sourceColumn: "source",
    idColumn: "internal_id",
  },
  market: {
    table: "nex.mp_seller",
    nameColumn: "display_name",
    cityColumn: "city",
    districtColumn: null,          // mp_seller has no explicit district column
    createdAtColumn: "created_at",
    sourceColumn: "discovered_from",
    idColumn: "seller_id",
  },
  transport: {
    table: "nex.transport_acquisition_record",
    nameColumn: "business_name",
    cityColumn: "city",
    districtColumn: null,
    createdAtColumn: "first_discovered_at",
    sourceColumn: "provider_kind",   // best proxy for "source" · provider_kind = walker-family
    idColumn: "provider_id",
  },
  // ── Phase 1 workforce output · nex.service_business filtered by category_slug ──
  // All 6 service categories share the same table + column layout.
  "services-gyms":       serviceSpec("gyms"),
  "services-salons":     serviceSpec("salons"),
  "services-dentists":   serviceSpec("dentists"),
  "services-opticians":  serviceSpec("opticians"),
  "services-pharmacies": serviceSpec("pharmacies"),
  "services-car-repair": serviceSpec("car-repair"),
};

function serviceSpec(categorySlug: string): TableSpec {
  return {
    table: "nex.service_business",
    nameColumn: "business_name",
    cityColumn: "city",
    districtColumn: "district",
    createdAtColumn: "created_at",
    sourceColumn: "source",
    idColumn: "internal_id",
    // Literal escaped in SQL string · category_slug values are lowercase-hyphenated
    // (validated in scripts/nex-workforce/_job-registry.mjs) so single-quotes are safe.
    extraWhere: `category_slug = '${categorySlug}'`,
  };
}

function specFor(category: DirectoryCategory): TableSpec {
  return TABLE_MAP[category];
}

export interface CityCount {
  city:  string;
  count: number;
}

export interface DirectoryTotals {
  category: DirectoryCategory;
  total:    number;
  byCity:   CityCount[];   // sorted desc by count
}

/**
 * Real per-city counts for a category. Returns total + descending city list.
 * Never falls back to cycle counts.
 */
export async function loadCategoryTotals(
  pool: Pool,
  category: DirectoryCategory,
): Promise<DirectoryTotals> {
  const spec = specFor(category);
  const extraWhereClause = spec.extraWhere ? `WHERE ${spec.extraWhere}` : "";
  try {
    const [totalR, cityR] = await Promise.all([
      pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${spec.table} ${extraWhereClause}`),
      pool.query<{ city: string | null; n: string }>(
        `SELECT ${spec.cityColumn} AS city, count(*)::text AS n
           FROM ${spec.table}
           ${extraWhereClause}
          GROUP BY ${spec.cityColumn}
          ORDER BY 2 DESC`,
      ),
    ]);
    return {
      category,
      total: Number(totalR.rows[0]?.n ?? 0),
      byCity: cityR.rows.map((r) => ({
        city: r.city ?? "(unknown)",
        count: Number(r.n),
      })),
    };
  } catch (e) {
    return { category, total: 0, byCity: [{ city: `(query error: ${(e as Error).message})`, count: 0 }] };
  }
}

/**
 * Load totals for ALL categories · used by admin /nex-head-quarters/directory
 * to populate the CATEGORY dropdown counts + the city dropdown counts.
 */
export async function loadAllCategoryTotals(pool: Pool): Promise<DirectoryTotals[]> {
  return Promise.all(DIRECTORY_CATEGORIES.map((c) => loadCategoryTotals(pool, c)));
}

export interface DirectoryRow {
  id:        string;
  name:      string;
  city:      string | null;
  district:  string | null;
  createdAt: string;
  source:    string | null;
}

export interface DirectoryPage {
  category: DirectoryCategory;
  city:     string | null;   // null = All
  rows:     DirectoryRow[];
  total:    number;          // total matching filter
  offset:   number;
  limit:    number;
}

/**
 * Paginated rows for the admin table. Filter by optional city.
 */
export async function loadDirectoryRows(
  pool: Pool,
  opts: {
    category: DirectoryCategory;
    city?: string | null;
    offset?: number;
    limit?: number;
  },
): Promise<DirectoryPage> {
  const spec = specFor(opts.category);
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const limit = Math.min(200, Math.max(1, Math.floor(opts.limit ?? 50)));
  const params: (string | number)[] = [];
  const whereParts: string[] = [];
  if (opts.city && opts.city !== "All") {
    params.push(opts.city);
    whereParts.push(`${spec.cityColumn} = $${params.length}`);
  }
  if (spec.extraWhere) whereParts.push(spec.extraWhere);
  const where = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  try {
    const [rowsR, totalR] = await Promise.all([
      pool.query<{ id: string; name: string; city: string | null; district: string | null; created_at: string; source: string | null }>(
        `SELECT ${spec.idColumn}::text        AS id,
                ${spec.nameColumn}            AS name,
                ${spec.cityColumn}            AS city,
                ${spec.districtColumn ?? "NULL::text"}   AS district,
                ${spec.createdAtColumn}::text AS created_at,
                ${spec.sourceColumn ?? "NULL::text"}      AS source
           FROM ${spec.table}
           ${where}
           ORDER BY ${spec.createdAtColumn} DESC NULLS LAST
           LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM ${spec.table} ${where}`,
        params,
      ),
    ]);
    return {
      category: opts.category,
      city: opts.city ?? null,
      rows: rowsR.rows.map((r) => ({
        id: r.id,
        name: r.name ?? "(unnamed)",
        city: r.city,
        district: r.district,
        createdAt: r.created_at,
        source: r.source,
      })),
      total: Number(totalR.rows[0]?.n ?? 0),
      offset,
      limit,
    };
  } catch (e) {
    return {
      category: opts.category,
      city: opts.city ?? null,
      rows: [{ id: "err", name: `(query error: ${(e as Error).message})`, city: null, district: null, createdAt: "", source: null }],
      total: 0,
      offset,
      limit,
    };
  }
}
