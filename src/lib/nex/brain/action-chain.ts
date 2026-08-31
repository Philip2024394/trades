// src/lib/nex/brain/action-chain.ts
//
// Stage 3.36 · Action + Verification v2 · executor (Philip 2026-08-31).
//
// The single choke point where an ActionAudit advances through its
// state machine. All side effects go through an ActionAdapter · the
// executor never touches the network itself. This lets tests inject
// fake adapters and assert every transition.
//
// CONSTITUTIONAL GUARANTEES (verified by tests):
//   G1: EXECUTING is unreachable without AUTHORIZED or NOT_REQUIRED
//   G2: EXECUTED never advances to VERIFIED without a DeliveryProof
//   G3: Adapter "accepted" outcome → UNKNOWN · never rounded up
//   G4: Adapter throw → FAILED with captured error · never partial
//   G5: Every transition is captured in transitions[]
//   G6: The audit is immutable · every step returns a new object

import {
  type ActionAdapter,
  type ActionAudit,
  type AdapterOutcome,
  type DeliveryProof,
  type VerificationCheckResult,
  createAudit,
  transition,
  type ChainActionKind,
  type ActionChainTarget,
  type AuthorizationState,
} from "./action-audit";

// ─── Correlation id ────────────────────────────────────────────────

let __corrCounter = 0;
function newCorrelationId(now: string): string {
  __corrCounter += 1;
  return `corr_${now.replace(/[^0-9]/g, "").slice(0, 14)}_${__corrCounter.toString(36)}`;
}

// ─── Executor input ────────────────────────────────────────────────

export type RunActionChainInput = {
  kind: ChainActionKind;
  requestedByMessage: string;
  target: ActionChainTarget;
  authorization: AuthorizationState;
  adapter: ActionAdapter;
  payload?: Record<string, unknown>;
  now?: () => string;                 // clock injection for tests
};

// ─── Verification derivation ───────────────────────────────────────

/**
 * Turns an AdapterOutcome + the current audit into the checks + evidence
 * required to decide VERIFIED vs UNKNOWN vs FAILED. This is the only
 * place that has permission to convert "delivered" into VERIFIED.
 */
function deriveVerification(
  audit: ActionAudit,
  outcome: AdapterOutcome,
): { checks: VerificationCheckResult[]; evidence: DeliveryProof[]; nextStage: "VERIFIED" | "UNKNOWN" | "FAILED"; reason: string } {
  const checks: VerificationCheckResult[] = [];
  const evidence: DeliveryProof[] = [];

  // Every path checks these two structural invariants first.
  checks.push({
    check: "capability_registered",
    passed: audit.intent.kind === "open_directory" || audit.intent.kind === "contact_via_whatsapp",
    reason: `action kind "${audit.intent.kind}" is registered v1`,
  });
  checks.push({
    check: "target_consistency",
    passed: !!audit.target.canonical,
    reason: audit.target.canonical
      ? `target has canonical name "${audit.target.canonical}"`
      : "target has no canonical name",
  });

  switch (outcome.kind) {
    case "delivered": {
      evidence.push(outcome.proof);
      checks.push({
        check: "delivery_evidence",
        passed: true,
        reason: `delivery proof: ${outcome.proof.kind} · ${outcome.proof.detail}`,
      });
      // For open_directory, we also require a link_round_trip check ·
      // enforced here so the executor doesn't have to know per-kind logic.
      if (audit.intent.kind === "open_directory") {
        const url = outcome.proof.detail;
        const refId = audit.target.refId;
        const raw = audit.target.canonical;
        const roundTrip = refId
          ? url.includes(encodeURIComponent(refId))
          : raw ? url.includes(encodeURIComponent(raw)) : false;
        checks.push({
          check: "link_round_trip",
          passed: roundTrip,
          reason: roundTrip
            ? `URL round-trips ${refId ? `refId "${refId}"` : `name "${raw}"`}`
            : `URL does NOT round-trip ${refId ? `refId "${refId}"` : `name "${raw}"`}`,
        });
        // If the round-trip failed, the delivery proof is not
        // sufficient · downgrade to UNKNOWN honestly.
        const allPassed = checks.every((c) => c.passed);
        if (!allPassed) {
          return {
            checks, evidence,
            nextStage: "UNKNOWN",
            reason: "adapter reported delivery but the link_round_trip check failed · cannot claim verified",
          };
        }
      }
      return {
        checks, evidence,
        nextStage: "VERIFIED",
        reason: `delivery evidence received: ${outcome.proof.kind}`,
      };
    }
    case "accepted": {
      // CONSTITUTIONAL: accepted → UNKNOWN. Never rounded up.
      checks.push({
        check: "delivery_evidence",
        passed: false,
        reason: `no delivery evidence · adapter reported "accepted" pending ${outcome.pending.awaitingKind} · ${outcome.pending.reason}`,
      });
      return {
        checks, evidence,
        nextStage: "UNKNOWN",
        reason: `adapter accepted but delivery not confirmable · ${outcome.pending.reason}`,
      };
    }
    case "rejected": {
      checks.push({
        check: "delivery_evidence",
        passed: false,
        reason: `adapter rejected: ${outcome.reason}`,
      });
      return {
        checks, evidence,
        nextStage: "FAILED",
        reason: `adapter rejected: ${outcome.reason}`,
      };
    }
    case "unreachable": {
      checks.push({
        check: "delivery_evidence",
        passed: false,
        reason: `adapter unreachable: ${outcome.reason}`,
      });
      return {
        checks, evidence,
        nextStage: "FAILED",
        reason: `adapter unreachable: ${outcome.reason}`,
      };
    }
  }
}

