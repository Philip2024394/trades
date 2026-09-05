// src/lib/nex/brain/language-state.ts
//
// G03 · Language Stability & Reply-Language Continuity
// Philip 2026-09-06 · AUTHORIZE · G03
//
// PROBLEM
//   NEX could understand a multilingual conversation but the reply
//   language sometimes drifted mid-conversation. The Speaking
//   Intelligence Audit demonstrated this (Category 20-T2 · Indonesian
//   ask → English reply). Each per-turn inline detection saw only the
//   current turn's evidence; there was no NEX-owned conversation-level
//   language state.
//
// GOVERNING PRINCIPLE (locked · AUTHORIZE §1 §2 §3)
//   NEX, not the underlying model, owns the active conversational
//   language policy. The model produces text under a language directive
//   NEX chose; NEX verifies the model actually obeyed.
//
// SCOPE OF THIS MODULE
//   · Per-turn language detection (Indonesian + English · quoted-text
//     stripped · capability-question / translation-request isolated)
//   · Conversation-level language state (keyed by conversation_id)
//   · Explicit-switch detection + deterministic switch-acknowledgement
//     replies in EN + ID
//   · Language policy: explicit switch > active > detected > preference
//     > default
//   · Model-output language verification
//
// PRESERVATION (§32)
//   · L4 · G12 · G23 · G24 · G04 · P0.3 · P0.4 · result-followup · all
//     untouched (this module is consumed by route.ts additively)
//   · language-intelligence.ts · language-lexicon.ts · untouched

// ─── Types ──────────────────────────────────────────────────────

export type Lang = "EN" | "ID" | "UNKNOWN" | "MIXED";
export type LanguageConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type LanguageSource =
  | "session_default"     // brand-new conversation · no evidence yet
  | "explicit_switch"     // user asked to switch this turn
  | "user_preference"     // durable preference (e.g., from G23)
  | "detected_turn"       // strong current-turn signal
  | "inherited";          // inherited from prior turn(s)

export type Stability = "STABLE" | "SWITCHED_THIS_TURN" | "AMBIGUOUS";

export type TurnLanguageDetection = {
  detected: Lang;
  confidence: LanguageConfidence;
  /** Non-null when the user explicitly requested a language switch. */
  explicit_switch_target: Lang | null;
  /** "Can you speak Indonesian?" is a capability question, not a switch. */
  is_capability_question: boolean;
  /** "Translate X into Y" specifies a translation target, not the
   *  conversational language. */
  is_translation_request: boolean;
  /** Sub-strings that were extracted as quoted text and NOT used for
   *  language identification. */
  quoted_regions: string[];
  /** The message with quoted regions stripped. */
  stripped_text: string;
  /** Evidence scores used to pick `detected`. */
  evidence: { en_score: number; id_score: number };
};

export type LanguageState = {
  active: Lang;
  detected_this_turn: Lang;
  confidence: LanguageConfidence;
  source: LanguageSource;
  explicit_switch_target: Lang | null;
  stability: Stability;
  history: Array<{
    at: string;                 // ISO
    from: Lang;
    to: Lang;
    reason: LanguageSource;
    turn_text: string;
  }>;
};

export type ResolveInput = {
  conversation_id: string;
  message: string;
  /** From G23 user-fact memory · a durable stated preference. */
  user_preferred_language?: Lang | null;
};

// ─── Vocabulary primitives ──────────────────────────────────────

/** High-signal Indonesian markers with word boundaries. Small and
 *  inspectable — new markers extend the set. */
const ID_MARKERS = new Set([
  // pronouns · determiners · articles
  "saya", "aku", "kami", "kita", "anda", "kamu", "dia", "mereka",
  "ini", "itu", "yang",
  // question words
  "apa", "siapa", "dimana", "kapan", "bagaimana", "mengapa", "kenapa", "mana",
  // negation
  "tidak", "bukan", "belum", "jangan", "nggak", "gak",
  // volition
  "mau", "ingin", "butuh", "perlu", "boleh", "bisa", "mesti", "harus",
  // prepositions · particles
  "di", "ke", "dari", "dekat", "dengan", "pada", "untuk", "oleh", "tentang",
  // conjunctions
  "dan", "atau", "tetapi", "tapi", "kalau", "jika",
  // aux · tense
  "sudah", "telah", "akan", "sedang", "masih", "lagi", "juga",
  // common verbs / nouns
  "cari", "carikan", "buat", "buatkan", "pesan", "beli", "makan", "minum",
  "tinggal", "berada", "punya",
  "orang", "tempat", "waktu", "hari",
  // greetings · social
  "halo", "hai", "iya", "ya", "selamat", "pagi", "siang", "sore", "malam",
  "terima", "kasih", "makasih", "trims", "sama", "kabar",
  // affirmatives
  "baik", "bagus", "keren",
  // extras
  "ada", "sini", "situ", "sana", "berapa", "banyak", "sedikit",
]);

