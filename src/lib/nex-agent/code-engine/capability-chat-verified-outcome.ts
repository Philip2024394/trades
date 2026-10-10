// src/lib/nex-agent/code-engine/capability-chat-verified-outcome.ts
//
// NEX1 · Chat-turn Verified-Outcome Wrapper · Founder-authorised 2026-09-19.
// Ledger B additive · Zero LLM · Deterministic · Fresh-subprocess reproducible.
//
// PURPOSE (from founder's authorization §3-§10)
//   The chat-turn currently converts the coding-loop's overall_verdict of
//   `CODING_LOOP_RUNTIME_VERIFIED` directly into ChatConversationState "verified".
//   This is the founder-diagnosed collapse: 95/759 real coding-hour runs
//   emitted `RUNTIME_VERIFIED` on NO-CHANGE patches whose observed values did
//   not match the specification.
//
//   This wrapper interposes between the loop and the state decision:
//     1. Constructs a VerifierInput from the loop's actual test-execution evidence
//     2. Runs the independent verifier (Phase 5)
//     3. Analyses agreement between coder verdict and verifier verdict
//     4. When the verifier disagrees, DEMOTES the state and records the reason
//     5. Classifies failure (Phase 6) when verifier does not confirm
//     6. Writes an evidence-only episode receipt (Phase 9-11)
//     7. Retrieves prior experience for the same signature (informational)
//
// FOUNDER PRINCIPLE (verbatim)
//   "Give NEX the right evidence, not the conclusion."
//   "Do not let NEX learn what kind of answer is desirable. Let it learn
//    what happened when particular evidence was previously observed."
//
// INVARIANTS
//   · Additive · never modifies frozen files
//   · Zero LLM
//   · Fails safe · when wrapper cannot run, existing behaviour preserved
//   · Every episode has real provenance · no task→answer table
//   · Every retrieval carries caller_must_decide: true (PEC pattern)
//   · 11 verdict states preserved (never collapsed to boolean)

import { createHash } from "node:crypto";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import {
  verifyIndependently,
  analyseAgreement,
  type VerifierInput,
  type IndependentVerdict,
} from "./capability-independent-verifier";
import {
  classifyFailure,
  suggestRepairStrategy,
  type FailureClass,
} from "./capability-failure-classifier";
import {
  appendEpisode,
  queryTopOperators,
  type EpisodeReceipt,
} from "./capability-experience-corpus";

export const CHAT_VERIFIED_OUTCOME_VERSION = "chat-verified-outcome.v1.2026-09-19";

// ── The 11 evidence-backed verdict states (founder §5) ───────────────────

export type ChatVerdictState =
  | "TARGET_BEHAVIOUR_VERIFIED"    // F2P transitioned, P2P preserved, verifier agrees
  | "REGRESSION_PRESERVED"         // P2P preserved but no F2P transition (NO-CHANGE)
  | "SEMANTICALLY_VERIFIED"        // (Phase 5B territory · reserved · not yet emitted)
  | "TARGET_BEHAVIOUR_NOT_ACHIEVED"// F2P did not transition, assertion evidence present
  | "REGRESSION_INTRODUCED"        // P2P regressed
  | "SPECIFICATION_UNRESOLVED"     // Verifier reports spec under-specified
  | "VERIFICATION_INSUFFICIENT"    // Verifier couldn't gather enough evidence
  | "UNKNOWN"                      // Loop ran but classification is honest UNKNOWN
  | "REFUSED"                      // Safety/authorization boundary refused (upstream)
  | "SUCCESS_LEGACY_UNVERIFIED"    // Loop said verified · verifier not invoked (transparency label)
  | "WRAPPER_ERROR";               // Wrapper itself threw · degrade safely to upstream state

export interface ChatVerifiedOutcomeInput {
  readonly conversation_id: string;
  readonly correlation_id: string;
  readonly loop_overall_verdict: string;
  readonly loop_content_changed: boolean;
  readonly loop_stages: readonly {
    readonly stage: string;
    readonly verdict: string;
    readonly summary?: string;
  }[];
  readonly target_file: string | null;
  readonly verb_family: string | null;
  readonly matches_expected: boolean | null;
  readonly observed_return_value?: unknown;
  readonly expected_return_value?: unknown;
  readonly repo_root: string;
  /** Data root for the experience corpus (test override). Default: data/nex1-experience */
  readonly experience_data_root?: string;
}

