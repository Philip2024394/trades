// src/lib/nex-agent/code-engine/capability-prediction-verdict-store.ts
//
// NEX1 · Iteration 2 · Prediction-verdict store (Ledger B substrate).
//
// PURPOSE
//   Persist the coupling between (a) a prediction NEX made and (b) the
//   eventual ground-truth outcome. This substrate is READ by NEX-side
//   metacognition agents; it must not contain any engineer-supplied
//   diagnostic vocabulary, candidate feature names, or "why it failed"
//   labels.
//
// MISSION CONSTRAINTS (from founder mission 2026-09-18 · sections 3-8)
//   - Exactly 9 conceptual fields per joined record.
//   - `features_the_brain_had_at_prediction_time` contains ONLY what the
//     brain actually consumed.
//   - Temporal integrity: predictions written at T1, verdicts at T2 > T1.
//   - No retroactive predictions.
//   - No "degenerate = true" or similar conclusion labels.
//   - Append-only.
//   - The record must not tell NEX what she failed to see.
//
// STORAGE MODEL
//   Two append-only JSONL logs at:
//     data/nex1-prediction-verdicts/predictions.jsonl  (write at T1)
//     data/nex1-prediction-verdicts/verdicts.jsonl     (write at T2)
//   Reader joins by entry_id.
//
// FIELDS (exactly the 9 named in the mission)
//   1  entry_id
//   2  brain_id
//   3  timestamp_predicted
//   4  timestamp_verified
//   5  features_the_brain_had_at_prediction_time
//   6  prediction_label
//   7  prediction_confidence
//   8  ground_truth_label
//   9  matched
//
// R11-B invariant: this store's contents are EVIDENCE for NEX-side
// metacognition · they must never be laundered into R-4 SUPPORTING counts
// on the investigation side (different pipeline).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "./capability-agent-registry";

registerAgent({
  id: "prediction_verdict_store",
  name: "Prediction↔Verdict store",
  cognitive_layer: "episodic_memory",
  description: "Append-only journal coupling NEX predictions to eventual ground-truth outcomes. Read by metacognition agents. Contains only what the brain saw, what it predicted, what happened, and whether they matched.",
});

// ── Types ──────────────────────────────────────────────────────────────

/** Whatever the brain actually consumed at predict time · NOTHING ELSE. */
export type PredictionFeatures = Readonly<Record<string, string | number | boolean | null>>;

/** Record written at prediction time (T1). Awaits verdict. */
export interface PredictionRecord {
  readonly type: "prediction";
  readonly entry_id: string;
  readonly brain_id: string;
  readonly timestamp_predicted: string; // ISO
  readonly features_the_brain_had_at_prediction_time: PredictionFeatures;
  readonly prediction_label: string | number | boolean | null;
  readonly prediction_confidence: number;
}

/** Record written at verification time (T2 > T1). Joined back by entry_id. */
export interface VerdictRecord {
  readonly type: "verdict";
  readonly entry_id: string;
  readonly timestamp_verified: string; // ISO
  readonly ground_truth_label: string | number | boolean | null;
  /** matched = prediction_label === ground_truth_label (null-safe). */
  readonly matched: boolean;
}

/** Full joined record · exactly the 9 mission fields. */
export interface PredictionVerdictEntry {
  readonly entry_id: string;
  readonly brain_id: string;
  readonly timestamp_predicted: string;
  readonly timestamp_verified: string | null;
  readonly features_the_brain_had_at_prediction_time: PredictionFeatures;
  readonly prediction_label: string | number | boolean | null;
  readonly prediction_confidence: number;
  readonly ground_truth_label: string | number | boolean | null;
  /** null when no verdict has arrived yet. */
  readonly matched: boolean | null;
}

// ── Paths ──────────────────────────────────────────────────────────────

export function getPredictionsPath(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-prediction-verdicts", "predictions.jsonl");
}
export function getVerdictsPath(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-prediction-verdicts", "verdicts.jsonl");
}

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

// ── Deterministic key derivation ──────────────────────────────────────
//
// Two purposes:
//   (a) entry_id: unique per prediction; based on hash(features + brain_id + timestamp).
//   (b) observation_key: deterministic across sessions, used as a soft-lookup handle if
//       a caller wants to match a verdict to the most recent unresolved prediction for
//       the same features. Callers should PREFER passing the exact entry_id back at
//       verify time; observation_key is a fallback only.

export function observationKey(brain_id: string, features: PredictionFeatures): string {
  const canonical = canonicalise(features);
  return crypto.createHash("sha256").update(brain_id + "\n" + canonical).digest("hex").slice(0, 24);
}

export function newEntryId(brain_id: string, features: PredictionFeatures): string {
  const nonce = crypto.randomBytes(6).toString("hex");
  return "pv_" + observationKey(brain_id, features) + "_" + nonce;
}

function canonicalise(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalise).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalise((obj as Record<string, unknown>)[k])).join(",") + "}";
}

// ── Write APIs ─────────────────────────────────────────────────────────

/**
 * Append a prediction record at prediction time. Returns the entry_id
 * the caller must pass back at verify time. No verdict is written yet.
 */
