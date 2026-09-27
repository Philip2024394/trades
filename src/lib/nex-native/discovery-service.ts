// src/lib/nex-native/discovery-service.ts
//
// discovery-service · Wave B Slice 8a · NEX-native search.
//
// Doctrine:
//   · Discovery-vs-Intelligence sealed boundary · Discovery searches +
//     collects · Discovery NEVER becomes authoritative NEX Intelligence.
//   · This service only reads REAL persisted rows via Supabase · never
//     calls an AI / LLM · never fabricates.
//   · Results carry a `source` tag so callers can label the origin honestly.
//   · Public search · no per-tenant filtering (searches ARE public).
//   · Empty query returns empty · never a full-table scan.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexBusinessRow, NexProductRow } from "./types";

export interface DiscoveryProductResult {
  source: "product";
  product: NexProductRow;
}
export interface DiscoveryBusinessResult {
  source: "business";
  business: NexBusinessRow;
}
export type DiscoveryResult = DiscoveryProductResult | DiscoveryBusinessResult;

const QUERY_MAX_CHARS = 100;

function normaliseQuery(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > QUERY_MAX_CHARS) {
    throw new Error(
      `discovery-service: query max ${QUERY_MAX_CHARS} chars · got ${trimmed.length}`
    );
  }
  return trimmed;
}

/**
 * Search live products by name, description, or exact tag match.
 * Empty / whitespace query returns [] · never a full scan.
 * Slice 8c · accepts either a plain number (legacy · limit) or an
 * options object with limit + offset. Backward-compatible with 8a callers.
 */
export interface PageOpts {
  limit?: number;
  offset?: number;
}

function clampPage(opts: number | PageOpts | undefined): { limit: number; offset: number } {
  if (typeof opts === "number") return { limit: Math.max(1, Math.min(100, opts)), offset: 0 };
  const raw = opts ?? {};
  const limit = Math.max(1, Math.min(100, raw.limit ?? 20));
  const offset = Math.max(0, raw.offset ?? 0);
  return { limit, offset };
}

export async function searchProducts(
  query: string,
  optsOrLimit: number | PageOpts = 20,
): Promise<NexProductRow[]> {
  const q = normaliseQuery(query);
  if (!q) return [];
  const { limit, offset } = clampPage(optsOrLimit);

  // ILIKE for case-insensitive substring on name + description.
  // Escape PostgREST-special characters (%, comma) to prevent injection.
  const pattern = `%${q.replace(/[\\%,]/g, "\\$&")}%`;

  // Postgres array containment for tag match (exact-tag semantics).
  const tagCandidate = q.toLowerCase();

  const orFilter = `name.ilike.${pattern},description.ilike.${pattern},tags.cs.{${tagCandidate}}`;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*")
    .eq("status", "live")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`discovery-service.searchProducts: ${error.message}`);
  }
  return (data as NexProductRow[]) ?? [];
}

/** Count of matching live products for a query. Empty query → 0. */
export async function countProducts(query: string): Promise<number> {
  const q = normaliseQuery(query);
  if (!q) return 0;
  const pattern = `%${q.replace(/[\\%,]/g, "\\$&")}%`;
  const tagCandidate = q.toLowerCase();
  const orFilter = `name.ilike.${pattern},description.ilike.${pattern},tags.cs.{${tagCandidate}}`;
  const { count, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*", { count: "exact", head: true })
    .eq("status", "live")
    .or(orFilter);
  if (error) throw new Error(`discovery-service.countProducts: ${error.message}`);
  return count ?? 0;
}

/**
 * Search businesses by display_name, description, exact slug, OR
 * an entry in search_keywords[] (Bridge 14). When a category is
 * supplied, the result is additionally scoped to that vertical ·
 * pass an empty query + a category to browse "all restaurants".
 * Archived shops are always excluded.
 */
export async function searchBusinesses(
  query: string,
  optsOrLimit: number | PageOpts = 20,
  filter: { category?: string | null } = {},
): Promise<NexBusinessRow[]> {
  const q = normaliseQuery(query);
  const category = filter.category?.trim() || null;
  // Category-only browse is allowed · text-only requires a query.
  if (!q && !category) return [];
  const { limit, offset } = clampPage(optsOrLimit);

  let builder = nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .is("archived_at", null);

  if (q) {
    const pattern = `%${q.replace(/[\\%,]/g, "\\$&")}%`;
    const slugCandidate = q.toLowerCase();
    // ILIKE on name/description + exact slug + keyword-array match.
    // Postgrest's `cs` (contains) operator hits the GIN index we
    // built in migration 065.
    const orFilter = [
      `display_name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `slug.eq.${slugCandidate}`,
      `search_keywords.cs.{${slugCandidate}}`,
    ].join(",");
    builder = builder.or(orFilter);
  }
  if (category) {
    builder = builder.eq("business_category", category);
  }

  const { data, error } = await builder
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`discovery-service.searchBusinesses: ${error.message}`);
  }
  return (data as NexBusinessRow[]) ?? [];
}

/** Count of matching businesses for a query + optional category. */
export async function countBusinesses(
  query: string,
  filter: { category?: string | null } = {},
): Promise<number> {
  const q = normaliseQuery(query);
  const category = filter.category?.trim() || null;
  if (!q && !category) return 0;
  let builder = nexSupabaseAdmin
    .from("nex_business")
    .select("*", { count: "exact", head: true })
    .is("archived_at", null);
  if (q) {
    const pattern = `%${q.replace(/[\\%,]/g, "\\$&")}%`;
    const slugCandidate = q.toLowerCase();
    builder = builder.or(
      [
        `display_name.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `slug.eq.${slugCandidate}`,
        `search_keywords.cs.{${slugCandidate}}`,
      ].join(","),
    );
  }
  if (category) {
    builder = builder.eq("business_category", category);
  }
  const { count, error } = await builder;
  if (error) throw new Error(`discovery-service.countBusinesses: ${error.message}`);
  return count ?? 0;
}

/**
 * Combined search returning a mixed result array with source tags.
 * Products first, then businesses. Respects per-source limits.
 */
export interface PopularTag {
  tag: string;
  count: number;
}

/**
 * Return the most-used tags across all LIVE products, count-sorted DESC.
 * Aggregation happens app-side (Supabase JS lacks a first-class GROUP BY
 * for array-unnest without an RPC). O(N * average_tag_count) over live
 * products. For pilot volumes this is comfortable in memory. A future
 * SQL view can slot in behind the same function signature.
 *
 * Only non-empty tags are counted. Never fabricates a tag. Returns []
 * when no product has tags.
 */
export async function getPopularTags(limit: number = 10): Promise<PopularTag[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error(
      `discovery-service.getPopularTags: limit must be an integer 1..100 · got ${limit}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("tags")
    .eq("status", "live")
    .not("tags", "is", null);
  if (error) {
    throw new Error(`discovery-service.getPopularTags: ${error.message}`);
  }
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ tags: string[] | null }>) {
    if (!row.tags) continue;
    for (const raw of row.tags) {
      if (typeof raw !== "string") continue;
      const t = raw.trim();
      if (t.length === 0) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
    .slice(0, limit);
}

export async function searchAll(
  query: string,
  productLimit: number = 20,
  businessLimit: number = 20
): Promise<DiscoveryResult[]> {
  const [products, businesses] = await Promise.all([
    searchProducts(query, productLimit),
    searchBusinesses(query, businessLimit),
  ]);
  const out: DiscoveryResult[] = [];
  for (const p of products) out.push({ source: "product", product: p });
  for (const b of businesses) out.push({ source: "business", business: b });
  return out;
}
