// src/lib/nex-agent/code-engine/capability-conversation-intents.ts
//
// NEX1 · CONVERSATION INTENT DETECTORS · deterministic · zero LLM.
// Founder-authorised 2026-09-17.
//
// Extracts structural conversation intents that are NOT covered by the
// Capability-A verb classifier: bindings, recall queries, thread control.
// Every pattern is a general natural-language form · zero test-specific
// hardcoding.
//
// Detectors:
//   · detectBindIntent    · "let's call X Y", "we'll refer to X as Y",
//                          "let's name X Y", "call the X Y" etc.
//   · detectRecallIntent  · "what did I call X?", "what did we decide?",
//                          "did it work?", "what changed?", "what did you find?"
//   · detectThreadIntent  · "let's leave that", "go back to X",
//                          "change the subject", "back to the pricing issue"

// ── Bind intent ─────────────────────────────────────────────────────────

export type BindingKindHint = "entity" | "phrase" | "code_identifier" | "file" | "concept";

export interface DetectedBinding {
  readonly name: string;
  readonly kind_hint: BindingKindHint;
  readonly reference_hint: string | null;
  readonly evidence: string;
}

/** Deterministic patterns for introducing a binding.
 *  All patterns are natural English constructions · zero task-specific tokens. */
// § Kind hint · deterministic dictionary of anchor nouns → binding kind.
// These do NOT hardcode test-specific names · they map general English nouns
// like "component" / "file" / "function" / "phrase" onto BindingKind slots so
// later references can be resolved by semantic-kind rather than literal name.
export const KIND_ANCHOR: ReadonlyMap<string, BindingKindHint> = new Map([
  ["component", "entity"], ["module", "entity"], ["project", "entity"], ["panel", "entity"],
  ["screen", "entity"], ["view", "entity"], ["page", "entity"], ["workspace", "entity"],
  ["frame", "entity"], ["shell", "entity"],
  ["file", "file"], ["source", "file"], ["module", "file"],
  ["function", "code_identifier"], ["method", "code_identifier"], ["helper", "code_identifier"],
  ["variable", "code_identifier"], ["constant", "code_identifier"], ["type", "code_identifier"],
  ["interface", "code_identifier"], ["class", "code_identifier"], ["hook", "code_identifier"],
  ["route", "code_identifier"], ["api", "code_identifier"], ["endpoint", "code_identifier"],
  ["phrase", "phrase"], ["term", "phrase"], ["expression", "phrase"], ["case", "phrase"],
  ["path", "phrase"], ["approach", "concept"], ["decision", "concept"], ["idea", "concept"],
  ["problem", "concept"], ["issue", "concept"],
]);

