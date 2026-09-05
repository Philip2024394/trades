// src/lib/nex/brain/abandonment-detector.ts
//
// Stage 3.41.k landing #1 · Abandonment detector (Philip 2026-08-31).
// Stage 3.41.l · extended for dangerous-combination vocabulary
//   (bare "cancel" · "udah gak usah" · "jangan jadi") and load-bearing
//   multi-turn conversation replay (food → reference → gak jadi →
//   fresh accommodation search on next turn).
//
// Detects when the user is EXPLICITLY telling NEX to drop the current
// vertical / reference / search — e.g.
//
//   "forget dinner"        · "forget it"          · "forget the hotel"
//   "nevermind"            · "cancel that"        · "scratch that"
//   "lupakan"              · "lupain"             · "gak jadi"
//   "udah gak jadi"        · "batal"              · "batalkan"
//   "udahin aja"           · "cancel aja"
//
// This is called AT THE TOP of the live orchestrator so that abandonment
// wins over vertical keyword routing. Otherwise a message like
// "forget dinner" would still route to food discovery just because it
// contains the word "dinner".
//
// CONSTITUTIONAL invariant (Philip 2026-08-31):
//   abandonment  >  vertical keywords  >  sticky-vertical  >  entity ref
//
//   · Deterministic · no LLM
//   · Detector marks INTENT · caller applies the session reset +
//     produces the acknowledgement · no side effects here
//   · Fail-closed on ambiguous input · never guess

