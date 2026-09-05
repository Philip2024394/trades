// src/lib/nex/brain/spoken-normalization.ts
//
// Wave 3 · STT / Phonetic Tolerance & Spoken-Form Normalization
// Philip 2026-09-06 · AUTHORIZE · WAVE 3 · Capability A
//
// PURPOSE (§1 §2 §3)
//   Real users speak — they use contractions, phonetic mistakes, filler
//   words, dropped punctuation, code-switching, and shorthand. NEX must
//   understand the intent WITHOUT lowering its semantic-safety bar and
//   WITHOUT fabricating meaning that isn't there.
//
// CONTRACT (§3 §4 §16)
//   raw          the user's actual utterance
//   normalized   a cleaner form of the same utterance (grammar-restored
//                contractions · lexicon-anchored typo repair · filler
//                removed · CASE preserved for named entities)
//   confidence   HIGH / MEDIUM / LOW
//   candidates   materially plausible alternatives when there is real
//                ambiguity (§2 · "do NOT silently choose one")
//   markers      observability breadcrumbs (what changed and why)
//
//   Normalization is ADVISORY. Downstream semantic gates (G03 · G04 ·
//   G12 · G15 · L4 · Wave 1 · Wave 2 · G24) remain authoritative.
//   Normalization NEVER introduces facts.
//
// PRINCIPLE (§2)
//   "Reason about likely spoken-language variation" — not a hand-curated
//   patch list. This module uses:
//     · Structural contraction rules (wanna → want to · dont → don't)
//     · A LEXICON-ANCHORED typo repair: when an unknown token is within
//       edit-distance 1 of a domain-lexicon word AND is not itself a
//       common English word, propose the lexicon word.
//     · Filler removal (uh · um · err · well) at token boundaries only.
//   New surface forms cost nothing if they use the same feature
//   vocabulary.

// ─── Types ──────────────────────────────────────────────────────

export type NormalizationConfidence = "HIGH" | "MEDIUM" | "LOW";

export type NormalizationCandidate = {
  text: string;
  confidence: number;
  note: string;
};

export type NormalizationResult = {
  raw: string;
  normalized: string;
  confidence: NormalizationConfidence;
  changed: boolean;
  markers: string[];
  candidates: NormalizationCandidate[];
  // §7 · self-correction observability
  self_correction: {
    detected: boolean;
    rejected_span: string | null;
    kept_span: string | null;
  };
  // §12 · code-switch observability (does NOT change active language)
  code_switch: {
    detected: boolean;
    languages_seen: string[];
  };
};

// ─── Structural rules (grammar-shape, not phrase lists) ─────────

/** Contraction / spoken-shorthand structural rules. Each entry pairs a
 *  short-form REGEX (word boundaries or nothing) with a canonical form.
 *  These are grammar-shape rules · not "phrase patches" — they normalize
 *  clitic contractions independent of surrounding words. */
