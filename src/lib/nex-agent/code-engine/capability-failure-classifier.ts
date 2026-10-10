// src/lib/nex-agent/code-engine/capability-failure-classifier.ts
//
// NEX1 · Phase 6 · Failure Classification (9-way taxonomy)
// Ledger B additive · Zero LLM · Deterministic · Fresh-subprocess reproducible.
//
// PURPOSE
//   When a coding attempt does not reach TARGET_BEHAVIOUR_VERIFIED, classify
//   WHY into one of 9 disjoint failure classes so downstream repair strategies
//   can select repair heuristics without pattern-matching on symptoms.
//
// FOUNDER PRINCIPLE (verbatim)
//   "Give NEX the right evidence, not the conclusion."
//   "Do not let NEX learn what kind of answer is desirable. Let it learn
//    what happened when particular evidence was previously observed."
//
// INVARIANTS
//   · Every classification carries the evidence signals that fired it.
//   · UNKNOWN is emitted rather than guessed when signals are ambiguous.
//   · Ordering of predicates is deterministic (no ties broken by hash-order).
//   · No task-specific / fixture-specific mapping.
//   · Zero-LLM · byte-identical fresh-subprocess reproducibility.
//
// AUTHORITY BOUNDARY
//   · ANALYSE authority only · never REPAIR / MODIFY / DECIDE.
//   · Output is advisory · caller MUST decide.

import { createHash } from "node:crypto";
import type { IndependentVerdict, VerificationReceipt } from "./capability-independent-verifier";

export const FAILURE_CLASSIFIER_VERSION = "failure-classifier.v1.2026-09-19";

export type FailureClass =
  | "SYNTAX"                    // parse / compile error
  | "TYPE"                      // TS/type-system error preventing execution
  | "TARGET_ASSERTION"          // F2P test ran and failed on the target assertion
  | "P2P_REGRESSION"            // previously-passing test now fails
  | "TIMEOUT"                   // process exceeded budget
  | "RUNTIME_CRASH"             // uncaught exception / exit code > 1
  | "NO_TRANSITION_OBSERVED"    // no F2P went FAIL→PASS (may be NO-CHANGE collapse)
  | "SPECIFICATION_UNRESOLVED"  // verifier could not resolve what the spec requires
  | "UNKNOWN";                  // insufficient evidence to classify

export interface FailureClassifierInput {
  readonly verifier_receipt: VerificationReceipt;
  readonly coder_emissions?: {
    readonly stdout?: string;
    readonly stderr?: string;
    readonly exit_code?: number;
    readonly timed_out?: boolean;
    readonly compile_errors?: readonly {
      readonly kind: "syntax" | "type" | "unknown";
      readonly file?: string;
      readonly line?: number;
      readonly message: string;
    }[];
    readonly assertion_errors?: readonly {
      readonly test_id: string;
      readonly message: string;
    }[];
  };
  readonly correlation_id?: string;
}

