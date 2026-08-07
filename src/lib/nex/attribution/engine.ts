// NEX Attribution · engine
//
// Given a conversion, find qualifying touchpoints in the window, apply
// the model (first_touch · last_touch · linear), and INSERT one
// attribution row per credited touchpoint.
//
// UNIQUE(conversion_id, model, source_event_id) guarantees idempotent
// replay · invariant #14.

import { randomUUID } from "crypto";
import { withClient } from "@/lib/nex/delivery/db";
import type { AttributionModel, ConversionEvent, ConversionInput } from "./types";

// ── Touchpoint definition ────────────────────────────────────────
// Any analytics event for this contact within the window that carries
// something worth attributing to (campaign / journey / experiment).
// Defaults to `opened` and `clicked` · configurable at compute time.
const DEFAULT_TOUCHPOINT_TYPES = ["opened", "clicked"];

// ── Recording a conversion ───────────────────────────────────────
export async function recordConversion(input: ConversionInput): Promise<ConversionEvent | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.conversion_events (contact_id, event_type, conversion_value, currency, occurred_at, window_days, source, correlation_id, external_ref, payload)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (source, external_ref) DO NOTHING
       RETURNING *`,
      [
        input.contact_id, input.event_type, input.conversion_value ?? 0, input.currency ?? "GBP",
        input.occurred_at ?? null, input.window_days ?? 30, input.source ?? "webhook",
        input.correlation_id ?? null, input.external_ref ?? null, JSON.stringify(input.payload ?? {}),
      ],
    );
    if (res.rows[0]) return rowToConversion(res.rows[0]);
    // Duplicate external_ref · return the existing row
    if (input.external_ref && input.source) {
      const back = await c.query(`SELECT * FROM nex.conversion_events WHERE source = $1 AND external_ref = $2`, [input.source, input.external_ref]);
      return back.rows[0] ? rowToConversion(back.rows[0]) : null;
    }
    return null;
  });
  return r;
}

// ── Attribution compute ─────────────────────────────────────────
export type ComputeOptions = {
  models?: AttributionModel[];                            // default: all three
  touchpoint_types?: string[];                            // default: ['opened', 'clicked']
};

export type ComputeResult = {
  conversion_id: string;
  touchpoints_found: number;
  models_computed: AttributionModel[];
  attributions_written: number;
  attribution_run_id: string;
};

export async function computeAttribution(conversion_id: string, opts: ComputeOptions = {}): Promise<ComputeResult | null> {
  const models = opts.models ?? ["first_touch", "last_touch", "linear"];
  const touchpointTypes = opts.touchpoint_types ?? DEFAULT_TOUCHPOINT_TYPES;
  const runId = randomUUID();

  const r = await withClient(async (c) => {
    // Load the conversion
    const cRes = await c.query(`SELECT * FROM nex.conversion_events WHERE conversion_id = $1`, [conversion_id]);
    if (cRes.rows.length === 0) return null;
    const conv = rowToConversion(cRes.rows[0]);

    // Load qualifying touchpoints in the window
    const windowStart = new Date(new Date(conv.occurred_at).getTime() - conv.window_days * 86400_000).toISOString();
    const placeholders = touchpointTypes.map((_, i) => `$${i + 4}`).join(",");
    const tpRes = await c.query(
      `SELECT event_id, event_type, event_timestamp, campaign_id, journey_id, experiment_id, variant_id, provider, country, domain, metadata
       FROM nex.analytics_events
       WHERE recipient_id = $1
         AND event_timestamp >= $2::timestamptz
         AND event_timestamp <= $3::timestamptz
         AND event_type = ANY(ARRAY[${placeholders}])
         AND (campaign_id IS NOT NULL OR journey_id IS NOT NULL OR experiment_id IS NOT NULL)
       ORDER BY event_timestamp ASC`,
      [conv.contact_id, windowStart, conv.occurred_at, ...touchpointTypes],
    );
    const touchpoints = tpRes.rows;

    if (touchpoints.length === 0) {
      // Record a "no touchpoint" placeholder per model so reports know this conversion was processed
      for (const model of models) {
        await c.query(
          `INSERT INTO nex.attributions (conversion_id, contact_id, model, window_days, credit_pct, attributed_value, currency, attribution_run_id)
           VALUES ($1, $2, $3, $4, 0, 0, $5, $6)
           ON CONFLICT (conversion_id, model, source_event_id) DO NOTHING`,
          [conv.conversion_id, conv.contact_id, model, conv.window_days, conv.currency, runId],
        );
      }
      return { conversion_id, touchpoints_found: 0, models_computed: models, attributions_written: 0, attribution_run_id: runId };
    }

    // Compute per model
    let written = 0;
    for (const model of models) {
      const credited = pickCredited(model, touchpoints);
      for (const item of credited) {
        const t = item.tp;
        const attributed_value = Math.round(conv.conversion_value * item.credit_pct) / 100;
        const res = await c.query(
          `INSERT INTO nex.attributions
           (conversion_id, contact_id, model, window_days, credit_pct, attributed_value, currency,
            source_event_id, source_event_type, source_event_timestamp,
            campaign_id, journey_id, experiment_id, variant_id, provider, country, domain, attribution_run_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (conversion_id, model, source_event_id) DO NOTHING
           RETURNING attribution_id`,
          [
            conv.conversion_id, conv.contact_id, model, conv.window_days,
            item.credit_pct, attributed_value, conv.currency,
            t.event_id, t.event_type, t.event_timestamp,
            t.campaign_id, t.journey_id, t.experiment_id, t.variant_id,
            t.provider, t.country, t.domain, runId,
          ],
        );
        if ((res.rowCount ?? 0) > 0) written++;
      }
    }
    return { conversion_id, touchpoints_found: touchpoints.length, models_computed: models, attributions_written: written, attribution_run_id: runId };
  });
  return r;
}

/**
 * Given the ordered touchpoint list (ASC by timestamp), return the
 * subset that should receive credit and how much (%) each gets under
 * the given model. Pure function · deterministic.
 */
function pickCredited(model: AttributionModel, touchpoints: Record<string, unknown>[]): Array<{ tp: Record<string, unknown>; credit_pct: number }> {
  if (touchpoints.length === 0) return [];
  if (model === "first_touch") return [{ tp: touchpoints[0],                     credit_pct: 100 }];
  if (model === "last_touch")  return [{ tp: touchpoints[touchpoints.length - 1], credit_pct: 100 }];
  // linear · equal split
  const share = Math.round((100 / touchpoints.length) * 1000) / 1000;    // 3 decimal places
  return touchpoints.map((tp) => ({ tp, credit_pct: share }));
}

// ── Batch compute for all unattributed conversions ──────────────
export async function computePending(models?: AttributionModel[]): Promise<{ processed: number; run_ids: string[] }> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT conversion_id FROM nex.conversion_events ce
       WHERE NOT EXISTS (SELECT 1 FROM nex.attributions a WHERE a.conversion_id = ce.conversion_id)
       ORDER BY occurred_at ASC LIMIT 500`,
    );
    return res.rows.map((r0) => String(r0.conversion_id));
  }) ?? [];
  const run_ids: string[] = [];
  for (const cid of r) {
    const out = await computeAttribution(cid, { models });
    if (out?.attribution_run_id) run_ids.push(out.attribution_run_id);
  }
  return { processed: r.length, run_ids };
}

