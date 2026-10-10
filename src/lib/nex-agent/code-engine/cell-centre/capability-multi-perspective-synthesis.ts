// src/lib/nex-agent/code-engine/cell-centre/capability-multi-perspective-synthesis.ts
//
// NEX1 · Multi-Perspective Synthesis (MPS) · Ledger B additive.
// Founder authorised 2026-09-18 · "find intelligence" continuation.
//
// PURPOSE
//   Consult multiple specialists in parallel · synthesise their signals
//   with domain-general rules · beat baseline on cases where baseline
//   is legitimately weak (verb contradictions · semantic duplicates).
//
// DISCIPLINE
//   · Frozen PEC/PB/router/specialists untouched · verified byte-identical
//   · Fear/Concern/Afraid HARD GATE preserved (delegated to PEC Plus)
//   · Rules are domain-general · defined a priori · not test-tuned
//   · Never bypasses safety
//   · Zero LLM · deterministic · Ledger B
//   · No production wiring · Gate 1 frozen
//   · Reversible: delete this file · behaviour reverts

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { consultWithPecPlus, type PecPlusResult } from "./capability-pec-plus";
import { runWithPbPlus } from "./capability-pb-plus";

registerAgent({
  id: "multi_perspective_synthesis",
  name: "Multi-Perspective Synthesis consumer",
  cognitive_layer: "infrastructure_registry",
  description: "Consults multiple specialists in parallel · synthesises signals via domain-general rules (contradiction · semantic duplicate) · defers to PEC Plus + safety layer. Ledger B additive · reversible.",
});

export type MpsVerdict =
  | "SYNTHESISED_UNKNOWN"
  | "SYNTHESISED_REFUSE_DUPLICATE"
  | "SYNTHESISED_REFUSE_HARDGATE"
  | "PASSTHROUGH";

export interface MpsInput {
  readonly task_id: string;
  readonly payload: {
    readonly intent?: string;
    readonly target?: string | null;
    readonly existing_capabilities?: readonly string[];
    readonly existence_absent?: boolean;
    readonly activity?: string;
  };
  readonly repo_root: string;
}

export interface MpsResult {
  readonly task_id: string;
  readonly verdict: MpsVerdict;
  readonly rule_fired: string | null;
  readonly signals: {
    readonly creation_kind: string | null;
    readonly creation_conf: number | null;
    readonly semantic_dup_kind: string | null;
    readonly semantic_dup_conf: number | null;
    readonly contradiction_kind: string | null;
    readonly contradiction_conf: number | null;
  };
  readonly pec_plus_outcome: string | null;
  readonly pec_plus_kind: string | null;
  readonly hard_gate: boolean;
  readonly evidence_kind: "INFERRED";
  readonly policy_id: "NEX1_MPS_POLICY_V1";
}

const MPS_POOL = ["creation_specialist", "semantic_duplicate_specialist", "verb_contradiction_specialist"] as const;

/**
 * Consult MPS pool and apply synthesis rules.
 *
 * Rules (Ledger B · domain-general · disclosed):
 *
 *   R0 · Safety (HARD GATE)
 *      PEC Plus PRE/POST safety block → SYNTHESISED_REFUSE_HARDGATE
 *
 *   R1 · Verb contradiction
 *      IF verb_contradiction_specialist emits `verb_contradiction_detected`
 *      at confidence ≥ 0.7  →  SYNTHESISED_UNKNOWN
 *      (Baseline picks first rule · this rule detects that no rule can
 *      resolve the contradiction confidently.)
 *
 *   R2 · Semantic duplicate
 *      IF semantic_duplicate_specialist emits `semantic_duplicate_detected`
 *      at confidence ≥ 0.7 AND creation_specialist emits
 *      `creation_signal_present`  →  SYNTHESISED_REFUSE_DUPLICATE
 *      (Both specialists agree · one detects creation intent, the other
 *      detects semantic overlap · legitimate synthesis.)
 *
 *   R3 · Passthrough
 *      Otherwise return PASSTHROUGH · caller uses baseline decision.
 *
 * NOTE
 *   MPS never overrides base UNKNOWN → PROCEED_CREATE (that was the U6
 *   regression from prior unlock test). MPS only converts overconfident
 *   baseline decisions to UNKNOWN or REFUSE_DUPLICATE · never the reverse.
 */
