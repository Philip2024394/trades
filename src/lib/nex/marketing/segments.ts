// src/lib/nex/marketing/segments.ts
//
// Founder 2026-09-10 · Segment engine · dynamic queries over
// nex.marketing_contact. Always honors opt_out + hard_bounced flags —
// even if a segment's filter would otherwise match, opted-out contacts
// are silently excluded.

import type { PoolClient } from "pg";
import { getPool } from "../db";

export interface SegmentFilter {
  category_group?: string;
  category_slug?: string;
  country?: string;
  city?: string;
  language?: string;
}

/**
 * Category × Country matrix · returns a 2-D count grid the UI renders.
 * Every count excludes opt_out AND hard_bounced contacts (safe to send).
 */
export interface MatrixCell {
  category_group: string;
  country: string;
  contact_count: number;
  sample_categories: string[]; // top 3 category_slugs
}

export async function computeCategoryCountryMatrix(): Promise<{
  categories: string[];
  countries: string[];
  cells: MatrixCell[];
  total_sendable: number;
  total_all: number;
  total_opted_out: number;
  total_bounced: number;
}> {
  const pool = await getPool();
  if (!pool) return { categories: [], countries: [], cells: [], total_sendable: 0, total_all: 0, total_opted_out: 0, total_bounced: 0 };
  const c = await pool.connect();
  try {
    const cells = (await c.query(`
      SELECT
        COALESCE(category_group, 'unclassified') AS category_group,
        COALESCE(country, 'ID') AS country,
        count(*)::int AS contact_count
      FROM nex.marketing_contact
      WHERE opt_out = FALSE AND hard_bounced = FALSE AND email IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 3 DESC
    `)).rows as MatrixCell[];

    // Enrich each cell with sample subcategory slugs
    for (const cell of cells) {
      const samples = (await c.query(`
        SELECT category_slug, count(*)::int AS c
        FROM nex.marketing_contact
        WHERE COALESCE(category_group, 'unclassified') = $1
          AND COALESCE(country, 'ID') = $2
          AND opt_out = FALSE AND hard_bounced = FALSE
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3
      `, [cell.category_group, cell.country])).rows;
      cell.sample_categories = samples.map((s) => s.category_slug ?? "-");
    }

    const totals = (await c.query(`
      SELECT
        count(*) FILTER (WHERE opt_out = FALSE AND hard_bounced = FALSE)::int AS sendable,
        count(*)::int AS total,
        count(*) FILTER (WHERE opt_out = TRUE)::int AS opted_out,
        count(*) FILTER (WHERE hard_bounced = TRUE)::int AS bounced
      FROM nex.marketing_contact
    `)).rows[0];

    const categories = [...new Set(cells.map((c) => c.category_group))].sort();
    const countries = [...new Set(cells.map((c) => c.country))].sort();

    return {
      categories, countries, cells,
      total_sendable: totals.sendable,
      total_all: totals.total,
      total_opted_out: totals.opted_out,
      total_bounced: totals.bounced,
    };
  } finally { c.release(); }
}

/**
 * Compute count for a specific filter (used at campaign send-time to
 * snapshot the target audience).
 */
export async function computeSegmentCount(filter: SegmentFilter, extraWhere?: string): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;
  const c = await pool.connect();
  try {
    const clauses: string[] = ["opt_out = FALSE", "hard_bounced = FALSE", "email IS NOT NULL"];
    const params: unknown[] = [];
    if (filter.category_group) { params.push(filter.category_group); clauses.push(`category_group = $${params.length}`); }
    if (filter.category_slug) { params.push(filter.category_slug); clauses.push(`category_slug = $${params.length}`); }
    if (filter.country) { params.push(filter.country); clauses.push(`country = $${params.length}`); }
    if (filter.city) { params.push(filter.city); clauses.push(`city = $${params.length}`); }
    if (filter.language) { params.push(filter.language); clauses.push(`language = $${params.length}`); }
    // extraWhere is validated by the segment CREATE endpoint (whitelist column names) · defense in depth here
    if (extraWhere && /^[A-Za-z0-9_ '"=,()!<>]+$/.test(extraWhere)) {
      clauses.push(`(${extraWhere})`);
    }
    const sql = `SELECT count(*)::int c FROM nex.marketing_contact WHERE ${clauses.join(" AND ")}`;
    const r = await c.query(sql, params);
    return r.rows[0]?.c ?? 0;
  } finally { c.release(); }
}

/**
 * Materialise the list of contacts matching a segment (used when a
 * campaign is confirmed, to populate the send queue).
 */
export async function materialiseSegmentContacts(
  client: PoolClient,
  filter: SegmentFilter,
  extraWhere: string | null,
): Promise<Array<{ contact_id: string; email: string }>> {
  const clauses: string[] = ["opt_out = FALSE", "hard_bounced = FALSE", "email IS NOT NULL"];
  const params: unknown[] = [];
  if (filter.category_group) { params.push(filter.category_group); clauses.push(`category_group = $${params.length}`); }
  if (filter.category_slug) { params.push(filter.category_slug); clauses.push(`category_slug = $${params.length}`); }
  if (filter.country) { params.push(filter.country); clauses.push(`country = $${params.length}`); }
  if (filter.city) { params.push(filter.city); clauses.push(`city = $${params.length}`); }
  if (filter.language) { params.push(filter.language); clauses.push(`language = $${params.length}`); }
  if (extraWhere && /^[A-Za-z0-9_ '"=,()!<>]+$/.test(extraWhere)) {
    clauses.push(`(${extraWhere})`);
  }
  const sql = `
    SELECT contact_id, email FROM nex.marketing_contact
    WHERE ${clauses.join(" AND ")}
    ORDER BY contact_confidence DESC NULLS LAST, last_seen_at DESC
  `;
  const r = await client.query(sql, params);
  return r.rows;
}