// ── Read helpers ────────────────────────────────────────────────
export async function listConversions(limit = 100): Promise<ConversionEvent[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.conversion_events ORDER BY occurred_at DESC LIMIT ${Math.max(1, Math.min(500, limit))}`);
    return res.rows.map(rowToConversion);
  });
  return r ?? [];
}

export async function listAttributionsForContact(contact_id: string, model?: AttributionModel): Promise<Array<Record<string, unknown>>> {
  const r = await withClient(async (c) => {
    const params: unknown[] = [contact_id];
    const modelClause = model ? `AND model = $${params.push(model)}` : "";
    const res = await c.query(
      `SELECT a.*, ce.event_type AS conversion_type, ce.conversion_value AS conversion_value
       FROM nex.attributions a
       JOIN nex.conversion_events ce ON ce.conversion_id = a.conversion_id
       WHERE a.contact_id = $1 ${modelClause}
       ORDER BY a.computed_at DESC LIMIT 500`,
      params,
    );
    return res.rows;
  });
  return r ?? [];
}

// Normalize a pg row's timestamp field to ISO 8601 (pg driver returns
// JS Date objects · their .toString() produces "GMT+0700 (…)" which
// Postgres refuses on re-parse · always use ISO).
function isoOf(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

// ── Row mapping ──────────────────────────────────────────────────
export function rowToConversion(r: Record<string, unknown>): ConversionEvent {
  return {
    conversion_id: String(r.conversion_id),
    contact_id: String(r.contact_id),
    event_type: String(r.event_type),
    conversion_value: Number(r.conversion_value),
    currency: String(r.currency),
    occurred_at: isoOf(r.occurred_at),
    window_days: Number(r.window_days),
    source: r.source as ConversionEvent["source"],
    correlation_id: (r.correlation_id as string | null) ?? null,
    external_ref:   (r.external_ref   as string | null) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    created_at: isoOf(r.created_at),
  };
}
