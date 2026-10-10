// WO-CAP-01 · three-outcome CAP resolver.
//
// Founder-locked 2026-09-13:
//   AUTO_FIX: within pre-authorised safe scope. Broker gates every action.
//   PROPOSE:  understood but out of pre-auth scope. Founder signature required.
//   ESCALATE: unsafe / ambiguous / protected / outside authority.

import { updateCapStatus, type CreateCapInput } from "./registry";
import type { CapResolverOutcome, CapabilityGap } from "./types";

/**
 * Founder-locked · pre-authorised AUTO_FIX scope.
 *
 * These are the ONLY CAP kinds where NEX1 Engineer is pre-authorised to
 * generate + apply a fix inside a bounded envelope. Every other kind must
 * either PROPOSE (founder-sign) or ESCALATE.
 *
 * Add new entries with EXTREME care · every entry is effectively founder-
 * pre-signed permission for NEX1 to act autonomously in that narrow lane.
 */
const AUTO_FIX_KINDS: ReadonlySet<string> = new Set([
  // Currently empty. Every AUTO_FIX entry must be added by explicit founder
  // decision · doctrine: "start with no autofix, prove PROPOSE first".
]);

/**
 * Kinds that must always ESCALATE (never PROPOSE, never AUTO_FIX).
 * These are areas where automated engineering is fundamentally unsafe.
 */
const ESCALATE_ONLY_KINDS: ReadonlySet<string> = new Set([
  "guardian.te.evidence_source_registry_untrusted",  // registry tamper → founder-only
  "guardian.te.evidence_source_test_masquerade",     // identity spoof attempt → founder-only
]);

export interface ResolveInput {
  readonly cap: CapabilityGap;
}

export interface ResolveResult {
  readonly outcome: CapResolverOutcome;
  readonly reason: string;
  readonly next_status: "PROPOSED" | "ESCALATED" | "IN_PROGRESS";
}

/**
 * Founder-locked deterministic resolver.
 * Pure function of the CAP · same input → same outcome. No LLM.
 * Never grants authority; produces a decision + reason + next status.
 */
export function resolveCapProposal(input: ResolveInput): ResolveResult {
  const c = input.cap;

  // ESCALATE-only kinds always escalate regardless of priority.
  if (ESCALATE_ONLY_KINDS.has(c.kind)) {
    return {
      outcome: "ESCALATE",
      reason: `kind "${c.kind}" is in the ESCALATE_ONLY set · founder decision required`,
      next_status: "ESCALATED",
    };
  }

  // CRITICAL priority always escalates — never auto-fix or propose critical.
  if (c.priority === "CRITICAL") {
    return {
      outcome: "ESCALATE",
      reason: `CRITICAL priority · founder decision required regardless of kind`,
      next_status: "ESCALATED",
    };
  }

  // AUTO_FIX only for pre-authorised safe kinds.
  if (AUTO_FIX_KINDS.has(c.kind)) {
    return {
      outcome: "AUTO_FIX",
      reason: `kind "${c.kind}" is in the pre-authorised AUTO_FIX set · Broker will gate execution`,
      next_status: "IN_PROGRESS",
    };
  }

  // Default: PROPOSE (unsigned WO envelope · founder must sign)
  return {
    outcome: "PROPOSE",
    reason: `kind "${c.kind}" not in AUTO_FIX set · proposing unsigned WO for founder review`,
    next_status: "PROPOSED",
  };
}

/**
 * Apply the resolver decision back to the CAP record (status transition).
 * Founder-locked: this ONLY updates the CAP status field · it does NOT
 * execute the fix. The Authority Broker gates all execution.
 */
export async function applyResolverDecision(cap: CapabilityGap): Promise<{ cap: CapabilityGap | null; decision: ResolveResult }> {
  const decision = resolveCapProposal({ cap });
  const updated = await updateCapStatus({
    cap_id: cap.cap_id,
    status: decision.next_status,
    resolver_outcome: decision.outcome,
    resolution_note: decision.reason,
  });
  return { cap: updated, decision };
}

// ── Read helpers for external callers ─────────────────────────────────

export function isAutoFixKind(kind: string): boolean { return AUTO_FIX_KINDS.has(kind); }
export function isEscalateOnlyKind(kind: string): boolean { return ESCALATE_ONLY_KINDS.has(kind); }
export function listAutoFixKinds(): readonly string[] { return Object.freeze([...AUTO_FIX_KINDS]); }
export function listEscalateOnlyKinds(): readonly string[] { return Object.freeze([...ESCALATE_ONLY_KINDS]); }
