// src/lib/nex-agent/code-engine/cell-centre/capability-production-evidence-consultation.ts
//
// NEX1 · Production Evidence Consultation (PEC).
// Founder-authorised 2026-09-18 · master prompt (narrower question):
//   "Can NEX's existing production runtime safely consult its existing
//    specialist network without changing the intelligence itself?"
//
// DESIGN INTENT
//   Provide the runtime with a controlled CONSULTATION function that:
//     · Applies the safety layer (Fear + Concern + Afraid) as an
//       INDEPENDENT and AUTHORITATIVE HARD GATE — first and last.
//     · Broadcasts observation to existing specialist network.
//     · Feeds specialist responses through the existing Processing Brain.
//     · Returns the processed state + full provenance.
//     · Makes NO decision merely because a majority exists.
//     · Preserves DISAGREEMENT · NO_RESPONSE · UNKNOWN honestly.
//     · Never auto-fires. Every consultation is an explicit caller invocation.
//
// STRICT DISCIPLINE
//   · This module does NOT wire itself into chat-turn / native-loop /
//     native-investigation-mode. Production runtime paths remain
//     intentionally disconnected (Gate 1 frozen).
//   · This module does NOT modify Fear/Concern/Afraid, routers, Processing
//     Brain, specialists, or safety-doctrine.
//   · This module does NOT change the intelligence. It exposes an
//     inspectable consultation pathway.
//   · Zero LLM · deterministic · Ledger B infrastructure.
//   · Safety is authoritative — HARD_GATE_BLOCKED short-circuits and
//     returns without invoking specialists (no consultation of network
//     when Fear says HIGH_FEAR).

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { assessFear, type FearAssessmentInput, type FearAssessment } from "../capability-fear";
import { assessConcern, type ConcernSignals, type ConcernAssessment } from "../capability-concern";
import { assessAfraid, type AfraidAssessmentInput, type AfraidAssessment } from "../capability-afraid";
import { runWithProcessingBrain, type PipelineInput, type ExperimentResult } from "../processing/capability-processing-pipeline";

// ── Passive registration · infrastructure_registry ──────────────────────

registerAgent({
  id: "production_evidence_consultation",
  name: "Production Evidence Consultation · controlled specialist consultation with hard safety gate",
  cognitive_layer: "infrastructure_registry",
  description: "Provides production runtime with a controlled consultation of the specialist network + Processing Brain. Applies Fear/Concern/Afraid as HARD GATE first and last. Returns consultation state · never auto-decides. NOT wired to production runtime by default · consumer must explicitly invoke.",
});

// ── Types ───────────────────────────────────────────────────────────────

export interface ProductionObservation {
  readonly task_id: string;
  readonly observation_input: unknown;
  readonly proposed_action: {
    readonly target: string | null;
    readonly operation_kind: FearAssessmentInput["operation_kind"];
    readonly preservation_baseline_available: boolean;
  };
  readonly concern_signals: ConcernSignals;
  readonly recent_turn_history: AfraidAssessmentInput["recent_turns"];
  readonly repo_root: string;
  readonly only_specialists?: readonly string[];
}

export type ConsultationOutcome =
  | "SAFE_TO_PROCEED_WITH_CONSULTATION"      // safety pass · specialists consulted · caller decides
  | "SAFE_TO_PROCEED_WITHOUT_CONSULTATION"   // safety pass · specialists returned NO_RESPONSE
  | "HARD_GATE_BLOCKED_PRE_CONSULTATION"     // fear HIGH_FEAR before broadcast · no consultation
  | "HARD_GATE_BLOCKED_POST_CONSULTATION"    // consultation ran but final Fear/Afraid recheck blocks
  | "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE"    // specialists disagree · caller MUST NOT force
  | "PRESERVE_UNKNOWN_DO_NOT_DECIDE"         // Processing Brain state UNCERTAIN/INSUFFICIENT
  | "PRESERVE_CONFLICT_DO_NOT_DECIDE";       // Processing Brain state CONFLICTED

