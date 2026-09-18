// src/lib/nex-agent/code-engine/capability-investigation-to-agent.ts
//
// NEX1 · Batch 2C · Investigation → correct downstream agent selection.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Given an investigation packet (produced by runNativeInvestigation), plus
//   optional signals about adjacent tests and Q8 output, deterministically
//   choose which of the 15 NEX Coding Team agents should act next. Return
//   the AgentId + a machine-readable reason. NO agent execution here — that
//   is a separate connection (Batch 2C-2 · dispatcher execution).
//
//   This module answers: given what investigation found, WHO should act?
//   Rules are declarative and testable. Zero LLM. Zero external call.
//
// CONSTITUTIONAL PRESERVATION
//   - REMEMBER ≠ SELECT ≠ MODIFY ≠ EXECUTE: this only SELECTS. It does not
//     dispatch, modify, execute, or authorise.
//   - Existing coding-team dispatcher UNCHANGED.
//   - Existing investigation packet UNCHANGED.
//   - Fix 23a/b/c UNCHANGED.
//   - Q7/Q8 UNCHANGED.

import type { AgentId } from "../../nex-coding-team/types";
import type { InvestigationEvidencePacket } from "./native-investigation-mode";

// ── Public shape ─────────────────────────────────────────────────────────

export type AgentSelectionRuleId =
  | "R1_fix_bridge_available"
  | "R2_investigation_more_needed"
  | "R3_insufficient_evidence"
  | "R4_conflict_detected"
  | "R5_test_gap"
  | "R6_default_pm";

export interface AgentSelection {
  readonly ok: true;
  readonly evidence_kind: "INFERRED";
  readonly selected_agent: AgentId;
  readonly rule_id: AgentSelectionRuleId;
  readonly reason: string;
  readonly next_action_hint: string;
  /** Alternative agents that could also have been selected under weaker
   *  rules; useful for auditing. Empty when the rule was unambiguous. */
  readonly alternatives: readonly AgentId[];
  /** Provenance of the input packet · policy version tag. */
  readonly policy_id: "BATCH_2C_AGENT_SELECTION_V1";
}

export type AgentSelectionRefusalKind =
  | "empty_packet"
  | "no_actionable_signals";

export interface AgentSelectionRefusal {
  readonly ok: false;
  readonly refusal_kind: AgentSelectionRefusalKind;
  readonly detail: string;
}

export type AgentSelectionResult = AgentSelection | AgentSelectionRefusal;

// ── Input shape (loose · we consume the parts we actually need) ─────────

export interface AgentSelectionInput {
  /** Investigation packet from runNativeInvestigation. */
  readonly packet: Pick<
    InvestigationEvidencePacket,
    | "verdict"
    | "candidate_files"
    | "evidence_for"
    | "evidence_against"
    | "confidence"
    | "confidence_numeric"
    | "unknown_facts"
    | "capability_gaps"
    | "hypotheses"
  > | null;
  /** True when Fix 24 Class 2 Bridge would fire for the target · signals
   *  that a coding repair path is available. Deterministic upstream check. */
  readonly class2_bridge_available?: boolean;
  /** True when Q8 emitted a SELECTED state (root cause chosen). */
  readonly q8_selected?: boolean;
  /** True when the target has any sibling test at all (not just a failing
   *  supported one — used for the "no tests exist" pathway to select the
   *  tester agent). */
  readonly target_has_any_sibling_test?: boolean;
}

// ── Deterministic rules ─────────────────────────────────────────────────

/** Select the correct downstream agent based on investigation output.
 *
 *  Rules (evaluated in order · first match wins):
 *
 *    R1 · If Class 2 Bridge is available AND Q8 emitted SELECTED
 *         → agent="debugger" (repair path is fully specified)
 *
 *    R2 · If investigation verdict === REQUIRE_MORE_INVESTIGATION
 *         → agent="forensics" (deeper structural investigation)
 *
 *    R3 · If verdict is empty OR confidence LOW AND candidate_files == 0
 *         → agent="forensics" (nothing to work with · investigate further)
 *
 *    R4 · If evidence_for AND evidence_against both non-empty (conflict)
 *         → agent="reviewer" (independent verdict on conflicting evidence)
 *
 *    R5 · If target_has_any_sibling_test === false AND candidate_files ≥ 1
 *         → agent="tester" (write tests to characterise expected behaviour)
 *
 *    R6 · default fallback
 *         → agent="pm" (assess and produce a ticket for humans)
 *
 *  All rules deterministic · no LLM · byte-identical repeat behaviour.
 */
