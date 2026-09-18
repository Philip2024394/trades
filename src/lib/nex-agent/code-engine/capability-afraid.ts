// src/lib/nex-agent/code-engine/capability-afraid.ts
//
// NEX1 · AFRAID · Metacognition (session-scoped) · Founder-authorised 2026-09-18.
//
// PURPOSE
//   Deterministic assessment of the CONVERSATION-LEVEL state based on the
//   recent turn history in the ConversationHead. When a conversation has
//   accumulated repeated refusals, failures, or elevated concern signals,
//   NEX1 enters an AFRAID state that raises thresholds for subsequent
//   fear/concern decisions and prepends a cautious note to the composer.
//
//   Biological analogue: sustained fear state (persistent amygdala firing +
//   HPA activation) that biases the whole organism toward caution.
//
//   AFRAID DOES NOT BLOCK. It modulates thresholds. The founder can still
//   authorise any action through Turn 2.
//
//   Zero LLM. Deterministic. Pure function.

export type AfraidState = "CALM" | "CAUTIOUS" | "AFRAID";

/** Minimal-shape recent-turn record; consumed rather than re-imported to
 *  keep this module free of ConversationHead type coupling. */
export interface AfraidTurnRecord {
  readonly turn_id: number;
  readonly state:
    | "refused"
    | "failed"
    | "clarification_required"
    | "insufficient_evidence"
    | "investigating"
    | "understood"
    | "verified"
    | string;
  readonly refusal_kind?: string | null;
}

export interface AfraidAssessmentInput {
  /** Recent turns in this conversation, ordered oldest → newest. */
  readonly recent_turns: readonly AfraidTurnRecord[];
  /** How many trailing turns to consider. Default 5. */
  readonly window_size?: number;
}

export interface AfraidAssessment {
  readonly state: AfraidState;
  readonly score: number;
  readonly window_examined: number;
  readonly refusal_count: number;
  readonly failure_count: number;
  readonly clarification_count: number;
  readonly rationale_prefix: string;
  readonly evidence_kind: "INFERRED";
  readonly policy_id: "NEX1_AFRAID_POLICY";
  readonly policy_version: "v1";
}

// ── Score table (Afraid's own rulebook) ─────────────────────────────────

const WEIGHTS = {
  refused: 2,
  failed: 2,
  clarification_required: 1,
  insufficient_evidence: 1,
} as const;

const THRESHOLDS = {
  AFRAID: 4,
  CAUTIOUS: 2,
} as const;

export function assessAfraid(input: AfraidAssessmentInput): AfraidAssessment {
  const windowSize =
    typeof input.window_size === "number" && input.window_size > 0
      ? input.window_size
      : 5;
  const window = input.recent_turns.slice(-windowSize);

  let refusal_count = 0;
  let failure_count = 0;
  let clarification_count = 0;
  let insufficient_count = 0;

  for (const t of window) {
    if (t.state === "refused") refusal_count++;
    else if (t.state === "failed") failure_count++;
    else if (t.state === "clarification_required") clarification_count++;
    else if (t.state === "insufficient_evidence") insufficient_count++;
  }

  const score =
    refusal_count * WEIGHTS.refused +
    failure_count * WEIGHTS.failed +
    clarification_count * WEIGHTS.clarification_required +
    insufficient_count * WEIGHTS.insufficient_evidence;

  let state: AfraidState = "CALM";
  if (score >= THRESHOLDS.AFRAID) state = "AFRAID";
  else if (score >= THRESHOLDS.CAUTIOUS) state = "CAUTIOUS";

  const rationale_prefix =
    state === "CALM"
      ? ""
      : `[Afraid · ${state} · score=${score} · refusals=${refusal_count} failures=${failure_count} clarifications=${clarification_count}] `;

  return {
    state,
    score,
    window_examined: window.length,
    refusal_count,
    failure_count,
    clarification_count,
    rationale_prefix,
    evidence_kind: "INFERRED",
    policy_id: "NEX1_AFRAID_POLICY",
    policy_version: "v1",
  };
}

export const AFRAID_VERSION = "afraid.v1";
export const _AFRAID_INTERNAL = { WEIGHTS, THRESHOLDS };
