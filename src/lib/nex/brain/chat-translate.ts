// src/lib/nex/brain/chat-translate.ts
//
// Stage 3.32 · Phase 25 · Chat-bubble translation · deterministic
// phrase pack (Philip 2026-08-31).
//
// Doctrine anchor: user's earlier choice — NEX Brain deterministic
// phrase pack, not an external LLM. Matches the accommodation composer
// approach: bounded regex / dictionary mapping · no network · zero
// cost per message · fully offline · predictable output.
//
// Scope for v1:
//   · Bounded pack of common Indonesian ⇄ English chat greetings,
//     yes/no, thanks, questions, courtesies, and short answers.
//     Anything outside the pack falls back to the ORIGINAL text
//     labelled "no_translation" so the UI can decide whether to
//     surface a machine-translation caveat later.
//   · Case-insensitive matching for whole-phrase and word-level
//     substitutions. Preserves numbers, business names, URLs,
//     emoji, and any word not in the pack VERBATIM.
//   · Pair-symmetric: every EN entry has an ID equivalent and vice
//     versa so round-trip (EN → ID → EN) preserves meaning.
//
// What v1 explicitly does NOT do:
//   · Grammar correction / conjugation across full sentences
//   · Compound-sentence translation via NLP
//   · Colloquial slang beyond the seed pack
//   · Names of people or places (translated as-is — those are proper
//     nouns · translating them would be a bug)
//   · Numbers, currencies, dates (verbatim)
//
// Honesty invariant: when the pack cannot translate a message with
// high confidence, return `{ text: original, translated: false,
// reason: "no_pack_match" }` so the UI can show a small "original
// only" caveat rather than fabricate a translation.

export type Lang = "en" | "id";

export type TranslationResult = {
  /** The translated (or original when no translation possible) text. */
  text: string;
  /** True when the pack found at least one substitution the caller
   *  can rely on · false when the message was returned verbatim. */
  translated: boolean;
  /** Machine-readable reason describing the outcome · for telemetry
   *  + UI caveat decisions. */
  reason:
    | "exact_phrase"     // whole-message match hit a canonical phrase
    | "word_swaps"       // one or more word/short-phrase substitutions applied
    | "same_language"    // source and target languages equal · passthrough
    | "no_pack_match";   // no substitutions applied · verbatim + honest signal
};

// ─── Canonical phrase pack ────────────────────────────────────────────
//
// Each entry: { en, id }. Both strings are lowercased for match; the
// output preserves the target language's canonical form (first-letter
// capital when the input started with a capital · otherwise lowercase).
// Entries ordered longer → shorter so multi-word phrases match before
// single-word substrings.
type PhrasePair = { en: string; id: string };

