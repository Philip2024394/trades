// src/lib/nex/brain/confirmation-parser.ts
//
// Stage 3.37 · Confirmation parser (Philip 2026-08-31).
//
// Deterministic bilingual EN + ID interpreter for user responses to a
// proposed mutation action. Three outcomes:
//   · CONFIRM   — explicit "yes, do it" phrasing
//   · DECLINE   — explicit "no, don't" phrasing
//   · AMBIGUOUS — anything else (including "okay", "sure", "fine")
//                 AMBIGUOUS NEVER authorizes. It triggers a
//                 clarification prompt.
//
// CONSTITUTIONAL: never guess authorization. If the phrase isn't in
// the explicit CONFIRM set, do NOT confirm.

export type ConfirmationResult =
  | { kind: "CONFIRM";   phrase: string; language: "en" | "id" }
  | { kind: "DECLINE";   phrase: string; language: "en" | "id" }
  | { kind: "AMBIGUOUS"; reason: string };

// Order matters: DECLINE checked first (so "no, don't send" doesn't
// hit "send" and confirm), then CONFIRM, then AMBIGUOUS fallback.
// Every pattern is anchored to word boundaries so we don't false-match
// inside longer sentences.

const EN_DECLINE_PATTERNS: RegExp[] = [
  /\bno\b/i,
  /\bdon'?t\s+(?:send|do\s+it|message)\b/i,
  /\bdo\s+not\s+(?:send|message|do)\b/i,
  /\bcancel\b/i,
  /\bstop\b/i,
  /\bnot\s+now\b/i,
  /\bnever\s*mind\b/i,
  /\bskip\s+it\b/i,
  /\babort\b/i,
];

const ID_DECLINE_PATTERNS: RegExp[] = [
  /\bjangan\b/i,
  /\bbatal(?:kan)?\b/i,       // batal / batalkan
  /\btidak\s+(?:usah|jadi)\b/i,
  /\bstop\b/i,
];

const EN_CONFIRM_PATTERNS: RegExp[] = [
  /^\s*yes\s*[.!]?\s*$/i,                          // bare "yes"
  /\byes\s*[,.]?\s*(?:send|do|please|go\s+ahead)/i,// yes send it / yes, do it / yes please
  /\bsend\s+it\b/i,
  /\bgo\s+ahead\b/i,
  /\bdo\s+it\b/i,
  /^\s*confirm(?:ed)?\s*[.!]?\s*$/i,               // bare "confirm"
  /\bplease\s+send\b/i,
  /\bplease\s+do\b/i,
  /\bproceed\b/i,
];

const ID_CONFIRM_PATTERNS: RegExp[] = [
  /^\s*iya\s*[.!]?\s*$/i,
  /^\s*ya\s*[.!]?\s*$/i,
  /\biya\s*[,.]?\s*(?:kirim|silakan|tolong)/i,
  /\bkirim\b/i,               // "kirim" bare or with modifiers
  /^\s*silakan\s*[.!]?\s*$/i,
  /\bsilakan\s+kirim\b/i,
  /\btolong\s+kirim\b/i,
  /\blanjut(?:kan)?\b/i,
];

// Explicitly AMBIGUOUS phrases the parser refuses to treat as CONFIRM
// even though a naive keyword match might. Listed for auditability.
const AMBIGUOUS_PATTERNS: RegExp[] = [
  /^\s*(?:okay|ok|okey|k)\s*[.!?]?\s*$/i,
  /^\s*sure\s*[.!?]?\s*$/i,
  /^\s*fine\s*[.!?]?\s*$/i,
  /^\s*maybe\s*[.!?]?\s*$/i,
  /^\s*hmm+\s*[.!?]?\s*$/i,
  /^\s*oke\s*[.!?]?\s*$/i,      // Indonesian "oke" · ambiguous
];

/**
 * Interpret the message as a response to a pending action proposal.
 * Callers must ONLY apply this when a pending proposal exists in the
 * session — otherwise everything is AMBIGUOUS by definition.
 */
export function parseConfirmation(message: string): ConfirmationResult {
  const m = message.trim();
  if (!m) return { kind: "AMBIGUOUS", reason: "empty message" };

  // DECLINE first — "no, don't send" must not fall to a "send" match.
  for (const rx of EN_DECLINE_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { kind: "DECLINE", phrase: hit[0], language: "en" };
  }
  for (const rx of ID_DECLINE_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { kind: "DECLINE", phrase: hit[0], language: "id" };
  }

  // Explicit AMBIGUOUS · refuse to treat "okay" as confirmation.
  for (const rx of AMBIGUOUS_PATTERNS) {
    if (rx.test(m)) {
      return {
        kind: "AMBIGUOUS",
        reason: `phrase matches ambiguous-set (${rx.source}) · not treated as explicit confirmation`,
      };
    }
  }

  // CONFIRM
  for (const rx of EN_CONFIRM_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { kind: "CONFIRM", phrase: hit[0], language: "en" };
  }
  for (const rx of ID_CONFIRM_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { kind: "CONFIRM", phrase: hit[0], language: "id" };
  }

  return {
    kind: "AMBIGUOUS",
    reason: "no explicit confirm/decline pattern matched",
  };
}
