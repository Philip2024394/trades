// src/lib/nex/harvest/business-candidate.ts
//
// NEX 24/7 World Harvest Engine · Wave H3 · Business candidate persistence
// Founder-authorised programme · 2026-09-22.
//
// Idempotent INSERT via ON CONFLICT on (source_slug, external_ref).
// Read + aggregate for HQ · returns REAL persisted counts.

import type { PoolClient } from "pg";

export interface HarvestBusinessCandidate {
  readonly candidate_id: string;
  readonly source_slug: string;
  readonly source_probe_job_id: string | null;
  readonly programme_id: string | null;
  readonly country_iso: string;
  readonly term: string | null;
  readonly external_ref: string | null;
  readonly business_name: string;
  readonly website_url: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly raw_tags: Readonly<Record<string, string>>;
  readonly provenance_url: string;
  readonly provenance_note: string | null;
  readonly website_walk_job_id: string | null;
  readonly website_walk_status: string | null;
  readonly website_walked_at: string | null;
  readonly emails_discovered_count: number;
  readonly discovered_at: string;
  readonly updated_at: string;
}

export interface InsertCandidateInput {
  readonly source_slug: string;
  readonly source_probe_job_id?: string | null;
  readonly programme_id?: string | null;
  readonly country_iso: string;
  readonly term?: string | null;
  readonly external_ref?: string | null;
  readonly business_name: string;
  readonly website_url?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly raw_tags?: Record<string, string>;
  readonly provenance_url: string;
  readonly provenance_note?: string | null;
}

export type InsertCandidateOutcome =
  | { kind: "inserted"; candidate: HarvestBusinessCandidate }
  | { kind: "duplicate"; existing: HarvestBusinessCandidate };

function rowToCandidate(r: any): HarvestBusinessCandidate {
  return {
    candidate_id: r.candidate_id,
    source_slug: r.source_slug,
    source_probe_job_id: r.source_probe_job_id ?? null,
    programme_id: r.programme_id ?? null,
    country_iso: r.country_iso,
    term: r.term ?? null,
    external_ref: r.external_ref ?? null,
    business_name: r.business_name,
    website_url: r.website_url ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    latitude: r.latitude !== null ? Number(r.latitude) : null,
    longitude: r.longitude !== null ? Number(r.longitude) : null,
    raw_tags: r.raw_tags ?? {},
    provenance_url: r.provenance_url,
    provenance_note: r.provenance_note ?? null,
    website_walk_job_id: r.website_walk_job_id ?? null,
    website_walk_status: r.website_walk_status ?? null,
    website_walked_at: r.website_walked_at ?? null,
    emails_discovered_count: Number(r.emails_discovered_count ?? 0),
    discovered_at: r.discovered_at,
    updated_at: r.updated_at,
  };
}

export async function insertBusinessCandidate(
  client: PoolClient,
  input: InsertCandidateInput,
): Promise<InsertCandidateOutcome> {
  const ins = await client.query<any>(
    `INSERT INTO nex.harvest_business_candidate
      (source_slug, source_probe_job_id, programme_id, country_iso, term, external_ref,
       business_name, website_url, phone, address, latitude, longitude,
       raw_tags, provenance_url, provenance_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
     ON CONFLICT (source_slug, external_ref)
       WHERE external_ref IS NOT NULL
       DO NOTHING
     RETURNING *`,
    [
      input.source_slug, input.source_probe_job_id ?? null, input.programme_id ?? null,
      input.country_iso, input.term ?? null, input.external_ref ?? null,
      input.business_name, input.website_url ?? null, input.phone ?? null, input.address ?? null,
      input.latitude ?? null, input.longitude ?? null,
      JSON.stringify(input.raw_tags ?? {}),
      input.provenance_url, input.provenance_note ?? null,
    ],
  );
  if (ins.rowCount === 1) {
    return { kind: "inserted", candidate: rowToCandidate(ins.rows[0]) };
  }
  const existing = await client.query<any>(
    `SELECT * FROM nex.harvest_business_candidate WHERE source_slug = $1 AND external_ref = $2`,
    [input.source_slug, input.external_ref],
  );
  return { kind: "duplicate", existing: rowToCandidate(existing.rows[0]) };
}

/** Link a website_walk job onto the candidate (from H3 executor). */
export async function attachWebsiteWalkJob(
  client: PoolClient,
  input: { candidate_id: string; website_walk_job_id: string },
): Promise<HarvestBusinessCandidate | null> {
  const r = await client.query<any>(
    `UPDATE nex.harvest_business_candidate
        SET website_walk_job_id = $2,
            website_walk_status = 'queued'
      WHERE candidate_id = $1
      RETURNING *`,
    [input.candidate_id, input.website_walk_job_id],
  );
  return r.rowCount === 0 ? null : rowToCandidate(r.rows[0]);
}

/** Load candidates for a scope (Founder API) · aggregate + rows. */
export interface CandidatesQuery {
  readonly programme_id?: string;
  readonly country_iso?: string;
  readonly limit?: number;
}

export interface CandidatesReport {
  readonly total: number;
  readonly with_website: number;
  readonly without_website: number;
  readonly with_walk_job: number;
  readonly by_country: readonly { country: string; total: number }[];
  readonly rows: readonly HarvestBusinessCandidate[];
}

export async function loadCandidates(client: PoolClient, q: CandidatesQuery): Promise<CandidatesReport> {
  const limit = Math.min(200, Math.max(1, q.limit ?? 50));
  const conds: string[] = [];
  const params: any[] = [];
  if (q.programme_id) { params.push(q.programme_id); conds.push(`programme_id = $${params.length}`); }
  if (q.country_iso)  { params.push(q.country_iso.toUpperCase()); conds.push(`country_iso = $${params.length}`); }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const agg = await client.query<{
    total: number; with_website: number; without_website: number; with_walk_job: number;
  }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE website_url IS NOT NULL AND website_url <> '')::int AS with_website,
            COUNT(*) FILTER (WHERE website_url IS NULL OR website_url = '')::int AS without_website,
            COUNT(*) FILTER (WHERE website_walk_job_id IS NOT NULL)::int AS with_walk_job
       FROM nex.harvest_business_candidate ${where}`,
    params,
  );
  const byCountry = await client.query<{ country: string; total: number }>(
    `SELECT country_iso AS country, COUNT(*)::int AS total
       FROM nex.harvest_business_candidate ${where}
      GROUP BY country_iso ORDER BY total DESC LIMIT 50`,
    params,
  );
  params.push(limit);
  const rows = await client.query<any>(
    `SELECT * FROM nex.harvest_business_candidate ${where}
      ORDER BY discovered_at DESC LIMIT $${params.length}`,
    params,
  );
  const a = agg.rows[0] ?? { total: 0, with_website: 0, without_website: 0, with_walk_job: 0 };
  return {
    total: a.total, with_website: a.with_website, without_website: a.without_website,
    with_walk_job: a.with_walk_job,
    by_country: byCountry.rows,
    rows: rows.rows.map(rowToCandidate),
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _CANDIDATE_NEVER_DELETES = "no_delete_or_purge_function_exported";
export const _CANDIDATE_IDEMPOTENT_INSERT =
  "UNIQUE_source_slug_external_ref_makes_re_probe_return_duplicate_never_double_row";
export const _CANDIDATE_WEBSITE_URL_NULLABLE =
  "website_url_stays_null_when_source_did_not_provide_it_never_fabricated";
