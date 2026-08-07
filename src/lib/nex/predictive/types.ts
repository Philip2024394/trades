// NEX Predictive Engine · types · invariant #15
//
// The engine reads canonical events + attribution outputs and writes only
// to nex.prediction_models, nex.predictions, and nex.predictive_controls.
// No provider, delivery, or compliance side effects.

export type PredictionTarget =
  | "conversion_probability"
  | "send_time"
  | "churn"
  | "campaign_recommendation"
  | "journey_recommendation"
  | "variant_ranking";

export type PredictionMode = "recommendation" | "optimisation" | "shadow";

export type ModelStatus = "shadow" | "active" | "retired";

export type ModelKind = "linear_score" | "logistic" | "rules" | "random_forest" | "xgboost" | "neural" | "other";

export interface FeatureWeight {
  name: string;
  weight: number;
  description?: string;
}

export interface PredictionModel {
  model_id: string;
  target: PredictionTarget;
  model_version: string;
  model_kind: ModelKind;
  status: ModelStatus;
  feature_spec: FeatureWeight[];
  hyperparameters: Record<string, unknown>;
  calibration: {
    brier?: number;
    auc?: number;
    samples?: number;
    last_measured_at?: string;
  };
  training_snapshot: Record<string, unknown>;
  deployed_at: string | null;
  retired_at: string | null;
  deployed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface FeatureVector {
  // Snapshot of numeric features used at inference time. Every field is a
  // number so the linear-score model can operate on it deterministically.
  // Additional fields may be added over time; missing fields fall back to 0.
  opens_last_30d: number;
  opens_last_7d: number;
  clicks_last_30d: number;
  clicks_last_7d: number;
  sends_last_30d: number;
  days_since_last_engagement: number;      // large number if never engaged
  distinct_campaigns_engaged_30d: number;
  attribution_conversions_ever: number;    // past conversions attributed to this contact
  attributed_value_ever: number;           // £ credited to this contact across all past conversions
  active_experiments: number;              // count of experiments the contact is in
  in_journey: number;                      // 1 if currently on any active journey, else 0
  tenure_days: number;                     // days since first canonical event we have for the contact
}

export interface Prediction {
  prediction_id: string;
  target: PredictionTarget;
  model_id: string;
  model_version: string;
  contact_id: string | null;
  subject_kind: "contact" | "segment" | "campaign" | "journey" | "variant";
  subject_id: string | null;
  prediction: { value: number; class?: string; rank?: number };
  confidence: number;                      // 0..1
  input_snapshot: {
    features: FeatureVector;
    refs: {
      contact_id?: string;
      last_event_timestamp?: string;
      analytics_window_days?: number;
      attribution_window_days?: number;
    };
  };
  reason: Array<{ feature: string; weight: number; contribution: number }>;
  window_days: number | null;
  correlation_id: string | null;
  mode: PredictionMode;
  created_at: string;
}

export interface PredictiveControls {
  paused: boolean;
  paused_at: string | null;
  paused_by: string | null;
  paused_reason: string | null;
  confidence_threshold: number;
  updated_at: string;
}

export interface InferenceInput {
  target: PredictionTarget;
  contact_id?: string;
  subject_kind?: "contact" | "segment" | "campaign" | "journey" | "variant";
  subject_id?: string;
  mode?: PredictionMode;                   // default 'recommendation'
  window_days?: number;                    // default 30
  correlation_id?: string;
  now?: string;                            // override "current time" for deterministic replay
}

// Result of inference — what the engine can offer *without* executing.
// Consumers (Journey/Campaign UI · Recommendations tab) render these.
export interface Recommendation {
  prediction_id: string;
  target: PredictionTarget;
  contact_id: string | null;
  headline: string;
  value: number;
  confidence: number;
  reason: Array<{ feature: string; contribution: number }>;
  meets_threshold: boolean;
  created_at: string;
}
