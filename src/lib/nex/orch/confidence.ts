// Confidence engine — rollup + conflict resolution.
//
// The ensemble collects N agent replies. Two questions arise:
//   1. What's the *overall* confidence for the merchant-facing reply?
//   2. When two agents contradict each other, which do we prefer?
//
// Rules — deliberately simple, deterministic, explainable:
//   - Overall confidence = min of contributing confidences, unless
//     ≥2 agents agree at "medium"+ in which case one step higher.
//   - Official (regulations family) always beats general knowledge.
//   - Higher confidence beats lower confidence.
//   - Same-tier, non-official ties = both cited with "sources disagree".

import type { AgentResult } from "./types";

export type Confidence = "low" | "medium" | "high";

const RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

export function rankConfidence(c: Confidence): number { return RANK[c]; }

export function stepUp(c: Confidence): Confidence {
  if (c === "low") return "medium";
  if (c === "medium") return "high";
  return "high";
}

export function stepDown(c: Confidence): Confidence {
  if (c === "high") return "medium";
  if (c === "medium") return "low";
  return "low";
}

/** Roll up N agent confidences into ONE. */
export function rollupConfidence(results: AgentResult[]): Confidence {
  const usable = results.filter((r) => !r.error);
  if (usable.length === 0) return "low";
  const min = usable.map((r) => RANK[r.confidence]).reduce((a, b) => Math.min(a, b), 3);
  const base: Confidence = min === 3 ? "high" : min === 2 ? "medium" : "low";
  // Bonus: ≥2 agents ≥medium + at least one official → step up one.
  const mediumOrHigher = usable.filter((r) => RANK[r.confidence] >= 2).length;
  const hasOfficial    = usable.some((r) => r.is_official);
  if (mediumOrHigher >= 2 && hasOfficial) return stepUp(base);
  return base;
}

// ─── Conflict resolution ────────────────────────────────────────

export type Conflict = {
  a: AgentResult;
  b: AgentResult;
  reason: string;
};

/** Very simple heuristic — a conflict is flagged when two agents both
 *  produce a non-error `speak` AND their headlines contain contradicting
 *  polarity markers (e.g. "yes / no", "safe / unsafe", "approved /
 *  refused"). This is intentionally conservative — we surface possible
 *  conflicts rather than silently pick a winner. */
const POLARITY_PAIRS: Array<[RegExp, RegExp]> = [
  [/\byes\b/i,      /\bno\b/i],
  [/\bsafe\b/i,     /\bunsafe\b|\bnot safe\b/i],
  [/\bapproved\b/i, /\brefused\b|\bnot approved\b/i],
  [/\bpositive\b/i, /\bnegative\b/i],
  [/\brecommend\b/i,/\bdo not recommend\b|\bnot recommended\b/i],
  [/\ballowed\b/i,  /\bnot allowed\b|\bprohibited\b/i]
];

export function detectConflicts(results: AgentResult[]): Conflict[] {
  const usable = results.filter((r) => !r.error && r.headline);
  const conflicts: Conflict[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i]!;
      const b = usable[j]!;
      for (const [posA, posB] of POLARITY_PAIRS) {
        if (posA.test(a.headline) && posB.test(b.headline)) {
          conflicts.push({ a, b, reason: `${a.agent_id} says one thing, ${b.agent_id} another` });
          break;
        }
        if (posB.test(a.headline) && posA.test(b.headline)) {
          conflicts.push({ a, b, reason: `${a.agent_id} says one thing, ${b.agent_id} another` });
          break;
        }
      }
    }
  }
  return conflicts;
}

/** Given a conflict pair, return the preferred result + why. Official
 *  regulations beat general knowledge; higher confidence beats lower;
 *  otherwise the tie is preserved and both are surfaced. */
export function resolveConflict(conflict: Conflict): {
  preferred: AgentResult | null;
  runner_up: AgentResult | null;
  reason:    string;
  is_tie:    boolean;
} {
  const { a, b } = conflict;
  if (a.is_official && !b.is_official) {
    return { preferred: a, runner_up: b, reason: `${a.agent_id} cites official guidance`, is_tie: false };
  }
  if (b.is_official && !a.is_official) {
    return { preferred: b, runner_up: a, reason: `${b.agent_id} cites official guidance`, is_tie: false };
  }
  const ra = RANK[a.confidence];
  const rb = RANK[b.confidence];
  if (ra > rb) return { preferred: a, runner_up: b, reason: `${a.agent_id} has higher confidence`, is_tie: false };
  if (rb > ra) return { preferred: b, runner_up: a, reason: `${b.agent_id} has higher confidence`, is_tie: false };
  return {
    preferred: null, runner_up: null,
    reason: `${a.agent_id} and ${b.agent_id} disagree at the same confidence — surfacing both`,
    is_tie: true
  };
}
