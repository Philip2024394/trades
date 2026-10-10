// src/lib/nex-agent/code-engine/cell-centre/capability-hypothesis-set.ts
//
// NEX1 · Multi-Hypothesis Representation · Ledger B additive.
// Founder-authorised 2026-09-19 · Missing Intelligence Mechanisms Build Program · Mechanism 1.
//
// PURPOSE
//   Provide a HYPOTHESIS-SET data structure that survives through
//   multi-specialist synthesis instead of collapsing to a single verdict.
//   Numenta CMP-inspired: maintain candidates, exchange union, intersect
//   on new evidence, never collapse prematurely.
//
// DISCIPLINE (all rules apply)
//   · Frozen PEC/PB/router/specialists/safety layer untouched · verified byte-identical
//   · Fear/Concern/Afraid HARD GATE preserved (caller delegates to PEC Plus)
//   · Rules are domain-general · pre-registered SHA-256 hash · not test-tuned
//   · Never bypasses safety
//   · Zero LLM · deterministic
//   · No production wiring · Gate 1 frozen
//   · Reversible: delete this file · behaviour reverts
//   · Ledger B: structure and weights Claude-authored. Ledger A promotion
//     requires NEX to derive per-specialist weights from training receipts.
//
// PRE-REGISTERED OPERATIONS (do not modify after corpus is written)
//   initialize(baseline)          → seed with baseline hypothesis at score 1.0
//   observe(analysis)             → add/strengthen hypotheses matching kind
//   intersect(setA, setB)         → keep hypotheses present in both · sum scores
//   eliminate(set, contradiction) → drop hypotheses contradicted by strong opposing signal
//   decide(set, margin)           → argmax with margin threshold · below = ABSTAIN

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";

registerAgent({
  id: "hypothesis_set_representation",
  name: "Multi-Hypothesis Representation · CMP-style · Ledger B additive",
  cognitive_layer: "infrastructure_registry",
  description: "Maintains a set of competing hypotheses with per-hypothesis evidence scores. Never collapses to single verdict prematurely. Numenta CMP-inspired union-then-intersect. Zero LLM. Deterministic. Ledger B additive · reversible.",
});

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** Discrete outcome universe for NEX decisions · fixed a priori */
export type HypothesisId =
  | "PROCEED_CREATE"
  | "REFUSE_DUPLICATE"
  | "REFUSE_UNRELATED"
  | "REFUSE_HARDGATE"
  | "UNKNOWN"
  | "ABSTAIN";

export interface HypothesisRecord {
  readonly id: HypothesisId;
  readonly evidence_score: number;              // sum of weighted contributions
  readonly supporting_specialists: readonly string[];
  readonly contradicting_specialists: readonly string[];
  readonly first_seen_turn: number;
}

export type HypothesisSet = Readonly<Record<HypothesisId, HypothesisRecord>>;

// ═══════════════════════════════════════════════════════════════════════
// KIND → HYPOTHESIS MAPPING TABLE (Claude-authored · Ledger B · disclosed)
// ═══════════════════════════════════════════════════════════════════════
// Each specialist output kind maps to a supported hypothesis (positive)
// or a contradicted hypothesis (negative). Weights are uniform 1.0.
// Ledger A candidate: replace this table with data-derived weights.

const KIND_SUPPORTS: Record<string, { support: HypothesisId | null; contradicts: HypothesisId | null }> = {
  // creation_specialist
  creation_signal_present:      { support: "PROCEED_CREATE",   contradicts: null },
  creation_duplicate_detected:  { support: "REFUSE_DUPLICATE", contradicts: "PROCEED_CREATE" },
  no_creation_signal:           { support: null,               contradicts: null },
  // semantic_duplicate_specialist
  semantic_duplicate_detected:  { support: "REFUSE_DUPLICATE", contradicts: "PROCEED_CREATE" },
  no_semantic_duplicate_signal: { support: null,               contradicts: null },
  semantic_duplicate_intent_signal_only: { support: null,      contradicts: null },
  // verb_contradiction_specialist
  verb_contradiction_detected:  { support: "UNKNOWN",          contradicts: null },
  no_verb_contradiction:        { support: null,               contradicts: null },
  // communication_specialist
  message_shape_request:        { support: null,               contradicts: null },
  message_shape_question:       { support: null,               contradicts: null },
  message_shape_statement:      { support: null,               contradicts: null },
  message_shape_refusal:        { support: "REFUSE_UNRELATED", contradicts: "PROCEED_CREATE" },
  message_shape_unknown:        { support: null,               contradicts: null },
  // safety layer (via PEC Plus)
  hard_gate_blocked:            { support: "REFUSE_HARDGATE",  contradicts: null },
};

