// src/lib/nex1-orchestrator/state-machine.ts
// NEX1 Orchestrator · deterministic state machine.
// Forward-only transitions. Explicit BLOCKED/REJECTED/HOLD escape hatches.

import type { StageId } from "./types";

const T: Readonly<Record<StageId, readonly StageId[]>> = {
  REQUEST_RECEIVED:    ["UNDERSTANDING","BLOCKED","REJECTED","HOLD"],
  UNDERSTANDING:       ["REQUIREMENTS","BLOCKED","REJECTED","HOLD"],
  REQUIREMENTS:        ["WORK_ORDER","BLOCKED","REJECTED","HOLD"],
  WORK_ORDER:          ["ARCHITECTURE","BLOCKED","REJECTED","HOLD"],
  ARCHITECTURE:        ["DESIGN","BLOCKED","REJECTED","HOLD"],
  DESIGN:              ["BUILD_PLAN","BLOCKED","REJECTED","HOLD"],
  BUILD_PLAN:          ["SPECIALIST_EVIDENCE","BLOCKED","REJECTED","HOLD"],
  SPECIALIST_EVIDENCE: ["EVIDENCE_VALIDATION","BLOCKED","REJECTED","HOLD"],
  EVIDENCE_VALIDATION: ["NEX2_REVIEW","BLOCKED","REJECTED","HOLD"],
  NEX2_REVIEW:         ["NEX3_ARBITRATION","BLOCKED","REJECTED","HOLD"],
  NEX3_ARBITRATION:    ["FOUNDER_DECISION","BLOCKED","REJECTED","HOLD"],
  FOUNDER_DECISION:    ["EXECUTION","REJECTED","HOLD","BLOCKED"],
  EXECUTION:           ["VERIFICATION","BLOCKED","REJECTED","HOLD"],
  VERIFICATION:        ["RELEASE","BLOCKED","REJECTED","HOLD"],
  RELEASE:             ["ORCHESTRATION_COMPLETED","DELIVERABLE_COMPLETED","BLOCKED","REJECTED","HOLD"],
  // ORCHESTRATION_COMPLETED (P-E) · state machine reached its currently-implemented end · does NOT mean deliverable exists · reachable when EXECUTION/VERIFICATION/RELEASE were NOT_IMPLEMENTED
  ORCHESTRATION_COMPLETED: [],
  // DELIVERABLE_COMPLETED (P-E) · real code created · real tests ran · real release evidence gathered · reachable only when every downstream stage was truly COMPLETE (not NOT_IMPLEMENTED)
  DELIVERABLE_COMPLETED:   [],
  BLOCKED:             [],
  REJECTED:            [],
  HOLD:                [],
};

export function canTransition(from: StageId, to: StageId): boolean {
  const allowed = T[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function allowedNext(from: StageId): readonly StageId[] {
  return T[from] ?? [];
}

export const ALL_STAGES: readonly StageId[] = Object.keys(T) as StageId[];
export const TERMINAL_STAGES: readonly StageId[] = ["ORCHESTRATION_COMPLETED","DELIVERABLE_COMPLETED","BLOCKED","REJECTED","HOLD"];
export function isTerminal(s: StageId): boolean { return TERMINAL_STAGES.includes(s); }
