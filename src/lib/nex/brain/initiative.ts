// src/lib/nex/brain/initiative.ts
//
// Stage 3.24 · Phase 17 · Initiative (Philip 2026-08-31).
//
// Consumer of Prediction (Phase 16). Decides WHEN to proactively
// surface a prediction to the user as a "suggested next" hint. Never
// spams · never competes with the composer's own question · never
// surfaces low-confidence hints.
//
// v1 discipline:
//   · Deterministic decision · no LLM
//   · Rate-limited per conversation (default cap: 3)
//   · Only volunteer `high` confidence predictions
//   · Suppress when reply already asked a question (composer already
//     took the "asking" turn · we don't double up)
//   · Suppress after Comparison / Recommendation / executed Action
//     (those ARE already proactive · adding more noise is worse)
//   · Attaches structured InitiativeReport to response · composer
//     text unchanged (v1 observational · UI or future Speaking layer
//     surfaces the suggested_next hint as a pill / voice cue)

import type { PredictionReport, PredictedNext } from "./prediction";

export type InitiativeDecision =
  | { volunteered: true; suggestion: PredictedNext; reason: string; }
  | { volunteered: false; reason: string; };

export type InitiativeReport = {
  decision: InitiativeDecision;
  sessionCount: number;
  cap: number;
};

export type InitiativeInput = {
  prediction?: PredictionReport;
  /** Reply text · used to detect if the composer already asked something. */
  reply: string;
  /** True when this turn executed an Action. */
  didExecuteAction: boolean;
  /** True when Comparison surfaced structured output this turn. */
  didComparison: boolean;
  /** True when Recommendation surfaced this turn. */
  didRecommendation: boolean;
  /** Session-level counter of prior initiatives volunteered. */
  sessionInitiativeCount: number;
  /** Max initiatives per conversation. Default 3. */
  cap?: number;
};

const DEFAULT_CAP = 3;

/**
 * Decide whether to volunteer the top prediction as a proactive
 * suggestion this turn. Deterministic gate.
 */
export function decideInitiative(input: InitiativeInput): InitiativeReport {
  const cap = input.cap ?? DEFAULT_CAP;
  const sessionCount = input.sessionInitiativeCount;

  const notVolunteered = (reason: string): InitiativeReport => ({
    decision: { volunteered: false, reason },
    sessionCount,
    cap,
  });

  // 1. No prediction at all · nothing to volunteer.
  if (!input.prediction || !input.prediction.top) {
    return notVolunteered("no prediction top candidate to consider");
  }
  const top = input.prediction.top;

  // 2. Rate limit · never exceed cap for this conversation.
  if (sessionCount >= cap) {
    return notVolunteered(`session cap reached (${sessionCount}/${cap}) · no more initiatives this conversation`);
  }

  // 3. Confidence gate · only volunteer HIGH confidence hints.
  if (top.confidence !== "high") {
    return notVolunteered(`top confidence=${top.confidence} · only 'high' hints are volunteered`);
  }

  // 4. Composer already asked · don't double up.
  if (input.reply.trim().endsWith("?")) {
    return notVolunteered("composer already ended reply with a question · initiative would be redundant");
  }

  // 5. Comparison / Recommendation / Action already proactive · don't stack.
  if (input.didComparison) {
    return notVolunteered("comparison already surfaced · already proactive");
  }
  if (input.didRecommendation) {
    return notVolunteered("recommendation already surfaced · already proactive");
  }
  if (input.didExecuteAction) {
    return notVolunteered("action executed · user is progressing · not the moment for a new suggestion");
  }

  // All gates pass · volunteer the top prediction.
  return {
    decision: {
      volunteered: true,
      suggestion: top,
      reason: `high-confidence ${top.kind} hint · none of the suppression conditions triggered · ${sessionCount + 1}/${cap}`,
    },
    sessionCount: sessionCount + 1,
    cap,
  };
}
