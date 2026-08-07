// NEX Attribution · reports
//
// Aggregates attributed_value by source dimension (campaign · journey ·
// experiment · variant · provider · country · domain) for a given model
// + optional window filter. Pure read · returns a ReportSummary.

import { withClient } from "@/lib/nex/delivery/db";
import type { AttributionModel, ReportRow, ReportSummary } from "./types";

export type ReportOptions = {
  model?: AttributionModel;                              // default: last_touch (industry-common)
  window_days?: number;                                   // filter to conversions with this window · default: any
  since?: string;                                         // computed_at > since · default: 30 days ago
};

const GROUPS = ["campaign", "journey", "experiment", "variant", "provider", "country", "domain"] as const;

export async function computeReport(opts: ReportOptions = {}): Promise<ReportSummary> {
  const model = opts.model ?? "last_touch";
  const since = opts.since ?? new Date(Date.now() - 30 * 86400_000).toISOString();
  const zero: Record<(typeof GROUPS)[number], ReportRow[]> = { campaign: [], journey: [], experiment: [], variant: [], provider: [], country: [], domain: [] };

  const r = await withClient(async (c) => {
    // Totals
    const totalsRes = await c.query(
      `SELECT
         COUNT(DISTINCT a.conversion_id)::int   AS conversions,
         COUNT(DISTINCT a.contact_id)::int      AS contacts,
         COALESCE(SUM(a.attributed_value), 0)   AS attributed_value,
         COALESCE(MAX(a.currency), 'GBP')       AS currency
       FROM nex.attributions a
       WHERE a.model = $1 AND a.computed_at > $2::timestamptz
         AND ($3::int IS NULL OR a.window_days = $3)`,
      [model, since, opts.window_days ?? null],
    );
    const totals = totalsRes.rows[0] as { conversions: number; contacts: number; attributed_value: number; currency: string };

    // Per-source aggregations
    const by_source_type = { ...zero };
    for (const g of GROUPS) {
      const col = g === "campaign" ? "campaign_id" :
                  g === "journey"  ? "journey_id"  :
                  g === "experiment" ? "experiment_id" :
                  g === "variant"  ? "variant_id"  :
                  g === "provider" ? "provider"    :
                  g === "country"  ? "country"     :
                                     "domain";
      const res = await c.query(
        `SELECT ${col}::text AS key,
                COUNT(DISTINCT a.conversion_id)::int AS conversions,
                COUNT(DISTINCT a.contact_id)::int    AS contacts,
                COALESCE(SUM(a.attributed_value), 0) AS attributed_value,
                COALESCE(MAX(a.currency), 'GBP')     AS currency
         FROM nex.attributions a
         WHERE a.model = $1
           AND a.computed_at > $2::timestamptz
           AND a.${col} IS NOT NULL
           AND ($3::int IS NULL OR a.window_days = $3)
         GROUP BY ${col}
         ORDER BY attributed_value DESC NULLS LAST
         LIMIT 15`,
        [model, since, opts.window_days ?? null],
      );
      by_source_type[g] = res.rows.map((r0) => ({
        key: String(r0.key ?? ""),
        label: null,                                       // resolved by caller if wanted
        conversions: Number(r0.conversions),
        contacts:    Number(r0.contacts),
        attributed_value: Number(r0.attributed_value),
        currency: String(r0.currency),
      }));
    }

    return {
      window_days: opts.window_days ?? 0,
      model, totals: {
        conversions:      Number(totals.conversions ?? 0),
        contacts:         Number(totals.contacts ?? 0),
        attributed_value: Number(totals.attributed_value ?? 0),
        currency:         String(totals.currency ?? "GBP"),
      },
      by_source_type,
      computed_at: new Date().toISOString(),
    };
  });

  return r ?? { window_days: opts.window_days ?? 0, model, totals: { conversions: 0, contacts: 0, attributed_value: 0, currency: "GBP" }, by_source_type: zero, computed_at: new Date().toISOString() };
}

// Attach labels to campaign/journey/experiment rows for display
export async function labelReport(report: ReportSummary): Promise<ReportSummary> {
  const ids = {
    campaign:   report.by_source_type.campaign.map((r) => r.key).filter(Boolean),
    journey:    report.by_source_type.journey.map((r) => r.key).filter(Boolean),
    experiment: report.by_source_type.experiment.map((r) => r.key).filter(Boolean),
  };
  const labels = await withClient(async (c) => {
    const map: Record<string, Record<string, string>> = { campaign: {}, journey: {}, experiment: {} };
    if (ids.campaign.length > 0) {
      const res = await c.query(`SELECT campaign_id::text AS k, name FROM nex.campaigns WHERE campaign_id = ANY($1::uuid[])`, [ids.campaign]);
      for (const row of res.rows) map.campaign[String(row.k)] = String(row.name);
    }
    if (ids.journey.length > 0) {
      const res = await c.query(`SELECT journey_id::text AS k, name FROM nex.journeys WHERE journey_id = ANY($1::uuid[])`, [ids.journey]);
      for (const row of res.rows) map.journey[String(row.k)] = String(row.name);
    }
    if (ids.experiment.length > 0) {
      const res = await c.query(`SELECT experiment_id::text AS k, name FROM nex.experiments WHERE experiment_id = ANY($1::uuid[])`, [ids.experiment]);
      for (const row of res.rows) map.experiment[String(row.k)] = String(row.name);
    }
    return map;
  }) ?? { campaign: {}, journey: {}, experiment: {} };

  const stamp = (rows: ReportRow[], m: Record<string, string>): ReportRow[] =>
    rows.map((r) => ({ ...r, label: m[r.key] ?? null }));

  return {
    ...report,
    by_source_type: {
      ...report.by_source_type,
      campaign:   stamp(report.by_source_type.campaign,   labels.campaign),
      journey:    stamp(report.by_source_type.journey,    labels.journey),
      experiment: stamp(report.by_source_type.experiment, labels.experiment),
    },
  };
}
