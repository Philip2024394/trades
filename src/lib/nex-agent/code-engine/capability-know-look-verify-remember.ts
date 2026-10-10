// src/lib/nex-agent/code-engine/capability-know-look-verify-remember.ts
//
// NEX · G7 · 4-Decision Engine · Phase 4 · 2026-09-21.
// Founder-authorised as part of "Global Web Intelligence".
//
// PURPOSE
//
//   Phase 3 shipped a 4-verdict KNOW-or-LOOK classifier. Phase 4
//   matures it into a 4-related-decisions engine that a caller can
//   consult once per turn and receive four orthogonal answers:
//
//     - DO_I_KNOW?     → yes/no from internal knowledge state
//     - DO_I_LOOK?     → yes/no from freshness + external-entity signal
//     - DO_I_VERIFY?   → yes/no from confidence + stakes
//     - DO_I_REMEMBER? → yes/no from retention signals
//
//   Each answer is derived from inputs the caller supplies. This
//   module composes existing capabilities (KNOW-or-LOOK verdict,
//   freshness policy, retention signals) rather than duplicating
//   their logic. All decisions are deterministic.
//
// ANTI-CHEATING
//
//   · Pure function of typed inputs.
//   · Zero LLM. Zero network.
//   · Each decision has a documented rule.
//   · Adding a decision is a governance action (union type change).

import { decideKnowOrLook, type KnowOrLookInputs, type KnowOrLookVerdict } from "./capability-know-or-look";
import type { RetentionSignal } from "./capability-retention-model";
import { BLOCKING_RETENTION_SIGNALS, POSITIVE_RETENTION_SIGNALS } from "./capability-retention-model";

export interface FourDecisionInputs {
  readonly know_or_look: KnowOrLookInputs;
  /** For DO_I_VERIFY? — is the question in a high-stakes class
   *  where a second source materially improves reliability?
   *  (e.g. coordinates, regulations, prices) */
  readonly high_stakes: boolean;
  /** For DO_I_REMEMBER? — retention signals the caller has already
   *  determined for this turn. */
  readonly retention_signals: readonly RetentionSignal[];
}

export interface FourDecisionResult {
  readonly know_verdict: KnowOrLookVerdict;
  readonly do_i_know: boolean;
  readonly do_i_look: boolean;
  readonly do_i_verify: boolean;
  readonly do_i_remember: boolean;
  readonly rationale: string;
}

const POS_SET = new Set<RetentionSignal>(POSITIVE_RETENTION_SIGNALS);
const BLOCK_SET = new Set<RetentionSignal>(BLOCKING_RETENTION_SIGNALS);

export function decideKnowLookVerifyRemember(inputs: FourDecisionInputs): FourDecisionResult {
  const kolResult = decideKnowOrLook(inputs.know_or_look);
  const do_i_know = kolResult.verdict === "KNOWN";
  const do_i_look = kolResult.verdict === "LOOK_REQUIRED" || kolResult.verdict === "LOOK_RECOMMENDED";
  // VERIFY: recommended when the class is high-stakes OR when
  // KNOW-or-LOOK is LOOK_RECOMMENDED (which already means confidence
  // benefits from a second source).
  const do_i_verify = inputs.high_stakes || kolResult.verdict === "LOOK_RECOMMENDED";
  // REMEMBER: at least one positive signal AND no blocking signal.
  // Mirrors capability-selective-retention.decideSelectiveRetention
  // fail-closed policy — never say "remember" if any block signal
  // fired.
  const positives = inputs.retention_signals.filter((s) => POS_SET.has(s));
  const blocks = inputs.retention_signals.filter((s) => BLOCK_SET.has(s));
  const do_i_remember = positives.length > 0 && blocks.length === 0;
  return {
    know_verdict: kolResult.verdict,
    do_i_know,
    do_i_look,
    do_i_verify,
    do_i_remember,
    rationale: `KNOW=${do_i_know} · LOOK=${do_i_look} · VERIFY=${do_i_verify} · REMEMBER=${do_i_remember} · [${kolResult.reason.slice(0, 100)}]`,
  };
}

export function emitFourDecisionTrace(result: FourDecisionResult): string {
  return `four_decision · know=${result.do_i_know} · look=${result.do_i_look} · verify=${result.do_i_verify} · remember=${result.do_i_remember} · kol=${result.know_verdict}`;
}
