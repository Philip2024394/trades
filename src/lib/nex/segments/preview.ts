// NEX Audience Engine · preview
//
// Translates an AudienceFilter into SQL against nex.contacts (+ optional
// join to nex.contact_sources) and returns:
//   · matching count (all contacts satisfying the filter)
//   · eligible-for-marketing count (matching AND compliance-clean)
//   · eligible-for-transactional count
//   · suppression breakdown (why some matching contacts won't receive)
//   · sample of first 25 matching rows
//
// The audience is ALWAYS a filter over the registry · never a
// materialised copy. Registry compliance ratchet stays authoritative ·
// this module just surfaces WHICH contacts would pass at send-time.

import type { AudienceFilter, AudiencePreview, SuppressionBreakdown } from "./types";

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};
type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };
let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { poolPromise = Promise.resolve(null); return poolPromise; }
  poolPromise = (async () => {
    let pg: unknown;
    try { pg = await import("pg" as string); } catch { return null; }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({ connectionString: url, max: 3, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  })();
  return poolPromise;
}

async function withClient<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

/**
 * Build the WHERE clause fragments + params array from an AudienceFilter.
 * Called by both the count queries and the sample query so the definition
 * is identical everywhere.
 */
function buildFilter(filter: AudienceFilter): { where: string[]; params: unknown[] } {
  const wheres: string[] = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];
  const push = (v: unknown): string => { params.push(v); return `$${params.length}`; };

  if (filter.countries && filter.countries.length > 0) {
    const placeholders = filter.countries.map((v) => push(v)).join(",");
    wheres.push(`c.country = ANY(ARRAY[${placeholders}])`);
  }
  if (filter.regions && filter.regions.length > 0) {
    const placeholders = filter.regions.map((v) => push(v.toLowerCase())).join(",");
    wheres.push(`LOWER(c.region) = ANY(ARRAY[${placeholders}])`);
  }
  if (filter.trades && filter.trades.length > 0) {
    // trade_categories JSONB contains any-of · use ?| operator
    const placeholders = filter.trades.map((v) => push(v)).join(",");
    wheres.push(`c.trade_categories ?| ARRAY[${placeholders}]`);
  }
  if (typeof filter.consent_marketing === "boolean") {
    wheres.push(`c.consent_marketing = ${push(filter.consent_marketing)}`);
  }
  if (typeof filter.consent_transactional === "boolean") {
    wheres.push(`c.consent_transactional = ${push(filter.consent_transactional)}`);
  }
  if (filter.include_never_contact !== true) wheres.push(`(c.never_contact IS DISTINCT FROM TRUE)`);
  if (filter.include_unsubscribed !== true)  wheres.push(`c.unsubscribe_at IS NULL`);
  if (filter.last_contacted_before) wheres.push(`c.last_contacted_at < ${push(filter.last_contacted_before)}`);
  if (filter.last_contacted_after)  wheres.push(`c.last_contacted_at > ${push(filter.last_contacted_after)}`);
  if (filter.first_seen_after)  wheres.push(`c.first_seen_at > ${push(filter.first_seen_after)}`);
  if (filter.first_seen_before) wheres.push(`c.first_seen_at < ${push(filter.first_seen_before)}`);
  if (filter.search) {
    const like = push(`%${filter.search.toLowerCase()}%`);
    wheres.push(`(LOWER(COALESCE(c.name, '')) LIKE ${like} OR LOWER(COALESCE(c.email, '')) LIKE ${like} OR LOWER(COALESCE(c.company, '')) LIKE ${like})`);
  }

  // Source filter · requires join to contact_sources
  if (filter.sources && filter.sources.length > 0) {
    const placeholders = filter.sources.map((v) => push(v)).join(",");
    wheres.push(`EXISTS (SELECT 1 FROM nex.contact_sources cs WHERE cs.contact_id = c.contact_id AND cs.source_type = ANY(ARRAY[${placeholders}]))`);
  }
  if (filter.has_crm_linkage === true) {
    wheres.push(`EXISTS (SELECT 1 FROM nex.contact_sources cs WHERE cs.contact_id = c.contact_id AND cs.source_type = 'crm')`);
  }

  return { where: wheres, params };
}

const CANONICAL_CTE = `
  WITH canonical AS (
    SELECT DISTINCT ON (contact_id) *
    FROM nex.contacts
    ORDER BY contact_id, updated_at DESC
  )
`;