export function appendPrediction(args: {
  readonly brain_id: string;
  readonly features_the_brain_had_at_prediction_time: PredictionFeatures;
  readonly prediction_label: string | number | boolean | null;
  readonly prediction_confidence: number;
  readonly repo_root?: string;
}): string {
  const entry_id = newEntryId(args.brain_id, args.features_the_brain_had_at_prediction_time);
  const record: PredictionRecord = {
    type: "prediction",
    entry_id,
    brain_id: args.brain_id,
    timestamp_predicted: new Date().toISOString(),
    features_the_brain_had_at_prediction_time: freezeFeatures(args.features_the_brain_had_at_prediction_time),
    prediction_label: args.prediction_label,
    prediction_confidence: args.prediction_confidence,
  };
  const p = getPredictionsPath(args.repo_root);
  ensureDir(p);
  fs.appendFileSync(p, JSON.stringify(record) + "\n", "utf8");
  recordHeartbeat({
    agent_id: "prediction_verdict_store",
    event_type: "append_prediction",
    event_data: { entry_id, brain_id: args.brain_id },
  });
  return entry_id;
}

/**
 * Append a verdict record at verification time. Joined to a prior
 * prediction by entry_id. matched is computed inside · caller supplies
 * only the observed ground truth.
 */
export function recordVerdict(args: {
  readonly entry_id: string;
  readonly ground_truth_label: string | number | boolean | null;
  readonly repo_root?: string;
}): { readonly matched: boolean | null; readonly joined: PredictionVerdictEntry | null } {
  // Look up the prediction record to compare labels
  const predictions = loadPredictions(args.repo_root);
  const prediction = predictions.find((p) => p.entry_id === args.entry_id);
  if (!prediction) {
    // Verdict without a prior prediction → discard (temporal integrity)
    return { matched: null, joined: null };
  }
  const matched = normalise(prediction.prediction_label) === normalise(args.ground_truth_label);
  const record: VerdictRecord = {
    type: "verdict",
    entry_id: args.entry_id,
    timestamp_verified: new Date().toISOString(),
    ground_truth_label: args.ground_truth_label,
    matched,
  };
  const p = getVerdictsPath(args.repo_root);
  ensureDir(p);
  fs.appendFileSync(p, JSON.stringify(record) + "\n", "utf8");
  recordHeartbeat({
    agent_id: "prediction_verdict_store",
    event_type: "record_verdict",
    event_data: { entry_id: args.entry_id, matched },
  });
  const joined: PredictionVerdictEntry = {
    entry_id: prediction.entry_id,
    brain_id: prediction.brain_id,
    timestamp_predicted: prediction.timestamp_predicted,
    timestamp_verified: record.timestamp_verified,
    features_the_brain_had_at_prediction_time: prediction.features_the_brain_had_at_prediction_time,
    prediction_label: prediction.prediction_label,
    prediction_confidence: prediction.prediction_confidence,
    ground_truth_label: record.ground_truth_label,
    matched: record.matched,
  };
  return { matched, joined };
}

// ── Read APIs ──────────────────────────────────────────────────────────

export function loadPredictions(repo_root?: string): readonly PredictionRecord[] {
  const p = getPredictionsPath(repo_root);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const out: PredictionRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as PredictionRecord;
      if (rec.type === "prediction") out.push(rec);
    } catch { /* silent · never break the reader on a bad line */ }
  }
  return out;
}

export function loadVerdicts(repo_root?: string): readonly VerdictRecord[] {
  const p = getVerdictsPath(repo_root);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const out: VerdictRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as VerdictRecord;
      if (rec.type === "verdict") out.push(rec);
    } catch { /* silent */ }
  }
  return out;
}

/**
 * Load the fully-joined verdict history. Only records with a matching
 * verdict are returned as joined; predictions without a verdict yet are
 * returned with timestamp_verified=null, ground_truth_label=null,
 * matched=null (unverified/pending).
 */
export function loadAllVerdicts(repo_root?: string): readonly PredictionVerdictEntry[] {
  const preds = loadPredictions(repo_root);
  const verdicts = loadVerdicts(repo_root);
  const byId = new Map<string, VerdictRecord>();
  for (const v of verdicts) byId.set(v.entry_id, v);
  return preds.map((p) => {
    const v = byId.get(p.entry_id);
    return {
      entry_id: p.entry_id,
      brain_id: p.brain_id,
      timestamp_predicted: p.timestamp_predicted,
      timestamp_verified: v?.timestamp_verified ?? null,
      features_the_brain_had_at_prediction_time: p.features_the_brain_had_at_prediction_time,
      prediction_label: p.prediction_label,
      prediction_confidence: p.prediction_confidence,
      ground_truth_label: v?.ground_truth_label ?? null,
      matched: v?.matched ?? null,
    };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

function normalise(v: string | number | boolean | null): string {
  if (v === null) return "\0null";
  return typeof v === "string" ? v : JSON.stringify(v);
}
function freezeFeatures(f: PredictionFeatures): PredictionFeatures {
  const out: Record<string, string | number | boolean | null> = {};
  for (const k of Object.keys(f).sort()) out[k] = f[k];
  return Object.freeze(out);
}

export const PREDICTION_VERDICT_STORE_VERSION = "prediction-verdict-store.v1";