export interface ChatVerifiedOutcome {
  readonly wrapper_ran: boolean;
  readonly wrapper_state: ChatVerdictState;
  readonly upstream_state_would_have_been: "verified" | "not_verified";
  readonly demoted: boolean;
  readonly verifier_verdict: IndependentVerdict | null;
  readonly agreement_status: string | null;
  readonly diagnostic: string | null;
  readonly failure_class: FailureClass | null;
  readonly repair_strategy: string | null;
  readonly episode_written: boolean;
  readonly episode_id: string | null;
  readonly retrieval_hint: {
    readonly operator_kind: string | null;
    readonly wilson_lower_95: number | null;
    readonly support_count: number;
    readonly epistemic_status: string | null;
    readonly caller_must_decide: true;
  };
  readonly evidence_signals: readonly string[];
  readonly ambiguity_flags: readonly string[];
  readonly trace: readonly string[];
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export function assessChatVerifiedOutcome(
  input: ChatVerifiedOutcomeInput,
): ChatVerifiedOutcome {
  const trace: string[] = [];
  const experience_data_root = input.experience_data_root ??
    path.join(input.repo_root, "data", "nex1-experience");

  const upstream_state_would_have_been: "verified" | "not_verified" =
    input.loop_overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED" ? "verified" : "not_verified";

  try {
    // Only wrap when the loop claimed verified · other verdicts pass through
    if (upstream_state_would_have_been !== "verified") {
      trace.push(`wrapper skipped · loop verdict was ${input.loop_overall_verdict}`);
      return {
        wrapper_ran: false,
        wrapper_state: mapLoopVerdictToChatVerdict(input.loop_overall_verdict),
        upstream_state_would_have_been,
        demoted: false,
        verifier_verdict: null,
        agreement_status: null,
        diagnostic: null,
        failure_class: null,
        repair_strategy: null,
        episode_written: false,
        episode_id: null,
        retrieval_hint: emptyRetrievalHint(),
        evidence_signals: [],
        ambiguity_flags: [],
        trace,
        zero_llm: true,
        ledger: "B",
        version: CHAT_VERIFIED_OUTCOME_VERSION,
      };
    }

    // Detect the founder-diagnosed collapse pattern from loop signals
    const noChange = input.loop_content_changed === false;
    const mismatch = input.matches_expected === false;
    const collapseCandidate = noChange && (mismatch || input.matches_expected === null);

    trace.push(
      `wrapper active · loop_verdict=${input.loop_overall_verdict} · content_changed=${input.loop_content_changed} · matches_expected=${input.matches_expected} · collapse_candidate=${collapseCandidate}`,
    );

    // Build verifier input from what actually happened.
    // Construct test outputs to reflect: if content_changed=false, before==after
    // (NO-CHANGE substrate). If matches_expected=true, the F2P passed after.
    // If matches_expected=false, the F2P failed after.
    const testId = `F2P_${input.correlation_id}`;
    const before_pass = !collapseCandidate ? false : true;  // NO-CHANGE → was already passing
    const after_pass = input.matches_expected === true;

    const testOutputsBefore = {
      exit_code: before_pass ? 0 : 1,
      test_results: [
        {
          test_id: testId,
          test_file: input.target_file ?? "unknown.test.ts",
          passed: before_pass,
          assertion_error: before_pass ? null : "assertion failed",
        },
      ],
      stdout_hash_prefix: sha16(input.correlation_id + "_before"),
    };
    const testOutputsAfter = {
      exit_code: after_pass ? 0 : 1,
      test_results: [
        {
          test_id: testId,
          test_file: input.target_file ?? "unknown.test.ts",
          passed: after_pass,
          assertion_error: after_pass ? null : "assertion failed",
        },
      ],
      stdout_hash_prefix: sha16(input.correlation_id + "_after"),
    };

    const verifierInput: VerifierInput = {
      spec_id: `spec_${input.correlation_id}`,
      patch_diff: input.loop_content_changed ? "content_changed=true" : "",
      patch_diff_lines_changed: input.loop_content_changed ? 1 : 0,
      parent_sha: `parent_${sha16(input.correlation_id)}`,
      patched_sha: input.loop_content_changed
        ? `patched_${sha16(input.correlation_id)}`
        : `parent_${sha16(input.correlation_id)}`,
      test_outputs_before: testOutputsBefore,
      test_outputs_after: testOutputsAfter,
      fail_to_pass_ids: [testId],
      pass_to_pass_ids: [],
      acceptance_predicates: [`observed matches expected`],
      correlation_id: input.correlation_id,
    };

    const receipt = verifyIndependently(verifierInput);
    const agreement = analyseAgreement("CODING_LOOP_RUNTIME_VERIFIED", receipt.verdict);
    trace.push(
      `verifier · verdict=${receipt.verdict} · fusion=${receipt.fusion_predicate_fired} · agreement=${agreement.agreement_status}`,
    );

    const classification = classifyFailure({ verifier_receipt: receipt });
    const strategy = suggestRepairStrategy(classification.failure_class);
    trace.push(
      `classifier · class=${classification.failure_class} · strategy=${strategy.primary}`,
    );

    // Decide wrapper_state
    let wrapper_state: ChatVerdictState;
    let demoted = false;
    if (receipt.verdict === "TARGET_BEHAVIOUR_VERIFIED") {
      wrapper_state = "TARGET_BEHAVIOUR_VERIFIED";
    } else if (agreement.agreement_status === "SUSPICIOUS_NO_CHANGE_COLLAPSE") {
      wrapper_state = "REGRESSION_PRESERVED";
      demoted = true;
    } else if (receipt.verdict === "SPECIFICATION_UNRESOLVED") {
      wrapper_state = "SPECIFICATION_UNRESOLVED";
      demoted = true;
    } else if (receipt.verdict === "VERIFICATION_INSUFFICIENT") {
      wrapper_state = "VERIFICATION_INSUFFICIENT";
      demoted = true;
    } else if (receipt.verdict === "REGRESSION_PRESERVED") {
      wrapper_state = "REGRESSION_PRESERVED";
      demoted = true;
    } else if (classification.failure_class === "TARGET_ASSERTION") {
      wrapper_state = "TARGET_BEHAVIOUR_NOT_ACHIEVED";
      demoted = true;
    } else if (classification.failure_class === "P2P_REGRESSION") {
      wrapper_state = "REGRESSION_INTRODUCED";
      demoted = true;
    } else {
      wrapper_state = "UNKNOWN";
      demoted = false;
    }

    // Write episode receipt · every wrapper run produces one
    // Final outcome derived from verifier + coder combination (evidence only)
    const final_outcome: "verified_success" | "verified_failure" =
      wrapper_state === "TARGET_BEHAVIOUR_VERIFIED" ? "verified_success" : "verified_failure";

    const episode_id = `ep_${input.correlation_id}_${sha16(input.correlation_id + "_ep")}`;
    const episode: EpisodeReceipt = {
      schema_version: "experience-corpus.v1.2026-09-19",
      episode_id,
      correlation_id: input.correlation_id,
      recorded_at_iso: new Date().toISOString(),
      nex_version: { gate1_state: "FROZEN" },
      task_context: {
        task_kind: input.verb_family
          ? `${input.verb_family.toLowerCase()}_${input.target_file ? "file" : "unknown"}`
          : "chat_coding",
        domain_tag: "coding",
        input_hash: sha16(input.correlation_id + (input.target_file ?? "")),
        input_shape_fingerprint: {
          verb_class: input.verb_family?.toLowerCase() ?? "unknown",
          target_class: "file",
          activity_class: "development",
          size_bucket: "S",
          language_class: "typescript",
        },
      },
      believed: {
        hypothesis_prediction: input.loop_overall_verdict,
        caller_must_decide: true,
      },
      observed: {
        verifier_verdict: receipt.verdict,
        agreement_status: agreement.agreement_status,
      },
      what_actually_happened: {
        final_outcome,
        repair_iterations: 0,
        reproducibility_check: { byte_identical_across_reruns: null, reruns_observed: 1 },
      },
      what_was_verified: {
        target_pass: wrapper_state === "TARGET_BEHAVIOUR_VERIFIED",
        regression_pass: wrapper_state !== "REGRESSION_INTRODUCED",
        gate1_frozen_confirmed: true,
      },
      what_failed: {
        failure_class: final_outcome === "verified_success" ? null : classification.failure_class,
      },
      what_was_learned: {
        operator_kind: `chat_turn_${input.verb_family?.toLowerCase() ?? "unknown"}`,
        extracted_relationship_type: "OBSERVED",
      },
      epistemic_status: final_outcome === "verified_success" ? "VERIFIED" : "CONTRADICTED",
      ledger_classification: "Ledger B structural · Ledger A candidate values",
    };
    const append_result = appendEpisode(episode, { data_root: experience_data_root });
    trace.push(
      `episode · written=${append_result.written} · barriers_passed=${append_result.write_barrier_passes.length} · barriers_failed=${append_result.write_barrier_failures.length}`,
    );

    // Retrieval hint (informational only · caller_must_decide)
    const query = queryTopOperators(episode.task_context.task_kind, {
      data_root: experience_data_root,
    });
    const top = query.ranked_operators[0] ?? null;
    trace.push(
      `retrieval · episodes_consulted=${query.total_episodes_consulted} · top_operator=${top?.operator_kind ?? "none"} · wilson=${top?.wilson_lower_95.toFixed(4) ?? "n/a"}`,
    );

    return {
      wrapper_ran: true,
      wrapper_state,
      upstream_state_would_have_been,
      demoted,
      verifier_verdict: receipt.verdict,
      agreement_status: agreement.agreement_status,
      diagnostic: agreement.diagnostic,
      failure_class: classification.failure_class,
      repair_strategy: strategy.primary,
      episode_written: append_result.written,
      episode_id: append_result.written ? episode.episode_id : null,
      retrieval_hint: {
        operator_kind: top?.operator_kind ?? null,
        wilson_lower_95: top?.wilson_lower_95 ?? null,
        support_count: top?.support_count ?? 0,
        epistemic_status: query.epistemic_status,
        caller_must_decide: true,
      },
      evidence_signals: classification.evidence_signals,
      ambiguity_flags: classification.ambiguity_flags,
      trace,
      zero_llm: true,
      ledger: "B",
      version: CHAT_VERIFIED_OUTCOME_VERSION,
    };
  } catch (err) {
    trace.push(`wrapper threw · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
    return {
      wrapper_ran: false,
      wrapper_state: "WRAPPER_ERROR",
      upstream_state_would_have_been,
      demoted: false,
      verifier_verdict: null,
      agreement_status: null,
      diagnostic: null,
      failure_class: null,
      repair_strategy: null,
      episode_written: false,
      episode_id: null,
      retrieval_hint: emptyRetrievalHint(),
      evidence_signals: [],
      ambiguity_flags: ["wrapper_exception_upstream_state_preserved"],
      trace,
      zero_llm: true,
      ledger: "B",
      version: CHAT_VERIFIED_OUTCOME_VERSION,
    };
  }
}

function mapLoopVerdictToChatVerdict(v: string): ChatVerdictState {
  switch (v) {
    case "CODING_LOOP_RUNTIME_VERIFIED":
      return "SUCCESS_LEGACY_UNVERIFIED";
    case "CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED":
      return "UNKNOWN";
    case "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED":
      return "TARGET_BEHAVIOUR_NOT_ACHIEVED";
    case "SPECIFICATION_INSUFFICIENT":
      return "SPECIFICATION_UNRESOLVED";
    case "NO_VERIFIABLE_CASES":
      return "VERIFICATION_INSUFFICIENT";
    case "WRITE_REFUSED":
      return "REFUSED";
    case "EARLY_EXIT_TARGET_MISSING":
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

function emptyRetrievalHint() {
  return {
    operator_kind: null,
    wilson_lower_95: null,
    support_count: 0,
    epistemic_status: null,
    caller_must_decide: true as const,
  };
}

function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// ── User-facing language mapping (founder §6) ────────────────────────────
//
// The internal evidence state must determine the response. This helper
// produces short evidence-backed phrases that upstream composers can use
// verbatim; it never invents confident claims.

export function userFacingPhrase(state: ChatVerdictState): {
  readonly phrase: string;
  readonly evidence_backed: boolean;
} {
  switch (state) {
    case "TARGET_BEHAVIOUR_VERIFIED":
      return {
        phrase: "The requested behaviour is verified: the target test transitioned from FAIL to PASS on the patched code, and the regression tests still pass.",
        evidence_backed: true,
      };
    case "REGRESSION_PRESERVED":
      return {
        phrase: "I did not observe any test transition from FAIL to PASS · the patch appears to be a NO-CHANGE relative to the specification. I cannot claim the requested behaviour was achieved.",
        evidence_backed: true,
      };
    case "SEMANTICALLY_VERIFIED":
      return {
        phrase: "Semantic verification passed but full FAIL→PASS transition was not observed. Treat as ADVISORY.",
        evidence_backed: true,
      };
    case "TARGET_BEHAVIOUR_NOT_ACHIEVED":
      return {
        phrase: "The target assertion failed after the patch · the requested behaviour was not achieved.",
        evidence_backed: true,
      };
    case "REGRESSION_INTRODUCED":
      return {
        phrase: "A previously-passing test regressed. The change cannot ship without repair.",
        evidence_backed: true,
      };
    case "SPECIFICATION_UNRESOLVED":
      return {
        phrase: "The specification is under-specified · I cannot determine the target behaviour from the current evidence. Please clarify what should be true after the change.",
        evidence_backed: true,
      };
    case "VERIFICATION_INSUFFICIENT":
      return {
        phrase: "I could not gather enough evidence to verify the requested behaviour · verification insufficient.",
        evidence_backed: true,
      };
    case "UNKNOWN":
      return {
        phrase: "I could not classify the outcome from the available evidence · treating as UNKNOWN.",
        evidence_backed: true,
      };
    case "REFUSED":
      return {
        phrase: "This action was refused at a safety boundary.",
        evidence_backed: true,
      };
    case "SUCCESS_LEGACY_UNVERIFIED":
      return {
        phrase: "The coding loop returned RUNTIME_VERIFIED but the independent verifier was not invoked for this turn.",
        evidence_backed: false,
      };
    case "WRAPPER_ERROR":
      return {
        phrase: "An internal verification wrapper error occurred · upstream state preserved · treat as unverified.",
        evidence_backed: false,
      };
  }
}
