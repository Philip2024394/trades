// NEX Delivery Engine · recipient expansion
//
// Given a campaign_id · runs each attached segment's filter against
// the Contact Registry · unions & dedupes at contact_id · applies
// compliance ratchet (never_contact, unsubscribed, no_marketing_consent
// for marketing campaigns · invalid email) · writes results to
// nex.campaign_recipients (immutable snapshot).
//
// Idempotent: `ON CONFLICT DO NOTHING` on the primary key means
// re-runs don't duplicate. New segment additions after expansion do
// NOT retroactively join the snapshot.

import { withClient } from "./db";
import { getCampaign } from "@/lib/nex/campaigns/registry";
import { getSegment } from "@/lib/nex/segments/registry";
import { decideWindow } from "./window";

export type ExpansionResult = {
  campaign_id: string;
  matched: number;
  inserted: number;
  suppressed: number;
  skipped_window: number;
  by_country: Record<string, number>;
  segments_used: string[];
  warnings: string[];
};

/**
 * Build the recipient snapshot for a campaign. Returns counts.
 * `campaigns.body_html` MUST already be rendered · this function is
 * only for identity + eligibility resolution.
 */
export async function expandCampaign(campaign_id: string): Promise<ExpansionResult | null> {
  const campaign = await getCampaign(campaign_id);
  if (!campaign) return null;

  const isMarketing = campaign.campaign_type !== "transactional";
  const warnings: string[] = [];
  const segments_used: string[] = [];

  // Collect segment filters
  const filters: unknown[] = [];
  for (const sid of campaign.segment_ids) {
    const seg = await getSegment(sid);
    if (seg) { filters.push(seg.filter); segments_used.push(sid); }
  }
  if (filters.length === 0) warnings.push("no segments attached · nothing to expand");

  const r = await withClient(async (c) => {
    // Build UNION of segment queries against the canonical contacts
    // view, dedupe by contact_id, apply compliance filter, then insert.
    if (filters.length === 0) return null;

    // Simple approach for MVP: pull every candidate contact via a
    // canonical DISTINCT ON view, apply per-segment matching in-memory
    // is too much for large registries — instead use per-filter SQL.
    //
    // Here we intersect the SAME filter shape used by segments/preview.
    // For MVP we accept the same limitations (countries/regions/trades/
    // consents/sources/dates/search) and enforce compliance one final
    // time so the snapshot is always safe.
    const wheres: string[] = ["c.deleted_at IS NULL", "c.canonical_email IS NOT NULL"];
    const params: unknown[] = [];
    const push = (v: unknown) => { params.push(v); return `$${params.length}`; };

    // Union across all filters via OR blocks
    const orGroups: string[] = [];
    for (const f of filters as Array<Record<string, unknown>>) {
      const gws: string[] = [];
      if (Array.isArray(f.countries) && (f.countries as string[]).length > 0) {
        const placeholders = (f.countries as string[]).map((v) => push(v)).join(",");
        gws.push(`c.country = ANY(ARRAY[${placeholders}])`);
      }
      if (Array.isArray(f.regions) && (f.regions as string[]).length > 0) {
        const placeholders = (f.regions as string[]).map((v) => push(String(v).toLowerCase())).join(",");
        gws.push(`LOWER(c.region) = ANY(ARRAY[${placeholders}])`);
      }
      if (Array.isArray(f.trades) && (f.trades as string[]).length > 0) {
        const placeholders = (f.trades as string[]).map((v) => push(v)).join(",");
        gws.push(`c.trade_categories ?| ARRAY[${placeholders}]`);
      }
      if (typeof f.consent_marketing === "boolean")     gws.push(`c.consent_marketing = ${push(f.consent_marketing)}`);
      if (typeof f.consent_transactional === "boolean") gws.push(`c.consent_transactional = ${push(f.consent_transactional)}`);
      if (typeof f.search === "string" && f.search) {
        const like = push(`%${(f.search as string).toLowerCase()}%`);
        gws.push(`(LOWER(COALESCE(c.name, '')) LIKE ${like} OR LOWER(COALESCE(c.email, '')) LIKE ${like} OR LOWER(COALESCE(c.company, '')) LIKE ${like})`);
      }
      orGroups.push(gws.length > 0 ? `(${gws.join(" AND ")})` : "TRUE");
    }
    if (orGroups.length > 0) wheres.push(`(${orGroups.join(" OR ")})`);

    // Compliance ratchet applied at expansion so suppressed rows still
    // land in the snapshot (for reporting) but with suppressed_reason set.
    const canonicalSql = `
      WITH canonical AS (
        SELECT DISTINCT ON (contact_id) *
        FROM nex.contacts
        ORDER BY contact_id, updated_at DESC
      )
      SELECT c.contact_id, c.name, c.company, c.canonical_email AS email, c.country, c.trade_categories,
             c.consent_marketing, c.never_contact, c.unsubscribe_at
      FROM canonical c
      WHERE ${wheres.join(" AND ")}
    `;

    const res = await c.query(canonicalSql, params);
    let inserted = 0, suppressed = 0, skipped_window = 0;
    const by_country: Record<string, number> = {};
    const matched = res.rows.length;

    for (const row of res.rows) {
      const contact_id = String(row.contact_id);
      const email      = String(row.email ?? "");
      const country    = (row.country as string | null) ?? null;
      const trades     = Array.isArray(row.trade_categories) ? row.trade_categories as string[] : [];

      // Variables at expansion time · unsubscribe_link left for the Runtime
      const variables = {
        name:         (row.name as string | null) ?? "",
        company:      (row.company as string | null) ?? "",
        trade:        trades[0] ?? "",
        country:      country ?? "",
        email:        email ?? "",
        current_year: String(new Date().getFullYear()),
      };

      // Compliance
      let suppressed_reason: string | null = null;
      let send_status: "pending" | "suppressed" | "skipped_window" = "pending";
      if (row.never_contact === true)                                       { suppressed_reason = "never_contact"; send_status = "suppressed"; suppressed++; }
      else if (row.unsubscribe_at !== null)                                 { suppressed_reason = "unsubscribed"; send_status = "suppressed"; suppressed++; }
      else if (isMarketing && row.consent_marketing !== true)               { suppressed_reason = "no_marketing_consent"; send_status = "suppressed"; suppressed++; }
      else if (!email)                                                      { suppressed_reason = "invalid_email"; send_status = "suppressed"; suppressed++; }

      // Country send-window · pending → skipped_window if outside window
      let scheduled_for: string | null = null;
      if (send_status === "pending") {
        const decision = decideWindow(country);
        if (!decision.in_window) {
          scheduled_for = decision.next_eligible_at;
          send_status = "skipped_window";
          skipped_window++;
        } else {
          scheduled_for = decision.next_eligible_at;
        }
      }

      const insertRes = await c.query(
        `INSERT INTO nex.campaign_recipients (campaign_id, contact_id, email, country, variables, send_status, suppressed_reason, scheduled_for)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         ON CONFLICT (campaign_id, contact_id) DO NOTHING`,
        [campaign_id, contact_id, email, country, JSON.stringify(variables), send_status, suppressed_reason, scheduled_for],
      );
      if ((insertRes.rowCount ?? 0) > 0) inserted++;
      if (country) by_country[country] = (by_country[country] ?? 0) + 1;
    }

    return { campaign_id, matched, inserted, suppressed, skipped_window, by_country, segments_used, warnings };
  });

  return r ?? { campaign_id, matched: 0, inserted: 0, suppressed: 0, skipped_window: 0, by_country: {}, segments_used, warnings: [...warnings, "database unreachable"] };
}