// ─── Negation / non-abandonment guards ──────────────────────────────
//
// Sentences the naive matcher would otherwise mistake for abandonment.
// Applied BEFORE the positive patterns · match = returns { matched: false }.
const NEGATIVE_GUARDS: RegExp[] = [
  /\b(don'?t|do\s+not)\s+forget\b/i,                                     // "don't forget dinner" — reminds, not cancels
  /\bjangan\s+(lupakan|lupain)\b/i,                                      // "jangan lupakan aku" — please remember me
  /\b(gak|nggak|ga|ngga|tidak)\s+jadi\s+(masalah|apa\s*-?\s*apa|soal)\b/i, // "gak jadi masalah" — no problem
  /\b(gak|nggak|ga|ngga|tidak)\s+usah\s+(pusing|khawatir|takut|malu)\b/i,  // "gak usah pusing" — don't worry
  // Corpus R (ride) · 2026-08-31 · compound refinement + auto-action.
  // "Jangan yang unverified driver account, cancel aja." is REFINEMENT
  // (exclude X + auto-cancel any X that appears), NOT goal abandonment.
  // Same shape for other action verbs Philip's corpora surfaced.
  /\bjangan\s+yang\b.*,\s*(cancel|batal(kan|in)?|lupakan|lupain|skip|drop)\s*(aja|deh|dulu)?\b/i,
];

// ─── EN abandonment patterns ────────────────────────────────────────
//
// "start-of-clause" here means: beginning of message · after `,` · `;` · `.` ·
// OR after a filler like "actually" / "actually," / "hold on" / "wait" /
// "wait no" which precede a reversal.
const CLAUSE_START = String.raw`(^|[,;.]\s*|\b(actually|hold\s+on|wait,?\s+no|wait|no\s+wait|hmm\s+actually)\s+,?\s*)`;
const EN_PATTERNS: RegExp[] = [
  // "forget X" · guard against "don't forget X" via NEGATIVE_GUARDS above.
  // Requires `forget` at start-of-clause so "I'll never forget you" doesn't fire.
  new RegExp(`${CLAUSE_START}forget\\s+(it|that|this|dinner|lunch|breakfast|food|hotels?|jewel(l)?ery|shopping|the\\s+(hotel|food|restaurant|search|shop|whole\\s+thing))`, "i"),
  new RegExp(`${CLAUSE_START}forget\\s+about\\s+(it|that|this|dinner|lunch|breakfast|food|hotels?|shopping)`, "i"),
  /\bnever\s*mind\b/i,
  /\bnvm\b/i,
  new RegExp(`${CLAUSE_START}cancel\\s+(it|that|the\\s+search|the\\s+order|everything)`, "i"),
  // Stage 3.41.l · bare "cancel" as command · guarded by clause-start
  // anchor so "how do I cancel my order" · "the cancel button" don't
  // fire (mid-sentence uses are noun/technical references, not commands).
  // Allows trailing punctuation ("cancel." / "cancel!") and atomic
  // "cancel, <new request>" — the abandonment still clears state; the
  // new request must be re-issued on the next turn.
  new RegExp(`${CLAUSE_START}cancel\\s*[.?!]?\\s*(,|$)`, "i"),
  new RegExp(`${CLAUSE_START}drop\\s+(it|that|the\\s+search)`, "i"),
  /\bscratch\s+that\b/i,
  /\bnot\s+(looking|searching)\s+for\s+.+\s+any(\s*more|more)\b/i,
  new RegExp(`${CLAUSE_START}stop\\s+(the\\s+)?(search|searching|looking)`, "i"),
  /(^|[,;.]\s*)stop\s*$/i,                                                // bare "stop" at end
  // "skip that / skip it" family — skip as an abandonment verb (not a
  // scheduling verb like "skip lunch to save money" · we anchor to
  // pronouns to keep it fail-closed).
  new RegExp(`${CLAUSE_START}skip\\s+(it|that|this)\\b`, "i"),
  /\bskip\s+it\b/i,
  // "change(d)? my mind" family — reversal of a prior instruction.
  /\b(chang(ing|ed)|change)\s+my\s+mind\b/i,
  // "let's move on" / "let's skip this" — collective walk-away.
  /\blet'?s\s+move\s+on\b/i,
  /\blet'?s\s+skip\s+(this|that|it)\b/i,
];

// ─── ID abandonment patterns ────────────────────────────────────────
const ID_PATTERNS: RegExp[] = [
  /\b(lupakan|lupain)\b/i,                                                // "lupakan" · "lupain"
  /\b(gak|nggak|ga|ngga|tidak)\s+jadi\b/i,                                // "gak jadi" (guarded above for "gak jadi masalah")
  /\bgajadi\b/i,                                                          // contracted "gajadi" (no space)
  /\budah\s+(gak|nggak|ga|ngga|tidak)\s+jadi\b/i,                         // "udah gak jadi"
  /\bbatal(kan|in)?\b/i,                                                  // "batal" · "batalkan" · "batalin"
  /(^|[,;.]\s*)(gak|nggak|tidak)\s+usah\s*(deh|dulu|aja)?\s*$/i,          // bare "gak usah" at end (guarded from "gak usah pusing")
  /\budah(in|i)\s*(aja|dulu)?\b/i,                                        // "udahin aja" · "udahi dulu"
  /(^|[,;.]\s*)stop\s+dulu\b/i,                                           // "stop dulu"
  /(^|[,;.]\s*)skip\s+dulu\b/i,                                           // "skip dulu" (borrowed)
  /(^|[,;.]\s*)tunda\s+dulu\b/i,                                          // "tunda dulu" — postpone/drop
  /(^|[,;.]\s*)cancel\s+aja\b/i,                                          // borrowed "cancel aja"
  // Stage 3.41.l · "udah, gak usah" composite · "udah" prefix marks
  // "that's enough" · already covered by the bare `gak usah` clause-
  // start pattern above (comma anchors it) but pinned explicitly here
  // as a regression against any future tightening.
  /\budah\s*,?\s*(gak|nggak|tidak)\s+usah\b/i,                             // "udah gak usah" / "udah, gak usah"
  // Stage 3.41.l · "jangan jadi" family · abandonment ONLY when bare
  // or followed by abandonment particles (deh/aja/dong/dulu/kali).
  // "jangan jadi anak nakal" / "jangan jadi orang jahat" (compound
  // "don't become X") does NOT match — end-anchor after the particle
  // keeps it fail-closed.
  /\bjangan\s+jadi\s*(deh|aja|dong|dulu|kali)?\s*$/i,
  // Stage 3.41.l · "jangan jadi + ACTION VERB" · means "don't proceed
  // to X" (e.g. "jangan jadi cari hotel" · "jangan jadi beli"). Only
  // fires when followed by a discovery/action verb — noun completions
  // like "anak nakal" · "orang jahat" don't match and don't trigger.
  /\bjangan\s+jadi\s+(cari|nyari|beli|pesen|pesan|hubungi|order|book|reserve|hunting)\b/i,
];

export type AbandonmentDetection = {
  matched: boolean;
  phrase?:   string;
  language?: "en" | "id";
};

/**
 * Detect abandonment intent. Deterministic · state-free · fail-closed.
 *
 * The CALLER must:
 *   · clear session.currentReference
 *   · drop business_name entities from the entity window
 *   · mark the current goal as `abandoned`
 *   · produce a short acknowledgement reply
 *   · SKIP vertical keyword routing on this turn
 */
export function detectAbandonment(message: string): AbandonmentDetection {
  const m = message.trim();
  if (!m) return { matched: false };

  for (const rx of NEGATIVE_GUARDS) {
    if (rx.test(m)) return { matched: false };
  }

  for (const rx of EN_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { matched: true, phrase: hit[0].trim(), language: "en" };
  }
  for (const rx of ID_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { matched: true, phrase: hit[0].trim(), language: "id" };
  }
  return { matched: false };
}