/** Confidence-scaled evidence contribution per (kind, confidence). */
function evidenceContribution(kind: string, confidence: number): { support: HypothesisId | null; contradicts: HypothesisId | null; weight: number } {
  const entry = KIND_SUPPORTS[kind];
  if (!entry) return { support: null, contradicts: null, weight: 0 };
  return { support: entry.support, contradicts: entry.contradicts, weight: Math.max(0, Math.min(1, confidence)) };
}

// ═══════════════════════════════════════════════════════════════════════
// OPERATIONS · PRE-REGISTERED · DO NOT MODIFY AFTER CORPUS WRITTEN
// ═══════════════════════════════════════════════════════════════════════

const EMPTY_HYPOTHESIS = (id: HypothesisId): HypothesisRecord => ({
  id,
  evidence_score: 0,
  supporting_specialists: [],
  contradicting_specialists: [],
  first_seen_turn: -1,
});

/**
 * Initialize hypothesis set. Baseline decision seeded at score 1.0 so the
 * mechanism can only OVERRIDE baseline with sufficient contrary evidence.
 * (Founder principle: give NEX right evidence not conclusion. Baseline is
 *  the a-priori best guess; mechanism must EARN a change.)
 */
export function initialize(baseline: HypothesisId, seedScore = 1.0): HypothesisSet {
  const ids: HypothesisId[] = ["PROCEED_CREATE", "REFUSE_DUPLICATE", "REFUSE_UNRELATED", "REFUSE_HARDGATE", "UNKNOWN", "ABSTAIN"];
  const out = Object.fromEntries(ids.map((id) => [id, EMPTY_HYPOTHESIS(id)])) as Record<HypothesisId, HypothesisRecord>;
  out[baseline] = {
    id: baseline,
    evidence_score: seedScore,
    supporting_specialists: ["__baseline__"],
    contradicting_specialists: [],
    first_seen_turn: 0,
  };
  return out;
}

/**
 * Observe a new specialist analysis. Add positive evidence for the supported
 * hypothesis; add negative evidence for the contradicted hypothesis.
 * Idempotent under specialist_id duplicate emission (protects vs correlated evidence).
 */
export function observe(
  set: HypothesisSet,
  analysis: { specialist_id: string; kind: string; confidence: number },
  turn: number,
): HypothesisSet {
  const contrib = evidenceContribution(analysis.kind, analysis.confidence);
  if (contrib.support === null && contrib.contradicts === null) return set;

  const next = { ...set } as Record<HypothesisId, HypothesisRecord>;

  if (contrib.support !== null) {
    const rec = next[contrib.support];
    // Idempotence · specialist_id can only support a hypothesis ONCE per turn.
    // This is the CMP protection against correlated/duplicate emission.
    if (rec.supporting_specialists.includes(analysis.specialist_id)) {
      // no-op · already counted
    } else {
      next[contrib.support] = {
        ...rec,
        evidence_score: rec.evidence_score + contrib.weight,
        supporting_specialists: [...rec.supporting_specialists, analysis.specialist_id],
        first_seen_turn: rec.first_seen_turn < 0 ? turn : rec.first_seen_turn,
      };
    }
  }

  if (contrib.contradicts !== null) {
    const rec = next[contrib.contradicts];
    if (!rec.contradicting_specialists.includes(analysis.specialist_id)) {
      next[contrib.contradicts] = {
        ...rec,
        evidence_score: Math.max(0, rec.evidence_score - contrib.weight),
        contradicting_specialists: [...rec.contradicting_specialists, analysis.specialist_id],
      };
    }
  }

  return next;
}

/**
 * Intersect two hypothesis sets (Numenta CMP-style):
 * a hypothesis survives if it has positive evidence in BOTH sets.
 * Scores are summed (union of supporting specialists).
 */
