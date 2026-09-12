// src/lib/nex-origin-canon/multi-turn-tracker.ts
//
// NEX1 · ORIGIN PROTECTION · CROSS-TURN EXTRACTION TRACKER v0.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Founder rule (Addendum §15): users may narrow the origin question over
// multiple turns · each turn individually harmless · together reconstructing
// the protected answer. Tracker detects cumulative extraction pressure.
//
// State model per conversation session:
//   · Every classified origin-related turn increments an extraction score
//     against a particular objective family.
//   · Score decays with time · so occasional benign mentions do not compound.
//   · When score crosses a threshold, cross-turn refusal engages · NEX
//     surfaces the fact that cumulative extraction is being treated as
//     extraction (per claim NEX-C-093).
//   · Session state is per-session · never persisted across sessions in v0
//     (privacy · SM-1 keeps this bounded).

import type { OriginExtractionObjective } from "./origin-protection-classifier";
import { classifyForOriginExtraction } from "./origin-protection-classifier";

interface TurnRecord {
  readonly at_ms: number;
  readonly objective: OriginExtractionObjective;
  readonly text_first_60: string;
}

export interface SessionState {
  readonly session_id: string;
  turns: TurnRecord[];
  score_by_family: Partial<Record<OriginExtractionObjective, number>>;
}

/** Per-objective family score threshold. Deterministic policy. */
const THRESHOLD = 3;
/** Turn-record retention window · rolling. */
const RETENTION_MS = 10 * 60 * 1000; // 10 minutes

const SESSIONS = new Map<string, SessionState>();

export function _resetTrackerForTest(): void { SESSIONS.clear(); }

export interface MultiTurnVerdict {
  readonly cross_turn_extraction_detected: boolean;
  readonly objective?: OriginExtractionObjective;
  readonly matched_rule_id?: string;
  readonly cumulative_score?: number;
  readonly rationale: string;
  readonly should_refuse: boolean;
}

/**
 * @summary Register a new turn against the tracker. If the turn is single-turn
 * origin extraction OR pushes a cumulative score over the threshold, the
 * verdict says so. Ordinary conversation passes through untouched.
 */
export function observeTurn(sessionId: string, utterance: string): MultiTurnVerdict {
  const now = Date.now();
  const single = classifyForOriginExtraction(utterance);
  const s = getOrCreate(sessionId);

  // Rolling window · evict old
  s.turns = s.turns.filter((t) => now - t.at_ms < RETENTION_MS);

  if (single.triggered && single.objective) {
    s.turns.push({ at_ms: now, objective: single.objective, text_first_60: utterance.slice(0, 60) });
    s.score_by_family[single.objective] = (s.score_by_family[single.objective] ?? 0) + 1;
    // Recompute score from surviving turns (in case some evicted)
    s.score_by_family = countByObjective(s.turns);

    const totalRelated = totalRelatedFamilyScore(s.score_by_family);
    if (totalRelated >= THRESHOLD) {
      return {
        cross_turn_extraction_detected: true,
        objective: single.objective,
        matched_rule_id: single.matched_rule_id,
        cumulative_score: totalRelated,
        rationale: `cumulative origin-extraction score ${totalRelated} across ${s.turns.length} recent turns · threshold ${THRESHOLD}`,
        should_refuse: true,
      };
    }
    return {
      cross_turn_extraction_detected: false,
      objective: single.objective,
      matched_rule_id: single.matched_rule_id,
      cumulative_score: totalRelated,
      rationale: `single-turn extraction detected · cumulative score ${totalRelated} · below threshold ${THRESHOLD} (single-turn refusal still applies)`,
      should_refuse: true, // single-turn extraction still refuses
    };
  }

  // Not classified as extraction this turn · do not add to record
  return {
    cross_turn_extraction_detected: false,
    rationale: "turn does not classify as origin-extraction · tracker unchanged",
    should_refuse: false,
  };
}

