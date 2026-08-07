// NEX A/B Testing · per-variant conversion stats
//
// Reads only from nex.analytics_events + nex.experiment_assignments.
// Zero writes. Computed on read (no aggregation table for MVP · fine
// for typical experiment sizes; add rollup later if needed).

import { withClient } from "@/lib/nex/delivery/db";
import { getExperiment } from "./registry";
import type { ExperimentStats, VariantStats } from "./types";

export async function computeExperimentStats(experiment_id: string): Promise<ExperimentStats | null> {
  const bundle = await getExperiment(experiment_id);
  if (!bundle) return null;
  const { experiment, variants } = bundle;

  const r = await withClient(async (c) => {
    // Per-variant contact counts (assignments)
    const assignRes = await c.query(
      `SELECT variant_id, COUNT(*)::int AS n FROM nex.experiment_assignments WHERE experiment_id = $1 GROUP BY variant_id`,
      [experiment_id],
    );
    const assigned: Record<string, number> = {};
    for (const row of assignRes.rows) assigned[String(row.variant_id)] = Number(row.n);

    // Per-variant analytics event counts (uses reserved experiment_id + variant_id fields)
    const eventRes = await c.query(
      `SELECT variant_id, event_type, COUNT(*)::int AS n
       FROM nex.analytics_events
       WHERE experiment_id = $1 AND variant_id IS NOT NULL
       GROUP BY variant_id, event_type`,
      [experiment_id],
    );

    // Nested count map: variant_id → event_type → count
    const eventCounts: Record<string, Record<string, number>> = {};
    for (const row of eventRes.rows) {
      const vid = String(row.variant_id);
      const et = String(row.event_type);
      eventCounts[vid] ??= {};
      eventCounts[vid][et] = Number(row.n);
    }

    // Goal event counts within the goal window · goal reached if a matching
    // event occurred within `goal_within_seconds` of the FIRST 'queued' event
    // for that (variant, contact). Simpler MVP: count DISTINCT recipient_ids
    // that have any goal event for this experiment (any variant).
    const goalRes = await c.query(
      `SELECT variant_id, COUNT(DISTINCT recipient_id)::int AS n
       FROM nex.analytics_events
       WHERE experiment_id = $1 AND variant_id IS NOT NULL
         AND event_type = $2
         AND event_timestamp > NOW() - INTERVAL '${Math.max(60, experiment.goal_within_seconds)} seconds'
       GROUP BY variant_id`,
      [experiment_id, experiment.goal_event_type],
    );
    const goals: Record<string, number> = {};
    for (const row of goalRes.rows) goals[String(row.variant_id)] = Number(row.n);

    return { assigned, eventCounts, goals };
  });

  const perVariant: VariantStats[] = variants.map((v) => {
    const assigned_contacts = r?.assigned[v.variant_id] ?? 0;
    const ev = r?.eventCounts[v.variant_id] ?? {};
    const sent      = ev.queued    ?? 0;
    const delivered = ev.delivered ?? 0;
    const opens     = ev.opened    ?? 0;
    const clicks    = ev.clicked   ?? 0;
    const goal_hits = r?.goals[v.variant_id] ?? 0;
    const denom = (n: number) => n > 0 ? n : null;
    return {
      variant_id: v.variant_id,
      name: v.name,
      allocation_pct: v.allocation_pct,
      assigned_contacts, sent, delivered, opens, clicks, goal_hits,
      conversion_rate: denom(assigned_contacts) ? Math.round((goal_hits / assigned_contacts) * 10000) / 100 : null,
      delivery_rate:   denom(sent)      ? Math.round((delivered / sent)     * 10000) / 100 : null,
      open_rate:       denom(delivered) ? Math.round((opens    / delivered) * 10000) / 100 : null,
      click_rate:      denom(delivered) ? Math.round((clicks   / delivered) * 10000) / 100 : null,
    };
  });

  return {
    experiment_id: experiment.experiment_id,
    goal_event_type: experiment.goal_event_type,
    window_seconds: experiment.goal_within_seconds,
    computed_at: new Date().toISOString(),
    variants: perVariant,
  };
}
