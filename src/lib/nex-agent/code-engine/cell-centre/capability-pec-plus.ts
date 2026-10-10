// src/lib/nex-agent/code-engine/cell-centre/capability-pec-plus.ts
//
// NEX1 · PEC Plus · additive extension for Stage 6 unlock.
// Founder-authorised 2026-09-18 · pairs with capability-pb-plus.ts.
//
// PURPOSE
//   Provide an ADDITIVE Ledger B consultation function that recognises
//   the new `CLEAR_SINGLE_STRONG` state from PB Plus and maps it to
//   `SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION`. Frozen PEC untouched.
//
// STRICT DISCIPLINE
//   · Frozen `capability-production-evidence-consultation.ts` untouched
//   · Fear/Concern/Afraid apply as authoritative HARD GATE (PRE + POST)
//     · same safety pattern as frozen PEC
//   · Never bypasses safety
//   · Zero LLM · deterministic · Ledger B
//   · No production wiring
//   · Reversible: delete this file · behaviour reverts

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { assessFear, type FearAssessmentInput, type FearAssessment } from "../capability-fear";
import { assessConcern, type ConcernSignals, type ConcernAssessment } from "../capability-concern";
import { assessAfraid, type AfraidAssessmentInput, type AfraidAssessment } from "../capability-afraid";
import { runWithPbPlus, type PbPlusState } from "./capability-pb-plus";

registerAgent({
  id: "production_evidence_consultation_plus",
  name: "PEC Plus · additive extension recognising CLEAR_SINGLE_STRONG",
  cognitive_layer: "infrastructure_registry",
  description: "Parallel to frozen PEC · uses PB Plus for extended state assessment · maps CLEAR_SINGLE_STRONG → SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION. Same safety pattern (Fear/Concern/Afraid HARD GATE first and last). Ledger B additive · reversible.",
});

// ── Types (extend frozen PEC's outcome set) ─────────────────────────────

export type PecPlusOutcome =
  | "HARD_GATE_BLOCKED_PRE_CONSULTATION"
  | "HARD_GATE_BLOCKED_POST_CONSULTATION"
  | "SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION"   // NEW · reachable via CLEAR_SINGLE_STRONG
  | "SAFE_TO_PROCEED_WITHOUT_CONSULTATION"
  | "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE"
  | "PRESERVE_UNKNOWN_DO_NOT_DECIDE"
  | "PRESERVE_CONFLICT_DO_NOT_DECIDE";

