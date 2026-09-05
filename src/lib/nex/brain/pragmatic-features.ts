// src/lib/nex/brain/pragmatic-features.ts
//
// Indonesian Pragmatic Layer · foundational infrastructure
// (Philip 2026-09-01).
//
// CONSTITUTIONAL CONTRACT:
//   "The layer must interpret conversational construction, particles,
//    address terms, code-switching and pragmatic force BEFORE downstream
//    intent detectors run. Do not add large pattern lists. Positive
//    contracts AND constitutional negative boundaries."
//
// Design choices per that contract:
//   · Read-only feature extraction · NO intent routing
//   · Existing detectors (abandonment / refinement / entity-followup /
//     reference) are NOT modified · they don't consume this layer yet
//   · Future intent detectors CAN consume `PragmaticFeatures` to be
//     simpler · but the constitutional wall today rests on the existing
//     detectors' unchanged behaviour
//   · Small structural vocabulary · no large pattern-list expansion
//
// FIVE features extracted (deliberately narrow):
//   1. ROLE           — question / statement / command / clarification / acknowledgement / unknown
//   2. ADDRESS        — Pak/Bu/Mas/Mbak/Kak/Bang/Dek/Dik/Om/Tante (+optional name)
//   3. PARTICLES      — sih / dong / deh / kok / ya / nih / tuh / aja
//   4. REGISTER       — formal / polite / neutral / casual / unknown
//   5. CODESWITCHING  — rough EN-in-ID indicator
//
// See doctrine pin `doctrine_indonesian_pragmatic_lexicon_2026_09_01.md`
// for the full architectural rationale.

export type PragmaticRole =
  | "question"         // interrogative construction (yes/no or wh-)
  | "statement"        // declarative
  | "command"          // imperative / request
  | "clarification"    // bare "apa?" / "sorry?" / "huh?"
  | "acknowledgement"  // "oke" / "sip" / "gitu ya"
  | "unknown";

export type PragmaticAddressTerm =
  | "pak" | "bapak" | "bu" | "ibu" | "mas" | "mbak"
  | "kak" | "bang" | "dek" | "dik" | "om" | "tante";

export type PragmaticAddress = {
  term: PragmaticAddressTerm;
  name?: string;
};

export type PragmaticParticle =
  | "sih" | "dong" | "deh" | "kok" | "ya" | "nih" | "tuh" | "aja";

export type PragmaticRegister =
  | "formal"    // "Selamat pagi, Bapak Ahmad" · "Apakah Anda..."
  | "polite"    // "Pak, tolong..." · "boleh saya..."
  | "neutral"   // default declarative
  | "casual"    // "gw" · "lu" · "aja" · "banget" · particles-heavy
  | "unknown";

export type PragmaticFeatures = {
  role:          PragmaticRole;
  address?:      PragmaticAddress;
  particles:     PragmaticParticle[];
  register:      PragmaticRegister;
  codeswitching: boolean;
};

// ─── ROLE detection ─────────────────────────────────────────────────
//
// Structural signals only — no keyword lookup for topical intent.
// Order matters: clarification > command > question > acknowledgement
// > statement.

const CLARIFICATION_BARE = /^\s*(apa|apaan|sorry|huh|hah|maaf)\s*[?.!]*\s*$/i;

const COMMAND_OPENERS = /^\s*(coba|tolong|kasih|kasihin|bikin|bikinin|carikan|cariin|show|give|tell|find|book|order|drop|pick|come|open|close)\b/i;

const QUESTION_WH_ID = /^\s*(apa|apakah|kapan|dimana|di\s+mana|kemana|ke\s+mana|mengapa|kenapa|bagaimana|gimana|siapa|mana|berapa)\b/i;
const QUESTION_WH_EN = /^\s*(what|when|where|why|how|who|which|whose)\b/i;
const QUESTION_YN_ID = /^\s*(bisa|boleh|udah|sudah|masih|ada|apakah)\b/i;
const QUESTION_YN_EN = /^\s*(can|could|should|would|do|does|did|is|are|was|were|will|may|might|have|has)\s+/i;
const TRAILING_QUESTION_MARK = /\?\s*$/;

const ACKNOWLEDGEMENT_SHORT = /^\s*(ok|oke|okay|sip|siap|sip{2,}|nah|gitu|gitu\s+ya|iya|iyalah|iya\s+deh|betul|bener|mantap|mantul|noted|got\s+it|understood|paham|ngerti|makasih|thanks|thank\s+you|makasi|thx)\s*[.!]*\s*$/i;

// ─── ADDRESS detection (reuses vocabulary from doctrine) ───────────