export interface FailureClassification {
  readonly failure_class: FailureClass;
  readonly evidence_signals: readonly string[];
  readonly rationale: string;
  readonly caller_must_decide: true;
  readonly verifier_verdict: IndependentVerdict;
  readonly ambiguity_flags: readonly string[];
  readonly input_digest: string;
  readonly classified_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Predicate helpers (deterministic + isolated) ─────────────────────────

function hasCompileError(input: FailureClassifierInput, kind: "syntax" | "type"): boolean {
  const errs = input.coder_emissions?.compile_errors;
  if (!errs || errs.length === 0) return false;
  return errs.some((e) => e.kind === kind);
}

function hasAssertionError(input: FailureClassifierInput): boolean {
  return (input.coder_emissions?.assertion_errors?.length ?? 0) > 0;
}

function crashed(input: FailureClassifierInput): boolean {
  return (input.coder_emissions?.exit_code ?? 0) > 1;
}

function timedOut(input: FailureClassifierInput): boolean {
  return input.coder_emissions?.timed_out === true;
}

function verifierFlaggedP2PRegression(input: FailureClassifierInput): boolean {
  return (input.verifier_receipt.sub_verdicts.v1_f2p_p2p.p2p_regressed_ids?.length ?? 0) > 0;
}

function verifierFlaggedNoTransition(input: FailureClassifierInput): boolean {
  const sub = input.verifier_receipt.sub_verdicts.v1_f2p_p2p;
  return sub.f2p_count > 0 && !sub.f2p_all_transitioned;
}

// ── Ordered classifier ───────────────────────────────────────────────────
//
// Ordering rationale (deterministic, honest):
//   1. If code didn't compile at all, SYNTAX/TYPE outranks everything —
//      no execution evidence is meaningful.
//   2. Explicit crash > timeout > P2P regression > assertion failure.
//      (A crash prevents test evidence · we classify at the earliest layer.)
//   3. NO_TRANSITION_OBSERVED fires only when F2P was designed and none
//      moved · this is the founder-diagnosed collapse signature.
//   4. SPECIFICATION_UNRESOLVED comes from the verifier layer directly.
//   5. UNKNOWN is the honest fallback.

export function classifyFailure(input: FailureClassifierInput): FailureClassification {
  const signals: string[] = [];
  const ambiguity_flags: string[] = [];

  if (hasCompileError(input, "syntax")) signals.push("compile_error:syntax");
  if (hasCompileError(input, "type")) signals.push("compile_error:type");
  if (hasAssertionError(input)) signals.push("assertion_error_present");
  if (crashed(input)) signals.push(`crashed:exit_code=${input.coder_emissions!.exit_code}`);
  if (timedOut(input)) signals.push("timeout_flagged");
  if (verifierFlaggedP2PRegression(input)) signals.push("verifier:p2p_regression");
  if (verifierFlaggedNoTransition(input)) signals.push("verifier:no_f2p_transition");
  if (input.verifier_receipt.verdict === "SPECIFICATION_UNRESOLVED") {
    signals.push("verifier:specification_unresolved");
  }
  if (input.verifier_receipt.verdict === "VERIFICATION_INSUFFICIENT") {
    signals.push("verifier:insufficient");
  }

  // Ordered predicate fires
  let failure_class: FailureClass = "UNKNOWN";
  let rationale = "no classifying signal fired · caller should treat as UNKNOWN";

  if (hasCompileError(input, "syntax")) {
    failure_class = "SYNTAX";
    rationale = "compile error(s) of kind=syntax present · code did not build";
  } else if (hasCompileError(input, "type")) {
    failure_class = "TYPE";
    rationale = "type error(s) present · code did not typecheck";
  } else if (timedOut(input)) {
    failure_class = "TIMEOUT";
    rationale = "coder emissions report timed_out=true";
  } else if (crashed(input)) {
    failure_class = "RUNTIME_CRASH";
    rationale = `exit_code=${input.coder_emissions!.exit_code} > 1 indicates uncaught exception`;
  } else if (verifierFlaggedP2PRegression(input)) {
    failure_class = "P2P_REGRESSION";
    rationale = `previously-passing test(s) now fail: ${
      input.verifier_receipt.sub_verdicts.v1_f2p_p2p.p2p_regressed_ids.join(", ")
    }`;
  } else if (hasAssertionError(input) && verifierFlaggedNoTransition(input)) {
    // Assertion error AND no F2P transitioned · target assertion failed
    failure_class = "TARGET_ASSERTION";
    rationale = "F2P test ran to assertion failure · target behaviour not achieved";
  } else if (verifierFlaggedNoTransition(input)) {
    failure_class = "NO_TRANSITION_OBSERVED";
    rationale = "F2P test defined but no observed FAIL→PASS transition · potential NO-CHANGE collapse";
    ambiguity_flags.push("could_be_no_change_collapse_or_incomplete_fix");
  } else if (input.verifier_receipt.verdict === "SPECIFICATION_UNRESOLVED") {
    failure_class = "SPECIFICATION_UNRESOLVED";
    rationale = "verifier reports spec appears under-specified · cannot determine target behaviour";
  } else if (hasAssertionError(input)) {
    // Assertion error without F2P context · still classify as TARGET_ASSERTION
    failure_class = "TARGET_ASSERTION";
    rationale = "assertion error(s) present · target behaviour not achieved";
    ambiguity_flags.push("no_f2p_receipt_context");
  } else {
    ambiguity_flags.push("no_classifying_signal_available");
  }

  // Emit ambiguity flags when strong signals conflict
  if (verifierFlaggedP2PRegression(input) && verifierFlaggedNoTransition(input) && failure_class !== "P2P_REGRESSION") {
    ambiguity_flags.push("both_p2p_regression_and_no_transition_observed");
  }

  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      verifier: input.verifier_receipt.input_digest,
      coder: input.coder_emissions ? Object.keys(input.coder_emissions).sort().join(",") : "",
      version: FAILURE_CLASSIFIER_VERSION,
    }))
    .digest("hex")
    .slice(0, 16);

  return {
    failure_class,
    evidence_signals: signals,
    rationale,
    caller_must_decide: true,
    verifier_verdict: input.verifier_receipt.verdict,
    ambiguity_flags,
    input_digest,
    classified_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: FAILURE_CLASSIFIER_VERSION,
  };
}

