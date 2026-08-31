// src/lib/nex/brain/action-audit.ts
//
// Stage 3.36 · Action + Verification v2 · immutable audit chain
// (Philip 2026-08-31).
//
// CONSTITUTIONAL:
//   1. NEX must NEVER tell the user an action succeeded unless the
//      system has evidence that it succeeded.
//   2. UNKNOWN is a first-class state · not silently rounded up to
//      success and not silently rounded down to failure.
//   3. Every state transition is captured with a timestamp + reason ·
//      the audit is replayable and inspectable.
//   4. EXECUTING is unreachable without an AUTHORIZED (or NOT_REQUIRED)
//      authorization. Enforced by the executor · not by convention.
//   5. VERIFIED is unreachable without an evidence record of delivery.
//      Adapter "accepted" outcomes map to UNKNOWN by design.
//
// This module defines ONLY the types and the immutable transition
// helpers. The executor + adapter contract live in action-chain.ts and
// adapters/*.ts.

// ─── Action identity ───────────────────────────────────────────────

export type ActionId = string; // "act_<ulid>"

/**
 * The kind of side-effect NEX is being asked to perform. The set is
 * intentionally small · every new kind ships its own adapter + evidence
 * model.
 */
export type ChainActionKind =
  | "open_directory"        // v1 · read-only-ish · verified via link round-trip
  | "contact_via_whatsapp"; // v2 stub · adapter returns "accepted" → UNKNOWN

// ─── Explicit state model ──────────────────────────────────────────

/**
 * Where the whole action currently sits. Ordered as the chain flows —
 * legal forward transitions are enforced by the executor.
 */
export type ChainStage =
  | "PROPOSED"
  | "AUTHORIZED"
  | "EXECUTING"
  | "EXECUTED"
  | "VERIFIED"
  | "UNKNOWN"
  | "FAILED"
  | "BLOCKED";

/** Terminal stages · no further transitions allowed. */
export const TERMINAL_STAGES: ReadonlySet<ChainStage> = new Set([
  "VERIFIED",
  "UNKNOWN",
  "FAILED",
  "BLOCKED",
]);

export function isTerminal(stage: ChainStage): boolean {
  return TERMINAL_STAGES.has(stage);
}

// ─── Authorization ─────────────────────────────────────────────────

export type AuthorizationState =
  | { state: "REQUIRED"; reason: string }
  | {
      state: "GRANTED";
      source: "user_reply" | "pre_authorized" | "policy_read_only";
      at: string;
      evidence: string;   // e.g. quoted user reply · or the policy name
    }
  | {
      state: "DENIED";
      source: "user_reply" | "policy";
      at: string;
      reason: string;
    }
  | {
      state: "NOT_REQUIRED";
      reason: string;   // e.g. "read-only action"
    };

// ─── Target ────────────────────────────────────────────────────────

export type ActionChainTarget = {
  canonical: string;
  refId?: string;
  contactChannel?: {
    kind: "whatsapp" | "phone" | "url";
    value: string;
    source: "world_record" | "session" | "message";
  };
  resolvedAt: string;
};

// ─── Adapter contract ──────────────────────────────────────────────

/**
 * The four outcomes an adapter can return · this is the single choke
 * point where UNKNOWN gets its life. A 2xx HTTP response WITHOUT a
 * delivery proof is "accepted" · which maps to UNKNOWN. Only a
 * "delivered" outcome (with proof) can advance to VERIFIED.
 */
export type AdapterOutcome =
  | {
      kind: "delivered";
      proof: DeliveryProof;
    }
  | {
      kind: "accepted";
      pending: PendingProof;
    }
  | {
      kind: "rejected";
      reason: string;
    }
  | {
      kind: "unreachable";
      reason: string;
    };

/** Independent evidence that the action actually landed. */
export type DeliveryProof = {
  kind: "link_round_trip" | "delivery_receipt" | "read_receipt" | "webhook";
  at: string;
  detail: string;             // e.g. "twilio message SM123 status=delivered"
  externalId?: string;        // provider-side id
};

/** Adapter accepted the call · but delivery not yet confirmable. */
export type PendingProof = {
  correlationId: string;
  reason: string;             // e.g. "twilio accepted · no delivery receipt wired"
  awaitingKind: "delivery_receipt" | "webhook" | "poll" | "not_wired";
};

/**
 * The adapter interface every mutation-capable action must implement.
 * Adapters are the ONLY place external side-effects happen.
 */
export interface ActionAdapter {
  kind: ChainActionKind;
  execute(input: {
    target: ActionChainTarget;
    payload?: Record<string, unknown>;
    correlationId: string;
  }): Promise<AdapterOutcome>;
}

// ─── Records captured at each stage ────────────────────────────────