export function selectAgentForInvestigation(
  input: AgentSelectionInput,
): AgentSelectionResult {
  if (!input.packet) {
    return {
      ok: false,
      refusal_kind: "empty_packet",
      detail: "no investigation packet supplied",
    };
  }
  const p = input.packet;

  // R1 · fix-bridge available AND Q8 selected → debugger
  if (input.class2_bridge_available === true && input.q8_selected === true) {
    return {
      ok: true,
      evidence_kind: "INFERRED",
      selected_agent: "debugger",
      rule_id: "R1_fix_bridge_available",
      reason:
        "Investigation completed with SELECTED root cause (Q8) AND Class 2 Bridge has synthesised a coding specification from an adjacent failing test. Repair path is fully specified; the debugger agent should apply the fix.",
      next_action_hint:
        "Turn 2 authorisation → runSpecificationDrivenCodingLoop (already wired via Fix 25). Debugger's downstream role is to record repair rationale in build_notes.",
      alternatives: ["builder"],
      policy_id: "BATCH_2C_AGENT_SELECTION_V1",
    };
  }

  // R2 · verdict says more investigation is needed
  if (p.verdict === "REQUIRE_MORE_INVESTIGATION") {
    return {
      ok: true,
      evidence_kind: "INFERRED",
      selected_agent: "forensics",
      rule_id: "R2_investigation_more_needed",
      reason:
        "Investigation verdict = REQUIRE_MORE_INVESTIGATION. Forensics agent should perform deeper structural analysis before any repair is attempted.",
      next_action_hint:
        "Forensics agent produces a forensic report and identifies the specific structural evidence needed to escalate the verdict.",
      alternatives: ["architect", "reviewer"],
      policy_id: "BATCH_2C_AGENT_SELECTION_V1",
    };
  }

  // R3 · insufficient evidence
  if (
    (p.verdict === "INSUFFICIENT_EVIDENCE" || p.verdict === null) &&
    p.candidate_files.length === 0
  ) {
    return {
      ok: true,
      evidence_kind: "INFERRED",
      selected_agent: "forensics",
      rule_id: "R3_insufficient_evidence",
      reason:
        "Investigation returned zero candidate files and insufficient/absent verdict. Forensics agent should investigate the wider structural landscape.",
      next_action_hint:
        "Forensics agent enumerates the surface, identifies missing evidence, and reports what is required to progress.",
      alternatives: ["pm", "architect"],
      policy_id: "BATCH_2C_AGENT_SELECTION_V1",
    };
  }

  // R4 · conflicting evidence
  if (p.evidence_for.length > 0 && p.evidence_against.length > 0) {
    return {
      ok: true,
      evidence_kind: "INFERRED",
      selected_agent: "reviewer",
      rule_id: "R4_conflict_detected",
      reason:
        `Investigation shows conflicting evidence (${p.evidence_for.length} supporting · ${p.evidence_against.length} contradicting). Reviewer agent should independently arbitrate.`,
      next_action_hint:
        "Reviewer agent inspects both evidence sets and emits a verdict on which line of reasoning is stronger.",
      alternatives: ["forensics", "architect"],
      policy_id: "BATCH_2C_AGENT_SELECTION_V1",
    };
  }

  // R5 · candidate files exist but no sibling tests
  if (
    input.target_has_any_sibling_test === false &&
    p.candidate_files.length >= 1
  ) {
    return {
      ok: true,
      evidence_kind: "INFERRED",
      selected_agent: "tester",
      rule_id: "R5_test_gap",
      reason:
        "Investigation identified candidate file(s) but no sibling test exists. Tester agent should author failing tests that characterise the expected behaviour before any repair is attempted.",
      next_action_hint:
        "Tester agent writes a targeted vitest file next to the target; on next turn the Class 2 Bridge will re-evaluate with the new test.",
      alternatives: ["pm", "architect"],
      policy_id: "BATCH_2C_AGENT_SELECTION_V1",
    };
  }

  // R6 · default fallback
  return {
    ok: true,
    evidence_kind: "INFERRED",
    selected_agent: "pm",
    rule_id: "R6_default_pm",
    reason:
      "No specific downstream trigger matched. PM agent assesses investigation output and produces a human-readable ticket.",
    next_action_hint:
      "PM writes a ticket_md summarising what investigation found and what human decision is required next.",
    alternatives: ["reviewer"],
    policy_id: "BATCH_2C_AGENT_SELECTION_V1",
  };
}

export const AGENT_SELECTION_VERSION = "batch2c.v1";
