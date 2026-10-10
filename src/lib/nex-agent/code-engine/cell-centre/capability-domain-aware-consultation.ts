// src/lib/nex-agent/code-engine/cell-centre/capability-domain-aware-consultation.ts
//
// NEX1 · Domain-Aware Consultation Path (DACP).
// Founder-authorised 2026-09-18 · direct response to LS v2 finding:
//
//   "Stage 6 is not disproven. It is currently untestable on this
//    architecture because the consultation pipeline cannot generate the
//    evidence states required to exercise it."
//
// PURPOSE
//   Provide a PARALLEL consultation path that:
//     · Uses the semantic matcher (capability-map-v2-semantic.ts) to
//       select DOMAIN-RELEVANT specialists only
//     · Aggregates ONLY on-domain responses
//     · Produces outcomes that reflect on-domain consensus/disagreement
//       rather than the diverse-pool DISAGREEMENT that dominates PEC
//     · Emits its own `consultation_authority` level (STRONG · ADVISORY ·
//       INCONCLUSIVE · UNAVAILABLE)
//
// STRICT DISCIPLINE
//   · Does NOT modify frozen PEC · Processing Brain · router · specialists
//   · Does NOT replace PEC · this is a PARALLEL path
//   · Does NOT wire into production runtime (Gate 1 frozen)
//   · Fear/Concern/Afraid apply as authoritative HARD GATE first (same
//     safety pattern as PEC)
//   · Zero LLM · deterministic · Ledger B infrastructure
//   · Never auto-decides · returns advisory outcome only

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { assessFear, type FearAssessmentInput } from "../capability-fear";
import { assessConcern, type ConcernSignals } from "../capability-concern";
import { assessAfraid, type AfraidAssessmentInput } from "../capability-afraid";
import { broadcastAnalysis } from "../brb/capability-brb-network-router";
import { semanticMatchCapabilities } from "./capability-map-v2-semantic";

registerAgent({
  id: "domain_aware_consultation",
  name: "Domain-Aware Consultation Path · Ledger B additive · Stage 6 testability substrate",
  cognitive_layer: "infrastructure_registry",
  description: "Selects on-domain specialists via semantic matcher · aggregates only their responses · emits consultation_authority level. Parallel to PEC · never replaces it. Never wired to production.",
});

// ── Types ───────────────────────────────────────────────────────────────

export type ConsultationAuthority =
  | "STRONG"            // on-domain UNANIMOUS + high confidence
  | "ADVISORY"          // on-domain SINGLE_RESPONDER with reasonable confidence or MAJORITY
  | "INCONCLUSIVE"      // on-domain DISAGREEMENT or low confidence
  | "UNAVAILABLE";      // no on-domain specialists responded

export type DacpOutcome =
  | "HARD_GATE_BLOCKED_PRE"
  | "HARD_GATE_BLOCKED_POST"
  | "SAFE_TO_PROCEED_WITH_STRONG_CONSULTATION"     // authority=STRONG · consultation may influence
  | "SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION"   // authority=ADVISORY · consultation may nudge
  | "PRESERVE_INCONCLUSIVE_DO_NOT_DECIDE"          // authority=INCONCLUSIVE
  | "PROCEED_WITHOUT_CONSULTATION";                // authority=UNAVAILABLE

export interface DacpInput {
  readonly task_id: string;
  readonly observation_input: Readonly<Record<string, unknown>>;
  readonly proposed_action: {
    readonly target: string | null;
    readonly operation_kind: FearAssessmentInput["operation_kind"];
    readonly preservation_baseline_available: boolean;
  };
  readonly concern_signals: ConcernSignals;
  readonly recent_turn_history: AfraidAssessmentInput["recent_turns"];
  readonly repo_root: string;
}

