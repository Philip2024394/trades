// src/lib/nex-agent/code-engine/capability-generalisation-ladder.ts
//
// NEX1 · K16 · Deeper Generalisation Ladder · 2026-09-21.
// Founder-authorised as part of NEX MASTER AUTONOMOUS CONTINUATION.
//
// PURPOSE
//
//   NEX's intelligence stack already generalises at multiple levels:
//   phrases → patterns → concepts → rules. This module makes the rung at
//   the TOP of that ladder — the DETERMINISTIC POLICIES NEX applies — an
//   explicit first-class artefact rather than a set of implicit code
//   comments. Each rule has an ID, a one-line statement, a where-applied
//   locus, and an emitter that stamps `k16-rule · <id> · <context>` into
//   the trace whenever the policy fires. This lets us:
//
//     · Audit which rules NEX exercises during a real turn
//     · Regression-test that a rule keeps firing where it must
//     · Discover missing rules (a code path with no rule stamp is a gap)
//
//   The ladder is INTERPRETIVE, not prescriptive: it observes and stamps
//   existing behaviour rather than changing decisions. No policy logic
//   moves here. No rule is "added" by this module — every rule is already
//   in the code today. This module only makes them visible.
//
// ANTI-CHEATING GUARANTEE
//
//   · Rules are declared in ONE canonical table (RULE_CATALOG).
//   · Every emitter takes the same shape (id + context) so grep works.
//   · No rule ID is fabricated at runtime; only IDs from the catalog are
//     emittable (TypeScript enforces the union type).
//   · Zero LLM. Zero network. Zero state. Zero mutation.
//   · This module NEVER changes what NEX decides — only records what NEX
//     decided using vocabulary the audit can consume.
//
// LADDER STRUCTURE
//
//   Phrase   →  natural-language surface strings ("weather in Bandung")
//   Pattern  →  RECALL_PATTERNS regex + kind ("weather_lookup")
//   Concept  →  domain or evidence category (weather · finance · confirmed)
//   Rule     →  deterministic policy (RULE_CATALOG below)
//
//   Existing generalisers already occupy the first three rungs. This
//   module names the fourth rung.

// ── Rule catalog · single source of truth ──────────────────────────────

export type K16RuleId =
  | "K16-R1-honest-degradation"
  | "K16-R2-fail-fast-sequence"
  | "K16-R3-whitelist-fail-closed"
  | "K16-R4-authoritative-required-for-confirmed"
  | "K16-R5-disagreement-visible-not-hidden"
  | "K16-R6-zero-llm-preserved"
  | "K16-R7-cancellation-clears-target"
  | "K16-R8-source-identity-preserved"
  | "K16-R9-recall-shortcircuit-before-classification"
  | "K16-R10-bounded-iteration-frozen-at-plan-time";

export interface K16Rule {
  readonly id: K16RuleId;
  readonly statement: string;
  readonly rungs: {
    readonly phrase_examples: readonly string[];
    readonly pattern_kinds: readonly string[];
    readonly concept: string;
  };
  readonly applied_in: readonly string[];
}

