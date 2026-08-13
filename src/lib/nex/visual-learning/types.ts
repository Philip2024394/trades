// Visual Learning Platform (VLP) · types.
//
// Distinct from Vision Intelligence: Vision understands ONE image · Visual
// Learning learns from MILLIONS. Every VKEP extraction feeds VLP · VLP
// compares against every Object Library entry · improves confidence · merges
// duplicates · registers new objects · captures style signals.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

import type { ObjectDNA, ObjectFamily } from "../object-library";

export type LearningInputObject = {
  candidate_family: ObjectFamily;
  shape: ObjectDNA["shape"];
  material_id?: string;
  dimensions?: ObjectDNA["dimensions"];
  style?: string;
  observed_confidence: number;           // 0..1 · from Vision/Sketch Intelligence
  evidence_asset_id: string;
  suggested_display_name?: string;
  suggested_construction_rules?: readonly ObjectDNA["construction_rules"][number][];
};

export type LearningInput = {
  extraction_id: string;
  project_id?: string;
  captured_at?: string;
  candidates: readonly LearningInputObject[];
  style_signals?: readonly { feature: string; value: string }[];
};

export type LearningReportUpdate = {
  object_id: string;
  version_before: number;
  version_after: number;
  changes: readonly string[];
};

export type LearningReportMerge = {
  kept_id: string;
  merged_id: string;
  reason: string;
};

export type LearningReportConfidenceBump = {
  object_id: string;
  before: number;
  after: number;
  delta: number;
};

export type LearningReportStyleSignal = {
  feature: string;
  value: string;
  support_delta: number;
};

export type LearningReport = {
  extraction_id: string;
  new_objects_registered: readonly ObjectDNA[];
  existing_objects_updated: readonly LearningReportUpdate[];
  duplicates_merged: readonly LearningReportMerge[];
  confidence_improvements: readonly LearningReportConfidenceBump[];
  style_signals_learned: readonly LearningReportStyleSignal[];
  learner_version: string;
  generated_at: string;
};