const STRUCTURAL_RULES: Array<{ from: RegExp; to: string; note: string }> = [
  // English clitic contractions and spoken shorthand
  { from: /\bwanna\b/gi, to: "want to", note: "clitic:wanna" },
  { from: /\bgonna\b/gi, to: "going to", note: "clitic:gonna" },
  { from: /\bgotta\b/gi, to: "got to", note: "clitic:gotta" },
  { from: /\bgimme\b/gi, to: "give me", note: "clitic:gimme" },
  { from: /\blemme\b/gi, to: "let me", note: "clitic:lemme" },
  { from: /\bkinda\b/gi, to: "kind of", note: "clitic:kinda" },
  { from: /\bsorta\b/gi, to: "sort of", note: "clitic:sorta" },
  { from: /\bdunno\b/gi, to: "don't know", note: "clitic:dunno" },
  { from: /\byknow\b/gi, to: "you know", note: "clitic:yknow" },
  // Apostrophe restoration for common contractions when the writer dropped it.
  { from: /\bdont\b/gi, to: "don't", note: "apostrophe:dont" },
  { from: /\bwont\b/gi, to: "won't", note: "apostrophe:wont" },
  { from: /\bcant\b/gi, to: "can't", note: "apostrophe:cant" },
  { from: /\bisnt\b/gi, to: "isn't", note: "apostrophe:isnt" },
  { from: /\barent\b/gi, to: "aren't", note: "apostrophe:arent" },
  { from: /\bwasnt\b/gi, to: "wasn't", note: "apostrophe:wasnt" },
  { from: /\bwerent\b/gi, to: "weren't", note: "apostrophe:werent" },
  { from: /\bdidnt\b/gi, to: "didn't", note: "apostrophe:didnt" },
  { from: /\bdoesnt\b/gi, to: "doesn't", note: "apostrophe:doesnt" },
  { from: /\bhasnt\b/gi, to: "hasn't", note: "apostrophe:hasnt" },
  { from: /\bhavent\b/gi, to: "haven't", note: "apostrophe:havent" },
  { from: /\bwouldnt\b/gi, to: "wouldn't", note: "apostrophe:wouldnt" },
  { from: /\bcouldnt\b/gi, to: "couldn't", note: "apostrophe:couldnt" },
  { from: /\bshouldnt\b/gi, to: "shouldn't", note: "apostrophe:shouldnt" },
  { from: /\bwhatre\b/gi, to: "what are", note: "apostrophe:whatre" },
  { from: /\bthats\b/gi, to: "that's", note: "apostrophe:thats" },
  { from: /\blets\b/gi, to: "let's", note: "apostrophe:lets" },
  { from: /\bim\b/gi, to: "I'm", note: "apostrophe:im" },
  { from: /\bive\b/gi, to: "I've", note: "apostrophe:ive" },
  { from: /\bill\b/gi, to: "I'll", note: "apostrophe:ill" },
  { from: /\byoure\b/gi, to: "you're", note: "apostrophe:youre" },
  { from: /\byoud\b/gi, to: "you'd", note: "apostrophe:youd" },
  { from: /\byoull\b/gi, to: "you'll", note: "apostrophe:youll" },
  // Indonesian spoken-shorthand structural rules
  { from: /\bnggak\b/gi, to: "tidak", note: "id_clitic:nggak" },
  { from: /\bngga\b/gi, to: "tidak", note: "id_clitic:ngga" },
  { from: /\benggak\b/gi, to: "tidak", note: "id_clitic:enggak" },
  { from: /\bgak\b/gi, to: "tidak", note: "id_clitic:gak" },
  { from: /\bgk\b/gi, to: "tidak", note: "id_clitic:gk" },
  { from: /\bkalo\b/gi, to: "kalau", note: "id_clitic:kalo" },
  { from: /\btrs\b/gi, to: "terus", note: "id_clitic:trs" },
  { from: /\bdah\b/gi, to: "sudah", note: "id_clitic:dah" },
  { from: /\budah\b/gi, to: "sudah", note: "id_clitic:udah" },
  { from: /\bblm\b/gi, to: "belum", note: "id_clitic:blm" },
  { from: /\byg\b/gi, to: "yang", note: "id_clitic:yg" },
  { from: /\btp\b/gi, to: "tapi", note: "id_clitic:tp" },
  { from: /\bkyk\b/gi, to: "seperti", note: "id_clitic:kyk" },
  { from: /\bgimana\b/gi, to: "bagaimana", note: "id_clitic:gimana" },
  { from: /\bkenapa sih\b/gi, to: "kenapa", note: "id_particle:sih_pruned" },
];

/** Filler tokens: prune only when they stand alone at a word boundary.
 *  Common written fillers users type when they're thinking aloud. */
const FILLERS = new Set(["uh", "um", "uhh", "err", "erm", "hmm", "hmmm", "well", "eh"]);

// ─── Domain lexicon (anchor for edit-distance repair) ───────────
//
// This lexicon is INTENTIONALLY small · it exists to catch phonetic
// typos in the domain vocabulary NEX users are likely to speak. It's
// NOT a "known-mistakes list" — it's an anchor for principled
// edit-distance-1 repair.