// ─── Public executor ───────────────────────────────────────────────

/**
 * Advance an ActionAudit through its full lifecycle using the given
 * adapter. Returns the terminal ActionAudit. Never throws for adapter
 * failures · those are captured as FAILED. Throws only on
 * programmer errors (unregistered kind · illegal transition · etc.)
 * so bugs surface loudly.
 */
export async function runActionChain(input: RunActionChainInput): Promise<ActionAudit> {
  const now = input.now ?? (() => new Date().toISOString());

  // Stage 0: PROPOSED
  let audit = createAudit({
    kind:               input.kind,
    requestedByMessage: input.requestedByMessage,
    target:             input.target,
    authorization:      input.authorization,
    at:                 now(),
  });

  // Stage 1: AUTHORIZED gate ────────────────────────────────────────
  const auth = audit.authorization;
  if (auth.state === "DENIED") {
    return transition(audit, "BLOCKED", `authorization denied by ${auth.source}: ${auth.reason}`, now(), {
      blockedReason: `authorization denied · ${auth.reason}`,
    });
  }
  if (auth.state === "REQUIRED") {
    return transition(audit, "BLOCKED", `authorization required · ${auth.reason}`, now(), {
      blockedReason: `awaiting user authorization · ${auth.reason}`,
    });
  }
  // GRANTED or NOT_REQUIRED both pass the gate.
  audit = transition(audit, "AUTHORIZED", `authorization ${auth.state.toLowerCase()}`, now());

  // Stage 2: EXECUTING · adapter must match kind ────────────────────
  if (input.adapter.kind !== input.kind) {
    // Programmer error · loud throw.
    throw new Error(
      `adapter kind mismatch · expected ${input.kind} · got ${input.adapter.kind}`,
    );
  }
  const correlationId = newCorrelationId(now());
  const startedAt = now();
  audit = transition(audit, "EXECUTING", "adapter invocation starting", startedAt, {
    execution: {
      state: "EXECUTING",
      adapter: `${input.adapter.kind}`,
      correlationId,
      startedAt,
    },
  });

  // Stage 3: adapter call · catch thrown errors and map to FAILED ───
  let outcome: AdapterOutcome;
  try {
    outcome = await input.adapter.execute({
      target: input.target,
      payload: input.payload,
      correlationId,
    });
  } catch (err) {
    const endedAt = now();
    const e = err instanceof Error ? err : new Error(String(err));
    return transition(audit, "FAILED", `adapter threw: ${e.message}`, endedAt, {
      execution: {
        ...audit.execution,
        state: "FAILED",
        endedAt,
        error: { name: e.name, message: e.message },
      },
    });
  }

  // Stage 4: EXECUTED (call returned · outcome recorded) ────────────
  const executedAt = now();
  audit = transition(audit, "EXECUTED", `adapter returned outcome=${outcome.kind}`, executedAt, {
    execution: {
      ...audit.execution,
      state: "EXECUTED",
      endedAt: executedAt,
      outcome,
    },
  });

  // Stage 5: derive verification stage from outcome ─────────────────
  const derived = deriveVerification(audit, outcome);
  const verifiedAt = now();
  const verificationState =
    derived.nextStage === "VERIFIED" ? "VERIFIED" :
    derived.nextStage === "UNKNOWN"  ? "UNKNOWN"  :
                                       "UNVERIFIABLE";
  return transition(audit, derived.nextStage, derived.reason, verifiedAt, {
    verification: {
      state:    verificationState,
      checks:   derived.checks,
      evidence: derived.evidence,
      at:       verifiedAt,
      reason:   derived.reason,
    },
  });
}
