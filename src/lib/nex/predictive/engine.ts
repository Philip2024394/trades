// NEX Predictive Engine · inference · invariant #15
//
// Pure, deterministic linear-score inference. Given a FeatureVector and
// the currently-active model for a target, produces a probability score
// plus an explanation (top contributing features) plus a reproducible
// input_snapshot. INSERTs into nex.predictions (append-only). NEVER
// touches delivery, compliance, provider, or campaign state.

import { withClient } from "@/lib/nex/db";
import { extractContactFeatures } from "./features";
import { CONV_PROB_V0_1_0_WEIGHTS, getActiveModel, seedInitialConversionModelIfMissing } from "./registry";
import { getControls } from "./controls";
import type { FeatureVector, FeatureWeight, InferenceInput, Prediction, PredictionMode, PredictionModel, PredictionTarget, Recommendation } from "./types";

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

// ── Pure math ────────────────────────────────────────────────
function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }

function scoreFeatures(features: FeatureVector, spec: FeatureWeight[], bias: number): {
  logit: number;
  reason: Array<{ feature: string; weight: number; contribution: number }>;
} {
  let logit = bias;
  const contribs: Array<{ feature: string; weight: number; contribution: number }> = [];
  for (const w of spec) {
    const v = (features as Record<string, number>)[w.name] ?? 0;
    const contribution = w.weight * v;
    logit += contribution;
    contribs.push({ feature: w.name, weight: w.weight, contribution });
  }
  contribs.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { logit, reason: contribs.slice(0, 6) };
}

// ── Public inference · deterministic given the same input ─────────
export function inferPure(features: FeatureVector, model: PredictionModel): {
  probability: number;
  reason: Array<{ feature: string; weight: number; contribution: number }>;
} {
  const bias = Number((model.hyperparameters as { bias?: number }).bias ?? 0);
  const spec = model.feature_spec.length > 0 ? model.feature_spec : CONV_PROB_V0_1_0_WEIGHTS;
  const { logit, reason } = scoreFeatures(features, spec, bias);
  const scale = Number((model.hyperparameters as { scale?: number }).scale ?? 1);
  return { probability: sigmoid(logit * scale), reason };
}

// ── Confidence heuristic ─────────────────────────────────────
// Confidence is distance from 0.5 plus a small penalty for very low sample
// contexts (contact with no history is a shakier prediction). This is a
// heuristic — replace with calibrated confidence after enough training data.
function confidenceFrom(probability: number, features: FeatureVector): number {
  const decisiveness = Math.abs(probability - 0.5) * 2;      // 0..1
  const totalSignal = features.opens_last_30d + features.clicks_last_30d + features.attribution_conversions_ever;
  const evidenceScale = Math.min(1, totalSignal / 10);        // 0..1 · 10+ signals = full evidence
  const c = decisiveness * (0.6 + 0.4 * evidenceScale);
  return Math.max(0.01, Math.min(0.99, Number(c.toFixed(5))));
}

// ── Recommendation projection ────────────────────────────────
function headlineFor(target: PredictionTarget, probability: number, windowDays: number): string {
  if (target === "conversion_probability") {
    const pct = Math.round(probability * 100);
    return `${pct}% likely to convert in the next ${windowDays} days`;
  }
  return `${target} score ${probability.toFixed(3)}`;
}

