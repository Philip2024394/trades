// src/lib/nex/brain/entity-followup-detector.ts
//
// Stage 3.41.d P2 · Entity-followup detector (Philip 2026-08-31).
//
// Detects when the user's message is a follow-up question about the
// currently-picked entity — NOT a new discovery, NOT a comparison,
// NOT an action. Examples:
//
//   "what's good about it?"          / "what's good about that one?"
//   "tell me more"                   / "tell me about it"
//   "why this one?"                  / "what about this one?"
//   "kenapa yang ini?"               / "cerita lebih dong"
//
// CONSTITUTIONAL:
//   · Deterministic · no LLM
//   · Fires ONLY when a currentReference is resolved · pointless
//     otherwise (nothing to follow up on)
//   · Ambiguous phrases fall through to normal routing · never guess

const EN_FOLLOWUP_PATTERNS: RegExp[] = [
  /\bwhat['’]?s\s+(good|special|nice|interesting|unique|cool)\s+(about|with)\s+(it|that|this|them|this\s+one|that\s+one)\b/i,
  /\btell\s+me\s+(more|about\s+(it|that|this|them|this\s+one|that\s+one))\b/i,
  /\bwhy\s+(this|that|this\s+one|that\s+one)\??$/i,
  /\bwhat\s+about\s+(it|this|that|this\s+one|that\s+one)\b/i,
  /\bmore\s+(info|details?|about\s+(it|that|this|them))\b/i,
  /\bhow\s+(about|good)\s+(is\s+)?(it|that|this|them|this\s+one|that\s+one)\b/i,
  // Stage 3.41.i · "what else / anything else / other options" family ·
  // natural way to ask about alternatives on the currently referenced
  // entity (e.g. "What else do they have?" after picking a restaurant).
  // Kept deterministic · fires only when a currentReference exists
  // (enforced upstream by the caller). Detector marks intent · the
  // composer decides what can be honestly said from available data.
  /\bwhat\s+else\s+(do\s+they\s+have|can\s+i\s+(get|order|try)|is\s+there|do\s+you\s+(have|know))\b/i,
  /\bwhat\s+else\??$/i,
  /\banything\s+else\??$/i,
  /\banything\s+more\??$/i,
  /\bgot\s+(any\s+)?more\??$/i,
  /\b(any\s+)?other\s+options?\b/i,
  /\bwhat\s+other\s+(things|options|choices|items)\b/i,
];

const ID_FOLLOWUP_PATTERNS: RegExp[] = [
  /\b(kenapa|kenapa\s+kok)\s+(ini|itu|yang\s+ini|yang\s+itu|dia|mereka)\b/i,
  /\bcerita(kan)?\s+(lebih|lagi|dong|soal(nya)?)/i,
  /\b(gimana|bagaimana)\s+(sama|dengan)?\s*(ini|itu|yang\s+ini|yang\s+itu|dia)\b/i,
  /\bapa(nya|kah)?\s+(bagus|menarik|spesial|unik)\s+(sama|dengan|dari|di)?\s*(ini|itu|yang\s+ini|yang\s+itu|dia)\b/i,
  /\binfo(nya)?\s+(lebih|lagi|dong)/i,
  // Stage 3.41.i · Indonesian "what else / anything else / other options"
  // (kept for clarity · superseded by the looser 3.41.k patterns below)
  /\bapa\s+lagi\??$/i,
  /\bada\s+(yang\s+)?lain(nya)?\??$/i,
  /\bada\s+lagi\??$/i,
  /\byang\s+lain(nya)?\??$/i,
  /\bpilihan\s+lain(nya)?\??$/i,
  // Stage 3.41.k · Indonesian entity-followup parity ·
  // extends the 3.41.i "what else" family to natural compositions ·
  //   "ada apa lagi di sana?"  ·  "apa lagi di sini?"
  //   "ada apa lagi disini?"   ·  "apa lagi ya?"
  //   "masih ada yang lain?"   ·  "yang lain ada?"
  //   "pilihan lain ada?"      ·  "ada opsi lain?"
  //
  // Each pattern requires the semantic core ("lagi" or "lain" or
  // "opsi lain") · guards below prevent matching bare "ada apa?" /
  // "yang lain bagus" / "apa artinya" / "nomor telepon".
  /\b(ada\s+)?apa\s+lagi\b/i,                    // "apa lagi" · "ada apa lagi" · with trailing tokens allowed
  /\bada\s+yang\s+lain(nya)?\b/i,                // "ada yang lain di sana?" · trailing tokens allowed · "yang" required to guard "ada lain hari"
  /\bmasih\s+ada\s+(yang\s+)?lain(nya)?\b/i,     // "masih ada yang lain?"
  /\byang\s+lain(nya)?\s+(ada|mana|apa)\b/i,     // "yang lain ada?" · "yang lain mana?"
  /\bpilihan\s+lain(nya)?\s+(ada|mana|apa)\b/i,  // "pilihan lain ada?"
  /\bada\s+opsi\s+lain(nya)?\b/i,                // "ada opsi lain?" · "ada opsi lainnya?" (borrowed-word variant)
];

export type EntityFollowupDetection = {
  matched: boolean;
  phrase?:   string;
  language?: "en" | "id";
};

/**
 * Detect entity-followup intent in the user's message. Call ONLY
 * when session.currentReference is resolved · the detector doesn't
 * know or care about session state · caller composes the two.
 */
export function detectEntityFollowup(message: string): EntityFollowupDetection {
  const m = message.trim();
  if (!m) return { matched: false };

  for (const rx of EN_FOLLOWUP_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { matched: true, phrase: hit[0], language: "en" };
  }
  for (const rx of ID_FOLLOWUP_PATTERNS) {
    const hit = m.match(rx);
    if (hit) return { matched: true, phrase: hit[0], language: "id" };
  }
  return { matched: false };
}