const ADDRESS_PREFIX = /^\s*(pak|bapak|bu|ibu|mas|mbak|kak|bang|dek|dik|om|tante)(?:\s+([A-Za-z][A-Za-z' ]{0,30}?))?[,:!?.]/i;

// ─── PARTICLES ─────────────────────────────────────────────────────
//
// Bare word-boundary particles. Order irrelevant. Extracted from
// anywhere in the message (particles are semantic markers, not
// positional).

const PARTICLES: Array<[RegExp, PragmaticParticle]> = [
  [/\bsih\b/i,  "sih"],
  [/\bdong\b/i, "dong"],
  [/\bdeh\b/i,  "deh"],
  [/\bkok\b/i,  "kok"],
  [/\bnih\b/i,  "nih"],
  [/\btuh\b/i,  "tuh"],
  [/\baja\b/i,  "aja"],
  // `ya` is trickier — used both as particle and as generic "yes/right".
  // Restrict to sentence-final position after other content.
  [/\S\s+ya[?!.,]*\s*$/i, "ya"],
];

// ─── REGISTER heuristic ────────────────────────────────────────────
//
// Best-effort · returns "unknown" when signals conflict or are absent.

const FORMAL_MARKERS = /\b(anda|bapak|ibu|apakah|kepada|silakan|mohon)\b/i;
const CASUAL_PRONOUNS = /\b(gw|gue|lu|lo|elo|gua)\b/i;
const CASUAL_INTENSIFIERS = /\b(banget|bgt|parah|abis|dahsyat|mantul)\b/i;

// ─── CODE-SWITCHING (rough indicator) ──────────────────────────────

const INDONESIAN_TOKEN = /\b(yang|dan|atau|dengan|dari|untuk|pada|itu|ini|saya|aku|kamu|dia|kita|kami|mereka|akan|sudah|belum|masih|apa|apakah|kapan|dimana|mengapa|kenapa|bagaimana|gimana|siapa|mana|berapa|pak|bu|mas|mbak|kak|bang|sih|dong|deh|kok|nih|tuh|aja|ya|banget|bgt|udah|gak|nggak|jangan|boleh|bisa)\b/i;
const ENGLISH_TOKEN = /\b(the|is|are|was|were|and|or|of|to|for|in|on|at|with|from|by|that|this|these|those|what|when|where|why|how|who|which|can|could|should|would|do|does|did|show|give|find|book|order|make|take|come|go|help|please|thanks|thank|you|me|my|your|his|her|our|their|it|its|not|no|yes)\b/i;

// ─── Detector ──────────────────────────────────────────────────────

// Address prefix strip · role detection needs to look past "Mas, "
// / "Pak Ahmad, " prefixes to see the underlying command/question.
// Matches only KNOWN address vocabulary · unknown prefixes (e.g. "NEX, ")
// are left intact and rely on the trailing-`?` fallback for role.
const ADDRESS_PREFIX_STRIP = /^\s*(?:pak|bapak|bu|ibu|mas|mbak|kak|bang|dek|dik|om|tante)(?:\s+[A-Za-z]+){0,2}[,:!?.]\s*/i;

function detectRole(msg: string): PragmaticRole {
  const trimmed = msg.trim();
  if (!trimmed) return "unknown";
  // Strip a leading Indonesian address prefix so downstream role
  // patterns anchored to `^` can see the true opener.
  const stripped = trimmed.replace(ADDRESS_PREFIX_STRIP, "");

  if (CLARIFICATION_BARE.test(stripped))      return "clarification";
  if (ACKNOWLEDGEMENT_SHORT.test(stripped))   return "acknowledgement";

  // Question comes before command · "Apa yang X?" is question, not command
  if (QUESTION_WH_ID.test(stripped))          return "question";
  if (QUESTION_WH_EN.test(stripped))          return "question";
  if (QUESTION_YN_ID.test(stripped))          return "question";
  if (QUESTION_YN_EN.test(stripped))          return "question";
  // Trailing "?" implies question even if opener not matched
  if (TRAILING_QUESTION_MARK.test(trimmed))   return "question";

  if (COMMAND_OPENERS.test(stripped))         return "command";

  return "statement";
}

function detectAddress(msg: string): PragmaticAddress | undefined {
  const m = msg.match(ADDRESS_PREFIX);
  if (!m) return undefined;
  const term = m[1].toLowerCase() as PragmaticAddressTerm;
  const name = m[2]?.trim();
  return name ? { term, name } : { term };
}

function detectParticles(msg: string): PragmaticParticle[] {
  const found = new Set<PragmaticParticle>();
  for (const [rx, name] of PARTICLES) {
    if (rx.test(msg)) found.add(name);
  }
  return Array.from(found);
}

function detectRegister(msg: string, hasAddress: boolean, particleCount: number): PragmaticRegister {
  if (!msg.trim()) return "unknown";
  const formal = FORMAL_MARKERS.test(msg);
  const casualPronoun = CASUAL_PRONOUNS.test(msg);
  const casualIntens = CASUAL_INTENSIFIERS.test(msg);

  if (formal && !casualPronoun && !casualIntens) return "formal";
  if (casualPronoun || casualIntens)             return "casual";
  if (hasAddress && particleCount >= 1)          return "polite";
  if (hasAddress || particleCount >= 1)          return "polite";
  return "neutral";
}

function detectCodeswitching(msg: string): boolean {
  return INDONESIAN_TOKEN.test(msg) && ENGLISH_TOKEN.test(msg);
}

/**
 * Extract pragmatic features from a raw user message.
 *
 * PURE FUNCTION. No side effects. No consumption by existing
 * detectors. Read-only observation of conversational structure.
 *
 * Downstream intent detectors MAY consume these features to reduce
 * per-detector guard duplication. Existing detectors do NOT consume
 * them today (constitutional wall preserved).
 */
export function extractPragmaticFeatures(message: string): PragmaticFeatures {
  const trimmed = message.trim();
  const address       = detectAddress(trimmed);
  const particles     = detectParticles(trimmed);
  const role          = detectRole(trimmed);
  const register      = detectRegister(trimmed, !!address, particles.length);
  const codeswitching = detectCodeswitching(trimmed);
  return { role, address, particles, register, codeswitching };
}