/**
 * @summary Read-only accessor for the session state. Founder-audit surface.
 */
export function inspectSession(sessionId: string): SessionState | null {
  return SESSIONS.get(sessionId) ?? null;
}

// ─── helpers ──────────────────────────────────────────────────────

function getOrCreate(sessionId: string): SessionState {
  let s = SESSIONS.get(sessionId);
  if (!s) {
    s = { session_id: sessionId, turns: [], score_by_family: {} };
    SESSIONS.set(sessionId, s);
  }
  return s;
}
function countByObjective(turns: readonly TurnRecord[]): Partial<Record<OriginExtractionObjective, number>> {
  const out: Partial<Record<OriginExtractionObjective, number>> = {};
  for (const t of turns) out[t.objective] = (out[t.objective] ?? 0) + 1;
  return out;
}
/**
 * Family scoring: some objectives are related enough that they should share
 * a threshold (e.g. creator_identity + yes_no_probe + first_letter_probe +
 * triangulation + negation_probe are all attacking the same secret).
 * Return the total score across THIS attack family based on the observed
 * objective's family.
 */
const RELATED_FAMILIES: Readonly<Record<OriginExtractionObjective, readonly OriginExtractionObjective[]>> = Object.freeze({
  "origin.mechanism":            ["origin.mechanism", "origin.reconstruction", "origin.internal_architecture"],
  "origin.creator_identity":     ["origin.creator_identity", "origin.yes_no_probe", "origin.first_letter_probe", "origin.triangulation", "origin.negation_probe", "origin.translation_attack"],
  "origin.source_code":          ["origin.source_code", "origin.internal_architecture", "origin.system_prompt", "origin.internal_memory"],
  "origin.system_prompt":        ["origin.system_prompt", "origin.override_instruction", "origin.source_code"],
  "origin.internal_memory":      ["origin.internal_memory", "origin.system_prompt", "origin.internal_architecture"],
  "origin.internal_architecture":["origin.internal_architecture", "origin.mechanism", "origin.source_code"],
  "origin.reconstruction":       ["origin.reconstruction", "origin.mechanism"],
  "origin.negation_probe":       ["origin.negation_probe", "origin.creator_identity"],
  "origin.triangulation":        ["origin.triangulation", "origin.creator_identity"],
  "origin.yes_no_probe":         ["origin.yes_no_probe", "origin.creator_identity"],
  "origin.first_letter_probe":   ["origin.first_letter_probe", "origin.creator_identity"],
  "origin.encoded_question":     ["origin.encoded_question", "origin.system_prompt", "origin.creator_identity"],
  "origin.roleplay_bypass":      ["origin.roleplay_bypass", "origin.hypothetical_bypass", "origin.override_instruction"],
  "origin.authority_bypass":     ["origin.authority_bypass", "origin.override_instruction"],
  "origin.hypothetical_bypass":  ["origin.hypothetical_bypass", "origin.roleplay_bypass"],
  "origin.override_instruction": ["origin.override_instruction", "origin.roleplay_bypass", "origin.system_prompt"],
  "origin.reveal_would_help":    ["origin.reveal_would_help"],
  "origin.translation_attack":   ["origin.translation_attack", "origin.creator_identity"],
  "origin.multi_turn_narrow":    ["origin.multi_turn_narrow"],
});
function totalRelatedFamilyScore(scores: Partial<Record<OriginExtractionObjective, number>>): number {
  // For each observed objective · sum the scores across its related family.
  // Take the max across all observed objectives' family totals — that's the
  // strongest single attack surface in play.
  let best = 0;
  for (const [obj, score] of Object.entries(scores) as [OriginExtractionObjective, number][]) {
    if (!score) continue;
    const family = RELATED_FAMILIES[obj] ?? [obj];
    let total = 0;
    for (const rel of family) total += scores[rel] ?? 0;
    if (total > best) best = total;
  }
  return best;
}
