// NEX Journey Engine · Trigger versioning + CRUD
//
// Mirrors the journey registry pattern:
//   · new version = new row (immutable per version)
//   · one Active per (journey_id, trigger_key)
//   · admin actions go through activate/pause/archive helpers

import { withClient } from "@/lib/nex/delivery/db";
import type { JourneyTrigger, TriggerStatus, TriggerType } from "./types";

export type NewTriggerInput = {
  journey_id: string;
  trigger_key: string;
  trigger_type: TriggerType;
  trigger_config?: Record<string, unknown>;
  dedup_window_sec?: number;
  correlation_scope?: "per_contact" | "per_event";
};

export async function nextTriggerVersion(journey_id: string, trigger_key: string): Promise<number> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM nex.journey_triggers WHERE journey_id = $1 AND trigger_key = $2`,
      [journey_id, trigger_key],
    );
    return Number((res.rows[0] as { v: number })?.v ?? 1);
  });
  return r ?? 1;
}

export async function createTriggerDraft(input: NewTriggerInput): Promise<JourneyTrigger | null> {
  const version = await nextTriggerVersion(input.journey_id, input.trigger_key);
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.journey_triggers
       (journey_id, trigger_key, version, status, trigger_type, trigger_config, dedup_window_sec, correlation_scope)
       VALUES ($1, $2, $3, 'draft', $4, $5::jsonb, $6, $7)
       RETURNING *`,
      [input.journey_id, input.trigger_key, version, input.trigger_type,
       JSON.stringify(input.trigger_config ?? {}), input.dedup_window_sec ?? 60, input.correlation_scope ?? "per_contact"],
    );
    return res.rows[0] ? rowToTrigger(res.rows[0]) : null;
  });
  return r;
}

export async function activateTrigger(trigger_id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await withClient(async (c) => {
    const cur = await c.query(`SELECT * FROM nex.journey_triggers WHERE trigger_id = $1`, [trigger_id]);
    if (cur.rows.length === 0) return { ok: false as const, error: "not_found" };
    const row = cur.rows[0] as Record<string, unknown>;
    if (row.status !== "draft") return { ok: false as const, error: `cannot activate from status ${row.status}` };
    await c.query(
      `UPDATE nex.journey_triggers SET status = 'paused', paused_at = NOW(), updated_at = NOW()
       WHERE journey_id = $1 AND trigger_key = $2 AND status = 'active'`,
      [row.journey_id, row.trigger_key],
    );
    await c.query(`UPDATE nex.journey_triggers SET status = 'active', activated_at = NOW(), updated_at = NOW() WHERE trigger_id = $1`, [trigger_id]);
    return { ok: true as const };
  });
  return r ?? { ok: false, error: "storage_unreachable" };
}

export async function pauseTrigger(trigger_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.journey_triggers SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE trigger_id = $1 AND status = 'active' RETURNING trigger_id`, [trigger_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}

export async function archiveTrigger(trigger_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.journey_triggers SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE trigger_id = $1 AND status IN ('draft','paused') RETURNING trigger_id`, [trigger_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}

export async function listTriggersForJourney(journey_id: string): Promise<JourneyTrigger[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journey_triggers WHERE journey_id = $1 ORDER BY trigger_key, version DESC`, [journey_id]);
    return res.rows.map(rowToTrigger);
  });
  return r ?? [];
}

export async function listActiveTriggersByType(trigger_type: TriggerType): Promise<JourneyTrigger[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journey_triggers WHERE status = 'active' AND trigger_type = $1`, [trigger_type]);
    return res.rows.map(rowToTrigger);
  });
  return r ?? [];
}

export async function recordTriggerFire(trigger_id: string, fired_count: number): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.journey_triggers SET last_fired_at = NOW(), fire_count = fire_count + $1 WHERE trigger_id = $2`,
      [fired_count, trigger_id],
    );
    return null;
  });
}

// ── Row mapping ──────────────────────────────────────────────────
export function rowToTrigger(r: Record<string, unknown>): JourneyTrigger {
  return {
    trigger_id: String(r.trigger_id),
    journey_id: String(r.journey_id),
    trigger_key: String(r.trigger_key),
    version: Number(r.version),
    status: r.status as TriggerStatus,
    trigger_type: r.trigger_type as TriggerType,
    trigger_config: (r.trigger_config as Record<string, unknown>) ?? {},
    dedup_window_sec: Number(r.dedup_window_sec ?? 60),
    correlation_scope: (r.correlation_scope as "per_contact" | "per_event") ?? "per_contact",
    last_fired_at: (r.last_fired_at as string | null) ?? null,
    fire_count: Number(r.fire_count ?? 0),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    activated_at: (r.activated_at as string | null) ?? null,
    paused_at:    (r.paused_at    as string | null) ?? null,
    archived_at:  (r.archived_at  as string | null) ?? null,
  };
}
