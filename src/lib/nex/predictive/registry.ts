// NEX Predictive · model registry · invariant #15
//
// Every model that ships to production is registered with a version,
// status (shadow → active → retired), calibration, and training
// snapshot. Rollback = flip the current active back to shadow and set
// a prior version to active. No code deploy required.

import { withClient } from "@/lib/nex/db";
import type { FeatureWeight, ModelKind, ModelStatus, PredictionModel, PredictionTarget } from "./types";

// ── Row normalisation ──────────────────────────────────────────
function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function rowToModel(r: Record<string, unknown>): PredictionModel {
  return {
    model_id: String(r.model_id),
    target: r.target as PredictionTarget,
    model_version: String(r.model_version),
    model_kind: r.model_kind as ModelKind,
    status: r.status as ModelStatus,
    feature_spec: (r.feature_spec as FeatureWeight[]) ?? [],
    hyperparameters: (r.hyperparameters as Record<string, unknown>) ?? {},
    calibration: (r.calibration as PredictionModel["calibration"]) ?? {},
    training_snapshot: (r.training_snapshot as Record<string, unknown>) ?? {},
    deployed_at: isoOf(r.deployed_at),
    retired_at: isoOf(r.retired_at),
    deployed_by: (r.deployed_by as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: isoOf(r.created_at) ?? new Date().toISOString(),
  };
}

// ── Registry ops ───────────────────────────────────────────────

export async function listModels(target?: PredictionTarget): Promise<PredictionModel[]> {
  const r = await withClient(async (c) => {
    const res = target
      ? await c.query(`SELECT * FROM nex.prediction_models WHERE target = $1 ORDER BY created_at DESC`, [target])
      : await c.query(`SELECT * FROM nex.prediction_models ORDER BY target ASC, created_at DESC`);
    return res.rows.map(rowToModel);
  });
  return r ?? [];
}

export async function getActiveModel(target: PredictionTarget): Promise<PredictionModel | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.prediction_models WHERE target = $1 AND status = 'active' LIMIT 1`,
      [target],
    );
    return res.rows[0] ? rowToModel(res.rows[0]) : null;
  });
  return r ?? null;
}

export interface RegisterModelInput {
  target: PredictionTarget;
  model_version: string;
  model_kind: ModelKind;
  feature_spec: FeatureWeight[];
  hyperparameters?: Record<string, unknown>;
  calibration?: PredictionModel["calibration"];
  training_snapshot?: Record<string, unknown>;
  status?: ModelStatus;                    // default 'shadow'
  notes?: string;
  deployed_by?: string;
}

export async function registerModel(input: RegisterModelInput): Promise<PredictionModel | null> {
  const status: ModelStatus = input.status ?? "shadow";
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.prediction_models
        (target, model_version, model_kind, status, feature_spec, hyperparameters, calibration, training_snapshot, notes, deployed_by, deployed_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, CASE WHEN $4 = 'active' THEN NOW() ELSE NULL END)
       ON CONFLICT (target, model_version) DO UPDATE
         SET model_kind = EXCLUDED.model_kind,
             feature_spec = EXCLUDED.feature_spec,
             hyperparameters = EXCLUDED.hyperparameters,
             calibration = EXCLUDED.calibration,
             training_snapshot = EXCLUDED.training_snapshot,
             notes = EXCLUDED.notes
       RETURNING *`,
      [
        input.target,
        input.model_version,
        input.model_kind,
        status,
        JSON.stringify(input.feature_spec),
        JSON.stringify(input.hyperparameters ?? {}),
        JSON.stringify(input.calibration ?? {}),
        JSON.stringify(input.training_snapshot ?? {}),
        input.notes ?? null,
        input.deployed_by ?? null,
      ],
    );
    return res.rows[0] ? rowToModel(res.rows[0]) : null;
  });
  return r ?? null;
}

// Flip a model to active. Retires whatever was previously active for the
// same target (one-active-per-target enforced by partial unique index).
export async function activateModel(model_id: string, deployed_by?: string): Promise<PredictionModel | null> {
  const r = await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      const cur = await c.query(`SELECT target FROM nex.prediction_models WHERE model_id = $1`, [model_id]);
      if (cur.rowCount === 0) { await c.query("ROLLBACK"); return null; }
      const target = String(cur.rows[0].target);
      await c.query(
        `UPDATE nex.prediction_models
            SET status = 'retired', retired_at = NOW()
          WHERE target = $1 AND status = 'active' AND model_id <> $2`,
        [target, model_id],
      );
      const res = await c.query(
        `UPDATE nex.prediction_models
            SET status = 'active', deployed_at = NOW(), deployed_by = COALESCE($2, deployed_by), retired_at = NULL
          WHERE model_id = $1
          RETURNING *`,
        [model_id, deployed_by ?? null],
      );
      await c.query("COMMIT");
      return res.rows[0] ? rowToModel(res.rows[0]) : null;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
  return r ?? null;
}

export async function retireModel(model_id: string): Promise<PredictionModel | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `UPDATE nex.prediction_models SET status = 'retired', retired_at = NOW() WHERE model_id = $1 RETURNING *`,
      [model_id],
    );
    return res.rows[0] ? rowToModel(res.rows[0]) : null;
  });
  return r ?? null;
}

// ── Seed the initial conversion-probability model ────────────────
// A deterministic linear-score model. Weights are hand-tuned starters —
// calibration + retraining land in a later ticket. The point is: every
// prediction is auditable, replayable, and rollback-able from day one.
export async function seedInitialConversionModelIfMissing(): Promise<PredictionModel | null> {
  const existing = await getActiveModel("conversion_probability");
  if (existing) return existing;
  const seeded = await registerModel({
    target: "conversion_probability",
    model_version: "conv-prob@v0.1.0",
    model_kind: "linear_score",
    feature_spec: CONV_PROB_V0_1_0_WEIGHTS,
    hyperparameters: { bias: -1.5, scale: 1.0 },
    calibration: { samples: 0 },
    training_snapshot: { note: "hand-tuned seed weights · replaced on first training run" },
    status: "active",
    deployed_by: "system:seed",
    notes: "v0.1.0 linear-score seed · deterministic · explainable · rollback-able.",
  });
  return seeded;
}

// Public so the engine can also fall back to these weights when the DB
// is unreachable in dev — see engine.inferConversionProbability().
export const CONV_PROB_V0_1_0_WEIGHTS: FeatureWeight[] = [
  { name: "opens_last_30d",                weight: 0.15, description: "recent opens signal interest" },
  { name: "clicks_last_30d",               weight: 0.45, description: "clicks are stronger than opens" },
  { name: "opens_last_7d",                 weight: 0.20, description: "very recent opens weight extra" },
  { name: "clicks_last_7d",                weight: 0.60, description: "very recent clicks weight extra" },
  { name: "distinct_campaigns_engaged_30d", weight: 0.30, description: "breadth of engagement" },
  { name: "attribution_conversions_ever",   weight: 0.80, description: "past converters convert again" },
  { name: "in_journey",                    weight: 0.35, description: "currently orchestrated" },
  { name: "active_experiments",            weight: 0.10, description: "in an experiment funnel" },
  { name: "days_since_last_engagement",    weight: -0.05, description: "staleness decays probability" },
  { name: "tenure_days",                   weight: 0.01, description: "long-lived contacts convert more" },
  { name: "sends_last_30d",                weight: 0.02, description: "small volume signal (not overweighted)" },
  { name: "attributed_value_ever",         weight: 0.0002, description: "£ scale · high past value hints at repeat" },
];