/**
 * Fetch pending recipients for a campaign (send_status = pending AND
 * scheduled_for <= now). Returns up to `limit` rows and marks NOTHING —
 * caller sends via the provider then updates each row.
 */
export async function claimNextRecipients(campaign_id: string, limit = 25) {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT campaign_id, contact_id, email, country, variables, attempts
       FROM nex.campaign_recipients
       WHERE campaign_id = $1
         AND send_status = 'pending'
         AND (scheduled_for IS NULL OR scheduled_for <= NOW())
       ORDER BY country NULLS LAST, contact_id
       LIMIT ${Math.max(1, Math.min(500, limit))}`,
      [campaign_id],
    );
    return res.rows;
  });
  return r ?? [];
}

export async function recordRecipientSend(input: {
  campaign_id: string; contact_id: string; ok: boolean;
  provider: string; provider_message_id?: string;
  latency_ms: number; error?: string; permanent?: boolean;
}): Promise<void> {
  await withClient(async (c) => {
    if (input.ok) {
      await c.query(
        `UPDATE nex.campaign_recipients
         SET send_status = 'sent', sent_at = NOW(),
             provider = $1, provider_message_id = $2, latency_ms = $3, attempts = attempts + 1
         WHERE campaign_id = $4 AND contact_id = $5`,
        [input.provider, input.provider_message_id ?? null, input.latency_ms, input.campaign_id, input.contact_id],
      );
    } else if (input.permanent) {
      await c.query(
        `UPDATE nex.campaign_recipients
         SET send_status = 'failed', failed_at = NOW(),
             provider = $1, latency_ms = $2, last_error = $3, attempts = attempts + 1
         WHERE campaign_id = $4 AND contact_id = $5`,
        [input.provider, input.latency_ms, (input.error ?? "").slice(0, 500), input.campaign_id, input.contact_id],
      );
    } else {
      // transient → keep pending, bump attempts, schedule short retry
      await c.query(
        `UPDATE nex.campaign_recipients
         SET attempts = attempts + 1, last_error = $1, scheduled_for = NOW() + INTERVAL '60 seconds', provider = $2
         WHERE campaign_id = $3 AND contact_id = $4`,
        [(input.error ?? "").slice(0, 500), input.provider, input.campaign_id, input.contact_id],
      );
    }
    return null;
  });
}

export type CampaignRecipientMetrics = {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  suppressed: number;
  skipped_window: number;
  by_country: Array<{ country: string | null; count: number }>;
};

export async function getCampaignRecipientMetrics(campaign_id: string): Promise<CampaignRecipientMetrics> {
  const r = await withClient(async (c) => {
    const totalRes  = await c.query(`SELECT send_status, COUNT(*)::int AS n FROM nex.campaign_recipients WHERE campaign_id = $1 GROUP BY send_status`, [campaign_id]);
    const byCountry = await c.query(`SELECT country, COUNT(*)::int AS n FROM nex.campaign_recipients WHERE campaign_id = $1 GROUP BY country ORDER BY n DESC LIMIT 15`, [campaign_id]);
    const out: CampaignRecipientMetrics = { total: 0, pending: 0, sent: 0, failed: 0, suppressed: 0, skipped_window: 0, by_country: [] };
    for (const row of totalRes.rows) {
      const st = String(row.send_status);
      const n = Number(row.n);
      out.total += n;
      if (st === "pending") out.pending = n;
      if (st === "sent") out.sent = n;
      if (st === "failed") out.failed = n;
      if (st === "suppressed") out.suppressed = n;
      if (st === "skipped_window") out.skipped_window = n;
    }
    out.by_country = byCountry.rows.map((r0) => ({ country: (r0.country as string | null) ?? null, count: Number(r0.n) }));
    return out;
  });
  return r ?? { total: 0, pending: 0, sent: 0, failed: 0, suppressed: 0, skipped_window: 0, by_country: [] };
}