export interface PecPlusInput {
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

export interface PecPlusResult {
  readonly task_id: string;
  readonly correlation_id: string | null;
  readonly outcome: PecPlusOutcome;
  readonly pb_plus_state: PbPlusState;
  readonly upgraded_by_pb_plus: boolean;
  readonly upgrade_reason: string | null;
  readonly pre_safety: {
    readonly fear: FearAssessment;
    readonly concern: ConcernAssessment;
    readonly afraid: AfraidAssessment;
    readonly hard_gate: boolean;
  };
  readonly post_safety: {
    readonly fear: FearAssessment;
    readonly afraid: AfraidAssessment;
    readonly hard_gate: boolean;
  } | null;
  readonly consultation_analyses: readonly { specialist_id: string; kind: string; confidence: number }[];
  readonly single_responder_kind: string | null;
  readonly provenance: {
    readonly correlation_id: string | null;
    readonly consensus_label: string | null;
    readonly pb_state_before_upgrade: string | null;
    readonly pb_state_after_upgrade: PbPlusState;
    readonly evidence_kind: "INFERRED";
    readonly r11b_marker: "PEC_PLUS_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  };
  readonly caller_must_decide: boolean;
  readonly policy_id: "NEX1_PEC_PLUS_POLICY_V1";
}

// ── Public API ──────────────────────────────────────────────────────────

export function consultWithPecPlus(input: PecPlusInput): PecPlusResult {
  // Pre-safety (identical to frozen PEC pattern)
  const fearBefore = assessFear({
    target: input.proposed_action.target,
    operation_kind: input.proposed_action.operation_kind,
    preservation_baseline_available: input.proposed_action.preservation_baseline_available,
    repo_root: input.repo_root,
  });
  const concernBefore = assessConcern(input.concern_signals);
  const afraidBefore = assessAfraid({ recent_turns: input.recent_turn_history });
  const hardGatePre = fearBefore.block_action === true;

  if (hardGatePre) {
    return {
      task_id: input.task_id,
      correlation_id: null,
      outcome: "HARD_GATE_BLOCKED_PRE_CONSULTATION",
      pb_plus_state: "INSUFFICIENT",
      upgraded_by_pb_plus: false,
      upgrade_reason: null,
      pre_safety: { fear: fearBefore, concern: concernBefore, afraid: afraidBefore, hard_gate: true },
      post_safety: null,
      consultation_analyses: [],
      single_responder_kind: null,
      provenance: {
        correlation_id: null,
        consensus_label: null,
        pb_state_before_upgrade: null,
        pb_state_after_upgrade: "INSUFFICIENT",
        evidence_kind: "INFERRED",
        r11b_marker: "PEC_PLUS_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      },
      caller_must_decide: false,
      policy_id: "NEX1_PEC_PLUS_POLICY_V1",
    };
  }

  // Run PB Plus (which runs frozen PB and post-processes)
  const pbPlus = runWithPbPlus({
    task_id: input.task_id,
    probe_input: input.observation_input,
    only_specialists: input.only_specialists,
    repo_root: input.repo_root,
  });

  // Post-safety
  const fearAfter = assessFear({
    target: input.proposed_action.target,
    operation_kind: input.proposed_action.operation_kind,
    preservation_baseline_available: input.proposed_action.preservation_baseline_available,
    repo_root: input.repo_root,
  });
  const afraidAfter = assessAfraid({ recent_turns: input.recent_turn_history });
  const hardGatePost = fearAfter.block_action === true || afraidAfter.state === "AFRAID";

  if (hardGatePost) {
    return {
      task_id: input.task_id,
      correlation_id: pbPlus.base_result.correlation_id,
      outcome: "HARD_GATE_BLOCKED_POST_CONSULTATION",
      pb_plus_state: pbPlus.pb_plus_state,
      upgraded_by_pb_plus: pbPlus.upgraded,
      upgrade_reason: pbPlus.upgrade_reason,
      pre_safety: { fear: fearBefore, concern: concernBefore, afraid: afraidBefore, hard_gate: false },
      post_safety: { fear: fearAfter, afraid: afraidAfter, hard_gate: true },
      consultation_analyses: pbPlus.base_result.analyses.map((a) => ({ specialist_id: a.specialist_id, kind: a.kind, confidence: a.confidence })),
      single_responder_kind: pbPlus.single_responder_kind,
      provenance: {
        correlation_id: pbPlus.base_result.correlation_id,
        consensus_label: pbPlus.base_result.cortex_consensus,
        pb_state_before_upgrade: pbPlus.base_result.processing_brain_state,
        pb_state_after_upgrade: pbPlus.pb_plus_state,
        evidence_kind: "INFERRED",
        r11b_marker: "PEC_PLUS_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      },
      caller_must_decide: false,
      policy_id: "NEX1_PEC_PLUS_POLICY_V1",
    };
  }

  // Map PB Plus state to outcome
  const consensus = pbPlus.base_result.cortex_consensus;
  const pbPlusState = pbPlus.pb_plus_state;
  let outcome: PecPlusOutcome;

  if (consensus === "NO_RESPONSE") {
    outcome = "SAFE_TO_PROCEED_WITHOUT_CONSULTATION";
  } else if (pbPlusState === "CLEAR_SINGLE_STRONG") {
    outcome = "SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION";
  } else if (pbPlusState === "CONFLICTED") {
    outcome = "PRESERVE_CONFLICT_DO_NOT_DECIDE";
  } else if (pbPlusState === "UNCERTAIN" || pbPlusState === "INSUFFICIENT") {
    outcome = "PRESERVE_UNKNOWN_DO_NOT_DECIDE";
  } else if (consensus === "DISAGREEMENT") {
    outcome = "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE";
  } else {
    outcome = "SAFE_TO_PROCEED_WITHOUT_CONSULTATION";
  }

  recordHeartbeat({
    agent_id: "production_evidence_consultation_plus",
    event_type: "consult",
    event_data: {
      task_id: input.task_id,
      outcome,
      pb_plus_state: pbPlusState,
      upgraded: pbPlus.upgraded,
    },
  });

  return {
    task_id: input.task_id,
    correlation_id: pbPlus.base_result.correlation_id,
    outcome,
    pb_plus_state: pbPlusState,
    upgraded_by_pb_plus: pbPlus.upgraded,
    upgrade_reason: pbPlus.upgrade_reason,
    pre_safety: { fear: fearBefore, concern: concernBefore, afraid: afraidBefore, hard_gate: false },
    post_safety: { fear: fearAfter, afraid: afraidAfter, hard_gate: false },
    consultation_analyses: pbPlus.base_result.analyses.map((a) => ({ specialist_id: a.specialist_id, kind: a.kind, confidence: a.confidence })),
    single_responder_kind: pbPlus.single_responder_kind,
    provenance: {
      correlation_id: pbPlus.base_result.correlation_id,
      consensus_label: consensus,
      pb_state_before_upgrade: pbPlus.base_result.processing_brain_state,
      pb_state_after_upgrade: pbPlusState,
      evidence_kind: "INFERRED",
      r11b_marker: "PEC_PLUS_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    },
    caller_must_decide: outcome === "SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION"
      || outcome === "PRESERVE_DISAGREEMENT_DO_NOT_DECIDE"
      || outcome === "PRESERVE_CONFLICT_DO_NOT_DECIDE"
      || outcome === "PRESERVE_UNKNOWN_DO_NOT_DECIDE",
    policy_id: "NEX1_PEC_PLUS_POLICY_V1",
  };
}

export const PEC_PLUS_VERSION = "pec-plus.v1.2026-09-18";
