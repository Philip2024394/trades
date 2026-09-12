// src/lib/nex/master-ai/decision-intelligence.ts
//
// NEX Master AI · Decision Intelligence · Know When Not To Act (F-Wave §21)
// Philip 2026-09-07 · AUTHORIZE
//
// Autonomy does not mean always taking action. The system must
// distinguish these seven decisions:
//
//   ACT_NOW            — evidence supports immediate action within safety bounds
//   RESEARCH_FIRST     — insufficient evidence · need more research before action
//   ASK_FOUNDER        — outside Master AI's autonomous authority
//   WAIT_FOR_EVIDENCE  — evidence gathering already in progress · wait
//   BLOCKED            — external dependency or authorization missing
//   UNKNOWN            — decision structure itself insufficient
//   DO_NOT_ACT         — evidence supports explicitly NOT acting
//
// This is intelligence.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { decisionsPath } from "./paths";

export type DecisionOutcome =
  | "ACT_NOW"
  | "RESEARCH_FIRST"
  | "ASK_FOUNDER"
  | "WAIT_FOR_EVIDENCE"
  | "BLOCKED"
  | "UNKNOWN"
  | "DO_NOT_ACT";

export const DECISION_OUTCOMES: readonly DecisionOutcome[] = Object.freeze([
  "ACT_NOW", "RESEARCH_FIRST", "ASK_FOUNDER", "WAIT_FOR_EVIDENCE",
  "BLOCKED", "UNKNOWN", "DO_NOT_ACT",
] as const);

export const OUTCOME_MEANING: Readonly<Record<DecisionOutcome, string>> = Object.freeze({
  ACT_NOW: "Evidence supports action now within safety bounds",
  RESEARCH_FIRST: "Insufficient evidence; more research is required before action",
  ASK_FOUNDER: "Outside Master AI's autonomous authority; requires Founder decision",
  WAIT_FOR_EVIDENCE: "Evidence gathering already in progress; wait for it to complete",
  BLOCKED: "External dependency or authorization boundary blocks progress",
  UNKNOWN: "Decision structure itself is insufficient; cannot yet decide",
  DO_NOT_ACT: "Evidence supports explicitly NOT acting on this",
});

export type DecisionInputs = {
  situation: string;                               // what is being decided
  evidence_refs: readonly string[];                // ledger references supporting the decision
  hard_safety_boundaries_touched: readonly string[]; // if non-empty → cannot ACT_NOW
  authority_required: "MASTER_AI_AUTONOMOUS" | "FOUNDER_APPROVAL" | "EXTERNAL_APPROVAL";
  evidence_confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  in_flight_research_query_ids: readonly string[];
  external_dependencies_pending: readonly string[]; // e.g. quote from Fiberstar
  supports_action: "YES" | "NO" | "UNKNOWN";       // does the evidence support this action
};

export type DecisionRecord = {
  decision_id: string;
  recorded_at_iso: string;
  situation: string;
  outcome: DecisionOutcome;
  rationale: string;                                // required ≥ 20 chars
  inputs: DecisionInputs;
  next_step: string;                                // required ≥ 5 chars
};

export class InvalidDecisionError extends Error {
  constructor(reason: string) { super(`invalid_decision:${reason}`); }
}