export async function previewAudience(filter: AudienceFilter): Promise<AudiencePreview> {
  const emptyResult: AudiencePreview = {
    matching: 0, eligible_marketing: 0, eligible_transactional: 0,
    suppressed: { unsubscribed: 0, never_contact: 0, invalid_email: 0, no_marketing_consent: 0, total_suppressed: 0 },
    sample: [], filter_used: filter, generated_at: new Date().toISOString(),
  };

  // Strip the compliance filters to count total matching first · then
  // apply compliance to count eligible + suppressed reasons.
  const nonCompliance: AudienceFilter = {
    ...filter,
    consent_marketing: undefined,
    consent_transactional: undefined,
    include_never_contact: true,
    include_unsubscribed: true,
  };
  const matchingParts = buildFilter(nonCompliance);

  const result = await withClient(async (c) => {
    const canonicalWhere = matchingParts.where.join(" AND ");
    const canonicalSql = `${CANONICAL_CTE.replace("nex.contacts", "nex.contacts").replace("ORDER BY contact_id, updated_at DESC", "ORDER BY contact_id, updated_at DESC")}, filtered AS (SELECT c.* FROM canonical c WHERE ${canonicalWhere})`;

    // Count matching
    const totalRes = await c.query(`${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered`, matchingParts.params);
    const matching = Number((totalRes.rows[0] as { n: number }).n);
    if (matching === 0) return emptyResult;

    // Compliance-eligible counts + suppression reasons
    const eligibleMarketingRes = await c.query(
      `${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered
       WHERE consent_marketing = TRUE AND never_contact IS DISTINCT FROM TRUE AND unsubscribe_at IS NULL
         AND canonical_email IS NOT NULL`,
      matchingParts.params,
    );
    const eligibleTransactionalRes = await c.query(
      `${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered
       WHERE consent_transactional IS DISTINCT FROM FALSE AND never_contact IS DISTINCT FROM TRUE AND unsubscribe_at IS NULL
         AND canonical_email IS NOT NULL`,
      matchingParts.params,
    );
    const unsubRes = await c.query(
      `${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered WHERE unsubscribe_at IS NOT NULL`,
      matchingParts.params,
    );
    const neverRes = await c.query(
      `${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered WHERE never_contact = TRUE`,
      matchingParts.params,
    );
    const invalidRes = await c.query(
      `${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered WHERE canonical_email IS NULL`,
      matchingParts.params,
    );
    const noMarketingRes = await c.query(
      `${canonicalSql} SELECT COUNT(*)::int AS n FROM filtered
       WHERE (consent_marketing IS DISTINCT FROM TRUE)
         AND never_contact IS DISTINCT FROM TRUE
         AND unsubscribe_at IS NULL
         AND canonical_email IS NOT NULL`,
      matchingParts.params,
    );

    const suppressed: SuppressionBreakdown = {
      unsubscribed: Number((unsubRes.rows[0] as { n: number }).n),
      never_contact: Number((neverRes.rows[0] as { n: number }).n),
      invalid_email: Number((invalidRes.rows[0] as { n: number }).n),
      no_marketing_consent: Number((noMarketingRes.rows[0] as { n: number }).n),
      total_suppressed: 0,
    };
    suppressed.total_suppressed = matching - Number((eligibleMarketingRes.rows[0] as { n: number }).n);

    // Sample · 25 rows for the preview table
    const sampleRes = await c.query(
      `${canonicalSql}
       SELECT contact_id, name, email, country, lifecycle_stage, consent_marketing, never_contact, unsubscribe_at
       FROM filtered
       ORDER BY updated_at DESC
       LIMIT 25`,
      matchingParts.params,
    );

    return {
      matching,
      eligible_marketing: Number((eligibleMarketingRes.rows[0] as { n: number }).n),
      eligible_transactional: Number((eligibleTransactionalRes.rows[0] as { n: number }).n),
      suppressed,
      sample: sampleRes.rows.map((r) => ({
        contact_id: String(r.contact_id),
        name: (r.name as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        country: (r.country as string | null) ?? null,
        lifecycle_stage: (r.lifecycle_stage as string | null) ?? null,
        consent_marketing: r.consent_marketing as boolean | null,
        never_contact: r.never_contact === true,
        unsubscribe_at: (r.unsubscribe_at as string | null) ?? null,
      })),
      filter_used: filter,
      generated_at: new Date().toISOString(),
    };
  });

  return result ?? emptyResult;
}