// ── Repair-strategy mapping (advisory only) ──────────────────────────────
//
// This mapping is Ledger B (Claude-authored structure).
// Values (which strategies work how often) are Ledger A candidate · derived
// from experience corpus (Phase 9-11 · not yet wired).

export type RepairStrategy =
  | "REWRITE_MINIMAL_PATCH"
  | "PRESERVE_P2P_ROLLBACK"
  | "FIX_TYPES_FIRST"
  | "FIX_SYNTAX_FIRST"
  | "RECONSIDER_HYPOTHESIS"
  | "ESCALATE_TO_SPEC_CLARIFICATION"
  | "MEASURE_LONGER_TIMEOUT"
  | "NONE_APPLICABLE";

export function suggestRepairStrategy(
  failure_class: FailureClass,
): { readonly primary: RepairStrategy; readonly reason: string } {
  switch (failure_class) {
    case "SYNTAX":
      return { primary: "FIX_SYNTAX_FIRST", reason: "syntax must be resolved before anything else runs" };
    case "TYPE":
      return { primary: "FIX_TYPES_FIRST", reason: "types must resolve before runtime evidence is meaningful" };
    case "P2P_REGRESSION":
      return { primary: "PRESERVE_P2P_ROLLBACK", reason: "revert change and try a narrower patch that preserves P2P" };
    case "TARGET_ASSERTION":
      return { primary: "RECONSIDER_HYPOTHESIS", reason: "target behaviour not achieved · original hypothesis may be wrong" };
    case "NO_TRANSITION_OBSERVED":
      return { primary: "RECONSIDER_HYPOTHESIS", reason: "no F2P transition observed · patch may be a NO-CHANGE" };
    case "SPECIFICATION_UNRESOLVED":
      return { primary: "ESCALATE_TO_SPEC_CLARIFICATION", reason: "spec insufficient · caller must clarify" };
    case "TIMEOUT":
      return { primary: "MEASURE_LONGER_TIMEOUT", reason: "code exceeded budget · retry with longer budget or narrower scope" };
    case "RUNTIME_CRASH":
      return { primary: "REWRITE_MINIMAL_PATCH", reason: "uncaught exception · consider narrower change and defensive check at exact throw site" };
    case "UNKNOWN":
      return { primary: "NONE_APPLICABLE", reason: "insufficient evidence to suggest a strategy · caller must decide" };
  }
}