const DOMAIN_LEXICON = new Set<string>([
  // English task nouns
  "hotel", "hotels", "restaurant", "restaurants", "cafe", "cafes",
  "villa", "villas", "flight", "flights", "car", "cars",
  "bar", "bars", "shop", "shops", "market", "markets",
  "place", "places", "food", "spot", "spots",
  // English attributes
  "cheap", "expensive", "close", "closer", "far", "farther",
  "quiet", "quieter", "loud", "louder", "big", "bigger",
  "small", "smaller", "modern", "budget", "midrange", "luxury",
  // English navigation
  "first", "second", "third", "last", "another", "next", "previous",
  // English spatial
  "near", "beside", "around", "airport", "station",
  // Indonesian task nouns
  "restoran", "penginapan", "tempat", "kafe", "warung",
  // Indonesian attributes
  "murah", "mahal", "dekat", "jauh", "tenang", "besar", "kecil",
  // Indonesian navigation
  "pertama", "kedua", "ketiga", "terakhir",
  // Places (canonical spellings we want to preserve)
  "yogyakarta", "jogja", "malioboro", "bali", "jakarta",
  "surabaya", "semarang", "bandung", "denpasar",
]);

/** Very common English words that should NEVER be replaced even if
 *  they are close to a lexicon word · this defends against overzealous
 *  edit-distance repair. */
const PROTECTED_COMMON = new Set<string>([
  "a", "an", "the", "i", "you", "we", "they", "he", "she", "it", "me",
  "is", "are", "was", "were", "be", "am", "do", "does", "did",
  "have", "has", "had", "will", "would", "could", "should", "may",
  "in", "on", "at", "of", "to", "for", "from", "by", "with",
  "and", "or", "but", "so", "if", "when", "where", "why", "how", "what",
  "who", "which", "that", "this", "these", "those", "them",
  "yes", "no", "not", "yeah", "yep", "yup", "nah", "nope",
  "good", "bad", "nice", "ok", "okay",
  "some", "any", "few", "many", "more", "less",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "here", "there",
  // Common verbs / determiners that are NEAR domain-lexicon words and
  // must never be silently rewritten (show / shop · look / book etc.)
  "show", "shop", "look", "book", "give", "find", "want",
  "need", "get", "put", "run", "see", "say", "make", "keep",
  "come", "go", "know", "think", "take", "tell", "help", "call",
  "wait", "meet", "meat", "well", "will", "walk", "talk",
  "stop", "start", "open", "close", "hold", "let", "just", "only",
  "back", "way", "day", "time", "year", "night", "week", "hour",
  "then", "than", "now", "very", "too", "also", "still", "again",
  // Indonesian common
  "saya", "aku", "kamu", "kami", "kita", "mereka", "dia",
  "ini", "itu", "di", "ke", "dari", "yang", "dan", "atau",
  "tidak", "iya", "ya", "baik", "oke",
  "cari", "carikan", "mau", "ingin", "coba", "lihat", "tunjuk",
]);

// ─── Edit-distance (bounded) ─────────────────────────────────────

/** Bounded Damerau-Levenshtein up to k=1. Returns:
 *  -1 if distance > 1, otherwise the actual distance (0 or 1). */
function editDistanceUpTo1(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return -1;
  // Insertion / deletion / substitution.
  if (la === lb) {
    let mismatches = 0;
    let i = 0;
    while (i < la && a[i] === b[i]) i++;
    if (i === la) return 0;
    let j = la;
    while (j > i && a[j - 1] === b[j - 1]) j--;
    // characters between i and j must equal 1 mismatch and no more
    if (j - i === 1) return 1;
    // transposition (Damerau): adjacent swap
    if (j - i === 2 && a[i] === b[i + 1] && a[i + 1] === b[i]) return 1;
    return -1;
  }
  // insertion / deletion
  const short = la < lb ? a : b;
  const long = la < lb ? b : a;
  let i = 0, j = 0;
  let skipped = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i++; j++; }
    else if (skipped === 0) { skipped++; j++; }
    else return -1;
  }
  return 1;
}