export type ExecutionRecord = {
  state: "PENDING" | "EXECUTING" | "EXECUTED" | "FAILED" | "SKIPPED";
  adapter?: string;             // adapter identifier · e.g. "whatsapp:stub"
  correlationId?: string;
  startedAt?: string;
  endedAt?: string;
  outcome?: AdapterOutcome;
  error?: { name: string; message: string };
};

export type VerificationRecord = {
  state:
    | "NOT_REQUIRED"
    | "PENDING"
    | "VERIFIED"
    | "UNKNOWN"
    | "UNVERIFIABLE";        // e.g. adapter rejected · nothing to verify
  checks: readonly VerificationCheckResult[];
  evidence: readonly DeliveryProof[];
  at?: string;
  reason?: string;
};

export type VerificationCheckKind =
  | "kind_matches_proposal"
  | "target_consistency"
  | "capability_registered"
  | "delivery_evidence"
  | "link_round_trip";

export type VerificationCheckResult = {
  check: VerificationCheckKind;
  passed: boolean;
  reason: string;
};

// ─── Transition audit trail ────────────────────────────────────────

export type Transition = {
  from: ChainStage;
  to: ChainStage;
  at: string;
  reason: string;
};

// ─── The immutable audit object ────────────────────────────────────

export type ActionAudit = {
  readonly actionId: ActionId;
  readonly intent: {
    kind: ChainActionKind;
    requestedByMessage: string;
    createdAt: string;
  };
  readonly target: ActionChainTarget;
  readonly authorization: AuthorizationState;
  readonly execution: ExecutionRecord;
  readonly verification: VerificationRecord;
  readonly stage: ChainStage;
  readonly finalState: ChainStage | null;   // null while non-terminal
  readonly transitions: readonly Transition[];
  readonly blockedReason?: string;
};

// ─── Illegal-transition guard ──────────────────────────────────────

/**
 * Allowed forward transitions. Any transition not in this table is
 * illegal and the executor MUST throw · never silently patch.
 */
const LEGAL_TRANSITIONS: Readonly<Record<ChainStage, readonly ChainStage[]>> = {
  PROPOSED:   ["AUTHORIZED", "BLOCKED", "FAILED"],
  AUTHORIZED: ["EXECUTING",  "BLOCKED", "FAILED"],
  EXECUTING:  ["EXECUTED",   "FAILED",  "UNKNOWN"],
  EXECUTED:   ["VERIFIED",   "UNKNOWN", "FAILED"],
  VERIFIED:   [],
  UNKNOWN:    [],
  FAILED:     [],
  BLOCKED:    [],
};

export function isLegalTransition(from: ChainStage, to: ChainStage): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export class IllegalTransitionError extends Error {
  constructor(from: ChainStage, to: ChainStage, reason: string) {
    super(`Illegal action-chain transition ${from} → ${to} · ${reason}`);
    this.name = "IllegalTransitionError";
  }
}

/**
 * Pure · returns a NEW ActionAudit with the transition applied.
 * Throws IllegalTransitionError if the transition isn't in the legal
 * table. Callers should always use this rather than mutating fields.
 */
export function transition(
  audit: ActionAudit,
  to: ChainStage,
  reason: string,
  at: string,
  patch: Partial<Pick<ActionAudit, "authorization" | "execution" | "verification" | "blockedReason">> = {},
): ActionAudit {
  if (!isLegalTransition(audit.stage, to)) {
    throw new IllegalTransitionError(audit.stage, to, reason);
  }
  const transitions: readonly Transition[] = [
    ...audit.transitions,
    { from: audit.stage, to, at, reason },
  ];
  return {
    ...audit,
    ...patch,
    stage: to,
    finalState: isTerminal(to) ? to : null,
    transitions,
  };
}

// ─── Constructors ──────────────────────────────────────────────────

let __idCounter = 0;
function newActionId(now: string): ActionId {
  __idCounter += 1;
  // ULID would be nicer · we use a deterministic-ish id that's monotonic
  // per process. Good enough for audit correlation v1.
  return `act_${now.replace(/[^0-9]/g, "").slice(0, 14)}_${__idCounter.toString(36)}`;
}

export function createAudit(input: {
  kind: ChainActionKind;
  requestedByMessage: string;
  target: ActionChainTarget;
  authorization: AuthorizationState;
  at: string;
}): ActionAudit {
  const actionId = newActionId(input.at);
  return {
    actionId,
    intent: {
      kind: input.kind,
      requestedByMessage: input.requestedByMessage,
      createdAt: input.at,
    },
    target: input.target,
    authorization: input.authorization,
    execution: { state: "PENDING" },
    verification: { state: "NOT_REQUIRED", checks: [], evidence: [] },
    stage: "PROPOSED",
    finalState: null,
    transitions: [],
  };
}
