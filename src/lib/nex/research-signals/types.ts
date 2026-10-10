// src/lib/nex/research-signals/types.ts
//
// UWI · Wave 4 · Research-signal + reliability + dedup shared types.
// Founder-authorised programme.
//
// Distinct from src/lib/nex/signals/ (which is a pre-existing per-user
// nudge detector system for the merchant/homeowner product surfaces).
// This module implements Wave 4 M15 (signal detection) + M16 (source-
// reliability learning ledger) + M17 (dedup cascade) for the Unified
// NEX Continuous World & Innovation Intelligence Programme.

// ─── Time-series input (Kleinberg burst · STL · CUSUM) ──────────────
export interface TimeSeriesPoint {
  readonly ts_ms: number;
  readonly value: number;
}

// ─── Kleinberg burst-detection outputs ──────────────────────────────
export interface BurstInterval {
  readonly state: number;
  readonly start_ms: number;
  readonly end_ms: number;
  readonly count: number;
  readonly rate: number;
}

export interface BurstDetectionResult {
  readonly method: "kleinberg-2state";
  readonly bursts: readonly BurstInterval[];
  readonly baseline_rate: number;
  readonly burst_rate: number;
}

// ─── CUSUM outputs ──────────────────────────────────────────────────
export interface CusumAlarm {
  readonly direction: "upper" | "lower";
  readonly at_ms: number;
  readonly cumsum_value: number;
  readonly index: number;
}

export interface CusumResult {
  readonly method: "cusum";
  readonly mean: number;
  readonly threshold_k: number;
  readonly alarm_threshold_h: number;
  readonly alarms: readonly CusumAlarm[];
  readonly upper_series: readonly number[];
  readonly lower_series: readonly number[];
}

// ─── STL-lite decomposition outputs ─────────────────────────────────
export interface StlDecomposition {
  readonly method: "stl-lite";
  readonly trend: readonly number[];
  readonly seasonal: readonly number[];
  readonly residual: readonly number[];
  readonly period: number;
}

// ─── Dedup layer outputs ────────────────────────────────────────────
export type DedupLayerName =
  | "sha256_exact"
  | "simhash_near"
  | "minhash_lsh"
  | "token_jaccard"
  | "citation_graph"
  | "wardley_position";

export type DedupVerdict =
  | { kind: "already_known"; layer: DedupLayerName; duplicate_of: string; confidence: number }
  | { kind: "same_idea_new_evidence"; layer: DedupLayerName; duplicate_of: string; similarity: number }
  | { kind: "genuinely_new" };

// ─── Wardley evolution stage ────────────────────────────────────────
export type WardleyStage = "genesis" | "custom_built" | "product" | "commodity";

export interface WardleyClassification {
  readonly stage: WardleyStage;
  readonly signals: readonly {
    readonly signal: string;
    readonly value: number | string | boolean;
    readonly weight: number;
  }[];
  readonly value_chain_position: "user" | "component" | "sub_component" | "infrastructure";
}

// ─── Source-reliability learning ledger records ─────────────────────
export type SourceOutcome =
  | "confirmed"       // fact verified against another source (agreement)
  | "contradicted"    // fact contradicted by another source (disagreement)
  | "unverified"      // fact retrieved but not cross-checked
  | "empty"           // retrieval returned no useful content
  | "malformed"       // retrieved content was malformed
  | "timeout"         // retrieval timed out
  | "http_error"      // retrieval returned non-2xx
  | "robots_denied";  // retrieval blocked by robots.txt

export interface SourceOutcomeRecord {
  readonly ts_iso: string;
  readonly source: string;         // e.g. "bmkg.go.id"
  readonly source_class: string;   // e.g. "weather_current"
  readonly outcome: SourceOutcome;
  readonly latency_ms: number | null;
  readonly detail: string | null;
}

export interface SourceReliabilitySnapshot {
  readonly source: string;
  readonly source_class: string;
  readonly window_size: number;
  readonly agreement_rate: number;
  readonly availability_rate: number;
  readonly avg_latency_ms: number | null;
  readonly recent_outcomes: readonly SourceOutcome[];
  readonly recommendation: "prefer" | "use" | "verify" | "avoid";
}
