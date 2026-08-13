// Visual Learning Platform · learn() orchestrator.
//
// For each candidate object in a learning input · finds Object Library matches
// · either reinforces + bumps confidence + adds evidence · OR registers a new
// ObjectDNA with a unique auto-id. Merges obvious duplicates. Captures style
// signals into Pattern Learning. Returns a LearningReport that is fully
// auditable · never silent.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

import type { LearningInput, LearningReport, LearningReportUpdate, LearningReportMerge, LearningReportConfidenceBump, LearningReportStyleSignal } from "./types";
import type { ObjectDNA } from "../object-library";
import { register, reinforce, findMatches, nextId, get, merge } from "../object-library";
import { observe as observePattern } from "../pattern-learning";

const VERSION = "vlp_mvp_1.0";
const HIGH_MATCH = 0.85;                                  // reinforce existing
const MERGE_MATCH = 0.95;                                 // merge cases (not used in MVP because the input is a single upload)
const MIN_CONF_BUMP = 0.02;
const MAX_CONF_BUMP = 0.05;
const NAMED_EXPERT = "Philip O'Farrell";

export function learn(input: LearningInput): LearningReport {
  const now = new Date().toISOString();
  const new_objects: ObjectDNA[] = [];
  const updates: LearningReportUpdate[] = [];
  const merges: LearningReportMerge[] = [];
  const bumps: LearningReportConfidenceBump[] = [];
  const styles: LearningReportStyleSignal[] = [];

  for (const cand of input.candidates) {
    const matches = findMatches({
      family: cand.candidate_family,
      shape: cand.shape,
      style: cand.style,
      dimensions: cand.dimensions,
    }, HIGH_MATCH);

    if (matches.length > 0) {
      // Reinforce the top match.
      const top = matches[0];
      const before = get(top.object.object_id)!;
      const versionBefore = before.history[before.history.length - 1]?.version ?? 0;
      const confBefore = before.aggregate_confidence;
      // Delta scales with the candidate's observed confidence and match similarity.
      const rawDelta = MIN_CONF_BUMP + (MAX_CONF_BUMP - MIN_CONF_BUMP) * cand.observed_confidence * top.similarity;
      const reinforced = reinforce(top.object.object_id, rawDelta, "visual_learning_platform", cand.evidence_asset_id);
      const versionAfter = reinforced.history[reinforced.history.length - 1]?.version ?? versionBefore;
      updates.push({ object_id: reinforced.object_id, version_before: versionBefore, version_after: versionAfter, changes: reinforced.history[reinforced.history.length - 1]?.changes ?? [] });
      bumps.push({ object_id: reinforced.object_id, before: confBefore, after: reinforced.aggregate_confidence, delta: reinforced.aggregate_confidence - confBefore });

      // Optional merge: if there is a second match nearly identical to the top match · merge them.
      if (matches.length >= 2 && matches[1].similarity >= MERGE_MATCH) {
        try {
          const { kept } = merge(top.object.object_id, matches[1].object.object_id, `vlp-detected near-duplicate (${matches[1].similarity})`, "visual_learning_platform");
          merges.push({ kept_id: kept.object_id, merged_id: matches[1].object.object_id, reason: `similarity=${matches[1].similarity}` });
        } catch { /* merge is best-effort · never breaks the learn call */ }
      }
    } else {
      // Register a new ObjectDNA.
      const id = nextId(cand.candidate_family);
      const newDna: ObjectDNA = {
        object_id: id,
        family: cand.candidate_family,
        display_name: cand.suggested_display_name ?? `${cand.candidate_family} · ${id}`,
        shape: cand.shape,
        material_id: cand.material_id,
        dimensions: cand.dimensions,
        style: cand.style,
        compatible_objects: [],
        construction_rules: [...(cand.suggested_construction_rules ?? [])],
        image_example_asset_ids: [cand.evidence_asset_id],
        history: [{ version: 1, captured_at: now, changes: ["registered by visual_learning_platform"], changed_by: "visual_learning_platform", confidence: cand.observed_confidence }],
        aggregate_confidence: cand.observed_confidence,
        observation_count: 1,
        provenance: { named_expert: NAMED_EXPERT, authored: now.slice(0, 10) },
        created_at: now,
        updated_at: now,
      };
      register(newDna);
      new_objects.push(newDna);
    }
  }

  for (const sig of input.style_signals ?? []) {
    observePattern({
      observation_id: `${input.extraction_id}_style_${sig.feature}_${sig.value}`,
      captured_at: now,
      source_asset_id: input.candidates[0]?.evidence_asset_id,
      features: { [sig.feature]: sig.value },
    });
    styles.push({ feature: sig.feature, value: sig.value, support_delta: 1 });
  }

  return {
    extraction_id: input.extraction_id,
    new_objects_registered: new_objects,
    existing_objects_updated: updates,
    duplicates_merged: merges,
    confidence_improvements: bumps,
    style_signals_learned: styles,
    learner_version: VERSION,
    generated_at: now,
  };
}