const BIND_PATTERNS: readonly {
  readonly re: RegExp;
  readonly nameGroup: number;
  readonly refGroup: number | null;
  readonly kind: BindingKindHint;
}[] = [
  // "let's call the customer panel CustomerPanel"
  // "let's call the fallback path the zero case"
  //   → nameGroup captures either a PascalCase identifier OR "the X" phrase
  {
    re: /(?:let(?:'s|s|\s+us)?\s+)call\s+(?:it|this|the\s+([a-zA-Z][\w\s\-]{1,60}?))\s+(?:(?:the\s+)?([a-z][a-z\s]{2,40}?)\s*$|([A-Z][A-Za-z0-9_]+))/i,
    nameGroup: 4,
    refGroup: 1,
    kind: "entity",
  },
  // Phrase-form: "let's call ... the zero case"
  {
    re: /(?:let(?:'s|s|\s+us)?\s+)call\s+(?:it|this|the\s+([a-zA-Z][\w\s\-]{1,60}?))\s+the\s+([a-z][a-z\s]{2,30})\.?$/i,
    nameGroup: 2,
    refGroup: 1,
    kind: "phrase",
  },
  // "we'll refer to the customer panel as CustomerPanel"
  {
    re: /(?:we(?:'ll|\s+will)|i(?:'ll|\s+will)|let(?:'s|s)\s+)?refer\s+to\s+(?:it|this|the\s+([a-zA-Z][\w\s\-]{1,60}?))\s+as\s+([A-Z][A-Za-z0-9_]+|[a-z][A-Za-z0-9_]+)\b/i,
    nameGroup: 2,
    refGroup: 1,
    kind: "entity",
  },
  // "Remember CustomerPanel." · imperative bind · requires the name to be a
  // proper-noun-looking identifier (has uppercase letter, min length 4).
  {
    re: /^remember\s+([A-Z][A-Za-z0-9_]{3,}|[A-Z][A-Za-z0-9_]*\.tsx?|[a-z][A-Za-z0-9_]*\.tsx?)\b/i,
    nameGroup: 1,
    refGroup: null,
    kind: "entity",
  },
];

/** File-reference regex (safe: won't match ordinary English words). */
const FILE_REF_RE = /\b([\w/.\-@]+\.[jt]sx?)\b/g;

/** Code-identifier regex · matches typical camelCase or PascalCase.
 *  Requires at least one lower→upper transition to avoid ordinary sentences. */
const CODE_IDENT_RE = /\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*|[A-Z][a-zA-Z0-9]*[A-Z][a-z][a-zA-Z0-9]*)\b/g;

/** Extract every BIND intent found in the message. Deterministic ordering
 *  by first-match position. */
export function detectBindIntent(message: string): readonly DetectedBinding[] {
  const found: DetectedBinding[] = [];
  const seen = new Set<string>();

  for (const p of BIND_PATTERNS) {
    const m = p.re.exec(message);
    if (!m) continue;
    const name = (m[p.nameGroup] ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const referenceHint = p.refGroup !== null ? (m[p.refGroup] ?? "").trim() || null : null;
    found.push({
      name,
      kind_hint: p.kind,
      reference_hint: referenceHint,
      evidence: m[0].slice(0, 160),
    });
  }

  // Also capture standalone code identifiers and file references introduced
  // in the message as latent bindings. These are only recorded when the
  // rest of the sentence has an introduction verb (avoids polluting the
  // binding table with every mention).
  const INTRO_HINTS = /\b(there(?:'s|\s+is)|introducing|adding|calling|naming|creating|new\s+file|new\s+function|new\s+component|use\s+the|the\s+function|the\s+file)\b/i;
  if (INTRO_HINTS.test(message)) {
    let fm: RegExpExecArray | null;
    FILE_REF_RE.lastIndex = 0;
    while ((fm = FILE_REF_RE.exec(message)) !== null) {
      const name = fm[1];
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      found.push({ name, kind_hint: "file", reference_hint: name, evidence: fm[0] });
    }
    CODE_IDENT_RE.lastIndex = 0;
    while ((fm = CODE_IDENT_RE.exec(message)) !== null) {
      const name = fm[1];
      if (name.length < 3) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      found.push({ name, kind_hint: "code_identifier", reference_hint: null, evidence: fm[0] });
    }
  }

  return found;
}

// ── Recall intent ──────────────────────────────────────────────────────

export type RecallKind =
  | "what_did_i_call"       // recall a binding by prompt
  | "what_did_we_decide"    // recall active thread's decisions
  | "did_it_work"           // recall last verification
  | "what_changed"          // recall last mutation
  | "what_did_you_find"     // recall last findings
  | "which_file"            // recall the modified/investigated file · Batch 1 Final Closure 2026-09-17
  | "which_function"        // recall the modified function · Batch 1 Final Closure 2026-09-17
  | "what_was_the_first"    // early-turn recall
  | "what_was_the_original";// original-problem recall

export interface DetectedRecall {
  readonly kind: RecallKind;
  readonly subject: string | null;  // e.g. "that function", "the customer panel"
  readonly evidence: string;
}

const RECALL_PATTERNS: readonly { readonly re: RegExp; readonly kind: RecallKind; readonly subjectGroup: number | null }[] = [
  { re: /what did (?:i|we) call (?:that|the|this)?\s*([a-z][\w\s]{1,40})?\??/i, kind: "what_did_i_call", subjectGroup: 1 },
  { re: /what did we decide(?:\s+about\s+([a-z][\w\s]{1,40}))?/i, kind: "what_did_we_decide", subjectGroup: 1 },
  { re: /did (?:it|the change|the fix) (?:actually\s+)?work\??/i, kind: "did_it_work", subjectGroup: null },
  // 2026-09-17 · continuous-learning session · natural user phrasing observed:
  // "Did the test pass?" · "Did the tests pass?" · "Did vitest pass?" ·
  // "Did the build pass?" · "Did it succeed?" · "Was it successful?"
  // These are semantically equivalent to "did it work" · all recall the
  // last verification record. Vocabulary extension only · zero logic change.
  { re: /did\s+(?:the\s+)?(?:tests?|vitest|build)\s+(?:actually\s+)?pass\??/i, kind: "did_it_work", subjectGroup: null },
  { re: /did\s+(?:it|the\s+(?:change|fix|code|test|tests))\s+(?:actually\s+)?(?:pass|succeed)\??/i, kind: "did_it_work", subjectGroup: null },
  { re: /was\s+(?:it|the\s+(?:change|fix|test|attempt))\s+(?:actually\s+)?successful\??/i, kind: "did_it_work", subjectGroup: null },
  { re: /what changed\??/i, kind: "what_changed", subjectGroup: null },
  { re: /what did you find\??/i, kind: "what_did_you_find", subjectGroup: null },
  // Batch 1 Final Closure 2026-09-17 · file / function recall
  { re: /which\s+file\s+(?:did\s+you\s+)?(?:change|modify|edit|update|touch|work on)\??/i, kind: "which_file", subjectGroup: null },
  { re: /what\s+file\s+(?:did\s+you\s+)?(?:change|modify|edit|update|touch|work on)\??/i, kind: "which_file", subjectGroup: null },
  { re: /(?:the\s+)?(?:name\s+of\s+the\s+)?file\s+(?:you|that\s+was)\s+(?:changed|modified|edited|updated)\??/i, kind: "which_file", subjectGroup: null },
  { re: /which\s+(?:function|method)\s+(?:did\s+you\s+)?(?:change|modify|edit|update|touch)\??/i, kind: "which_function", subjectGroup: null },
  { re: /what\s+(?:function|method)\s+(?:did\s+you\s+)?(?:change|modify|edit|update|touch)\??/i, kind: "which_function", subjectGroup: null },
  { re: /what\s+was\s+the\s+function\s+(?:you|that\s+was)\s+(?:changed|modified|edited|updated)\??/i, kind: "which_function", subjectGroup: null },
  { re: /what was the first (?:issue|problem|target|thing) (?:we|i)?\s*(?:discussed|mentioned|talked about)?/i, kind: "what_was_the_first", subjectGroup: null },
  { re: /what was the original (?:issue|problem)/i, kind: "what_was_the_original", subjectGroup: null },
];

export function detectRecallIntent(message: string): DetectedRecall | null {
  for (const p of RECALL_PATTERNS) {
    const m = p.re.exec(message);
    if (m) {
      return {
        kind: p.kind,
        subject: p.subjectGroup !== null ? (m[p.subjectGroup] ?? null)?.trim() ?? null : null,
        evidence: m[0].slice(0, 160),
      };
    }
  }
  return null;
}

// ── Thread intent ──────────────────────────────────────────────────────

export type ThreadIntentKind =
  | "leave_current"        // "let's leave that", "change the subject"
  | "go_back_to"           // "go back to the pricing issue", "return to the frame"
  | "return_to_earlier";   // "back to what we were doing"

export interface DetectedThread {
  readonly kind: ThreadIntentKind;
  readonly subject: string | null;
  readonly evidence: string;
}

const THREAD_PATTERNS: readonly { readonly re: RegExp; readonly kind: ThreadIntentKind; readonly subjectGroup: number | null }[] = [
  { re: /(?:let(?:'s|\s+us)?\s+)?leave (?:that|it|the\s+([a-z][\w\s]{1,40}))(?:\s+for now)?/i, kind: "leave_current", subjectGroup: 1 },
  { re: /change (?:the )?subject(?:\s+for a moment)?/i, kind: "leave_current", subjectGroup: null },
  { re: /(?:let(?:'s|\s+us)?\s+)?(?:go|come)\s+back\s+to\s+(?:the\s+)?([a-z][\w\s]{1,60})/i, kind: "go_back_to", subjectGroup: 1 },
  { re: /return\s+to\s+(?:the\s+)?([a-z][\w\s]{1,60})/i, kind: "go_back_to", subjectGroup: 1 },
  { re: /(?:let(?:'s|\s+us)?\s+)?(?:now\s+)?(?:discuss|talk about)\s+(?:the\s+)?([a-z][\w\s]{1,60})\s+(?:instead|now)?/i, kind: "go_back_to", subjectGroup: 1 },
];

export function detectThreadIntent(message: string): DetectedThread | null {
  for (const p of THREAD_PATTERNS) {
    const m = p.re.exec(message);
    if (m) {
      return {
        kind: p.kind,
        subject: p.subjectGroup !== null ? (m[p.subjectGroup] ?? null)?.trim() ?? null : null,
        evidence: m[0].slice(0, 160),
      };
    }
  }
  return null;
}

// ── Definition-form bindings (§8) ───────────────────────────────────────

/** Deterministic patterns for definitional bindings.
 *
 *   "The zero case means quantity is zero."
 *   "By 'fallback path' I mean the alternative route."
 *   "When I say CustomerPanel, I'm referring to the checkout component."
 *   "The frame means the physical NEX interface shell."
 *
 * Every pattern requires an explicit definition verb (means / is defined as /
 * refers to / I mean). Ordinary sentences like "The user is happy" won't
 * match. */
const DEFINITION_PATTERNS: readonly {
  readonly re: RegExp;
  readonly nameGroup: number;
  readonly refGroup: number;
  readonly kind: BindingKindHint;
}[] = [
  // "The X means Y." · "The zero case means quantity is zero"
  { re: /(?:the|our)\s+([a-z][a-z\s]{2,40}?)\s+means\s+([^.]{4,140})/i, nameGroup: 1, refGroup: 2, kind: "phrase" },
  // "The X is defined as Y."
  { re: /(?:the|our)\s+([a-z][a-z\s]{2,40}?)\s+is\s+defined\s+as\s+([^.]{4,140})/i, nameGroup: 1, refGroup: 2, kind: "phrase" },
  // "By 'X' I mean Y." · "By X we mean Y."
  { re: /by\s+["']?([a-zA-Z][\w\s]{2,40}?)["']?[,]?\s+(?:i|we)\s+mean\s+([^.]{4,140})/i, nameGroup: 1, refGroup: 2, kind: "phrase" },
  // "When I say X, I'm referring to Y."
  { re: /when\s+(?:i|we)\s+say\s+([A-Za-z][\w\s]{2,40}?)\s*,?\s*(?:i(?:'m|\s+am)|we(?:'re|\s+are))\s+referring\s+to\s+([^.]{4,140})/i, nameGroup: 1, refGroup: 2, kind: "entity" },
  // "X refers to Y."
  { re: /(?:the\s+|our\s+)?([a-z][a-z\s]{2,40}?)\s+refers\s+to\s+([^.]{4,140})/i, nameGroup: 1, refGroup: 2, kind: "phrase" },
];

export function detectDefinitionIntent(message: string): readonly DetectedBinding[] {
  const found: DetectedBinding[] = [];
  const seen = new Set<string>();
  for (const p of DEFINITION_PATTERNS) {
    const m = p.re.exec(message);
    if (!m) continue;
    const name = (m[p.nameGroup] ?? "").trim();
    const ref = (m[p.refGroup] ?? "").trim();
    if (!name || !ref) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name, kind_hint: p.kind, reference_hint: ref, evidence: m[0].slice(0, 200) });
  }
  return found;
}

// ── Decision detection (§9) ─────────────────────────────────────────────

export interface DetectedDecision {
  readonly text: string;      // the decision itself · verbatim
  readonly kind: "accept" | "reject" | "defer" | "propose";
  readonly evidence: string;
}

const DECISION_PATTERNS: readonly { readonly re: RegExp; readonly kind: DetectedDecision["kind"]; readonly textGroup: number }[] = [
  // Accept forms
  { re: /(?:let(?:'s|s|\s+us)?\s+)(use|keep|go\s+with|pick|choose|adopt|accept)\s+([^.,!?]{4,120})/i, kind: "accept", textGroup: 2 },
  { re: /we(?:'ll|\s+will|\s+are\s+going\s+to)\s+(use|keep|go\s+with|pick|choose|adopt|accept)\s+([^.,!?]{4,120})/i, kind: "accept", textGroup: 2 },
  { re: /(?:let(?:'s|s|\s+us)?\s+)?(go\s+ahead\s+with)\s+([^.,!?]{4,120})/i, kind: "accept", textGroup: 2 },
  { re: /decided\s+to\s+([^.,!?]{4,140})/i, kind: "accept", textGroup: 1 },
  // Reject forms
  { re: /(?:let(?:'s|s|\s+us)?\s+)?(?:don'?t|do\s+not|reject|drop|avoid|skip|discard)\s+([^.,!?]{4,120})/i, kind: "reject", textGroup: 1 },
  // Defer forms
  { re: /(?:let(?:'s|s|\s+us)?\s+)?(?:defer|postpone|park|table|leave)\s+([^.,!?]{4,120})\s+for\s+now/i, kind: "defer", textGroup: 1 },
  // Propose forms (weaker · marked distinctly)
  { re: /(?:maybe|perhaps|we\s+could|what\s+if\s+we)\s+([^.,!?]{4,140})/i, kind: "propose", textGroup: 1 },
];

export function detectDecisionIntent(message: string): DetectedDecision | null {
  for (const p of DECISION_PATTERNS) {
    const m = p.re.exec(message);
    if (m) {
      return {
        text: (m[p.textGroup] ?? "").trim(),
        kind: p.kind,
        evidence: m[0].slice(0, 200),
      };
    }
  }
  return null;
}

// ── Semantic entity-kind resolution helper (§7) ─────────────────────────

/**
 * Extract an anchor noun from natural-language references such as
 *   "the component we discussed earlier"
 *   "that function"
 *   "the previous file"
 * If the anchor noun is in KIND_ANCHOR, return its associated BindingKindHint.
 * Return null when no anchor is present.
 */
export function extractAnchorKind(message: string): BindingKindHint | null {
  const ANCHOR_RE = /\b(?:that|the|this|our|previous|earlier)\s+([a-z]+)\b/gi;
  let m: RegExpExecArray | null;
  ANCHOR_RE.lastIndex = 0;
  while ((m = ANCHOR_RE.exec(message)) !== null) {
    const anchor = m[1].toLowerCase();
    const kind = KIND_ANCHOR.get(anchor);
    if (kind) return kind;
  }
  return null;
}

// ── Composite scan for chat-turn ────────────────────────────────────────

export interface ConversationIntentScan {
  readonly bindings: readonly DetectedBinding[];
  readonly definitions: readonly DetectedBinding[];
  readonly recall: DetectedRecall | null;
  readonly thread: DetectedThread | null;
  readonly decision: DetectedDecision | null;
  readonly anchor_kind: BindingKindHint | null;
}

export function scanConversationIntents(message: string): ConversationIntentScan {
  return {
    bindings: detectBindIntent(message),
    definitions: detectDefinitionIntent(message),
    recall: detectRecallIntent(message),
    thread: detectThreadIntent(message),
    decision: detectDecisionIntent(message),
    anchor_kind: extractAnchorKind(message),
  };
}
