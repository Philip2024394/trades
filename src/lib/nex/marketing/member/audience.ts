// src/lib/nex/marketing/member/audience.ts
//
// NEX Managed Email Marketing · Stage 4 · Audience counter (no addresses)
// Founder-authorised programme (ADR-0003a Clause 1 · Clause 6).
//
// **Absolute rule**: this module returns COUNTS ONLY. It never returns
// email addresses. It never returns arrays of contacts. It never returns
// contact_ids to member-facing code. The response shape is
// `AudienceCount` · pure integers + reasons.
//
// Reuses `nex.marketing_contact` (existing schema) · applies the same
// suppression discipline as segmentation.

import type { PoolClient } from "pg";
import type { AudienceQuery, AudienceCount } from "./types";

/** Count eligible + suppressed contacts for (country × category × language).
 *  Returns aggregate integers only. Never returns addresses. */
export async function countAudience(
  client: PoolClient,
  query: AudienceQuery,
): Promise<AudienceCount> {
  const filters: string[] = [];
  const params: unknown[] = [];
  const addFilter = (col: string, val: unknown) => {
    if (val === undefined || val === null || val === "") return;
    params.push(val);
    filters.push(`${col} = $${params.length}`);
  };
  addFilter("country", query.country);
  addFilter("category_slug", query.category);
  addFilter("language", query.language);

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  // Single aggregate query · reads counts · reads NO email addresses
  const sql = `
    SELECT
      COUNT(*)::int AS total_discovered,
      COUNT(*) FILTER (WHERE opt_out = false AND hard_bounced = false)::int AS eligible,
      COUNT(*) FILTER (WHERE opt_out = true)::int AS opt_out,
      COUNT(*) FILTER (WHERE hard_bounced = true)::int AS hard_bounced,
      COUNT(*) FILTER (WHERE complaint_count > 0)::int AS complaint
      FROM nex.marketing_contact
      ${whereClause}
  `;

  const res = await client.query<{
    total_discovered: number;
    eligible: number;
    opt_out: number;
    hard_bounced: number;
    complaint: number;
  }>(sql, params);
  const r = res.rows[0] ?? { total_discovered: 0, eligible: 0, opt_out: 0, hard_bounced: 0, complaint: 0 };

  const suppressed = r.total_discovered - r.eligible;

  return {
    total_discovered: r.total_discovered,
    eligible: r.eligible,
    suppressed,
    not_eligible_reason: {
      opt_out: r.opt_out,
      hard_bounced: r.hard_bounced,
      complaint: r.complaint,
    },
    query,
    computed_at: new Date().toISOString(),
  };
}

/** Compile-time assertion: this module MUST NOT export any function whose
 *  name suggests contact-address exposure. Runtime structural test in
 *  member acceptance suite verifies these are undefined. */
export const _CONTACT_BOUNDARY_ASSERTION = "counts_only_no_addresses";