export interface ConsultationResult {
  readonly task_id: string;
  readonly correlation_id: string | null;
  readonly outcome: ConsultationOutcome;
  readonly pre_safety: {
    readonly fear: FearAssessment;
    readonly concern: ConcernAssessment;
    readonly afraid: AfraidAssessment;
    readonly hard_gate_engaged: boolean;
    readonly hard_gate_reason: string | null;
  };
  readonly consultation: ExperimentResult | null;
  readonly post_safety: {
    readonly fear: FearAssessment;
    readonly afraid: AfraidAssessment;
    readonly hard_gate_engaged: boolean;
    readonly hard_gate_reason: string | null;
  } | null;
  readonly provenance: {
    readonly correlation_id: string | null;
    readonly responder_count: number;
    readonly non_null_count: number;
    readonly consensus_label: string | null;
    readonly processing_brain_state: string | null;
    readonly evidence_kind: "INFERRED";
    readonly r11b_marker: "PEC_CONSULTATION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  };
  readonly caller_must_decide: boolean;
  readonly policy_id: "NEX1_PEC_POLICY_V1";
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Explicit consultation entry point. Never fires autonomously.
 * Applies Fear/Concern/Afraid as HARD GATE before AND after specialist
 * consultation. Returns a rich consultation object · caller decides.
 */
export function consultSpecialistsForProductionDecision(input: ProductionObservation): ConsultationResult {
  // ── Pre-consultation safety gate · authoritative ──
  const fearBefore = assessFear({
    target: input.proposed_action.target,
    operation_kind: input.proposed_action.operation_kind,
    preservation_baseline_available: input.proposed_action.preservation_baseline_available,
    repo_root: input.repo_root,
  });
  const concernBefore = assessConcern(input.concern_signals);
  const afraidBefore = assessAfraid({ recent_turns: input.recent_turn_history });

  const hardGatePre = fearBefore.block_action === true;

  recordHeartbeat({
    agent_id: "production_evidence_consultation",
    event_type: "pre_safety",
    event_data: {
      task_id: input.task_id,
      fear: fearBefore.level,
      concern: concernBefore.level,
      afraid: afraidBefore.state,
      hard_gate: hardGatePre,
    },
  });

  // If HIGH_FEAR blocks · do NOT consult specialists · authoritative
  if (hardGatePre) {
    return {
      task_id: input.task_id,
      correlation_id: null,
      outcome: "HARD_GATE_BLOCKED_PRE_CONSULTATION",
      pre_safety: {
        fear: fearBefore,
        concern: concernBefore,
        afraid: afraidBefore,
        hard_gate_engaged: true,
        hard_gate_reason: fearBefore.reason_code,
      },
      consultation: null,
      post_safety: null,
      provenance: {
        correlation_id: null,
        responder_count: 0,
        non_null_count: 0,
        consensus_label: null,
        processing_brain_state: null,
        evidence_kind: "INFERRED",
        r11b_marker: "PEC_CONSULTATION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      },
      caller_must_decide: false, // Nothing to decide · safety already blocked
      policy_id: "NEX1_PEC_POLICY_V1",
    };
  }

  // ── Consult specialists via existing Processing Brain pipeline ──
  const pipelineInput: PipelineInput = {
    task_id: input.task_id,
    probe_input: input.observation_input,
    only_specialists: input.only_specialists,
    repo_root: input.repo_root,
  };
  const consultation = runWithProcessingBrain(pipelineInput);

  // ── Post-consultation safety recheck · authoritative ──
  const fearAfter = assessFear({
    target: input.proposed_action.target,
    operation_kind: input.proposed_action.operation_kind,
    preservation_baseline_available: input.proposed_action.preservation_baseline_available,
    repo_root: input.repo_root,
  });
  const afraidAfter = assessAfraid({ recent_turns: input.recent_turn_history });
  const hardGatePost = fearAfter.block_action === true || afraidAfter.state === "AFRAID";

  recordHeartbeat({
    agent_id: "production_evidence_consultation",
    event_type: "post_safety",
    event_data: {
      task_id: input.task_id,
      fear: fearAfter.level,
      afraid: afraidAfter.state,
      pb_state: consultation.processing_brain_state,
      hard_gate: hardGatePost,
    },
  });

  // If post-safety says stop · authoritative override
  if (hardGatePost) {
    return {
      task_id: input.task_id,
      correlation_id: consultation.correlation_id,
      outcome: "HARD_GATE_BLOCKED_POST_CONSULTATION",
      pre_safety: {
        fear: fearBefore, concern: concernBefore, afraid: afraidBefore,
        hard_gate_engaged: false, hard_gate_reason: null,
      },
      consultation,
      post_safety: {
        fear: fearAfter, afraid: afraidAfter,
        hard_gate_engaged: true,
        hard_gate_reason: fearAfter.block_action ? fearAfter.reason_code : "afraid_state",
      },
      provenance: {
        correlation_id: consultation.correlation_id,
        responder_count: consultation.responders.length,
        non_null_count: consultation.responders.length, // Rough count · analyses were emitted
        consensus_label: consultation.cortex_consensus,
        processing_brain_state: consultation.processing_brain_state,
        evidence_kind: "INFERRED",
        r11b_marker: "PEC_CONSULTATION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      },
      caller_must_decide: false, // Post-safety authoritative
      policy_id: "NEX1_PEC_POLICY_V1",
    };
  }

  // ── Determine outcome from consultation state · preserve disagreement/unknown ──
  const pbState = consultation.processing_brain_state;
  const consensus = consultation.cortex_consensus;

  let outcome: ConsultationOutcome;
  if (consensus === "NO_RESPONSE") {
    outcome = "SAFE_TO_PROCEED_WITHOUT_CONSULTATION";
  } else if (pbState === "CONFLICTED") {
    outcome = "PRESERVE_CONFLICT_DO_NOT_DECIDE";
  } else if (pbState === "UNCERTAIN" || pbState === "INSUFFICIENT") {
    outcome = "PRESERVE_UNKNOWN_DO_NOT_DECIDE";
  } else if (consensus === "DISAGREEMENT") {
    outcome = "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE";
  } else {
    outcome = "SAFE_TO_PROCEED_WITH_CONSULTATION";
  }

  return {
    task_id: input.task_id,
    correlation_id: consultation.correlation_id,
    outcome,
    pre_safety: {
      fear: fearBefore, concern: concernBefore, afraid: afraidBefore,
      hard_gate_engaged: false, hard_gate_reason: null,
    },
    consultation,
    post_safety: {
      fear: fearAfter, afraid: afraidAfter,
      hard_gate_engaged: false, hard_gate_reason: null,
    },
    provenance: {
      correlation_id: consultation.correlation_id,
      responder_count: consultation.responders.length,
      non_null_count: consultation.responders.length,
      consensus_label: consensus,
      processing_brain_state: pbState,
      evidence_kind: "INFERRED",
      r11b_marker: "PEC_CONSULTATION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    },
    caller_must_decide: outcome === "SAFE_TO_PROCEED_WITH_CONSULTATION"
      || outcome === "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE"
      || outcome === "PRESERVE_CONFLICT_DO_NOT_DECIDE"
      || outcome === "PRESERVE_UNKNOWN_DO_NOT_DECIDE",
    policy_id: "NEX1_PEC_POLICY_V1",
  };
}

export const PEC_VERSION = "production-evidence-consultation.v1";
