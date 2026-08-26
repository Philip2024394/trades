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

export const DIRECTORY_CATEGORIES = ["food", "accommodation", "market", "transport"] as const;
export type DirectoryCategory = typeof DIRECTORY_CATEGORIES[number];

interface TableSpec {
  table:            string;   // e.g. "nex.food_business"
  nameColumn:       string;   // display name column
  cityColumn:       string;   // city column
  districtColumn:   string | null;
  createdAtColumn:  string;
  sourceColumn:     string | null;
  idColumn:         string;
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
};

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
  try {
    const [totalR, cityR] = await Promise.all([
      pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${spec.table}`),
      pool.query<{ city: string | null; n: string }>(
        `SELECT ${spec.cityColumn} AS city, count(*)::text AS n
           FROM ${spec.table}
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
  let where = "";
  if (opts.city && opts.city !== "All") {
    params.push(opts.city);
    where = `WHERE ${spec.cityColumn} = $${params.length}`;
  }
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
