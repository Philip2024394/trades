// User Identity classifier — token-signal classifier with explicit self-ID priority.
//
// Doctrine: docs/brains/nex-user-identity-brain-philip-2026-08-03.md

import type { IdentityClassification, IdentityRegister } from "./types";

/** Per-register signal vocabularies. Extended over time from real telemetry. */
const REGISTER_SIGNALS: Record<IdentityRegister, string[]> = {
  homeowner_novice: [
    "my home", "our house", "just moved in", "first time", "no idea",
    "not sure", "what should i", "renovate", "renovation", "diy but",
    "we want", "help me choose",
  ],
  homeowner_informed: [
    "researched", "pinterest", "instagram", "we're planning", "looked at",
    "considering between", "compared", "our extension", "our new build",
  ],
  builder: [
    "site", "sub-floor", "first fix", "second fix", "install sequence",
    "tolerances", "materials list", "trades", "plastering", "brickwork",
  ],
  joiner: [
    "joinery", "workshop", "mortise", "tenon", "housed", "rebate",
    "moulding", "spindle", "handrail machining", "cnc", "spray booth",
    "grain direction", "quarter sawn",
  ],
  architect: [
    "plan drawing", "elevation", "specification", "regs", "approved doc",
    "planning application", "building control", "cad", "revit", "bim",
    "structural engineer", "acoustic", "u-value",
  ],
  interior_designer: [
    "mood board", "colour scheme", "palette", "styling", "aesthetic",
    "period property", "heritage", "compatibility", "curated", "styling client",
  ],
  developer: [
    "programme", "phase", "release", "plot", "development", "housebuilder",
    "spec homes", "volume", "per unit", "trade coordination",
  ],
  manufacturer: [
    "production", "batch", "yield", "nesting", "cutting list", "bom",
    "cnc programme", "spray line", "factory", "throughput", "shift",
  ],
  student: [
    "studying", "college", "university", "coursework", "dissertation",
    "learning about", "for my course",
  ],
  diy: [
    "diy", "myself", "weekend project", "youtube", "self-installed",
    "have i got the tools", "step by step", "beginner",
  ],
  business_owner: [
    "my business", "my shop", "my company", "my customers", "my restaurant",
    "my salon", "my cake business", "my bakery", "my clients", "grow my business",
  ],
};

/** Explicit self-identification patterns (highest priority). */
const EXPLICIT_SELF_ID: Array<{ pattern: RegExp; register: IdentityRegister }> = [
  { pattern: /\bi'?m (?:the |a )?homeowner\b/i,        register: "homeowner_informed" },
  { pattern: /\bi'?m (?:the |a )?builder\b/i,          register: "builder" },
  { pattern: /\bi'?m (?:the |a )?joiner\b/i,           register: "joiner" },
  { pattern: /\bi'?m (?:the |a )?carpenter\b/i,        register: "joiner" },
  { pattern: /\bi'?m (?:the |an )?architect\b/i,       register: "architect" },
  { pattern: /\bi'?m (?:the |an )?interior designer\b/i, register: "interior_designer" },
  { pattern: /\bi'?m (?:the |a )?developer\b/i,        register: "developer" },
  { pattern: /\bi'?m (?:the |a )?manufacturer\b/i,     register: "manufacturer" },
  { pattern: /\bi'?m (?:a )?student\b/i,               register: "student" },
  { pattern: /\bi own (?:a |my )?/i,                   register: "business_owner" },
];

function tokenise(s: string): string {
  return s.toLowerCase();
}

function countSignals(input: string, signals: string[]): { hits: number; matched: string[] } {
  const lower = input.toLowerCase();
  let hits = 0;
  const matched: string[] = [];
  for (const sig of signals) {
    if (lower.includes(sig)) {
      hits++;
      matched.push(sig);
    }
  }
  return { hits, matched };
}

export function classifyIdentity(input: string): IdentityClassification {
  const original = input.trim();
  if (!original) {
    return {
      register: "homeowner_novice",
      confidence: 0,
      matched_signals: [],
      original,
      reason: "empty input",
      needs_clarification: true,
    };
  }

  // 1. Explicit self-identification (highest priority · confidence 0.98).
  for (const { pattern, register } of EXPLICIT_SELF_ID) {
    if (pattern.test(original)) {
      return {
        register,
        confidence: 0.98,
        matched_signals: [pattern.source],
        original,
        reason: `explicit self-identification: ${pattern.source}`,
        needs_clarification: false,
      };
    }
  }

  // 2. Signal-vocabulary scoring across all registers.
  const scores: Array<{ register: IdentityRegister; hits: number; matched: string[] }> = [];
  for (const register of Object.keys(REGISTER_SIGNALS) as IdentityRegister[]) {
    const { hits, matched } = countSignals(original, REGISTER_SIGNALS[register]);
    if (hits > 0) scores.push({ register, hits, matched });
  }
  scores.sort((a, b) => b.hits - a.hits);
  const top = scores[0];

  if (top && top.hits >= 2) {
    return {
      register: top.register,
      confidence: Math.min(0.9, 0.5 + top.hits * 0.15),
      matched_signals: top.matched,
      original,
      reason: `matched ${top.hits} signals for register ${top.register}`,
      needs_clarification: false,
    };
  }

  if (top && top.hits === 1) {
    return {
      register: top.register,
      confidence: 0.6,
      matched_signals: top.matched,
      original,
      reason: `matched 1 signal for register ${top.register} — low confidence`,
      needs_clarification: true,
    };
  }

  // 3. No signals matched — default to homeowner_novice + ask clarifying question.
  return {
    register: "homeowner_novice",
    confidence: 0.3,
    matched_signals: [],
    original,
    reason: "no register signals matched · defaulting to homeowner_novice · needs clarification",
    needs_clarification: true,
  };
}
