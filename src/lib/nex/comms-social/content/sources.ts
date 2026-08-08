// NEX Comms Centre · Social · content source CRUD.
//
// Charter §S-IV enforcement lives here: sources with rights_status
// outside AUTOPUBLISH_ELIGIBLE_RIGHTS are NEVER returned by the
// generator-facing listers. Admin/UI listers can still see them so a
// merchant can complete attestation.

import type { PgClientLike } from "@/lib/nex/db";
import {
  AUTOPUBLISH_ELIGIBLE_RIGHTS,
  type ContentSource,
  type ContentSourceKind,
  type RightsStatus,
} from "./types";
import type { TenantId } from "../types";

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function rowToSource(r: Record<string, unknown>): ContentSource {
  return {
    source_id:                      String(r.source_id),
    tenant_id:                      String(r.tenant_id),
    kind:                           r.kind as ContentSourceKind,
    slug:                           (r.slug as string | null) ?? null,
    content:                        (r.content as Record<string, unknown>) ?? {},
    rights_status:                  r.rights_status as RightsStatus,
    contains_identifiable_persons:  Boolean(r.contains_identifiable_persons),
    person_release_evidence_url:    (r.person_release_evidence_url as string | null) ?? null,
    attested_by:                    (r.attested_by as string | null) ?? null,
    attested_at:                    isoOf(r.attested_at),
    expires_at:                     isoOf(r.expires_at),
    active:                         Boolean(r.active),
    created_at:                     isoOf(r.created_at) ?? new Date().toISOString(),
    updated_at:                     isoOf(r.updated_at) ?? new Date().toISOString(),
  };
}

export interface UpsertSourceInput {
  client:                         PgClientLike;
  tenant_id:                      TenantId;
  kind:                           ContentSourceKind;
  slug?:                          string;
  content:                        Record<string, unknown>;
  rights_status?:                 RightsStatus;
  contains_identifiable_persons?: boolean;
  person_release_evidence_url?:   string;
  attested_by?:                   string;
  attestation_ip?:                string;
  expires_at?:                    string;
  active?:                        boolean;
}

export async function upsertContentSource(input: UpsertSourceInput): Promise<ContentSource> {
  // Explicit casts on every parameter to avoid 42P08 "could not
  // determine data type of parameter" when NULL is supplied. Also
  // compute `attested_at` in the caller so the SQL doesn't reference
  // the same parameter twice with derived logic.
  const attestedAt = input.attested_by ? new Date().toISOString() : null;
  const r = await input.client.query(
    `INSERT INTO nex.social_content_sources
       (tenant_id, kind, slug, content, rights_status,
        contains_identifiable_persons, person_release_evidence_url,
        attested_by, attested_at, attestation_ip, expires_at, active)
     VALUES ($1::uuid, $2::text, $3::text, $4::jsonb, $5::text,
             $6::boolean, $7::text,
             $8::text, $9::timestamptz, $10::inet, $11::timestamptz, $12::boolean)
     ON CONFLICT (tenant_id, kind, slug) DO UPDATE
       SET content = EXCLUDED.content,
           rights_status = EXCLUDED.rights_status,
           contains_identifiable_persons = EXCLUDED.contains_identifiable_persons,
           person_release_evidence_url = EXCLUDED.person_release_evidence_url,
           attested_by = EXCLUDED.attested_by,
           attested_at = EXCLUDED.attested_at,
           attestation_ip = EXCLUDED.attestation_ip,
           expires_at = EXCLUDED.expires_at,
           active = EXCLUDED.active,
           updated_at = NOW()
     RETURNING *`,
    [
      input.tenant_id, input.kind, input.slug ?? null,
      JSON.stringify(input.content),
      input.rights_status ?? "unknown",
      input.contains_identifiable_persons ?? false,
      input.person_release_evidence_url ?? null,
      input.attested_by ?? null,
      attestedAt,
      input.attestation_ip ?? null,
      input.expires_at ?? null,
      input.active ?? true,
    ],
  );
  return rowToSource(r.rows[0]);
}

// Generator-facing lister · returns ONLY autopublish-eligible sources.
// Filters (a) active=TRUE, (b) rights_status in eligible set,
// (c) expires_at > NOW() when applicable,
// (d) contains_identifiable_persons=FALSE OR person_release_evidence_url IS NOT NULL.
export async function listEligibleSources(
  client: PgClientLike,
  tenant_id: TenantId,
  kind?: ContentSourceKind,
): Promise<ContentSource[]> {
  const params: unknown[] = [tenant_id];
  let sql = `
    SELECT * FROM nex.social_content_sources
     WHERE tenant_id = $1
       AND active = TRUE
       AND rights_status = ANY($2)
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (contains_identifiable_persons = FALSE OR person_release_evidence_url IS NOT NULL)
  `;
  params.push(AUTOPUBLISH_ELIGIBLE_RIGHTS as unknown as string[]);
  if (kind) { params.push(kind); sql += ` AND kind = $${params.length}`; }
  sql += ` ORDER BY kind, slug, created_at DESC`;
  const r = await client.query(sql, params);
  return r.rows.map(rowToSource);
}

// Admin/UI-facing lister · returns EVERYTHING so a merchant can see
// pending attestations. This function is intentionally distinct from
// listEligibleSources; do not merge them.
export async function listAllSources(
  client: PgClientLike,
  tenant_id: TenantId,
): Promise<ContentSource[]> {
  const r = await client.query(
    `SELECT * FROM nex.social_content_sources
      WHERE tenant_id = $1
      ORDER BY kind, slug, created_at DESC`,
    [tenant_id],
  );
  return r.rows.map(rowToSource);
}

// Fetch one source by ID · tenant-scoped via RLS + explicit filter.
export async function getSourceById(
  client: PgClientLike,
  tenant_id: TenantId,
  source_id: string,
): Promise<ContentSource | null> {
  const r = await client.query(
    `SELECT * FROM nex.social_content_sources WHERE source_id = $1 AND tenant_id = $2`,
    [source_id, tenant_id],
  );
  return r.rows[0] ? rowToSource(r.rows[0]) : null;
}

// Dotted-path getter over a source's content JSON. Returns undefined
// on any missing hop. Used by the generator to extract variable values.
export function getBySourcePath(source: ContentSource, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = source.content;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
