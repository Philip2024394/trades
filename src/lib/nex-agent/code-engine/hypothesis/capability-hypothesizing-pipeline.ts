// src/lib/nex-agent/code-engine/hypothesis/capability-hypothesizing-pipeline.ts
//
// NEX1 · Hypothesizing Pipeline (additive · Ledger B wiring).
//
// COMPOSES the existing runWithProcessingBrain — does NOT modify it.
// When the Processing Brain reports evidence_state=CONFLICTED, this
// wiring autonomously invokes each responder specialist's own
// .hypothesise() method on the same evidence, and routes any emitted
// statements to the hypothesis store.
//
// DISCLOSURE (per founder anti-cheating rules):
//   · The invocation trigger — "on CONFLICTED, ask specialists to hypothesise" —
//     is engineered wiring authored by Claude. It is Ledger B.
//   · The CONTENT of every hypothesis comes from an existing specialist's
//     own .hypothesise() output. Claude did not author any hypothesis
//     content.
//   · No target relationship, similarity metric, feature-hint or
//     benchmark-specific rule is encoded here.
//   · If a specialist's .hypothesise() returns nothing, no hypothesis is
//     written. Empty outputs are respected honestly.
//
// The critical evidence question this experiment can now answer:
//   With minimal wiring in place, does downstream verification confirm
//   or reject the hypotheses NEX's specialists actually produce?

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { runWithProcessingBrain, type PipelineInput, type ExperimentResult as PipelineExperimentResult } from "../processing/capability-processing-pipeline";
import { writeHypothesis, type HypothesisRecord } from "./capability-hypothesis-store";
import { getSpecialist, listSpecialists } from "../brb/capability-brb-network-router";
import type { Hypothesis } from "../brb/capability-specialist-brain";

registerAgent({
  id: "hypothesizing_pipeline",
  name: "Hypothesizing Pipeline · CONFLICTED-triggered .hypothesise() invocation",
  cognitive_layer: "hypothesis_and_experimentation",
  description: "Composes the existing Processing Brain pipeline. On evidence_state=CONFLICTED, autonomously invokes responder specialists' .hypothesise() methods and routes their content to the hypothesis store. Additive · does not modify existing production paths.",
});

export interface HypothesizingPipelineResult extends PipelineExperimentResult {
  readonly hypotheses_emitted: readonly HypothesisRecord[];
  readonly hypothesizing_engaged: boolean;
  readonly hypothesizing_reason: string;
}

/**
 * Run the standard Processing-Brain pipeline; if the resulting evidence
 * state is CONFLICTED (i.e. NEX's own specialists disagree meaningfully
 * on the input), ask each specialist to hypothesise from the same
 * evidence, and persist any statements produced.
 *
 * The wiring is deliberately minimal:
 *   - only triggers on CONFLICTED (not on CLEAR/UNCERTAIN/INSUFFICIENT/DEGRADED)
 *   - passes the ORIGINAL probe_input verbatim to .hypothesise()
 *   - respects any specialist that returns no hypotheses
 *   - never invents statements or fields
 *   - every persisted hypothesis has explicit provenance to its
 *     source_specialist_id and its underlying evidence_refs
 */
export function runWithHypothesizing(input: PipelineInput): HypothesizingPipelineResult {
  const base = runWithProcessingBrain(input);

  // Decision rule · exact wiring (single line):
  //   engage hypothesising iff Processing Brain reports evidence_state === "CONFLICTED"
  const engaged = base.processing_brain_state === "CONFLICTED";
  const reason = engaged
    ? "processing_brain_state === CONFLICTED · specialists in genuine disagreement · invite hypothesise()"
    : "processing_brain_state !== CONFLICTED (was " + base.processing_brain_state + ") · hypothesising not triggered";

  const hypotheses_emitted: HypothesisRecord[] = [];

  if (engaged) {
    // For each responder that actually contributed a non-null analysis to
    // this task, ask its own .hypothesise() on the same input.
    for (const specialist_id of base.responders) {
      const brain = getSpecialist(specialist_id);
      if (!brain) continue;
      let statements: readonly Hypothesis[] = [];
      try {
        statements = brain.hypothesise(input.probe_input);
      } catch {
        // Specialists must not break the pipeline · silent skip
        continue;
      }
      for (const s of statements) {
        // Verbatim persistence · provenance to specialist + task
        const rec = writeHypothesis({
          source_agent: s.specialist_id,
          evidence_refs: s.evidence_ids,
          observation_pattern: s.kind,        // whatever the specialist emitted
          proposed_relationship: s.statement, // verbatim from specialist
          expected_observation: "verifier_input_required", // caller supplies at test time
          counterexample_condition: "verifier_input_required",
          confidence: s.confidence,
          provenance: {
            source_pipeline: "hypothesizing_pipeline.v1",
            trigger_state: base.processing_brain_state,
            correlation_id: base.correlation_id,
            task_id: base.task_id,
            responder_specialists: base.responders,
            processing_result_id: base.processing_result.id,
          },
          repo_root: input.repo_root,
        });
        hypotheses_emitted.push(rec);
      }
    }
  }

  recordHeartbeat({
    agent_id: "hypothesizing_pipeline",
    event_type: "run",
    event_data: {
      task_id: input.task_id,
      engaged,
      hypotheses_emitted: hypotheses_emitted.length,
    },
  });

  return {
    ...base,
    hypotheses_emitted,
    hypothesizing_engaged: engaged,
    hypothesizing_reason: reason,
  };
}

export const HYPOTHESIZING_PIPELINE_VERSION = "hypothesizing-pipeline.v1";
