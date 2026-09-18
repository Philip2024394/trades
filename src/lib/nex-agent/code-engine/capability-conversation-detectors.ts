// src/lib/nex-agent/code-engine/capability-conversation-detectors.ts
//
// NEX1 · C10 Phase 2 · Natural-language pattern detectors · 2026-09-17.
// Founder-authorised via frontier §17 queue after C10 Phase 1.
//
// PURPOSE
//   Deterministic regex-based extractors that spot founder preferences +
//   corrections inside a plain-language prompt. Zero LLM · zero fuzzy match.
//   Callers feed the detector output into `capability-conversation-graph`
//   mutators.
//
// PATTERNS
//   PREFERENCE  · "always X"     · "never X"
//                · "prefer X to Y" · "prefer X over Y"
//                · "use X not Y" · "use X instead of Y"
//                · "X, not Y"    · "X (not Y)"
//   CORRECTION  · "no, do X instead"
//                · "not Y, X"    · "actually X, not Y"
//                · "make it X, not Y" · "should be X, not Y"
//                · "wrong · X"
//
// Scope: deterministic natural-English. Non-English or heavily stylised
// input returns null · caller falls through to the existing pipeline.

export interface DetectedPreference {
  readonly kind: "always" | "never" | "prefer_over" | "use_not";
  readonly value: string;
  readonly alt_value: string | null;    // the rejected side (for prefer_over / use_not)
  readonly matched_snippet: string;
  readonly source_pattern: string;
}

export interface DetectedCorrection {
  readonly kind: "not_x_y" | "actually_x_not_y" | "no_do_x" | "should_be_x_not_y";
  readonly from_value: string | null;   // the wrong side, if identifiable
  readonly to_value: string;
  readonly matched_snippet: string;
  readonly source_pattern: string;
}

// ── Preference patterns ────────────────────────────────────────────────

interface PatternDef {
  readonly re: RegExp;
  readonly name: string;
  readonly kind: DetectedPreference["kind"];
  readonly value_group: number;
  readonly alt_group: number | null;
}

// Character class · code-identifier-friendly. Dot allowed (Math.max, foo.bar);
// only structural punctuation and newlines terminate a value. Length-capped
// with lazy quantifier so the shortest reasonable value wins.
const VAL = "[^,;!?\\r\\n]";

const PREF_PATTERNS: readonly PatternDef[] = [
  // "always use X not Y" · "always prefer X over Y"
  { re: new RegExp(`\\balways\\s+(?:use|prefer|do|write|pick|choose)\\s+(${VAL}{2,80}?)(?:\\s+(?:not|instead of|over)\\s+(${VAL}{2,80}?))?(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "always_x_not_y", kind: "always", value_group: 1, alt_group: 2 },
  // "always X" · standalone directive
  { re: new RegExp(`\\balways\\s+([a-z]${VAL}{1,60}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "always_x", kind: "always", value_group: 1, alt_group: null },
  // "never use X" · "never do X"
  { re: new RegExp(`\\bnever\\s+(?:use|do|write|pick|choose)\\s+(${VAL}{2,80}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "never_x", kind: "never", value_group: 1, alt_group: null },
  // "prefer X to Y" · "prefer X over Y"
  { re: new RegExp(`\\bprefer\\s+(${VAL}{2,80}?)\\s+(?:to|over)\\s+(${VAL}{2,80}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "prefer_x_over_y", kind: "prefer_over", value_group: 1, alt_group: 2 },
  // "use X not Y" · "use X instead of Y"
  { re: new RegExp(`\\buse\\s+(${VAL}{2,80}?)\\s+(?:not|instead of)\\s+(${VAL}{2,80}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "use_x_not_y", kind: "use_not", value_group: 1, alt_group: 2 },
];

function trimVal(v: string): string {
  return v.replace(/\s+/g, " ").trim().replace(/^["'`]+|["'`]+$/g, "");
}

/**
 * Detect the FIRST preference pattern that matches in the message.
 * Returns null if none match. Deterministic · first-pattern-wins.
 */
export function detectPreference(message: string): DetectedPreference | null {
  if (!message || message.length < 5) return null;
  for (const p of PREF_PATTERNS) {
    const m = message.match(p.re);
    if (m) {
      const value = trimVal(m[p.value_group] ?? "");
      const alt = p.alt_group !== null ? trimVal(m[p.alt_group] ?? "") : "";
      if (!value || value.length < 2 || value.length > 120) continue;
      // Filter obvious noise · a preference must contain a coding-adjacent
      // signal (a symbol, function name, or a term > 3 chars).
      if (!/[a-z_$@.()/]{3}/i.test(value)) continue;
      return {
        kind: p.kind,
        value,
        alt_value: alt || null,
        matched_snippet: m[0],
        source_pattern: p.name,
      };
    }
  }
  return null;
}

// ── Correction patterns ────────────────────────────────────────────────

interface CorrPatternDef {
  readonly re: RegExp;
  readonly name: string;
  readonly kind: DetectedCorrection["kind"];
  readonly to_group: number;
  readonly from_group: number | null;
}

const CORR_PATTERNS: readonly CorrPatternDef[] = [
  // "actually X, not Y" · "actually it's X not Y" · "actually use X, not Y"
  { re: new RegExp(`\\bactually\\s+(?:it'?s\\s+|use\\s+|do\\s+)?(${VAL}{2,80}?)\\s*,?\\s*not\\s+(${VAL}{2,80}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "actually_x_not_y", kind: "actually_x_not_y", to_group: 1, from_group: 2 },
  // "should be X, not Y"
  { re: new RegExp(`\\bshould\\s+be\\s+(${VAL}{2,80}?)\\s*,?\\s*not\\s+(${VAL}{2,80}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "should_be_x_not_y", kind: "should_be_x_not_y", to_group: 1, from_group: 2 },
  // "no, do X instead"
  { re: new RegExp(`\\bno[,.]?\\s+do\\s+(${VAL}{2,80}?)(?:\\s+instead)?(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "no_do_x", kind: "no_do_x", to_group: 1, from_group: null },
  // "not X, Y" · placed AFTER other patterns so more-specific corrective
  // patterns win first. Value class allows periods for code identifiers.
  { re: new RegExp(`\\bnot\\s+(${VAL}{2,60}?)\\s*[,·]\\s*(${VAL}{2,60}?)(?:[,;!?]|\\.\\s|$)`, "i"),
    name: "not_x_y", kind: "not_x_y", to_group: 2, from_group: 1 },
];

export function detectCorrection(message: string): DetectedCorrection | null {
  if (!message || message.length < 5) return null;
  for (const p of CORR_PATTERNS) {
    const m = message.match(p.re);
    if (m) {
      const to = trimVal(m[p.to_group] ?? "");
      const from = p.from_group !== null ? trimVal(m[p.from_group] ?? "") : "";
      if (!to || to.length < 2 || to.length > 120) continue;
      // Distinguish from a preference: correction requires an explicit
      // corrective word ("actually", "no,", "should be", or a "not X, Y"
      // shape). That's the pattern selection · already enforced.
      return {
        kind: p.kind,
        from_value: from || null,
        to_value: to,
        matched_snippet: m[0],
        source_pattern: p.name,
      };
    }
  }
  return null;
}