export interface DacpResult {
  readonly task_id: string;
  readonly outcome: DacpOutcome;
  readonly consultation_authority: ConsultationAuthority | null;
  readonly pre_safety: {
    readonly fear_level: string;
    readonly concern_level: string;
    readonly afraid_state: string;
    readonly hard_gate: boolean;
  };
  readonly semantic_features: unknown;
  readonly on_domain_specialists: readonly string[];
  readonly on_domain_analyses: readonly { specialist_id: string; kind: string; confidence: number }[];
  readonly on_domain_consensus: "UNANIMOUS" | "MAJORITY" | "DISAGREEMENT" | "SINGLE_RESPONDER" | "NO_RESPONSE";
  readonly on_domain_majority_kind: string | null;
  readonly avg_confidence: number | null;
  readonly r11b_marker: "DACP_INFERRED_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  readonly evidence_kind: "INFERRED";
  readonly policy_id: "NEX1_DACP_POLICY_V1";
}

// ── Consultation-authority thresholds (Ledger B · deterministic · disclosed) ─

const AUTHORITY_STRONG_MIN_CONF = 0.6;
const AUTHORITY_ADVISORY_MIN_CONF = 0.4;

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Explicit domain-aware consultation. Never fires autonomously.
 *
 * Flow:
 *   1. Fear/Concern/Afraid — authoritative HARD GATE first
 *   2. Semantic matcher — select on-domain specialists
 *   3. broadcastAnalysis (existing frozen router) to on-domain pool only
 *   4. Aggregate on-domain responses only
 *   5. Compute consultation_authority based on consensus + avg confidence
 *   6. Map to DacpOutcome
 *   7. Fear/Afraid post-check
 */
