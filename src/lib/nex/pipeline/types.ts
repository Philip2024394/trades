// End-to-End Pipeline types — the complete user-journey trace.
//
// Doctrine: docs/brains/nex-end-to-end-pipeline-philip-2026-08-03.md
// Composes with identity + universal-intent + knowledge-layer libraries.

import type { IdentityClassification } from "../identity";
import type { IntentClassification } from "../universal-intent";
import type { RetrieveResult } from "../knowledge-layer";
import type { RecommendationSet } from "./recommend";

export type PipelineRequest = {
  /** User input text. */
  input: string;
  /** Session identifier for learning-log correlation. Server can generate one. */
  session_id?: string;
  /** Optional pre-selected goal from the Goal Layer UI. */
  goal_id?: string;
  /** Optional pre-loaded workspace identity register (for returning users). */
  workspace_identity?: string;
};

export type CoverageCheck = {
  domain: string;
  maturity_level: "bronze" | "silver" | "gold" | "pending";
  coverage_multiplier: number;
  overall_coverage_percent: number | null;
  soft_caveat: string | null;
};

export type LayeredConfidence = {
  identity: number;
  intent: number;
  knowledge: number;
  coverage_multiplier: number;
  overall: number;
  needs_clarification: boolean;
};

export type AssembledResponse = {
  text: string;
  next_step_offered: string;
  clarifying_question: string | null;
  cited_sources: readonly string[];
  cited_items: readonly string[];
};

export type PipelineTrace = {
  /** Pipeline schema version. */
  pipeline_version: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Session identifier. */
  session_id: string;
  /** Original input. */
  input: string;
  /** Stage 2 · Identity classification. */
  identity: IdentityClassification;
  /** Stage 3 · Goal (either pre-selected or inferred from intent). */
  goal: { id: string | null; inferred_from_intent: boolean };
  /** Stage 4 · Intent classification. */
  intent: IntentClassification;
  /** Stage 5 · Knowledge retrieval. */
  knowledge: RetrieveResult;
  /** Stage 6 · Coverage check. */
  coverage: CoverageCheck;
  /** Stage 7 · Layered confidence. */
  confidence: LayeredConfidence;
  /** Stage 8-9 · Assembled response with sources. */
  response: AssembledResponse;
  /** Stage 8b · Recommendation Engine (Phase D.6 · Q → A → Recommendations). */
  recommendations: RecommendationSet;
  /** Stage 10 · Learning captured (append to log). */
  learning_captured: boolean;
  /** Stage 11 · Dashboard signal recorded. */
  dashboard_signal_recorded: boolean;
  /** Human-readable trace summary (for Router Trace UI). */
  trace_reason: string;
};

export type PipelineResponse = {
  /** The response the user sees. */
  response_text: string;
  /** True when the pipeline declined to answer (Brain 14 gate). */
  needs_clarification: boolean;
  /** The clarifying question if needs_clarification is true. */
  clarifying_question: string | null;
  /** Next-step offer (Brain 15). */
  next_step: string;
  /** Cited source paths. */
  sources: readonly string[];
  /** Overall confidence 0..1. */
  confidence: number;
  /** Volunteered recommendations across categories (Phase D.6). */
  recommendations: RecommendationSet;
  /** Full trace for debugging (returned in dev · omitted in prod). */
  trace?: PipelineTrace;
};
