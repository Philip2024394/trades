// NEX A/B Testing · experiment CRUD + status transitions

import { withClient } from "@/lib/nex/delivery/db";
import type { Experiment, ExperimentScope, ExperimentStatus, ExperimentVariant } from "./types";

// ── Row mapping ──────────────────────────────────────────────────
export function rowToExperiment(r: Record<string, unknown>): Experiment {
  return {
    experiment_id: String(r.experiment_id),
    slug: String(r.slug),
    name: String(r.name),
    description: (r.description as string | null) ?? null,
    version: Number(r.version),
    status: r.status as ExperimentStatus,
    scope_type: (r.scope_type as ExperimentScope) ?? "journey_node",
    scope_ref: (r.scope_ref as string | null) ?? null,
    goal_event_type: String(r.goal_event_type),
    goal_within_seconds: Number(r.goal_within_seconds),
    seed: Number(r.seed),
    start_at: (r.start_at as string | null) ?? null,
    end_at:   (r.end_at   as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    activated_at: (r.activated_at as string | null) ?? null,
    paused_at:    (r.paused_at    as string | null) ?? null,
    ended_at:     (r.ended_at     as string | null) ?? null,
  };
}
export function rowToVariant(r: Record<string, unknown>): ExperimentVariant {
  return {
    experiment_id: String(r.experiment_id),
    variant_id: String(r.variant_id),
    name: (r.name as string | null) ?? null,
    allocation_pct: Number(r.allocation_pct),
    target_node_id: (r.target_node_id as string | null) ?? null,
    target_campaign_id: (r.target_campaign_id as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  };
}

// ── Seed generator · immutable per experiment ────────────────────
function genSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

// ── CRUD ─────────────────────────────────────────────────────────
export type CreateExperimentInput = {
  slug: string;
  name: string;
  description?: string | null;
  scope_type?: ExperimentScope;
  scope_ref?: string | null;
  goal_event_type?: string;
  goal_within_seconds?: number;
  variants: Array<{ variant_id: string; name?: string; allocation_pct: number; target_node_id?: string | null; target_campaign_id?: string | null }>;
  created_by?: string | null;
};

export async function createExperiment(input: CreateExperimentInput): Promise<{ ok: boolean; experiment?: Experiment; variants?: ExperimentVariant[]; error?: string }> {
  // Validate allocation
  const totalPct = input.variants.reduce((a, v) => a + v.allocation_pct, 0);
  if (Math.abs(totalPct - 100) > 0.01) return { ok: false, error: `allocation must sum to 100 · got ${totalPct}` };
  if (new Set(input.variants.map((v) => v.variant_id)).size !== input.variants.length) return { ok: false, error: "duplicate variant_id" };
  if (input.variants.length < 2) return { ok: false, error: "need at least 2 variants" };

  const version = await withClient(async (c) => {
    const res = await c.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM nex.experiments WHERE slug = $1`, [input.slug]);
    return Number((res.rows[0] as { v: number })?.v ?? 1);
  }) ?? 1;

  const seed = genSeed();
  const r = await withClient(async (c) => {
    const insExp = await c.query(
      `INSERT INTO nex.experiments (slug, name, description, version, status, scope_type, scope_ref, goal_event_type, goal_within_seconds, seed, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10) RETURNING *`,
      [input.slug, input.name, input.description ?? null, version, input.scope_type ?? "journey_node", input.scope_ref ?? null, input.goal_event_type ?? "clicked", input.goal_within_seconds ?? 604800, seed, input.created_by ?? null],
    );
    const experiment = rowToExperiment(insExp.rows[0]);
    const variants: ExperimentVariant[] = [];
    for (const v of input.variants) {
      const insV = await c.query(
        `INSERT INTO nex.experiment_variants (experiment_id, variant_id, name, allocation_pct, target_node_id, target_campaign_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
        [experiment.experiment_id, v.variant_id, v.name ?? null, v.allocation_pct, v.target_node_id ?? null, v.target_campaign_id ?? null, JSON.stringify({})],
      );
      variants.push(rowToVariant(insV.rows[0]));
    }
    return { experiment, variants };
  });
  if (!r) return { ok: false, error: "storage_unreachable" };
  return { ok: true, experiment: r.experiment, variants: r.variants };
}

export async function listExperiments(): Promise<Experiment[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.experiments ORDER BY slug ASC, version DESC`);
    return res.rows.map(rowToExperiment);
  });
  return r ?? [];
}

export async function getExperiment(experiment_id: string): Promise<{ experiment: Experiment; variants: ExperimentVariant[] } | null> {
  const r = await withClient(async (c) => {
    const eRes = await c.query(`SELECT * FROM nex.experiments WHERE experiment_id = $1`, [experiment_id]);
    if (!eRes.rows[0]) return null;
    const vRes = await c.query(`SELECT * FROM nex.experiment_variants WHERE experiment_id = $1 ORDER BY variant_id ASC`, [experiment_id]);
    return { experiment: rowToExperiment(eRes.rows[0]), variants: vRes.rows.map(rowToVariant) };
  });
  return r ?? null;
}

export async function getVariants(experiment_id: string): Promise<ExperimentVariant[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.experiment_variants WHERE experiment_id = $1 ORDER BY variant_id ASC`, [experiment_id]);
    return res.rows.map(rowToVariant);
  });
  return r ?? [];
}

export async function activateExperiment(experiment_id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await withClient(async (c) => {
    const cur = await c.query(`SELECT slug, status FROM nex.experiments WHERE experiment_id = $1`, [experiment_id]);
    if (cur.rows.length === 0) return { ok: false as const, error: "not_found" };
    const row = cur.rows[0] as { slug: string; status: string };
    if (row.status !== "draft" && row.status !== "paused") return { ok: false as const, error: `cannot activate from status ${row.status}` };
    // Pause any current Active of the same slug (unique index blocks two Active)
    await c.query(`UPDATE nex.experiments SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE slug = $1 AND status = 'active'`, [row.slug]);
    await c.query(`UPDATE nex.experiments SET status = 'active', activated_at = COALESCE(activated_at, NOW()), updated_at = NOW() WHERE experiment_id = $1`, [experiment_id]);
    return { ok: true as const };
  });
  return r ?? { ok: false, error: "storage_unreachable" };
}
export async function pauseExperiment(experiment_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.experiments SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE experiment_id = $1 AND status = 'active' RETURNING experiment_id`, [experiment_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}
export async function endExperiment(experiment_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.experiments SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE experiment_id = $1 AND status IN ('active','paused') RETURNING experiment_id`, [experiment_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}