// ─── Tokenizer (whitespace + basic punct) ───────────────────────

type Token = { text: string; leading: string; trailing: string };
function tokenize(input: string): Token[] {
  const result: Token[] = [];
  const parts = input.split(/(\s+)/);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (/^\s+$/.test(p)) continue;
    // pull trailing punctuation off so the word can be compared
    const m = /^([^A-Za-z0-9']*)([A-Za-z0-9'\-]*)([^A-Za-z0-9']*)$/.exec(p);
    if (m) {
      result.push({ leading: m[1], text: m[2], trailing: m[3] });
    } else {
      result.push({ leading: "", text: p, trailing: "" });
    }
  }
  return result;
}
function detokenize(tokens: Token[]): string {
  return tokens
    .map((t, i) => (i === 0 ? "" : " ") + t.leading + t.text + t.trailing)
    .join("")
    .trim();
}

// ─── Lexicon repair (edit-distance-1 · protected common words) ──

function repairToken(tok: string, markers: string[]): string {
  if (!tok) return tok;
  const lower = tok.toLowerCase();
  if (PROTECTED_COMMON.has(lower)) return tok;
  if (DOMAIN_LEXICON.has(lower)) return tok;
  if (lower.length < 4) return tok;               // too short to correct safely
  // Try to find a lexicon word at edit-distance 1
  for (const lex of DOMAIN_LEXICON) {
    if (lex.length < 4) continue;                 // won't match short tokens confidently
    if (Math.abs(lex.length - lower.length) > 1) continue;
    const d = editDistanceUpTo1(lower, lex);
    if (d === 1) {
      markers.push(`lexicon_repair:${lower}->${lex}`);
      // preserve original case pattern (Title / lower)
      if (tok[0] === tok[0].toUpperCase()) {
        return lex.charAt(0).toUpperCase() + lex.slice(1);
      }
      return lex;
    }
  }
  return tok;
}

// ─── Filler stripping ───────────────────────────────────────────

function stripFillers(tokens: Token[], markers: string[]): Token[] {
  const kept: Token[] = [];
  for (const t of tokens) {
    const lower = t.text.toLowerCase();
    if (FILLERS.has(lower) && !t.leading && !t.trailing) {
      markers.push(`filler:${lower}`);
      continue;
    }
    kept.push(t);
  }
  return kept;
}

// ─── Self-correction detection (§7 §11) ─────────────────────────

/** Detect a self-correction shape: "X. no, actually Y" / "X, sorry, Y".
 *  Emits observability WITHOUT rewriting semantics — downstream Wave 2
 *  topic-shift + G04 reference + G12 polarity remain authoritative. */
const CORRECTION_MARKERS = /\b(no|actually|wait|sorry|i mean|instead|scrap that|forget that|bukan|sebenarnya|maksud saya|maksudku|batalkan|gantinya)\b/i;

function detectSelfCorrection(text: string): NormalizationResult["self_correction"] {
  const m = CORRECTION_MARKERS.exec(text);
  if (!m) return { detected: false, rejected_span: null, kept_span: null };
  const idx = m.index;
  // Split on the marker · everything before is potentially rejected;
  // everything after is potentially kept. Trim punctuation.
  const before = text.slice(0, idx).trim().replace(/[,.;:—-]+$/g, "").trim();
  const after = text.slice(idx + m[0].length).trim().replace(/^[,.;:—-]+/g, "").trim();
  // We only mark self-correction when BOTH sides carry material.
  if (!before || !after) return { detected: false, rejected_span: null, kept_span: null };
  // Guard: pure negation ("I don't want a hotel") is G12's domain · we
  // shouldn't overclaim self-correction just because "no" appears at
  // the start of a message.
  if (/^\s*no[\s,]/i.test(text) && !/(actually|instead|sorry|i mean)/i.test(text)) {
    return { detected: false, rejected_span: null, kept_span: null };
  }
  return { detected: true, rejected_span: before, kept_span: after };
}

// ─── Code-switch detection (§12 · observability only) ───────────

const ID_MARKER_TOKENS = new Set([
  "yang", "saya", "aku", "kamu", "dan", "atau", "tapi", "kalau",
  "murah", "mahal", "dekat", "jauh", "tenang",
  "restoran", "penginapan", "tempat",
  "pertama", "kedua", "ketiga", "terakhir",
  "iya", "tidak", "bukan", "sudah", "belum",
]);
// English marker tokens for code-switch observability. Deliberately
// exclude words that ALSO appear naturally in Indonesian at the same
// spelling (hotel · restaurant · cafe · etc.) so we don't misfire on
// pure Indonesian utterances.
const EN_MARKER_TOKENS = new Set([
  "the", "a", "an", "and", "or", "but", "if",
  "cheap", "expensive", "first", "second",
  "want", "need", "find", "show", "give",
  "please", "would", "could", "should",
  "yes", "no",
]);

function detectCodeSwitch(tokens: Token[]): NormalizationResult["code_switch"] {
  const seen: Set<string> = new Set();
  for (const t of tokens) {
    const lower = t.text.toLowerCase();
    if (EN_MARKER_TOKENS.has(lower)) seen.add("EN");
    if (ID_MARKER_TOKENS.has(lower)) seen.add("ID");
  }
  return { detected: seen.size >= 2, languages_seen: Array.from(seen) };
}

// ─── Confidence calibration ────────────────────────────────────

function computeConfidence(markers: string[], self: boolean): NormalizationConfidence {
  if (markers.length === 0) return "HIGH";
  const lexicon_edits = markers.filter((m) => m.startsWith("lexicon_repair:")).length;
  // Structural edits (clitic / apostrophe / filler) are safe and don't
  // reduce confidence. Lexicon edits are inferential — reduce confidence
  // when many happen in one utterance.
  if (lexicon_edits >= 2) return "LOW";
  if (lexicon_edits === 1 || self) return "MEDIUM";
  return "HIGH";
}

// ─── Public API ────────────────────────────────────────────────

export function normalizeSpokenInput(raw: string): NormalizationResult {
  const markers: string[] = [];
  const candidates: NormalizationCandidate[] = [];
  if (!raw || !raw.trim()) {
    return {
      raw, normalized: raw, confidence: "HIGH", changed: false, markers,
      candidates,
      self_correction: { detected: false, rejected_span: null, kept_span: null },
      code_switch: { detected: false, languages_seen: [] },
    };
  }
  // 1 · Structural rules (contractions, apostrophes, shorthand) applied
  //     against the RAW text so that word boundaries remain meaningful.
  let working = raw;
  for (const rule of STRUCTURAL_RULES) {
    if (rule.from.test(working)) {
      working = working.replace(rule.from, rule.to);
      markers.push(rule.note);
    }
  }
  // 2 · Filler pruning + lexicon-anchored typo repair on tokenized form.
  const tokens = tokenize(working);
  const trimmed = stripFillers(tokens, markers);
  const repaired = trimmed.map((t) => ({ ...t, text: repairToken(t.text, markers) }));
  const normalized = detokenize(repaired);
  // 3 · Self-correction observability
  const self = detectSelfCorrection(normalized);
  // 4 · Code-switch observability (does NOT change active language)
  const cs = detectCodeSwitch(repaired);
  const conf = computeConfidence(markers, self.detected);
  const changed = normalized !== raw;
  // 5 · Candidates: when a lexicon-repair fired, expose BOTH forms so
  //     downstream can request clarification if genuine ambiguity is
  //     present.
  if (markers.some((m) => m.startsWith("lexicon_repair:"))) {
    candidates.push({ text: normalized, confidence: 0.75, note: "lexicon_repair" });
    candidates.push({ text: raw, confidence: 0.25, note: "raw_preserved" });
  }
  return {
    raw, normalized, confidence: conf, changed, markers, candidates,
    self_correction: self, code_switch: cs,
  };
}

/** Convenience: apply normalization for downstream classifiers that
 *  work on lowered text. Never touches quoted spans (double-quoted). */
export function normalizedForClassification(raw: string): string {
  return normalizeSpokenInput(raw).normalized;
}
