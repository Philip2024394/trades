// NEX Journey Engine · registry (list · get · publish · metrics)
//
// CRUD-ish wrappers that keep the API layer thin.

import { withClient } from "@/lib/nex/delivery/db";
import { parseDefinition } from "./definition/parser";
import { validateForActivation } from "./definition/validator";
import { createDraft, rowToJourney, type NewVersionInput } from "./definition/versioning";
import type { Journey, JourneyState } from "./types";
import { rowToState } from "./runtime/tick";

export async function listJourneys(): Promise<Journey[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journeys ORDER BY slug ASC, version DESC`);
    return res.rows.map(rowToJourney);
  });
  return r ?? [];
}

export async function getJourney(journey_id: string): Promise<Journey | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journeys WHERE journey_id = $1`, [journey_id]);
    return res.rows[0] ? rowToJourney(res.rows[0]) : null;
  });
  return r ?? null;
}

export async function listVersionsForSlug(slug: string): Promise<Journey[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journeys WHERE slug = $1 ORDER BY version DESC`, [slug]);
    return res.rows.map(rowToJourney);
  });
  return r ?? [];
}

/**
 * Publish input: creates a new draft version + runs the parser + validator.
 * The returned journey has status='draft'; call the activate endpoint next.
 */
export async function publishDraft(input: NewVersionInput): Promise<{ ok: boolean; journey?: Journey; errors?: string[] }> {
  const parsed = parseDefinition(input.definition);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const validated = await validateForActivation(parsed.definition);
  const journey = await createDraft({ ...input, definition: parsed.definition });
  if (!journey) return { ok: false, errors: ["create_failed"] };
  if (!validated.ok) {
    // Persist errors on the draft so the UI can render them
    await withClient(async (c) => {
      await c.query(`UPDATE nex.journeys SET validation_errors = $1::jsonb WHERE journey_id = $2`, [JSON.stringify(validated.errors), journey.journey_id]);
      return null;
    });
    return { ok: false, journey: { ...journey, validation_errors: validated.errors }, errors: validated.errors };
  }
  return { ok: true, journey };
}

// ── State + metrics ──────────────────────────────────────────────
export async function listStatesForJourney(journey_id: string, limit = 200): Promise<JourneyState[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journey_states WHERE journey_id = $1 ORDER BY last_transition_at DESC LIMIT ${Math.max(1, Math.min(500, limit))}`, [journey_id]);
    return res.rows.map(rowToState);
  });
  return r ?? [];
}

export async function getState(state_id: string): Promise<JourneyState | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journey_states WHERE state_id = $1`, [state_id]);
    return res.rows[0] ? rowToState(res.rows[0]) : null;
  });
  return r ?? null;
}

export type JourneyMetrics = {
  total_journeys: number;
  by_status: Record<Journey["status"], number>;
  active_states: number;
  waiting_states: number;
  completed_last_24h: number;
  stopped_last_24h: number;
  emitted_commands_last_24h: number;
};

export async function getJourneyMetrics(): Promise<JourneyMetrics> {
  const zero: Record<Journey["status"], number> = { draft: 0, active: 0, paused: 0, archived: 0 };
  const r = await withClient(async (c) => {
    const byStatus = await c.query(`SELECT status, COUNT(*)::int AS n FROM nex.journeys GROUP BY status`);
    const totals: Record<Journey["status"], number> = { ...zero };
    for (const row of byStatus.rows) totals[row.status as Journey["status"]] = Number(row.n);

    const stateCounts = await c.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::int  AS active,
         COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
         COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours')::int AS completed_24h,
         COUNT(*) FILTER (WHERE status = 'stopped'   AND completed_at > NOW() - INTERVAL '24 hours')::int AS stopped_24h
       FROM nex.journey_states`,
    );
    const s = stateCounts.rows[0] as { active: number; waiting: number; completed_24h: number; stopped_24h: number };

    const cmdRes = await c.query(
      `SELECT COUNT(*)::int AS n FROM nex.journey_events
       WHERE event_type = 'CampaignCommandEmitted' AND occurred_at > NOW() - INTERVAL '24 hours'`,
    );
    return {
      total_journeys: Object.values(totals).reduce((a, b) => a + b, 0),
      by_status: totals,
      active_states: Number(s.active),
      waiting_states: Number(s.waiting),
      completed_last_24h: Number(s.completed_24h),
      stopped_last_24h: Number(s.stopped_24h),
      emitted_commands_last_24h: Number((cmdRes.rows[0] as { n: number }).n),
    };
  });
  return r ?? { total_journeys: 0, by_status: zero, active_states: 0, waiting_states: 0, completed_last_24h: 0, stopped_last_24h: 0, emitted_commands_last_24h: 0 };
}
