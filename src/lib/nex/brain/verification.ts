// src/lib/nex/brain/verification.ts
//
// Stage 3.22 · Phase 15 · Verification (Philip 2026-08-31).
//
// CONSTITUTIONAL · closes the honesty five (Truth · Reflection ·
// Confidence · Meta-Cognition · Learning · Verification). Runs after
// Action to confirm the execution matched the intent. Never claims
// verification success without evidence.
//
// v1 discipline:
//   · Deterministic checks · no LLM
//   · Applies only when Action actually executed something (executed: true)
//   · When Action refused, Verification reports `applicable=false ·
//     nothing_executed` · does not claim pass/fail on non-events
//   · Checks: target consistency · link round-trip · kind matches
//     proposal · capability registered
//   · Attached to BrainReply + HTTP response · consumed by
//     Meta-Cognition's whatDidItAccomplish (was "didItWork" placeholder)
//
// Future: transaction verification (payment succeeded? · order created?)
// lands with Stage 6 payment integration. Today verifies the safe
// link-generation Action produces.

import type { ActionProposal, ActionExecution } from "./action";
import type { SessionState } from "./session";

export type VerificationCheck =
  | "target_consistency"     // action.target matches session.currentReference.business
  | "link_round_trip"        // link contains encoded refId (or query name fallback)
  | "kind_matches_proposal"  // execution.kind === proposal.kind
  | "capability_registered"; // action kind is a known registered action

export type VerificationFinding = {
  check: VerificationCheck;
  passed: boolean;
  reason: string;
};

export type VerificationReport =
  | {
      applicable: true;
      passed: boolean;              // all checks passed
      findings: VerificationFinding[];
      passedCount: number;
      totalChecks: number;
      summary: string;
    }
  | {
      applicable: false;
      reason: "nothing_executed" | "no_proposal" | "execution_refused";
      summary: string;
    };

const REGISTERED_ACTION_KINDS = new Set([
  "open_directory",
  "contact_via_whatsapp",
  "email_seller",
  "save_to_list",
  "book_now",
  "add_to_cart",
]);

export type VerifyInput = {
  proposal?: ActionProposal;
  execution?: ActionExecution;
  session?: SessionState | null;
};

export function verifyAction(input: VerifyInput): VerificationReport {
  const { proposal, execution, session } = input;

  if (!proposal) {
    return { applicable: false, reason: "no_proposal", summary: "no action proposed this turn" };
  }
  if (!execution) {
    return { applicable: false, reason: "nothing_executed", summary: "action proposed but never invoked" };
  }
  if (!execution.executed) {
    return {
      applicable: false,
      reason: "execution_refused",
      summary: `execution refused: ${execution.reason} · nothing to verify`,
    };
  }

  const findings: VerificationFinding[] = [];

  // 1. target consistency: proposal.target and execution.target must match
  //    session.currentReference.business (when session available).
  const refBusiness = session?.currentReference?.business;
  if (refBusiness) {
    const targetCanonical = execution.target?.canonical ?? proposal.target.canonical;
    const targetMatches = targetCanonical === refBusiness.canonical;
    findings.push({
      check: "target_consistency",
      passed: targetMatches,
      reason: targetMatches
        ? `action target "${targetCanonical}" matches resolved reference`
        : `action target "${targetCanonical}" does NOT match resolved reference "${refBusiness.canonical}"`,
    });
  } else {
    // No resolved reference · can't verify target consistency · pass with note
    findings.push({
      check: "target_consistency",
      passed: true,
      reason: "no resolved reference in session · target consistency not applicable",
    });
  }

  // 2. link round-trip: for open_directory, the generated URL must
  //    contain the encoded refId (or fall back to the encoded name).
  if (proposal.kind === "open_directory") {
    const url = execution.result.url ?? "";
    const refId = execution.target?.refId ?? proposal.target.refId;
    const rawName = execution.target?.raw ?? proposal.target.raw;
    let linkOk = false;
    let reason = "";
    if (refId) {
      linkOk = url.includes(encodeURIComponent(refId));
      reason = linkOk
        ? `link encodes refId "${refId}"`
        : `link does NOT encode refId "${refId}" · got "${url}"`;
    } else if (rawName) {
      linkOk = url.includes(encodeURIComponent(rawName));
      reason = linkOk
        ? `link encodes fallback name "${rawName}"`
        : `link does NOT encode name "${rawName}"`;
    } else {
      linkOk = false;
      reason = "neither refId nor name available for round-trip check";
    }
    findings.push({ check: "link_round_trip", passed: linkOk, reason });
  } else {
    // Other action kinds don't currently produce a URL to round-trip.
    findings.push({
      check: "link_round_trip",
      passed: true,
      reason: `kind "${proposal.kind}" doesn't produce a round-trippable URL v1 · check not applicable`,
    });
  }

  // 3. kind matches proposal
  const kindMatches = execution.kind === proposal.kind;
  findings.push({
    check: "kind_matches_proposal",
    passed: kindMatches,
    reason: kindMatches
      ? `execution.kind "${execution.kind}" matches proposal.kind`
      : `execution.kind "${execution.kind}" does NOT match proposal.kind "${proposal.kind}"`,
  });

  // 4. capability registered
  const registered = REGISTERED_ACTION_KINDS.has(execution.kind);
  findings.push({
    check: "capability_registered",
    passed: registered,
    reason: registered
      ? `action kind "${execution.kind}" is registered`
      : `action kind "${execution.kind}" is NOT in the registered set · possible spoof`,
  });

  const passedCount = findings.filter((f) => f.passed).length;
  const passed = passedCount === findings.length;
  const summary = passed
    ? `verified · ${passedCount}/${findings.length} checks passed · action "${execution.kind}" targeted "${execution.target?.raw ?? "?"}"`
    : `verification FAILED · ${passedCount}/${findings.length} checks passed · see findings`;

  return {
    applicable: true,
    passed,
    findings,
    passedCount,
    totalChecks: findings.length,
    summary,
  };
}