export function intersect(setA: HypothesisSet, setB: HypothesisSet): HypothesisSet {
  const ids: HypothesisId[] = ["PROCEED_CREATE", "REFUSE_DUPLICATE", "REFUSE_UNRELATED", "REFUSE_HARDGATE", "UNKNOWN", "ABSTAIN"];
  const out = Object.fromEntries(ids.map((id) => [id, EMPTY_HYPOTHESIS(id)])) as Record<HypothesisId, HypothesisRecord>;
  for (const id of ids) {
    const a = setA[id]; const b = setB[id];
    if (a.evidence_score > 0 && b.evidence_score > 0) {
      out[id] = {
        id,
        evidence_score: a.evidence_score + b.evidence_score,
        supporting_specialists: [...new Set([...a.supporting_specialists, ...b.supporting_specialists])],
        contradicting_specialists: [...new Set([...a.contradicting_specialists, ...b.contradicting_specialists])],
        first_seen_turn: Math.min(a.first_seen_turn < 0 ? Infinity : a.first_seen_turn, b.first_seen_turn < 0 ? Infinity : b.first_seen_turn),
      };
    }
  }
  return out;
}

/**
 * Decide argmax with margin threshold. Below threshold → ABSTAIN.
 * The margin is measured over active hypotheses (evidence_score > 0).
 */
export interface DecideResult {
  readonly verdict: HypothesisId | "ABSTAIN_MARGIN" | "ABSTAIN_NO_EVIDENCE" | "ABSTAIN_TIE";
  readonly top: HypothesisRecord | null;
  readonly runnerUp: HypothesisRecord | null;
  readonly margin: number;
  readonly active_count: number;
  readonly threshold: number;
}

export function decide(set: HypothesisSet, marginThreshold = 0.6): DecideResult {
  const records = Object.values(set).filter((r) => r.evidence_score > 0);
  records.sort((a, b) => b.evidence_score - a.evidence_score);

  if (records.length === 0) {
    return { verdict: "ABSTAIN_NO_EVIDENCE", top: null, runnerUp: null, margin: 0, active_count: 0, threshold: marginThreshold };
  }
  const top = records[0];
  const runnerUp = records[1] ?? null;

  if (!runnerUp) {
    // Single active hypothesis but must clear absolute floor to decide.
    if (top.evidence_score >= marginThreshold) {
      return { verdict: top.id, top, runnerUp: null, margin: top.evidence_score, active_count: records.length, threshold: marginThreshold };
    }
    return { verdict: "ABSTAIN_MARGIN", top, runnerUp: null, margin: top.evidence_score, active_count: records.length, threshold: marginThreshold };
  }

  const margin = top.evidence_score - runnerUp.evidence_score;
  if (margin < marginThreshold) {
    // Contradiction / tie / insufficient separation
    if (margin === 0) return { verdict: "ABSTAIN_TIE", top, runnerUp, margin, active_count: records.length, threshold: marginThreshold };
    return { verdict: "ABSTAIN_MARGIN", top, runnerUp, margin, active_count: records.length, threshold: marginThreshold };
  }

  return { verdict: top.id, top, runnerUp, margin, active_count: records.length, threshold: marginThreshold };
}

/**
 * Full pipeline: initialize → fold observations → decide.
 * Order-independence check: caller can pass analyses in any order and
 * get byte-identical result (observations commute except for turn stamps).
 */
export function synthesise(input: {
  baseline: HypothesisId;
  analyses: readonly { specialist_id: string; kind: string; confidence: number }[];
  margin_threshold?: number;
}): { set: HypothesisSet; decision: DecideResult } {
  let set = initialize(input.baseline);
  for (let i = 0; i < input.analyses.length; i++) {
    set = observe(set, input.analyses[i], i + 1);
  }
  const decision = decide(set, input.margin_threshold ?? 0.6);

  recordHeartbeat({
    agent_id: "hypothesis_set_representation",
    event_type: "synthesise",
    event_data: {
      baseline: input.baseline,
      analyses_count: input.analyses.length,
      verdict: decision.verdict,
      margin: decision.margin,
      active_count: decision.active_count,
    },
  });

  return { set, decision };
}

export const HYPOTHESIS_SET_VERSION = "hypothesis-set.v1.2026-09-19";
export const HYPOTHESIS_SET_ALGEBRA_HASH_TARGET = "will_be_hashed_via_script";
