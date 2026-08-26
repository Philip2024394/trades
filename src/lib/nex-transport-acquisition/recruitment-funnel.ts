// src/lib/nex-transport-acquisition/recruitment-funnel.ts
//
// RECRUITMENT FUNNEL · pure state machine.
//
// Legal transitions:
//
//   discovered → public_contact_verified → invitable → invited → interested
//     → registration_started → registered → kyc_pending → vehicle_pending
//     → insurance_pending → legal_review → verified → active
//
// Terminal exits (reachable from most stages):
//
//   any pre-active → declined | unreachable | opted_out
//
// Bright-line rules:
//   1. Cannot skip forward stages · discovered cannot leap to verified
//   2. Cannot re-enter a terminal exit
//   3. Cannot go backwards without a documented reason
//   4. verified → active requires an approved legal model AND is the ONLY
//      transition that unlocks a driver for dispatch consideration
//   5. Every transition returns the note that must be recorded on it

import type { TransportRecruitmentStage } from "./types";

const FORWARD: TransportRecruitmentStage[] = [
  "discovered",
  "public_contact_verified",
  "invitable",
  "invited",
  "interested",
  "registration_started",
  "registered",
  "kyc_pending",
  "vehicle_pending",
  "insurance_pending",
  "legal_review",
  "verified",
  "active",
];

const TERMINALS: TransportRecruitmentStage[] = ["declined", "unreachable", "opted_out"];

export class RecruitmentTransitionError extends Error {
  code:
    | "ILLEGAL_TRANSITION"
    | "TERMINAL_STATE"
    | "REASON_REQUIRED"
    | "MISSING_LEGAL_APPROVAL";
  constructor(code: RecruitmentTransitionError["code"], detail: string) {
    super(detail);
    this.name = "RecruitmentTransitionError";
    this.code = code;
  }
}

export interface TransitionInput {
  current: TransportRecruitmentStage;
  next: TransportRecruitmentStage;
  reason?: string;
  legalModelApproved?: boolean;
}

export interface TransitionOK {
  status: "OK";
  from: TransportRecruitmentStage;
  to: TransportRecruitmentStage;
  reason: string | null;
}

export function transitionRecruitmentStage(input: TransitionInput): TransitionOK {
  const { current, next, reason, legalModelApproved } = input;

  if (TERMINALS.includes(current)) {
    throw new RecruitmentTransitionError(
      "TERMINAL_STATE",
      `Cannot leave terminal state ${current}.`,
    );
  }

  // Terminal exits from any non-terminal state require a reason
  if (TERMINALS.includes(next)) {
    if (!reason || reason.trim().length === 0) {
      throw new RecruitmentTransitionError(
        "REASON_REQUIRED",
        `Terminal exit to ${next} requires a non-empty reason.`,
      );
    }
    return { status: "OK", from: current, to: next, reason };
  }

  // Forward transitions only (single-step or same-stage-hold not permitted)
  const idxCurrent = FORWARD.indexOf(current);
  const idxNext = FORWARD.indexOf(next);
  if (idxCurrent === -1 || idxNext === -1) {
    throw new RecruitmentTransitionError(
      "ILLEGAL_TRANSITION",
      `Unknown stage in transition ${current} → ${next}.`,
    );
  }
  if (idxNext !== idxCurrent + 1) {
    throw new RecruitmentTransitionError(
      "ILLEGAL_TRANSITION",
      `Non-adjacent forward transition ${current} → ${next} is not permitted. Advance one stage at a time.`,
    );
  }

  // The final unlock (verified → active) requires the legal model approval flag
  if (current === "verified" && next === "active") {
    if (!legalModelApproved) {
      throw new RecruitmentTransitionError(
        "MISSING_LEGAL_APPROVAL",
        "Cannot transition verified → active without legalModelApproved=true. See nex.transport_legal_model.",
      );
    }
  }

  return { status: "OK", from: current, to: next, reason: reason ?? null };
}

/**
 * True if the driver is currently in a stage that permits dispatch consideration.
 * This is a NECESSARY but NOT SUFFICIENT check — dispatch layer applies its own
 * legal-gate, wallet-gate, consent-gate, freshness-gate, etc.
 */
export function isStageDispatchable(stage: TransportRecruitmentStage): boolean {
  return stage === "active";
}

/**
 * True if the stage is a terminal exit (cannot progress further).
 */
export function isTerminalStage(stage: TransportRecruitmentStage): boolean {
  return TERMINALS.includes(stage);
}
