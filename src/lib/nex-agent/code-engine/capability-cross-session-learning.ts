// src/lib/nex-agent/code-engine/capability-cross-session-learning.ts
//
// NEX1 · Fix 30 · Cross-session learning consumer. Uses Fix 26 retrieval.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Turn Fix 17 (write) + Fix 26 (read) into cumulative behaviour:
//   when NEX1 encounters a target it has previously seen, surface the
//   prior verdicts as retrieval-informed CONTEXT (never as authority).
//
//   Consumers of Fix 30:
//     - chat-turn composer (surface "we investigated this file before ·
//       last verdict was <X>")
//     - salience-switch (Fix 25) may up-weight bridge-attempt when prior
//       SELECTED existed
//
//   CONSTITUTIONAL RULES (STRICT · R11-B / Q8 V2 v4)
//   - Retrieved verdicts INFORM but do NOT authorise. Consumer must
//     still run its own investigation this turn.
//   - Retrieved evidence MUST NOT enter R-4 SUPPORTING count. This
//     module carries the r11b_marker forward from Fix 26.
//   - Q8 V2 v4 unresolved Sub-decisions A-E respected. No silent choice.
//   - Zero LLM.
//
//   Fix 30 does not itself alter behaviour; it produces a `Nex1PriorContext`
//   object that consumers can OPT-IN to using. Zero regression risk when
//   consumers do not opt in.

import { retrieveExperience, type RetrievalResult } from "./capability-experience-retrieval";
import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";

export interface Nex1PriorContextRequest {
  readonly repo_root?: string;
  readonly source_file: string;
  readonly max_history?: number;
}

export type PriorContextStatus =
  | "NO_PRIOR_EXPERIENCE"
  | "PRIOR_EXPERIENCE_INFORM_ONLY"
  | "STORE_UNAVAILABLE";

export interface Nex1PriorContext {
  readonly status: PriorContextStatus;
  readonly source_file: string;
  readonly total_prior_entries: number;
  /** Most recent up to max_history entries · ordered by timestamp DESC.
   *  Empty when status !== "PRIOR_EXPERIENCE_INFORM_ONLY". */
  readonly recent: readonly InvestigationConclusionEntry[];
  /** Aggregated by selection_state · counts only. Never treated as majority. */
  readonly state_counts: Readonly<
    Record<InvestigationConclusionEntry["selection_state"], number>
  >;
  /** Explicit constitutional marker echoed to every consumer. */
  readonly r11b_marker: "PRIOR_EXPERIENCE_INFORMS_BUT_DOES_NOT_AUTHORISE";
  /** Deterministic recommendation string, informational only. Never
   *  overrides current-turn investigation. */
  readonly informational_hint: string;
}

const EMPTY_STATE_COUNTS: Record<
  InvestigationConclusionEntry["selection_state"],
  number
> = {
  SELECTED: 0,
  NO_SELECTION: 0,
  TIE: 0,
  INSUFFICIENT_EVIDENCE: 0,
  UNRESOLVED: 0,
  REQUIRE_MORE_INVESTIGATION: 0,
};

export function buildPriorContext(
  req: Nex1PriorContextRequest,
): Nex1PriorContext {
  const max = typeof req.max_history === "number" && req.max_history > 0
    ? req.max_history
    : 3;
  const r: RetrievalResult = retrieveExperience({
    repo_root: req.repo_root,
    source_file: req.source_file,
    max_entries: 200, // read broadly · trim after sorting
  });

  if (!r.ok) {
    if (r.refusal_kind === "store_not_found" || r.refusal_kind === "store_unreadable") {
      return {
        status: "STORE_UNAVAILABLE",
        source_file: req.source_file,
        total_prior_entries: 0,
        recent: [],
        state_counts: { ...EMPTY_STATE_COUNTS },
        r11b_marker: "PRIOR_EXPERIENCE_INFORMS_BUT_DOES_NOT_AUTHORISE",
        informational_hint: `store unavailable · run investigation fresh · ${r.detail}`,
      };
    }
    // empty_query_would_return_everything cannot happen here — we passed a filter.
    return {
      status: "NO_PRIOR_EXPERIENCE",
      source_file: req.source_file,
      total_prior_entries: 0,
      recent: [],
      state_counts: { ...EMPTY_STATE_COUNTS },
      r11b_marker: "PRIOR_EXPERIENCE_INFORMS_BUT_DOES_NOT_AUTHORISE",
      informational_hint: `no prior experience for ${req.source_file}`,
    };
  }

  const entries = [...r.entries].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  const recent = entries.slice(0, max);
  const counts: Record<
    InvestigationConclusionEntry["selection_state"],
    number
  > = { ...EMPTY_STATE_COUNTS };
  for (const e of entries) counts[e.selection_state]++;
  const total = entries.length;
  const status: PriorContextStatus = total === 0
    ? "NO_PRIOR_EXPERIENCE"
    : "PRIOR_EXPERIENCE_INFORM_ONLY";
  return {
    status,
    source_file: req.source_file,
    total_prior_entries: total,
    recent,
    state_counts: counts,
    r11b_marker: "PRIOR_EXPERIENCE_INFORMS_BUT_DOES_NOT_AUTHORISE",
    informational_hint:
      total === 0
        ? `no prior experience for ${req.source_file}`
        : `${total} prior investigation(s) · last verdict ${recent[0]?.selection_state ?? "n/a"} · informational only`,
  };
}

export const CROSS_SESSION_LEARNING_VERSION = "fix30.v1";