/** Deterministic decision engine. Same inputs → same outcome. */
export function decide(input: DecisionInputs): { outcome: DecisionOutcome; rationale: string; next_step: string } {
  if (!input.situation || input.situation.trim().length < 5) {
    throw new InvalidDecisionError("situation_too_short");
  }
  // Priority-ordered decision cascade:
  // 1. External approval required → BLOCKED
  if (input.authority_required === "EXTERNAL_APPROVAL") {
    return { outcome: "BLOCKED", rationale: "External approval outside NEX is required · Master AI cannot proceed autonomously", next_step: "Route to Founder for external engagement plan" };
  }
  // 2. Founder approval required → ASK_FOUNDER
  if (input.authority_required === "FOUNDER_APPROVAL") {
    return { outcome: "ASK_FOUNDER", rationale: "Decision authority requires Founder approval · not in Master AI autonomous scope", next_step: "Compose approval request with evidence bundle" };
  }
  // 3. Hard safety boundary touched → DO_NOT_ACT
  if (input.hard_safety_boundaries_touched.length > 0) {
    return {
      outcome: "DO_NOT_ACT",
      rationale: `Action would cross hard safety boundaries: ${input.hard_safety_boundaries_touched.join(", ")}`,
      next_step: "Redesign approach to remain within safety envelope · or escalate to Founder",
    };
  }
  // 4. Evidence explicitly says NO → DO_NOT_ACT
  if (input.supports_action === "NO") {
    return { outcome: "DO_NOT_ACT", rationale: "Available evidence explicitly does not support this action", next_step: "Record decision and monitor for evidence change" };
  }
  // 5. Evidence pending → WAIT_FOR_EVIDENCE
  if (input.in_flight_research_query_ids.length > 0 && input.evidence_confidence === "LOW") {
    return {
      outcome: "WAIT_FOR_EVIDENCE",
      rationale: `${input.in_flight_research_query_ids.length} research query/queries in flight · confidence still LOW · wait for results before deciding`,
      next_step: "Re-evaluate after in-flight research completes",
    };
  }
  // 6. External dependency pending → BLOCKED
  if (input.external_dependencies_pending.length > 0) {
    return {
      outcome: "BLOCKED",
      rationale: `Blocked by external dependencies: ${input.external_dependencies_pending.join(", ")}`,
      next_step: "Surface blockers · determine whether they need Founder attention",
    };
  }
  // 7. No evidence at all → UNKNOWN
  if (input.evidence_confidence === "NONE" || input.evidence_refs.length === 0) {
    return { outcome: "UNKNOWN", rationale: "No supporting evidence in ledger · cannot form defensible decision", next_step: "Register a research query to gather evidence" };
  }
  // 8. Low confidence + supports_action UNKNOWN → RESEARCH_FIRST
  if (input.evidence_confidence === "LOW" || input.supports_action === "UNKNOWN") {
    return { outcome: "RESEARCH_FIRST", rationale: `Evidence confidence ${input.evidence_confidence} · supports_action=${input.supports_action} · need higher confidence before acting`, next_step: "Prioritise research to elevate confidence" };
  }
  // 9. MEDIUM+ confidence, supports_action YES, autonomous authority → ACT_NOW
  if (input.supports_action === "YES" && (input.evidence_confidence === "MEDIUM" || input.evidence_confidence === "HIGH")) {
    return {
      outcome: "ACT_NOW",
      rationale: `Evidence confidence ${input.evidence_confidence} · supports action · within Master AI autonomous authority · no blockers`,
      next_step: "Execute within bounded engineering envelope · report outcome",
    };
  }
  // Fallback (should not be reachable but honestly returns UNKNOWN)
  return { outcome: "UNKNOWN", rationale: "Decision cascade did not match any explicit outcome path", next_step: "Audit inputs and refine decision cascade" };
}

export function recordDecision(input: DecisionInputs): DecisionRecord {
  const d = decide(input);
  if (d.rationale.length < 20) throw new InvalidDecisionError("rationale_length");
  if (d.next_step.length < 5) throw new InvalidDecisionError("next_step_length");
  const rec: DecisionRecord = {
    decision_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    situation: input.situation,
    outcome: d.outcome,
    rationale: d.rationale,
    inputs: input,
    next_step: d.next_step,
  };
  appendJsonLine(decisionsPath(), rec);
  return rec;
}

export function readAllDecisions(): DecisionRecord[] {
  return readJsonlAll<DecisionRecord>(decisionsPath());
}

export function summariseDecisions(): Record<DecisionOutcome, number> {
  const out: Record<DecisionOutcome, number> = { ACT_NOW: 0, RESEARCH_FIRST: 0, ASK_FOUNDER: 0, WAIT_FOR_EVIDENCE: 0, BLOCKED: 0, UNKNOWN: 0, DO_NOT_ACT: 0 };
  for (const d of readAllDecisions()) out[d.outcome]++;
  return out;
}

export function _resetDecisionsForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(decisionsPath())) fs.unlinkSync(decisionsPath()); } catch { /* ignore */ }
}