// ── Predict a single contact ─────────────────────────────────
export async function predictConversionProbability(input: InferenceInput): Promise<Prediction | null> {
  if (!input.contact_id) throw new Error("predictConversionProbability requires contact_id");
  const model = (await getActiveModel("conversion_probability")) ?? (await seedInitialConversionModelIfMissing());
  if (!model) return null;

  const nowIso = input.now ?? new Date().toISOString();
  const windowDays = input.window_days ?? 30;
  const controls = await getControls();

  const { features, refs } = await extractContactFeatures(input.contact_id, nowIso);
  const { probability, reason } = inferPure(features, model);
  const confidence = confidenceFrom(probability, features);

  // Mode discipline: if globally paused, force shadow. Optimisation-mode
  // predictions that don't clear the confidence threshold degrade to
  // recommendation. The engine itself NEVER produces an execution side
  // effect — mode is metadata for downstream consumers.
  let mode: PredictionMode = input.mode ?? "recommendation";
  if (controls.paused) mode = "shadow";
  if (mode === "optimisation" && confidence < controls.confidence_threshold) mode = "recommendation";

  const inputSnapshot = {
    features,
    refs: {
      contact_id: input.contact_id,
      last_event_timestamp: refs.last_event_timestamp,
      analytics_window_days: 30,
      attribution_window_days: windowDays,
    },
  };

  const inserted = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.predictions
         (target, model_id, model_version, contact_id, subject_kind, subject_id, prediction, confidence, input_snapshot, reason, window_days, correlation_id, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11, $12, $13)
       RETURNING *`,
      [
        "conversion_probability",
        model.model_id,
        model.model_version,
        input.contact_id,
        input.subject_kind ?? "contact",
        input.subject_id ?? input.contact_id,
        JSON.stringify({ value: probability }),
        confidence,
        JSON.stringify(inputSnapshot),
        JSON.stringify(reason),
        windowDays,
        input.correlation_id ?? null,
        mode,
      ],
    );
    return res.rows[0] ?? null;
  });

  if (!inserted) return null;

  return {
    prediction_id: String(inserted.prediction_id),
    target: "conversion_probability",
    model_id: model.model_id,
    model_version: model.model_version,
    contact_id: input.contact_id,
    subject_kind: (inserted.subject_kind as Prediction["subject_kind"]) ?? "contact",
    subject_id: (inserted.subject_id as string) ?? input.contact_id,
    prediction: { value: probability },
    confidence,
    input_snapshot: inputSnapshot,
    reason,
    window_days: windowDays,
    correlation_id: input.correlation_id ?? null,
    mode,
    created_at: isoOf(inserted.created_at) ?? new Date().toISOString(),
  };
}

// ── Convenience: recommendation projection ───────────────────
export function toRecommendation(p: Prediction, threshold: number): Recommendation {
  return {
    prediction_id: p.prediction_id,
    target: p.target,
    contact_id: p.contact_id,
    headline: headlineFor(p.target, p.prediction.value, p.window_days ?? 30),
    value: p.prediction.value,
    confidence: p.confidence,
    reason: p.reason.map((r) => ({ feature: r.feature, contribution: r.contribution })),
    meets_threshold: p.confidence >= threshold,
    created_at: p.created_at,
  };
}

// ── Listing predictions ──────────────────────────────────────
export async function listPredictions(opts: { target?: PredictionTarget; contact_id?: string; limit?: number } = {}): Promise<Prediction[]> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const r = await withClient(async (c) => {
    const where: string[] = [];
    const p: unknown[] = [];
    if (opts.target) { p.push(opts.target); where.push(`target = $${p.length}`); }
    if (opts.contact_id) { p.push(opts.contact_id); where.push(`contact_id = $${p.length}`); }
    p.push(limit);
    const res = await c.query(
      `SELECT * FROM nex.predictions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT $${p.length}`,
      p,
    );
    return res.rows.map((r) => ({
      prediction_id: String(r.prediction_id),
      target: r.target as PredictionTarget,
      model_id: String(r.model_id),
      model_version: String(r.model_version),
      contact_id: (r.contact_id as string | null) ?? null,
      subject_kind: r.subject_kind as Prediction["subject_kind"],
      subject_id: (r.subject_id as string | null) ?? null,
      prediction: r.prediction as Prediction["prediction"],
      confidence: Number(r.confidence),
      input_snapshot: r.input_snapshot as Prediction["input_snapshot"],
      reason: (r.reason as Prediction["reason"]) ?? [],
      window_days: (r.window_days as number | null) ?? null,
      correlation_id: (r.correlation_id as string | null) ?? null,
      mode: r.mode as PredictionMode,
      created_at: isoOf(r.created_at) ?? new Date().toISOString(),
    }));
  });
  return r ?? [];
}
