// src/lib/nex-agent/code-engine/processing/capability-processing-pipeline.ts
//
// NEX1 · Processing Pipeline · assembles Cortex → Processing Brain → NEX.
//
// This module is the sole integration point between the existing BRB
// Cortex (brb_network_router) and the new Continuous Processing Brain.
// It does NOT create a second router — it wraps the existing one.
//
// Two entry points:
//   · runBaseline(input)          → Cortex broadcast · returns raw analysis (control arm of A/B)
//   · runWithProcessingBrain(input) → Cortex broadcast → Processing Brain → returns processed result (experiment arm)
//
// Both emit pulses so the A/B comparison of pulse-trace coverage is
// visible. Baseline pulses stop at Cortex; experiment pulses continue
// through Processing Brain and back.

import crypto from "node:crypto";
import { broadcastAnalysis, collectHeartbeats, listSpecialists } from "../brb/capability-brb-network-router";
import { process as processEvidence, heartbeat as pbHeartbeat, initProcessingBrain, type ProcessingResult, type EvidenceState } from "./capability-processing-brain";
import { emitPulse, markPulseProcessed, _resetForTesting } from "./capability-pulse";
import { recordHeartbeat, registerAgent } from "../capability-agent-registry";

registerAgent({
  id: "processing_pipeline",
  name: "Processing Pipeline · assembles Cortex → CPB → NEX",
  cognitive_layer: "processing_brain",
  description: "Wraps the existing Cortex broadcast with an optional Processing Brain leg. Emits pulses at every hop. Baseline arm skips the Processing Brain.",
});

export interface PipelineInput {
  readonly task_id: string;
  readonly probe_input: unknown;              // whatever the specialists' .analyse expects
  readonly only_specialists?: readonly string[];
  readonly repo_root?: string;
}

export interface BaselineResult {
  readonly arm: "baseline_no_processing_brain";
  readonly task_id: string;
  readonly correlation_id: string;
  readonly cortex_consensus: string;
  readonly cortex_majority_kind: string | null;
  readonly responders: readonly string[];
  readonly analyses: readonly ReturnType<typeof simplifyAnalysis>[];
  readonly pulses_emitted: number;
}

export interface ExperimentResult {
  readonly arm: "experiment_with_processing_brain";
  readonly task_id: string;
  readonly correlation_id: string;
  readonly cortex_consensus: string;
  readonly cortex_majority_kind: string | null;
  readonly responders: readonly string[];
  readonly analyses: readonly ReturnType<typeof simplifyAnalysis>[];
  readonly processing_brain_state: EvidenceState;
  readonly processing_result: ProcessingResult;
  readonly pulses_emitted: number;
}

function simplifyAnalysis(a: import("../brb/capability-specialist-brain").Analysis) {
  return { specialist_id: a.specialist_id, kind: a.kind, confidence: a.confidence };
}

// ── Baseline arm · Cortex → NEX (no Processing Brain) ─────────────────

export function runBaseline(input: PipelineInput): BaselineResult {
  const correlationId = "corr_" + crypto.randomBytes(4).toString("hex") + "_" + input.task_id;
  let pulses = 0;
  emitPulse({
    source: "nex",
    destination: "cortex",
    direction: "specialist_to_cortex", // treat as request
    payload_type: "task_request",
    payload_reference: input.task_id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
  }); pulses++;

  emitPulse({
    source: "cortex",
    destination: "specialists",
    direction: "cortex_to_specialist",
    payload_type: "broadcast_request",
    payload_reference: input.task_id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
  }); pulses++;

  const cortex = broadcastAnalysis(input.probe_input, input.only_specialists);

  emitPulse({
    source: "specialists",
    destination: "cortex",
    direction: "specialist_to_cortex",
    payload_type: "aggregated_analyses",
    payload_reference: input.task_id + "|" + cortex.analyses.length + "_responders",
    correlation_id: correlationId,
    repo_root: input.repo_root,
    state: "processed",
  }); pulses++;

  return {
    arm: "baseline_no_processing_brain",
    task_id: input.task_id,
    correlation_id: correlationId,
    cortex_consensus: cortex.consensus,
    cortex_majority_kind: cortex.majority_kind,
    responders: cortex.responders,
    analyses: cortex.analyses.map(simplifyAnalysis),
    pulses_emitted: pulses,
  };
}