const PHRASE_PAIRS: readonly PhrasePair[] = [
  // Greetings + farewells
  { en: "good morning",       id: "selamat pagi" },
  { en: "good afternoon",     id: "selamat siang" },
  { en: "good evening",       id: "selamat malam" },
  { en: "good night",         id: "selamat tidur" },
  { en: "see you later",      id: "sampai jumpa" },
  { en: "see you tomorrow",   id: "sampai besok" },
  { en: "welcome",            id: "selamat datang" },
  { en: "goodbye",            id: "selamat tinggal" },
  { en: "hello",              id: "halo" },
  { en: "hi",                 id: "hai" },
  { en: "bye",                id: "dadah" },

  // Courtesies
  { en: "thank you very much", id: "terima kasih banyak" },
  { en: "thank you",           id: "terima kasih" },
  { en: "thanks",              id: "makasih" },
  { en: "please",              id: "tolong" },
  { en: "excuse me",           id: "permisi" },
  { en: "sorry",               id: "maaf" },
  { en: "you're welcome",      id: "sama-sama" },
  { en: "no problem",          id: "tidak masalah" },

  // Yes/No + short answers
  { en: "yes",                 id: "ya" },
  { en: "no",                  id: "tidak" },
  { en: "of course",           id: "tentu saja" },
  { en: "okay",                id: "baik" },
  { en: "ok",                  id: "oke" },
  { en: "sure",                id: "tentu" },
  { en: "maybe",               id: "mungkin" },

  // Common questions
  { en: "how are you",         id: "apa kabar" },
  { en: "what is your name",   id: "siapa nama kamu" },
  { en: "where are you from",  id: "kamu dari mana" },
  { en: "how much is this",    id: "berapa harganya ini" },
  { en: "how much",            id: "berapa" },
  { en: "where is",            id: "dimana" },
  { en: "when",                id: "kapan" },
  { en: "why",                 id: "kenapa" },
  { en: "how",                 id: "bagaimana" },
  { en: "what",                id: "apa" },
  { en: "who",                 id: "siapa" },

  // Common answers
  { en: "i am fine",           id: "saya baik-baik saja" },
  { en: "i am good",           id: "saya baik" },
  { en: "i don't understand",  id: "saya tidak mengerti" },
  { en: "i don't know",        id: "saya tidak tahu" },
  { en: "i love you",          id: "aku cinta kamu" },
  { en: "i like it",           id: "saya suka" },
  { en: "i want",              id: "saya mau" },
  { en: "i need",              id: "saya butuh" },
  { en: "i am",                id: "saya" },

  // Chat/logistics vocabulary
  { en: "where are you",       id: "kamu dimana" },
  { en: "i am here",           id: "saya di sini" },
  { en: "on my way",           id: "sedang di jalan" },
  { en: "wait a moment",       id: "tunggu sebentar" },
  { en: "one moment",          id: "sebentar" },
  { en: "not yet",             id: "belum" },
  { en: "already",             id: "sudah" },
  { en: "now",                 id: "sekarang" },
  { en: "later",               id: "nanti" },
  { en: "tomorrow",            id: "besok" },
  { en: "today",               id: "hari ini" },
  { en: "tonight",             id: "malam ini" },

  // Directions / places
  { en: "at home",             id: "di rumah" },
  { en: "at work",             id: "di kantor" },
  { en: "near",                id: "dekat" },
  { en: "far",                 id: "jauh" },
  { en: "here",                id: "di sini" },
  { en: "there",               id: "di sana" },

  // Feelings
  { en: "happy",               id: "senang" },
  { en: "sad",                 id: "sedih" },
  { en: "tired",               id: "lelah" },
  { en: "hungry",              id: "lapar" },
  { en: "thirsty",             id: "haus" },

  // Descriptors — must come after multi-word phrases that contain them
  { en: "good",                id: "baik" },
  { en: "bad",                 id: "buruk" },
  { en: "big",                 id: "besar" },
  { en: "small",               id: "kecil" },
  { en: "cheap",               id: "murah" },
  { en: "expensive",           id: "mahal" },
] as const;

// Sort by EN length descending · longest-first substitution wins so
// "good morning" is matched before "good" and "morning".
const PAIRS_BY_EN_DESC = [...PHRASE_PAIRS].sort((a, b) => b.en.length - a.en.length);
const PAIRS_BY_ID_DESC = [...PHRASE_PAIRS].sort((a, b) => b.id.length - a.id.length);

