// Staircase Advisor · Truth Retrieval (Philip 2026-08-01)
//
// "Bring nex alive to answer from truth herself" · phase 2 · full corpus.
//
// Takes a customer message · finds best-matching snippet in the indexed
// Philip-authored corpus · wraps in Nex voice. Same shape as truth-answer.ts
// but sourced automatically from the full library instead of hand-coded.
//
// Grounding: every snippet is VERBATIM from an approved Philip file
// (Section 8 contract enforced by truth-index.ts). No invention · no LLM.

import "server-only";
import { getTruthIndex, type IndexedSnippet } from "./truth-index";

const NEX_INTROS: Record<IndexedSnippet["section_type"], string[]> = {
  faq: [
    "That's a fair question — here's the honest answer.",
    "This one comes up a lot.",
    "Worth explaining properly.",
  ],
  principle: [
    "This is one of the design principles worth understanding.",
    "There's a principle here that shapes the answer.",
  ],
  description: [
    "Here's what's worth knowing.",
    "The short version:",
  ],
  list: [
    "The options usually break down like this.",
    "There are a few directions to consider.",
  ],
  other: [
    "Here's what I can tell you.",
    "On that topic:",
  ],
};

const NEX_FOLLOWUP = "Would you like to keep exploring your project direction?";

// Minimum score for retrieval to hijack the turn. With the new scoring
// (title×10 + body×2 + bonuses), a single title-token match = 10 and any
// body-only match maxes out around 4-6. Setting threshold to 10 = at least
// one title-token match required · below that, fall through to Runtime Core.
const MIN_MATCH_SCORE = 10;

// Tokens that appear in almost every staircase message · zero ranking signal
const COMMON_TOKENS = new Set([
  "staircase", "staircases", "stair", "stairs",
  "the", "a", "an", "for", "of", "to", "in", "on", "and", "or", "but",
  "i", "me", "my", "you", "your", "we", "us", "our",
  "is", "are", "am", "be", "was", "were",
  "with", "about", "at", "by",
  "can", "could", "will", "would", "should",
  "have", "has", "had", "do", "does", "did",
  "not", "no", "yes",
  "this", "that", "these", "those",
  "what", "how", "when", "why", "which",
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

function scoreSnippet(msgTokens: string[], snippet: IndexedSnippet): number {
  const distinctive = msgTokens.filter((t) => !COMMON_TOKENS.has(t));
  if (distinctive.length === 0) return 0;

  const sectionTokens = new Set(
    snippet.section.toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !COMMON_TOKENS.has(t))
      .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)),
  );

  // Title-token match · strongest signal
  let titleHits = 0;
  for (const t of distinctive) if (sectionTokens.has(t)) titleHits += 1;

  // Body-token overlap · secondary signal
  let bodyHits = 0;
  for (const t of distinctive) if (snippet.tokens.has(t)) bodyHits += 1;

  // Exact-title bonus · if the section title is FULLY covered by the query
  // (every title distinctive token appears in the query), the snippet is
  // almost certainly the direct answer. Example: query "what is a tread"
  // matches title "Tread" perfectly · beats "Should every tread look identical?"
  // which has extra title tokens not in the query.
  const distinctiveSet = new Set(distinctive);
  let titleFullyCovered = sectionTokens.size > 0;
  for (const t of sectionTokens) if (!distinctiveSet.has(t)) { titleFullyCovered = false; break; }
  const exactTitleBonus = titleFullyCovered && titleHits > 0 ? 15 : 0;

  // Small tiebreakers
  const messageIsQuestion = /\b(what|how|when|why|should|can|is|are|do|does|which)\b/i.test(msgTokens.join(" "));
  const qBonus     = (messageIsQuestion && snippet.is_question) ? 1 : 0;
  const focusBonus = snippet.text.length < 300 ? 1 : 0;

  return titleHits * 10 + bodyHits * 2 + exactTitleBonus + qBonus + focusBonus;
}

export type TruthRetrievalResult = {
  snippet: IndexedSnippet;
  text:    string;
  sources: string[];
  score:   number;
};

/**
 * Retrieve best-matching Philip snippet for a customer message.
 * Returns null when no snippet scores above threshold (falls through to Runtime Core).
 */
export function retrieveTruth(message: string): TruthRetrievalResult | null {
  const index = getTruthIndex();
  if (index.length === 0) return null;

  const msgTokens = tokenize(message);
  if (msgTokens.length === 0) return null;

  let best: IndexedSnippet | null = null;
  let bestScore = 0;
  for (const snippet of index) {
    const s = scoreSnippet(msgTokens, snippet);
    if (s > bestScore) {
      bestScore = s;
      best = snippet;
    }
  }

  if (!best || bestScore < MIN_MATCH_SCORE) return null;

  const introVariants = NEX_INTROS[best.section_type] ?? NEX_INTROS.other;
  const intro = introVariants[best.id.length % introVariants.length];

  // Clean snippet · strip any residual markdown headings and normalise bullets
  const clean = best.text
    .replace(/^\s*#{1,6}\s+.*$/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const text = `${intro} ${clean}\n\n${NEX_FOLLOWUP}`;

  return {
    snippet: best,
    text,
    sources: [`${best.file} · ${best.section}`],
    score:   bestScore,
  };
}
