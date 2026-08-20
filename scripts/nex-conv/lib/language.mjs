// Language detection for NEX-Conv.
//
// Philip 2026-08-20 · Indonesian language-neutral layer · Phase 1.
// Re-detects on EVERY turn (no session lock). Customer can switch between
// languages mid-conversation and NEX follows: Indonesian turn → id,
// English turn → en. State stays language-neutral (canonical slugs);
// language is a per-turn presentation layer only.
//
// Regex-based · zero dependencies · deliberately conservative to avoid
// mis-classifying English staircase phrases as Indonesian.
//
// Doctrine (Owner-Provenanced Pricing + Commercial Model): existing
// English behaviour is the merge gate. Detection defaults to 'en' when
// signal is weak so no existing English test can regress.

/** Words that are HIGH-CONFIDENCE Indonesian markers. Presence of ANY
 *  one of these → 'id'. Chosen carefully to avoid English collisions —
 *  none of these are English words in staircase / building context. */
const HIGH_CONFIDENCE_ID_WORDS = [
  'saya', 'aku', 'kamu', 'anda',
  'halo', 'hai',
  'berapa', 'bagaimana', 'mengapa', 'kenapa', 'siapa',
  'ingin', 'mau', 'suka',
  'sebenarnya', 'sebetulnya', 'sebenernya',
  'terima', 'makasih',
  'sudah', 'belum', 'akan',
  'iya', 'tidak', 'bukan',
  'kalau', 'jika',
  'dengan', 'untuk', 'dari', 'atau',
  'yang', 'ini', 'itu',
  'saja', 'juga', 'lagi',
  'tolong', 'permisi',
];

const RX_ID = new RegExp(
  `\\b(${HIGH_CONFIDENCE_ID_WORDS.join('|')})\\b`,
  'i',
);

/**
 * Detect the language of a message.
 * Returns 'id' if any high-confidence Indonesian marker is present.
 * Otherwise 'en' (safe default · preserves English regression gate).
 *
 * Called every turn — no session lock. Customer can switch mid-conversation
 * and NEX follows.
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  return RX_ID.test(text) ? 'id' : 'en';
}

/** Return a human-readable language name for the system prompt. */
export function languageDisplayName(code) {
  switch (code) {
    case 'id': return 'Indonesian (Bahasa Indonesia)';
    case 'en':
    default:   return 'British English';
  }
}