// ─── Case helpers ─────────────────────────────────────────────────────
//
// Preserve initial capitalization so "Hello" ⇄ "Halo" (not "halo").
function matchCase(source: string, replacement: string): string {
  if (source.length === 0 || replacement.length === 0) return replacement;
  const isCap = source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase();
  if (!isCap) return replacement;
  return replacement[0].toUpperCase() + replacement.slice(1);
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── The translator ──────────────────────────────────────────────────
export function translateChatMessage(input: {
  text: string;
  from: Lang;
  to: Lang;
}): TranslationResult {
  const { text, from, to } = input;
  if (from === to) return { text, translated: false, reason: "same_language" };

  const trimmed = text.trim();
  if (trimmed.length === 0) return { text, translated: false, reason: "no_pack_match" };

  // 1. Whole-message exact-phrase match (case-insensitive).
  const lower = trimmed.toLowerCase();
  const pairs = from === "en" ? PAIRS_BY_EN_DESC : PAIRS_BY_ID_DESC;
  for (const pair of pairs) {
    const src = from === "en" ? pair.en : pair.id;
    const tgt = to === "en" ? pair.en : pair.id;
    if (lower === src) {
      // Preserve leading/trailing whitespace + case + trailing punctuation.
      const leading = text.match(/^\s*/)?.[0] ?? "";
      const trailing = text.match(/\s*$/)?.[0] ?? "";
      const trailingPunct = trimmed.match(/[?!.,]+$/)?.[0] ?? "";
      const capped = matchCase(trimmed, tgt);
      return {
        text: `${leading}${capped}${trailingPunct}${trailing}`,
        translated: true,
        reason: "exact_phrase",
      };
    }
  }

  // 2. Word / short-phrase substitutions inside a larger sentence.
  //    Longest-first ordering means "good morning" replaces before
  //    "good" or "morning" alone. Case is preserved per-match.
  let working = text;
  let anyReplaced = false;
  for (const pair of pairs) {
    const src = from === "en" ? pair.en : pair.id;
    const tgt = to === "en" ? pair.en : pair.id;
    // Word-boundary escape allows the substring to sit inside larger text
    // e.g. "OK, thank you!" → "OK, terima kasih!". We use a manual boundary
    // rather than \b because ID has non-ASCII punctuation contexts and \b
    // is inconsistent across engines for those.
    const rx = new RegExp(`(^|[^\\p{L}])${escapeRx(src)}(?![\\p{L}])`, "giu");
    const before = working;
    working = working.replace(rx, (_full, prefix, offset) => {
      // Match case of the original substring at `offset + prefix.length`.
      const origStart = offset + prefix.length;
      const origSubstr = before.substr(origStart, src.length);
      return `${prefix}${matchCase(origSubstr, tgt)}`;
    });
    if (working !== before) anyReplaced = true;
  }

  if (anyReplaced) {
    return { text: working, translated: true, reason: "word_swaps" };
  }
  return { text, translated: false, reason: "no_pack_match" };
}

// ─── Detector · figure out which language a chat message is in ────────
//
// Reuses the same doctrine as the accommodation composer's
// `detectAccommodationReplyLang` — bounded ID markers, everything else
// defaults to EN. Kept separate here because the chat-message marker
// set is broader (chat covers logistics + greetings + feelings, not
// just accommodation vocabulary).
const CHAT_ID_MARKERS: RegExp[] = [
  /\b(halo|hai|selamat pagi|selamat siang|selamat malam|selamat tidur|sampai jumpa|dadah|selamat tinggal|selamat datang)\b/i,
  /\b(terima kasih|makasih|tolong|permisi|maaf|sama-sama|tidak masalah)\b/i,
  /\b(ya|tidak|tentu saja|tentu|mungkin|baik|oke)\b/i,
  /\b(apa kabar|siapa nama|kamu dari mana|berapa harganya|berapa|dimana|kapan|kenapa|bagaimana|siapa)\b/i,
  /\b(saya|aku|kamu|kita|kami|mereka)\b/i,
  /\b(sudah|belum|sekarang|nanti|besok|hari ini|malam ini|sebentar|tunggu sebentar|sedang di jalan|di sini|di sana|dekat|jauh)\b/i,
  /\b(senang|sedih|lelah|lapar|haus|murah|mahal|besar|kecil|buruk)\b/i,
];

export function detectChatMessageLang(message: string): Lang {
  return CHAT_ID_MARKERS.some((rx) => rx.test(message)) ? "id" : "en";
}
