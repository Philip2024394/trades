// src/lib/nex/discovery-world/business-evidence.ts
//
// Per-business evidence recorder + Founder-only reader.
// Founder-authorised programme · bounded wave · 2026-09-21.
//
// Founder-only visibility (§Founder should be able to see the email
// addresses here if this is an authorized Founder-only operational surface):
//   * loadBusinessesForCountry() returns full evidence including
//     discovered_email · caller MUST be Founder-authenticated.
//   * There is NO member-facing route for this table.

import type { PoolClient } from "pg";
import type { BusinessEvidence } from "./types";

export interface RecordBusinessInput {
  readonly programme_id: string;
  readonly iso: string;
  readonly cycle_id: string | null;
  readonly business_name: string;
  readonly website_url?: string | null;
  readonly contact_page_url?: string | null;
  readonly services?: ReadonlyArray<string>;
  readonly category?: string | null;
  readonly discovered_via_term: string;
  readonly discovered_via_source: string;
  readonly discovered_via_evidence_url?: string | null;
  readonly discovered_email?: string | null;
  readonly email_source_url?: string | null;
  readonly email_extraction_confidence?: number | null;
  readonly metadata?: Record<string, unknown>;
}

export async function recordBusinessEvidence(
  client: PoolClient,
  input: RecordBusinessInput,
): Promise<{ kind: "created" | "updated"; evidence: BusinessEvidence }> {
  const services = input.services ?? [];
  const res = await client.query(
    `INSERT INTO nex.discovery_business_evidence
        (programme_id, iso_alpha_2, cycle_id, business_name, website_url,
         contact_page_url, services, category, discovered_via_term,
         discovered_via_source, discovered_via_evidence_url,
         discovered_email, email_source_url, email_extraction_confidence, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     ON CONFLICT (programme_id, iso_alpha_2, business_name, website_url) DO UPDATE SET
        contact_page_url = COALESCE(EXCLUDED.contact_page_url, nex.discovery_business_evidence.contact_page_url),
        services = ARRAY(SELECT DISTINCT unnest(nex.discovery_business_evidence.services || EXCLUDED.services)),
        category = COALESCE(EXCLUDED.category, nex.discovery_business_evidence.category),
        discovered_email = COALESCE(EXCLUDED.discovered_email, nex.discovery_business_evidence.discovered_email),
        email_source_url = COALESCE(EXCLUDED.email_source_url, nex.discovery_business_evidence.email_source_url),
        email_extraction_confidence = GREATEST(
            COALESCE(nex.discovery_business_evidence.email_extraction_confidence, 0),
            COALESCE(EXCLUDED.email_extraction_confidence, 0)),
        last_seen_at = now(),
        cycle_id = COALESCE(EXCLUDED.cycle_id, nex.discovery_business_evidence.cycle_id)
     RETURNING *, (xmax = 0) AS is_insert`,
    [
      input.programme_id, input.iso.toUpperCase(), input.cycle_id, input.business_name,
      input.website_url ?? null, input.contact_page_url ?? null, services,
      input.category ?? null, input.discovered_via_term, input.discovered_via_source,
      input.discovered_via_evidence_url ?? null,
      input.discovered_email ? String(input.discovered_email).toLowerCase() : null,
      input.email_source_url ?? null, input.email_extraction_confidence ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const row = res.rows[0];
  return { kind: row.is_insert ? "created" : "updated", evidence: rowToEvidence(row) };
}

/** Founder-only reader. Callers MUST have passed Founder auth. */
export async function loadBusinessesForCountry(
  client: PoolClient,
  input: { programme_id: string; iso: string; limit?: number; offset?: number; with_email_only?: boolean },
): Promise<{ total: number; rows: ReadonlyArray<BusinessEvidence> }> {
  const limit = Math.min(500, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const where: string[] = ["programme_id = $1", "iso_alpha_2 = $2"];
  const params: unknown[] = [input.programme_id, input.iso.toUpperCase()];
  if (input.with_email_only) where.push("discovered_email IS NOT NULL");
  const totalRes = await client.query(
    `SELECT COUNT(*)::int AS n FROM nex.discovery_business_evidence WHERE ${where.join(" AND ")}`,
    params,
  );
  params.push(limit); params.push(offset);
  const rowsRes = await client.query(
    `SELECT * FROM nex.discovery_business_evidence
      WHERE ${where.join(" AND ")}
      ORDER BY last_seen_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    total: Number(totalRes.rows[0].n),
    rows: rowsRes.rows.map(rowToEvidence),
  };
}

function rowToEvidence(r: any): BusinessEvidence {
  return {
    evidence_id: r.evidence_id, programme_id: r.programme_id, iso_alpha_2: r.iso_alpha_2,
    cycle_id: r.cycle_id, business_name: r.business_name, website_url: r.website_url,
    contact_page_url: r.contact_page_url, services: r.services ?? [],
    category: r.category, discovered_via_term: r.discovered_via_term,
    discovered_via_source: r.discovered_via_source,
    discovered_via_evidence_url: r.discovered_via_evidence_url,
    discovered_email: r.discovered_email, email_source_url: r.email_source_url,
    email_extraction_confidence: r.email_extraction_confidence == null ? null : Number(r.email_extraction_confidence),
    first_seen_at: r.first_seen_at, last_seen_at: r.last_seen_at,
    metadata: r.metadata ?? {},
  };
}