/** High-signal English function words. Kept small — the presence of
 *  these near-obligatory tokens is strong evidence, not the absence
 *  of Indonesian ones. */
const EN_MARKERS = new Set([
  // articles · determiners
  "the", "a", "an", "this", "that", "these", "those",
  // pronouns
  "i", "im", "you", "your", "youre", "we", "were", "he", "she", "it", "they", "them", "us", "me",
  // aux · copula · modal
  "is", "are", "was", "were", "be", "been", "being",
  "am", "have", "has", "had", "do", "does", "did", "done",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  // prepositions
  "in", "on", "at", "of", "for", "with", "by", "from", "to", "into", "about",
  // conjunctions
  "and", "or", "but", "so", "because", "if", "when", "while", "although",
  // negation
  "not", "no", "dont", "doesnt", "didnt", "wont", "cant", "isnt", "arent",
  // question words
  "what", "who", "where", "when", "why", "how", "which",
  // common verbs
  "want", "need", "like", "prefer", "find", "show", "get", "give",
  "go", "come", "make", "take", "look", "see", "know", "think",
  // greetings · social
  "hi", "hello", "hey", "thanks", "thank",
]);

/** Language name lexicon · maps textual names to Lang. */
const LANGUAGE_NAMES: Record<string, Lang> = {
  english: "EN",
  inggris: "EN",
  indonesian: "ID",
  indonesia: "ID",
  bahasa: "ID",   // in Indonesian speech, "bahasa" typically = Indonesian
};

// ─── Quoted-text extraction ────────────────────────────────────

const QUOTE_PATTERNS: ReadonlyArray<RegExp> = [
  /"([^"]{1,120})"/g,           // straight double
  /“([^”]{1,120})”/g,           // curly double
  /'([^']{1,120})'/g,           // straight single
  /‘([^’]{1,120})’/g,           // curly single
];

function stripQuotedRegions(message: string): { stripped: string; quoted: string[] } {
  let stripped = message;
  const quoted: string[] = [];
  for (const rx of QUOTE_PATTERNS) {
    stripped = stripped.replace(rx, (_full, inner) => {
      quoted.push(inner);
      return " ";
    });
  }
  return { stripped, quoted };
}

// ─── Tokenizer (matches sibling classifiers) ────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Explicit-switch detection ──────────────────────────────────
//
// Distinguishes:
//   INSTRUCTION  → sets explicit_switch_target
//     "please answer in Indonesian"
//     "let's speak English"
//     "switch to Indonesian"
//     "sekarang jawab dalam bahasa Inggris"
//     "bisa jawab dalam bahasa Indonesia?"
//   CAPABILITY QUESTION → does NOT switch
//     "can you speak Indonesian?"
//     "do you speak English?"

const SWITCH_INSTRUCTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bplease (?:answer|reply|respond) (?:in|dalam)\s+(?:bahasa\s+)?(\w+)/i,
  /\banswer (?:me|us) (?:in|dalam)\s+(?:bahasa\s+)?(\w+)/i,
  /\blets? speak\s+(\w+)/i,
  /\bswitch (?:back )?(?:to|into)\s+(?:bahasa\s+)?(\w+)/i,
  /\bcontinue (?:in|with)\s+(\w+)/i,
  /\breply in\s+(\w+)/i,
  /\brespond in\s+(\w+)/i,
  // Bare imperative "speak <lang>" · but only if NOT preceded by can/do
  /^speak\s+(\w+)/i,
  // Indonesian instruction shapes
  /\bsekarang\s+(?:jawab|pakai|gunakan)\s+(?:dalam\s+)?bahasa\s+(\w+)/i,
  /\bjawab\s+dalam\s+bahasa\s+(\w+)/i,
  /\bpakai\s+bahasa\s+(\w+)/i,
  /\bgunakan\s+bahasa\s+(\w+)/i,
  /\bbisa\s+jawab\s+dalam\s+bahasa\s+(\w+)/i,
  /\btolong\s+jawab\s+dalam\s+bahasa\s+(\w+)/i,
  /\bnow\s+switch\s+(?:back\s+)?to\s+(\w+)/i,
];

const CAPABILITY_QUESTION_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*(?:can|could|do|does)\s+(?:you|we|nex)\s+speak\s+(\w+)/i,
  /^\s*(?:can|could|do|does)\s+(?:you|we|nex)\s+understand\s+(\w+)/i,
  /^\s*apakah\s+(?:kamu|anda)\s+bisa\s+bahasa\s+(\w+)/i,
];

function resolveLanguageName(name: string | undefined): Lang | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return LANGUAGE_NAMES[lower] ?? null;
}