// ── Experiment arm · Cortex → Processing Brain → NEX ──────────────────

export function runWithProcessingBrain(input: PipelineInput): ExperimentResult {
  initProcessingBrain(input.repo_root);
  const hb = pbHeartbeat(input.repo_root);
  if (hb.status === "DEGRADED") {
    // continue but record it
    recordHeartbeat({ agent_id: "processing_pipeline", event_type: "cpb_degraded", event_data: { task_id: input.task_id } });
  }

  const correlationId = "corr_" + crypto.randomBytes(4).toString("hex") + "_" + input.task_id;
  let pulses = 0;

  emitPulse({
    source: "nex",
    destination: "cortex",
    direction: "specialist_to_cortex",
    payload_type: "task_request",
    payload_reference: input.task_id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
  }); pulses++;
  emitPulse({
    source: "cortex",
    destination: "specialists",
    direction: "cortex_to_specialist",
    payload_type: "broadcast_request",
    payload_reference: input.task_id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
  }); pulses++;

  const cortex = broadcastAnalysis(input.probe_input, input.only_specialists);

  const specialistsToCortexPulse = emitPulse({
    source: "specialists",
    destination: "cortex",
    direction: "specialist_to_cortex",
    payload_type: "aggregated_analyses",
    payload_reference: input.task_id + "|" + cortex.analyses.length + "_responders",
    correlation_id: correlationId,
    repo_root: input.repo_root,
    state: "processed",
  }); pulses++;

  // Cortex → Processing Brain
  emitPulse({
    source: "cortex",
    destination: "processing_brain",
    direction: "cortex_to_processing_brain",
    payload_type: "aggregated_evidence",
    payload_reference: specialistsToCortexPulse.pulse_id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
  }); pulses++;

  // Heartbeats snapshot into the processing input · so PB can see DEGRADED
  const specHeartbeats: Record<string, string> = {};
  for (const h of collectHeartbeats()) specHeartbeats[h.specialist_id] = h.status;

  const processed = processEvidence({
    task_id: input.task_id,
    specialist_analyses: cortex.analyses,
    consensus_label: cortex.consensus,
    heartbeat_snapshot: specHeartbeats,
  }, input.repo_root);

  emitPulse({
    source: "processing_brain",
    destination: "cortex",
    direction: "processing_brain_to_cortex",
    payload_type: "processed_result",
    payload_reference: processed.id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
    state: "processed",
  }); pulses++;
  emitPulse({
    source: "processing_brain",
    destination: "nex",
    direction: "processing_brain_to_nex",
    payload_type: "processed_result",
    payload_reference: processed.id,
    correlation_id: correlationId,
    repo_root: input.repo_root,
    state: "processed",
  }); pulses++;
  markPulseProcessed({ prior_pulse_id: specialistsToCortexPulse.pulse_id, result_reference: processed.id, repo_root: input.repo_root });

  return {
    arm: "experiment_with_processing_brain",
    task_id: input.task_id,
    correlation_id: correlationId,
    cortex_consensus: cortex.consensus,
    cortex_majority_kind: cortex.majority_kind,
    responders: cortex.responders,
    analyses: cortex.analyses.map(simplifyAnalysis),
    processing_brain_state: processed.evidence_state,
    processing_result: processed,
    pulses_emitted: pulses,
  };
}

export function _resetPulseForTesting(session_id?: string): void { _resetForTesting(session_id); }
export function listSpecialistsInNetwork(): readonly string[] { return listSpecialists(); }
export const PROCESSING_PIPELINE_VERSION = "processing-pipeline.v1";