export function synthesiseMultiPerspective(input: MpsInput): MpsResult {
  // Consult MPS pool via PEC Plus (safety layer + evidence assessment)
  const consult = consultWithPecPlus({
    task_id: input.task_id,
    observation_input: input.payload,
    proposed_action: {
      target: input.payload.target ?? null,
      operation_kind: "READ",
      preservation_baseline_available: true,
    },
    concern_signals: {
      prior_relationship: null,
      investigation_verdict: null,
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    },
    recent_turn_history: [{ turn_id: 1, state: "verified" }],
    repo_root: input.repo_root,
    only_specialists: MPS_POOL,
  });

  // R0 · Safety hard gate
  if (consult.outcome === "HARD_GATE_BLOCKED_PRE_CONSULTATION" || consult.outcome === "HARD_GATE_BLOCKED_POST_CONSULTATION") {
    recordHeartbeat({
      agent_id: "multi_perspective_synthesis",
      event_type: "synthesise",
      event_data: { task_id: input.task_id, verdict: "SYNTHESISED_REFUSE_HARDGATE", rule: "R0" },
    });
    return {
      task_id: input.task_id,
      verdict: "SYNTHESISED_REFUSE_HARDGATE",
      rule_fired: "R0_safety_hardgate",
      signals: {
        creation_kind: null, creation_conf: null,
        semantic_dup_kind: null, semantic_dup_conf: null,
        contradiction_kind: null, contradiction_conf: null,
      },
      pec_plus_outcome: consult.outcome,
      pec_plus_kind: null,
      hard_gate: true,
      evidence_kind: "INFERRED",
      policy_id: "NEX1_MPS_POLICY_V1",
    };
  }

  // Also run PB Plus directly to get all specialist analyses (PEC Plus flattens to single-responder view)
  const pbPlus = runWithPbPlus({
    task_id: input.task_id + "_pbraw",
    probe_input: input.payload,
    only_specialists: MPS_POOL,
    repo_root: input.repo_root,
  });

  const analyses = pbPlus.base_result.analyses ?? [];
  const bySpecialist = new Map<string, { kind: string; confidence: number }>();
  for (const a of analyses) bySpecialist.set(a.specialist_id, { kind: a.kind, confidence: a.confidence });

  const creation = bySpecialist.get("creation_specialist") ?? null;
  const semDup = bySpecialist.get("semantic_duplicate_specialist") ?? null;
  const contradiction = bySpecialist.get("verb_contradiction_specialist") ?? null;

  const signals = {
    creation_kind: creation?.kind ?? null,
    creation_conf: creation?.confidence ?? null,
    semantic_dup_kind: semDup?.kind ?? null,
    semantic_dup_conf: semDup?.confidence ?? null,
    contradiction_kind: contradiction?.kind ?? null,
    contradiction_conf: contradiction?.confidence ?? null,
  };

  // R1 · Verb contradiction
  if (contradiction && contradiction.kind === "verb_contradiction_detected" && contradiction.confidence >= 0.7) {
    recordHeartbeat({
      agent_id: "multi_perspective_synthesis",
      event_type: "synthesise",
      event_data: { task_id: input.task_id, verdict: "SYNTHESISED_UNKNOWN", rule: "R1_verb_contradiction" },
    });
    return {
      task_id: input.task_id,
      verdict: "SYNTHESISED_UNKNOWN",
      rule_fired: "R1_verb_contradiction",
      signals,
      pec_plus_outcome: consult.outcome,
      pec_plus_kind: consult.single_responder_kind,
      hard_gate: false,
      evidence_kind: "INFERRED",
      policy_id: "NEX1_MPS_POLICY_V1",
    };
  }

  // R2 · Semantic duplicate (two-specialist agreement)
  if (
    semDup && semDup.kind === "semantic_duplicate_detected" && semDup.confidence >= 0.7 &&
    creation && creation.kind === "creation_signal_present"
  ) {
    recordHeartbeat({
      agent_id: "multi_perspective_synthesis",
      event_type: "synthesise",
      event_data: { task_id: input.task_id, verdict: "SYNTHESISED_REFUSE_DUPLICATE", rule: "R2_semantic_duplicate_two_witness" },
    });
    return {
      task_id: input.task_id,
      verdict: "SYNTHESISED_REFUSE_DUPLICATE",
      rule_fired: "R2_semantic_duplicate_two_witness",
      signals,
      pec_plus_outcome: consult.outcome,
      pec_plus_kind: consult.single_responder_kind,
      hard_gate: false,
      evidence_kind: "INFERRED",
      policy_id: "NEX1_MPS_POLICY_V1",
    };
  }

  // R3 · Passthrough
  recordHeartbeat({
    agent_id: "multi_perspective_synthesis",
    event_type: "synthesise",
    event_data: { task_id: input.task_id, verdict: "PASSTHROUGH", rule: null },
  });
  return {
    task_id: input.task_id,
    verdict: "PASSTHROUGH",
    rule_fired: null,
    signals,
    pec_plus_outcome: consult.outcome,
    pec_plus_kind: consult.single_responder_kind,
    hard_gate: false,
    evidence_kind: "INFERRED",
    policy_id: "NEX1_MPS_POLICY_V1",
  };
}

export const MPS_VERSION = "mps.v1.2026-09-18";