function normalizeForRegex(message: string): string {
  // Strip apostrophes so contractions ("let's") match the same regex
  // that handles unapostrophized forms ("lets"). Everything else is
  // preserved so word-boundary semantics remain intact.
  return message.replace(/[’']/g, "");
}

function detectExplicitSwitch(message: string): { target: Lang | null; is_capability_question: boolean } {
  const norm = normalizeForRegex(message);
  // Capability question runs FIRST · it overlaps with instruction patterns.
  for (const rx of CAPABILITY_QUESTION_PATTERNS) {
    const m = rx.exec(norm);
    if (m) return { target: null, is_capability_question: true };
  }
  for (const rx of SWITCH_INSTRUCTION_PATTERNS) {
    const m = rx.exec(norm);
    if (m) {
      const lang = resolveLanguageName(m[1]);
      if (lang && (lang === "EN" || lang === "ID")) {
        return { target: lang, is_capability_question: false };
      }
    }
  }
  return { target: null, is_capability_question: false };
}

// ─── Translation-request detection ──────────────────────────────

const TRANSLATION_PATTERNS: ReadonlyArray<RegExp> = [
  /\btranslate\b.*\b(?:into|to)\s+(\w+)/i,
  /\bwhat does\s+["'“].+["'”]\s+mean in\s+(\w+)/i,
  /\bhow do you say\b.*\bin\s+(\w+)/i,
  /\bapa arti\b.*\bdalam\s+(?:bahasa\s+)?(\w+)/i,
  /\bbagaimana\s+(?:cara\s+)?menerjemahkan\b/i,
];

function isTranslationRequest(message: string): boolean {
  for (const rx of TRANSLATION_PATTERNS) if (rx.test(message)) return true;
  return false;
}

// ─── Per-turn language detection ────────────────────────────────

export function detectTurnLanguage(message: string): TurnLanguageDetection {
  const { stripped, quoted } = stripQuotedRegions(message);
  const t = tokens(stripped);
  let id_score = 0;
  let en_score = 0;
  for (const tok of t) {
    if (ID_MARKERS.has(tok)) id_score++;
    if (EN_MARKERS.has(tok)) en_score++;
  }
  const { target, is_capability_question } = detectExplicitSwitch(message);
  const is_translation = isTranslationRequest(message);

  // Dominance heuristic
  let detected: Lang;
  let confidence: LanguageConfidence;
  const total = id_score + en_score;
  if (total === 0) {
    // No marker evidence · UNKNOWN. Inheritance will handle the reply
    // language via resolveActiveLanguage.
    detected = "UNKNOWN";
    confidence = "UNKNOWN";
  } else if (id_score === en_score && total >= 2) {
    detected = "MIXED";
    confidence = "MEDIUM";
  } else if (id_score > en_score * 2) {
    detected = "ID";
    confidence = id_score >= 3 ? "HIGH" : id_score >= 2 ? "MEDIUM" : "LOW";
  } else if (en_score > id_score * 2) {
    detected = "EN";
    confidence = en_score >= 3 ? "HIGH" : en_score >= 2 ? "MEDIUM" : "LOW";
  } else if (id_score > en_score) {
    detected = "ID";
    confidence = "MEDIUM";
  } else if (en_score > id_score) {
    detected = "EN";
    confidence = "MEDIUM";
  } else {
    detected = "MIXED";
    confidence = "MEDIUM";
  }

  return {
    detected,
    confidence,
    explicit_switch_target: target,
    is_capability_question,
    is_translation_request: is_translation,
    quoted_regions: quoted,
    stripped_text: stripped,
    evidence: { en_score, id_score },
  };
}

// ─── Conversation-level state ───────────────────────────────────

const stateByConversation = new Map<string, LanguageState>();

/** For tests only. */
export function _resetLanguageStateForTests(): void {
  stateByConversation.clear();
}

export function getLanguageState(conversation_id: string): LanguageState | null {
  return stateByConversation.get(conversation_id) ?? null;
}

/** Resolve the active language for a turn. Applies the policy from
 *  AUTHORIZE §17. */
export function resolveActiveLanguage(input: ResolveInput): LanguageState {
  const detection = detectTurnLanguage(input.message);
  const prior = stateByConversation.get(input.conversation_id) ?? null;
  const now = new Date().toISOString();

  const priorActive: Lang = prior?.active ?? "UNKNOWN";
  let active: Lang = priorActive;
  let source: LanguageSource;
  let stability: Stability;

  if (detection.explicit_switch_target
      && (detection.explicit_switch_target === "EN" || detection.explicit_switch_target === "ID")) {
    // 1 · Explicit switch — highest priority.
    active = detection.explicit_switch_target;
    source = "explicit_switch";
    stability = "SWITCHED_THIS_TURN";
  } else if (prior && prior.active !== "UNKNOWN") {
    // 2 · Preserve active conversational language unless HIGH-confidence
    //     current-turn evidence contradicts it. This is the stability
    //     guarantee for short / ambiguous turns.
    if (
      (detection.detected === "EN" || detection.detected === "ID")
      && detection.detected !== prior.active
      && detection.confidence === "HIGH"
      && detection.is_translation_request === false
    ) {
      // Strong turn evidence → treat as drift-signal, but do NOT
      // switch without an explicit request. Mark AMBIGUOUS for the
      // observability layer; keep the active language.
      active = prior.active;
      source = "inherited";
      stability = "AMBIGUOUS";
    } else {
      active = prior.active;
      source = "inherited";
      stability = "STABLE";
    }
  } else if (detection.detected === "EN" || detection.detected === "ID") {
    // 3 · Current-turn strong detection (no prior state).
    active = detection.detected;
    source = "detected_turn";
    stability = "STABLE";
  } else if (input.user_preferred_language
             && (input.user_preferred_language === "EN" || input.user_preferred_language === "ID")) {
    // 4 · Durable user preference (G23).
    active = input.user_preferred_language;
    source = "user_preference";
    stability = "STABLE";
  } else {
    // 5 · Safe default: EN.
    active = "EN";
    source = "session_default";
    stability = "STABLE";
  }

  const historyEvent = prior && prior.active !== active
    ? { at: now, from: prior.active, to: active, reason: source, turn_text: input.message.slice(0, 200) }
    : null;

  const next: LanguageState = {
    active,
    detected_this_turn: detection.detected,
    confidence: detection.confidence,
    source,
    explicit_switch_target: detection.explicit_switch_target,
    stability,
    history: historyEvent
      ? [...(prior?.history ?? []), historyEvent]
      : (prior?.history ?? []),
  };
  stateByConversation.set(input.conversation_id, next);
  return next;
}

// ─── Explicit-switch gate · deterministic acknowledgement ───────
//
// Fires when the user explicitly requests a language change. Emits a
// short acknowledgement in the NEW language and updates state.

export type LanguageSwitchGateDecision =
  | { shouldGate: false; reason: string; state: LanguageState }
  | {
      shouldGate: true;
      reason: string;
      state: LanguageState;
      reply: string;
      switched_from: Lang;
      switched_to: Lang;
    };

export function decideLanguageSwitchGate(input: ResolveInput): LanguageSwitchGateDecision {
  const prior = stateByConversation.get(input.conversation_id);
  const priorActive: Lang = prior?.active ?? "UNKNOWN";
  const state = resolveActiveLanguage(input);
  if (state.source === "explicit_switch"
      && state.active !== priorActive
      && (state.active === "EN" || state.active === "ID")) {
    return {
      shouldGate: true,
      reason: `explicit_switch:${priorActive}->${state.active}`,
      state,
      switched_from: priorActive,
      switched_to: state.active,
      reply: state.active === "ID"
        ? "Baik, saya akan menjawab dalam bahasa Indonesia. Ada yang bisa saya bantu?"
        : "Okay, I'll continue in English. What can I help you with?",
    };
  }
  return { shouldGate: false, reason: `not_explicit_switch:${state.source}`, state };
}

// ─── Model-output verification (§22) ────────────────────────────

/** Detect the dominant language of a REPLY string. Uses the same
 *  markers but with lower thresholds because model replies are longer.
 *  Distinct from `detectTurnLanguage` in that it does not treat the
 *  text as user input (no explicit-switch / translation detection). */
export function verifyOutputLanguage(text: string, expected: Lang): {
  matches: boolean;
  dominant: Lang;
  confidence: LanguageConfidence;
  en_score: number;
  id_score: number;
} {
  const t = tokens(text);
  let id_score = 0;
  let en_score = 0;
  for (const tok of t) {
    if (ID_MARKERS.has(tok)) id_score++;
    if (EN_MARKERS.has(tok)) en_score++;
  }
  let dominant: Lang;
  let confidence: LanguageConfidence;
  const total = id_score + en_score;
  if (total < 2) {
    dominant = "UNKNOWN";
    confidence = "UNKNOWN";
  } else if (id_score > en_score * 1.5) {
    dominant = "ID";
    confidence = id_score >= 5 ? "HIGH" : "MEDIUM";
  } else if (en_score > id_score * 1.5) {
    dominant = "EN";
    confidence = en_score >= 5 ? "HIGH" : "MEDIUM";
  } else {
    dominant = "MIXED";
    confidence = "MEDIUM";
  }
  const matches = expected === "MIXED" || expected === "UNKNOWN"
                  ? true
                  : dominant === expected || dominant === "UNKNOWN";
  return { matches, dominant, confidence, en_score, id_score };
}

// ─── Convenience: lowercase Lang for downstream callers ─────────

export function langToOwnerLanguage(l: Lang): "en" | "id" {
  return l === "ID" ? "id" : "en";
}
