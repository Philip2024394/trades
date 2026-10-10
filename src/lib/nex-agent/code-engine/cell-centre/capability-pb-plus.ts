// src/lib/nex-agent/code-engine/cell-centre/capability-pb-plus.ts
//
// NEX1 · Processing Brain Plus · additive extension for Stage 6 unlock.
// Founder-authorised 2026-09-18 · direct response to Unlock Protocol outcome E:
//
//   "The scientific location of the lock is identified. PB uniformly emits
//    INSUFFICIENT for singleton cases regardless of quality. Multiple layers
//    must change coordinately."
//
//   Founder final directive: "use the key to unlock the door."
//
// PURPOSE
//   Provide an ADDITIVE Ledger B module that extends Processing Brain's
//   state assessment WITHOUT modifying the frozen original. Adds a new
//   state `CLEAR_SINGLE_STRONG` under strict conditions:
//     · Consensus = SINGLE_RESPONDER
//     · Confidence >= 0.6
//     · Kind is INFORMATIVE (not in NO_SIGNAL_KINDS)
//     · Specialist is on-domain (matches semantic criteria for the input)
//
// STRICT DISCIPLINE
//   · Frozen `capability-processing-brain.ts` untouched · verified byte-identical
//   · Frozen `capability-processing-pipeline.ts` untouched · verified byte-identical
//   · PB Plus is a POST-PROCESSING wrapper · never modifies PB internals
//   · Safety layer untouched (still authoritative)
//   · Zero LLM · deterministic · Ledger B
//   · No production wiring
//   · Reversible: delete this file · behaviour reverts to prior state

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { runWithProcessingBrain, type PipelineInput, type ExperimentResult } from "../processing/capability-processing-pipeline";
import { semanticMatchCapabilities } from "./capability-map-v2-semantic";

registerAgent({
  id: "processing_brain_plus",
  name: "PB Plus · additive state assessment extension for Stage 6 unlock",
  cognitive_layer: "infrastructure_registry",
  description: "Wraps frozen PB with post-processing that may re-classify UNCERTAIN → CLEAR_SINGLE_STRONG under strict conditions (SINGLE_RESPONDER + high confidence + informative kind + on-domain specialist). Ledger B additive · reversible · frozen PB untouched.",
});

// ── Extended state type ─────────────────────────────────────────────────

export type PbPlusState =
  | "CLEAR"                    // (from original PB)
  | "CLEAR_SINGLE_STRONG"      // (NEW · this module) high-quality single-responder
  | "UNCERTAIN"                // (from original PB)
  | "CONFLICTED"               // (from original PB)
  | "INSUFFICIENT"             // (from original PB)
  | "DEGRADED";                // (from original PB)

// ── Conditions for CLEAR_SINGLE_STRONG (Ledger B · disclosed) ───────────

const STRONG_SINGLE_MIN_CONFIDENCE = 0.6;

const NO_SIGNAL_KINDS = new Set([
  "no_op", "no_response", "no_creation_signal", "not_a_combination",
  "single_domain", "no_change_to_test", "message_shape_unknown",
  "no_failures_observed", "no_boundary_observed", "state_nominal",
  "single_step_not_a_build",
]);

export interface PbPlusResult {
  readonly base_result: ExperimentResult;
  readonly pb_plus_state: PbPlusState;
  readonly upgraded: boolean;                                // true if state changed from base UNCERTAIN/INSUFFICIENT to CLEAR_SINGLE_STRONG
  readonly upgrade_reason: string | null;
  readonly single_responder_confidence: number | null;
  readonly single_responder_kind: string | null;
  readonly single_responder_specialist_id: string | null;
  readonly on_domain_check: boolean;
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "PB_PLUS_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  readonly policy_id: "NEX1_PB_PLUS_POLICY_V1";
}

/**
 * Runs the frozen pipeline · post-processes state to potentially return
 * CLEAR_SINGLE_STRONG. Never modifies underlying PB behaviour.
 */
export function runWithPbPlus(input: PipelineInput): PbPlusResult {
  // Run the FROZEN pipeline first · unchanged
  const base = runWithProcessingBrain(input);
  const analyses = base.analyses ?? [];

  // Default: no upgrade
  let pb_plus_state: PbPlusState = base.processing_brain_state as PbPlusState;
  let upgraded = false;
  let upgrade_reason: string | null = null;
  let single_conf: number | null = null;
  let single_kind: string | null = null;
  let single_specialist: string | null = null;
  let on_domain_check = false;

  // Condition check for CLEAR_SINGLE_STRONG upgrade
  const consensus = base.cortex_consensus;
  const pbState = base.processing_brain_state;
  const informativeAnalyses = analyses.filter((a) => !NO_SIGNAL_KINDS.has(a.kind));

  if (
    consensus === "SINGLE_RESPONDER" &&
    (pbState === "UNCERTAIN" || pbState === "INSUFFICIENT") &&
    informativeAnalyses.length === 1
  ) {
    const single = informativeAnalyses[0];
    single_conf = single.confidence;
    single_kind = single.kind;
    single_specialist = single.specialist_id;

    // On-domain check via semantic matcher (Ledger B)
    const semantic = semanticMatchCapabilities(input.probe_input as Readonly<Record<string, unknown>>);
    on_domain_check = semantic.selected.includes(single.specialist_id);

    if (single_conf >= STRONG_SINGLE_MIN_CONFIDENCE && on_domain_check) {
      pb_plus_state = "CLEAR_SINGLE_STRONG";
      upgraded = true;
      upgrade_reason = "SINGLE_RESPONDER + confidence " + single_conf.toFixed(2) +
        " >= " + STRONG_SINGLE_MIN_CONFIDENCE + " + informative kind '" + single_kind +
        "' + on-domain specialist '" + single_specialist + "'";
    } else if (single_conf < STRONG_SINGLE_MIN_CONFIDENCE) {
      upgrade_reason = "SINGLE_RESPONDER but confidence " + single_conf.toFixed(2) + " below threshold " + STRONG_SINGLE_MIN_CONFIDENCE;
    } else if (!on_domain_check) {
      upgrade_reason = "SINGLE_RESPONDER at required confidence but specialist '" + single_specialist + "' not on-domain per semantic matcher";
    }
  }

  recordHeartbeat({
    agent_id: "processing_brain_plus",
    event_type: "assess",
    event_data: {
      task_id: input.task_id,
      base_state: base.processing_brain_state,
      final_state: pb_plus_state,
      upgraded,
    },
  });

  return {
    base_result: base,
    pb_plus_state,
    upgraded,
    upgrade_reason,
    single_responder_confidence: single_conf,
    single_responder_kind: single_kind,
    single_responder_specialist_id: single_specialist,
    on_domain_check,
    evidence_kind: "INFERRED",
    r11b_marker: "PB_PLUS_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    policy_id: "NEX1_PB_PLUS_POLICY_V1",
  };
}

export const PB_PLUS_VERSION = "pb-plus.v1.2026-09-18";
