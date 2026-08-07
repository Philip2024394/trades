// NEX Journey Engine · versioning helper
//
// Publishing a Draft creates a new version row rather than updating the
// existing one · in-flight contacts on prior versions stay on their
// entering version (doctrine §2). Also enforces the "one Active per
// slug at a time" rule.

import { withClient } from "@/lib/nex/delivery/db";
import type { Journey, JourneyDefinition, TriggerType } from "../types";

export type NewVersionInput = {
  slug: string;                                    // stable id across versions
  name: string;
  description?: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  definition: JourneyDefinition;
  created_by?: string | null;
};

/** Returns the next version number for a slug (max existing + 1). */
export async function nextVersion(slug: string): Promise<number> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM nex.journeys WHERE slug = $1`, [slug]);
    return Number((res.rows[0] as { v: number })?.v ?? 1);
  });
  return r ?? 1;
}

/** Create a new draft version (does not activate). */
export async function createDraft(input: NewVersionInput): Promise<Journey | null> {
  const version = await nextVersion(input.slug);
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.journeys
       (slug, name, description, version, status, trigger_type, trigger_config, definition, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6::jsonb, $7::jsonb, $8)
       RETURNING *`,
      [input.slug, input.name, input.description ?? null, version, input.trigger_type, JSON.stringify(input.trigger_config), JSON.stringify(input.definition), input.created_by ?? null],
    );
    return res.rows[0] ? rowToJourney(res.rows[0]) : null;
  });
  return r;
}

/** Activate a draft · atomically deactivates any current Active version of the same slug. */
export async function activate(journey_id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await withClient(async (c) => {
    // Read the journey · verify it's a draft with no validation errors
    const cur = await c.query(`SELECT * FROM nex.journeys WHERE journey_id = $1`, [journey_id]);
    if (cur.rows.length === 0) return { ok: false as const, error: "not_found" };
    const row = cur.rows[0] as Record<string, unknown>;
    if (row.status !== "draft") return { ok: false as const, error: `cannot activate from status ${row.status}` };
    if (row.validation_errors && Array.isArray(row.validation_errors) && row.validation_errors.length > 0) {
      return { ok: false as const, error: "validation_errors_present · publish() must succeed first" };
    }

    // Pause any current Active version for this slug (unique index blocks two Active)
    await c.query(`UPDATE nex.journeys SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE slug = $1 AND status = 'active'`, [row.slug]);
    // Now activate this version
    await c.query(`UPDATE nex.journeys SET status = 'active', activated_at = NOW(), updated_at = NOW() WHERE journey_id = $1`, [journey_id]);
    return { ok: true as const };
  });
  return r ?? { ok: false, error: "storage_unreachable" };
}

export async function pause(journey_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.journeys SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE journey_id = $1 AND status = 'active' RETURNING journey_id`, [journey_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}

export async function archive(journey_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.journeys SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE journey_id = $1 AND status IN ('draft','paused') RETURNING journey_id`, [journey_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}

// ── Row mapping ──────────────────────────────────────────────────
export function rowToJourney(r: Record<string, unknown>): Journey {
  return {
    journey_id: String(r.journey_id),
    slug: String(r.slug),
    name: String(r.name),
    description: (r.description as string | null) ?? null,
    version: Number(r.version),
    status: r.status as Journey["status"],
    trigger_type: (r.trigger_type as TriggerType) ?? "segment_join",
    trigger_config: (r.trigger_config as Record<string, unknown>) ?? {},
    definition: (r.definition as JourneyDefinition) ?? { nodes: [], start_node_id: "" },
    validation_errors: (r.validation_errors as string[] | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    activated_at: (r.activated_at as string | null) ?? null,
    paused_at:    (r.paused_at    as string | null) ?? null,
    archived_at:  (r.archived_at  as string | null) ?? null,
  };
}