export const RULE_CATALOG: readonly K16Rule[] = [
  {
    id: "K16-R1-honest-degradation",
    statement: "When a retrieval or lookup cannot answer, state what NEX CAN do and enumerate the boundary — never fabricate a plausible answer.",
    rungs: {
      phrase_examples: ["weather forecast for Reykjavik", "coordinates of Lagos"],
      pattern_kinds: ["weather_lookup", "place_lookup"],
      concept: "external retrieval boundary",
    },
    applied_in: [
      "capability-chat-turn.ts · weather_lookup · place_not_in_map branch",
      "capability-chat-turn.ts · place_lookup · nominatim zero results",
    ],
  },
  {
    id: "K16-R2-fail-fast-sequence",
    statement: "In a bounded iteration sequence, STOP the chain on the first non-zero exit or timeout — never continue past failure.",
    rungs: {
      phrase_examples: ["run typecheck then tests", "run hq:status then workforce:status"],
      pattern_kinds: ["dispatch_sequence_request", "dispatch_confirm"],
      concept: "sequential command execution",
    },
    applied_in: [
      "capability-chat-turn.ts · dispatch_confirm sequence · stoppedEarly branch",
    ],
  },
  {
    id: "K16-R3-whitelist-fail-closed",
    statement: "When a candidate is not in the explicit allowlist, refuse the whole request — never partially satisfy, never silently drop.",
    rungs: {
      phrase_examples: ["run hq:status then evil:script"],
      pattern_kinds: ["dispatch_request", "dispatch_sequence_request"],
      concept: "authority boundary",
    },
    applied_in: [
      "capability-chat-turn.ts · dispatch_sequence_request · non-whitelisted refusal",
      "capability-chat-turn.ts · dispatch_request · no match refusal",
    ],
  },
  {
    id: "K16-R4-authoritative-required-for-confirmed",
    statement: "Evidence level `confirmed` requires at least one authoritative source AND no unresolved disagreement AND no retrieval failure — otherwise `unconfirmed`.",
    rungs: {
      phrase_examples: ["what is the weather in Jakarta", "coordinates of Bandung"],
      pattern_kinds: ["weather_lookup", "place_lookup", "multi_source_lookup"],
      concept: "evidence classification",
    },
    applied_in: [
      "capability-evidence-status.ts · level classification block",
    ],
  },
  {
    id: "K16-R5-disagreement-visible-not-hidden",
    statement: "When sources disagree, enumerate the disagreement inline in the evidence envelope — never silently select one source.",
    rungs: {
      phrase_examples: ["verify the coordinates of Bandung", "cross-check coordinates of Denpasar"],
      pattern_kinds: ["multi_source_lookup"],
      concept: "multi-source truth",
    },
    applied_in: [
      "capability-evidence-status.ts · multiEvalTrace verdict block",
      "capability-chat-turn.ts · multi_source_lookup verdict emission",
    ],
  },
  {
    id: "K16-R6-zero-llm-preserved",
    statement: "No code path may invoke an external LLM provider — every response is derived from head state, deterministic composition, or allowlisted authoritative sources.",
    rungs: {
      phrase_examples: ["(applies to every turn)"],
      pattern_kinds: ["(all kinds)"],
      concept: "R1 constitutional gate",
    },
    applied_in: [
      "src/lib/nex/constitutional-gate/index.ts · blockThirdPartyAI",
      "src/lib/nex-agent/code-engine/capability-chat-turn.ts · zero_llm: true propagation",
    ],
  },
  {
    id: "K16-R7-cancellation-clears-target",
    statement: "A cancellation intent CLEARS the active_target and prevents inheritance — no follow-up may resurrect a cancelled thread.",
    rungs: {
      phrase_examples: ["cancel that", "stop", "never mind"],
      pattern_kinds: ["cancellation_intent"],
      concept: "explicit thread termination",
    },
    applied_in: [
      "capability-chat-turn.ts · cancellation_intent handler · cleared_target trace",
    ],
  },
  {
    id: "K16-R8-source-identity-preserved",
    statement: "Every retrieved fact carries its source identifier (`bmkg.go.id`, `nominatim.openstreetmap.org`, etc.) in the evidence envelope — never collapse to an anonymous provider.",
    rungs: {
      phrase_examples: ["weather forecast for Jakarta", "coordinates of X"],
      pattern_kinds: ["weather_lookup", "place_lookup", "multi_source_lookup"],
      concept: "provenance",
    },
    applied_in: [
      "capability-evidence-status.ts · SOURCE_RELIABILITY + sources.push identifier",
    ],
  },
  {
    id: "K16-R9-recall-shortcircuit-before-classification",
    statement: "Recall intent detection runs BEFORE the classifier and topic discovery — a message that matches a RecallKind pattern never reaches the coding-loop pipeline.",
    rungs: {
      phrase_examples: ["what did you find", "have we discussed X", "what's the weather in Jakarta"],
      pattern_kinds: ["(any RecallKind)"],
      concept: "conversation-first routing",
    },
    applied_in: [
      "capability-chat-turn.ts · if (conversationScan.recall) short-circuit at ~line 404",
    ],
  },
  {
    id: "K16-R10-bounded-iteration-frozen-at-plan-time",
    statement: "Iteration counts are frozen when the sequence is planned — no runtime loop may grow past the planned length or the whitelist meta cap.",
    rungs: {
      phrase_examples: ["run A then B then C"],
      pattern_kinds: ["dispatch_sequence_request"],
      concept: "iteration boundedness",
    },
    applied_in: [
      "capability-chat-turn.ts · K12_MAX_SEQUENCE_LENGTH at parse time",
      "capability-chat-turn.ts · for..of loop over frozen pendingSeq.scripts",
    ],
  },
];

// ── Emitter ────────────────────────────────────────────────────────────
//
// The single API a caller uses to stamp a rule firing into the trace. The
// return value is the trace-line string so callers can just push it into
// their local trace array. Context should be a short, greppable descriptor
// (e.g. "weather · reykjavik", "sequence · stopped at step 2").

export function emitRuleApplied(id: K16RuleId, context: string): string {
  return `k16-rule · ${id} · ${context.slice(0, 200)}`;
}

// ── Audit ──────────────────────────────────────────────────────────────
//
// Given a trace array from any RunChatTurnResult, extract the ordered list
// of rule IDs that were stamped. Used by the K16 diagnostic suite to
// verify a turn exercised the rules it was expected to exercise.

export function extractAppliedRules(trace: readonly string[]): readonly K16RuleId[] {
  const out: K16RuleId[] = [];
  const catalogIds = new Set<K16RuleId>(RULE_CATALOG.map((r) => r.id));
  for (const line of trace) {
    const m = /^k16-rule · (K16-R\d+-[a-z-]+) ·/.exec(line);
    if (m && catalogIds.has(m[1] as K16RuleId)) out.push(m[1] as K16RuleId);
  }
  return out;
}

// ── Inventory ──────────────────────────────────────────────────────────
//
// Static maturity report — how many rules exist, what concepts they span,
// where each is applied. Consumed by the K16 audit tool and (optionally) a
// future admin surface.

export interface LadderInventory {
  readonly total_rules: number;
  readonly concepts_covered: readonly string[];
  readonly pattern_kinds_covered: readonly string[];
  readonly rules: readonly {
    readonly id: K16RuleId;
    readonly statement: string;
    readonly concept: string;
    readonly applied_in_count: number;
  }[];
}

export function inventoryLadder(): LadderInventory {
  const concepts = new Set<string>();
  const kinds = new Set<string>();
  for (const r of RULE_CATALOG) {
    concepts.add(r.rungs.concept);
    for (const k of r.rungs.pattern_kinds) kinds.add(k);
  }
  return {
    total_rules: RULE_CATALOG.length,
    concepts_covered: Array.from(concepts).sort(),
    pattern_kinds_covered: Array.from(kinds).sort(),
    rules: RULE_CATALOG.map((r) => ({
      id: r.id,
      statement: r.statement,
      concept: r.rungs.concept,
      applied_in_count: r.applied_in.length,
    })),
  };
}