export function consultDomainAware(input: DacpInput): DacpResult {
  // ── Pre-safety ──
  const fearBefore = assessFear({
    target: input.proposed_action.target,
    operation_kind: input.proposed_action.operation_kind,
    preservation_baseline_available: input.proposed_action.preservation_baseline_available,
    repo_root: input.repo_root,
  });
  const concernBefore = assessConcern(input.concern_signals);
  const afraidBefore = assessAfraid({ recent_turns: input.recent_turn_history });

  const preSafety = {
    fear_level: fearBefore.level,
    concern_level: concernBefore.level,
    afraid_state: afraidBefore.state,
    hard_gate: fearBefore.block_action === true,
  };

  if (preSafety.hard_gate) {
    recordHeartbeat({
      agent_id: "domain_aware_consultation",
      event_type: "pre_safety_block",
      event_data: { task_id: input.task_id, fear: fearBefore.level },
    });
    return {
      task_id: input.task_id,
      outcome: "HARD_GATE_BLOCKED_PRE",
      consultation_authority: null,
      pre_safety: preSafety,
      semantic_features: null,
      on_domain_specialists: [],
      on_domain_analyses: [],
      on_domain_consensus: "NO_RESPONSE",
      on_domain_majority_kind: null,
      avg_confidence: null,
      r11b_marker: "DACP_INFERRED_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      evidence_kind: "INFERRED",
      policy_id: "NEX1_DACP_POLICY_V1",
    };
  }

  // ── Semantic matcher · select on-domain specialists ──
  const semanticResult = semanticMatchCapabilities(input.observation_input);
  const onDomainSpecialists = semanticResult.selected;

  if (onDomainSpecialists.length === 0) {
    // No on-domain specialists · proceed without consultation
    return {
      task_id: input.task_id,
      outcome: "PROCEED_WITHOUT_CONSULTATION",
      consultation_authority: "UNAVAILABLE",
      pre_safety: preSafety,
      semantic_features: semanticResult.features,
      on_domain_specialists: [],
      on_domain_analyses: [],
      on_domain_consensus: "NO_RESPONSE",
      on_domain_majority_kind: null,
      avg_confidence: null,
      r11b_marker: "DACP_INFERRED_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      evidence_kind: "INFERRED",
      policy_id: "NEX1_DACP_POLICY_V1",
    };
  }

  // ── Broadcast to on-domain specialists only (existing frozen router) ──
  const broadcast = broadcastAnalysis(input.observation_input, onDomainSpecialists);

  // ── Filter out no_op / no-signal kinds so on-domain agreement is real ──
  const NO_SIGNAL_KINDS = new Set([
    "no_op", "no_response", "no_creation_signal", "not_a_combination",
    "single_domain", "no_change_to_test", "message_shape_unknown",
    "no_failures_observed", "no_boundary_observed", "state_nominal",
    "single_step_not_a_build",
  ]);
  const informativeAnalyses = broadcast.analyses.filter((a) => !NO_SIGNAL_KINDS.has(a.kind));

  // ── Compute on-domain consensus over INFORMATIVE responses ──
  let consensus: DacpResult["on_domain_consensus"];
  let majority_kind: string | null = null;
  let avg_confidence: number | null = null;

  if (informativeAnalyses.length === 0) {
    consensus = "NO_RESPONSE";
  } else {
    const kindCounts = new Map<string, number>();
    let totalConf = 0;
    for (const a of informativeAnalyses) {
      kindCounts.set(a.kind, (kindCounts.get(a.kind) ?? 0) + 1);
      totalConf += a.confidence;
    }
    avg_confidence = totalConf / informativeAnalyses.length;

    if (informativeAnalyses.length === 1) {
      consensus = "SINGLE_RESPONDER";
      majority_kind = informativeAnalyses[0].kind;
    } else if (kindCounts.size === 1) {
      consensus = "UNANIMOUS";
      majority_kind = [...kindCounts.keys()][0];
    } else {
      const sorted = [...kindCounts.entries()].sort((a, b) => b[1] - a[1]);
      const topCount = sorted[0][1];
      if (topCount > informativeAnalyses.length / 2) {
        consensus = "MAJORITY";
        majority_kind = sorted[0][0];
      } else {
        consensus = "DISAGREEMENT";
        majority_kind = null;
      }
    }
  }

  // ── Determine consultation_authority + outcome ──
  let authority: ConsultationAuthority;
  let outcome: DacpOutcome;

  if (consensus === "NO_RESPONSE") {
    authority = "UNAVAILABLE";
    outcome = "PROCEED_WITHOUT_CONSULTATION";
  } else if (consensus === "UNANIMOUS" && (avg_confidence ?? 0) >= AUTHORITY_STRONG_MIN_CONF) {
    authority = "STRONG";
    outcome = "SAFE_TO_PROCEED_WITH_STRONG_CONSULTATION";
  } else if (consensus === "SINGLE_RESPONDER" && (avg_confidence ?? 0) >= AUTHORITY_ADVISORY_MIN_CONF) {
    authority = "ADVISORY";
    outcome = "SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION";
  } else if (consensus === "MAJORITY" && (avg_confidence ?? 0) >= AUTHORITY_ADVISORY_MIN_CONF) {
    authority = "ADVISORY";
    outcome = "SAFE_TO_PROCEED_WITH_ADVISORY_CONSULTATION";
  } else {
    authority = "INCONCLUSIVE";
    outcome = "PRESERVE_INCONCLUSIVE_DO_NOT_DECIDE";
  }

  // ── Post-safety ──
  const fearAfter = assessFear({
    target: input.proposed_action.target,
    operation_kind: input.proposed_action.operation_kind,
    preservation_baseline_available: input.proposed_action.preservation_baseline_available,
    repo_root: input.repo_root,
  });
  const afraidAfter = assessAfraid({ recent_turns: input.recent_turn_history });
  if (fearAfter.block_action === true || afraidAfter.state === "AFRAID") {
    outcome = "HARD_GATE_BLOCKED_POST";
    authority = null as unknown as ConsultationAuthority; // safety override
  }

  recordHeartbeat({
    agent_id: "domain_aware_consultation",
    event_type: "consult",
    event_data: {
      task_id: input.task_id,
      on_domain_count: onDomainSpecialists.length,
      informative_count: informativeAnalyses.length,
      consensus,
      authority,
      outcome,
    },
  });

  return {
    task_id: input.task_id,
    outcome,
    consultation_authority: authority,
    pre_safety: preSafety,
    semantic_features: semanticResult.features,
    on_domain_specialists: onDomainSpecialists,
    on_domain_analyses: broadcast.analyses.map((a) => ({ specialist_id: a.specialist_id, kind: a.kind, confidence: a.confidence })),
    on_domain_consensus: consensus,
    on_domain_majority_kind: majority_kind,
    avg_confidence: avg_confidence === null ? null : Number(avg_confidence.toFixed(4)),
    r11b_marker: "DACP_INFERRED_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    evidence_kind: "INFERRED",
    policy_id: "NEX1_DACP_POLICY_V1",
  };
}

export const DACP_VERSION = "domain-aware-consultation.v1.2026-09-18";
