// src/lib/nex-native/safechat/vocabulary-reader.ts
//
// NEX SafeChat Phase 1 · vocabulary reader + matcher.
// Pure server-only. Reads active vocabulary rows for a language set
// and exposes a hot-path matcher that walks tokens of a normalised
// message and reports vocabulary matches.
//
// Doctrine:
//   · Only ACTIVE rows (deprecated_at IS NULL) are matched. Historical
//     rows remain in the DB for existing classification joins.
//   · Case-insensitive match via the normalised_term column.
//   · Multi-word terms are matched as whitespace-collapsed substrings
//     of the normalised text. Single-word terms are matched as whole
//     tokens (so a dictionary term like "cum" doesn't match
//     "cumulative"). This is a deliberate Phase 1 trade-off and is
//     documented in the doctrine as INCOMPLETE · future tuning may add
//     language-aware word boundaries.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type { VocabCategory, VocabularyMatch, VocabularyRow, Severity } from "./types";

/** Lowercase + collapse whitespace. Shared by the reader + the
 *  matcher so test fixtures stay faithful to real DB rows. */
export function normaliseForMatch(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Load every active vocabulary row for the given languages, indexed
 *  by normalised_term. The caller caches this per-request (do NOT
 *  cache at module scope · tests inject different fixtures).
 *  Returns an empty map when the DB pool is unavailable (dev / test). */
export async function loadVocabularyForLanguages(
  languages: readonly string[],
): Promise<ReadonlyMap<string, readonly VocabularyMatch[]>> {
  const map = new Map<string, VocabularyMatch[]>();
  if (languages.length === 0) return map;

  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT term_id::text AS term_id,
              term,
              normalised_term,
              language,
              category,
              severity
         FROM nex.safechat_vocabulary_term
        WHERE language = ANY ($1::text[])
          AND deprecated_at IS NULL`,
      [languages.slice()],
    );
    return r.rows.map((row) => {
      const rec = row as Record<string, unknown>;
      const v: VocabularyRow = {
        termId: String(rec.term_id),
        term: String(rec.term),
        normalisedTerm: String(rec.normalised_term),
        category: String(rec.category) as VocabCategory,
        severity: Number(rec.severity) as Severity,
        language: String(rec.language),
      };
      return v;
    });
  });

  const rows = result ?? [];
  for (const row of rows) {
    const key = row.normalisedTerm;
    const match: VocabularyMatch = {
      termId: row.termId,
      term: row.term,
      category: row.category,
      severity: row.severity,
      language: row.language,
    };
    const bucket = map.get(key);
    if (bucket) bucket.push(match);
    else map.set(key, [match]);
  }
  return map;
}

/** True when the string looks like a single word (no spaces). */
function isSingleWord(normalised: string): boolean {
  return !/\s/.test(normalised);
}

/** Walk the normalised message and emit a VocabularyMatch for every
 *  active term that fires. Multi-word terms match as whitespace-
 *  collapsed substrings. Single-word terms match as whole tokens
 *  bounded by non-letter characters. */
export function matchVocabulary(args: {
  readonly normalisedText: string;
  readonly languages: readonly string[];
  readonly vocabIndex: ReadonlyMap<string, readonly VocabularyMatch[]>;
}): readonly VocabularyMatch[] {
  const { normalisedText, languages, vocabIndex } = args;
  if (normalisedText.length === 0 || vocabIndex.size === 0) return [];
  const languageFilter = new Set(languages);
  const matches: VocabularyMatch[] = [];

  for (const [normalisedTerm, bucket] of vocabIndex.entries()) {
    const singleWord = isSingleWord(normalisedTerm);
    let hit = false;

    if (singleWord) {
      // Whole-token match · bounded by non-letter chars.
      // We intentionally do NOT use \b because unicode-letters are a
      // mess · instead we hand-roll a scan that accepts "letters" as
      // any character the regex /\p{L}/u reports as a letter.
      hit = containsAsWholeWord(normalisedText, normalisedTerm);
    } else {
      hit = normalisedText.includes(normalisedTerm);
    }

    if (!hit) continue;
    for (const m of bucket) {
      if (languageFilter.has(m.language)) matches.push(m);
    }
  }
  return matches;
}

/** True when `term` appears as a whole word in `text`. Letter class
 *  uses the unicode property \p{L}. */
export function containsAsWholeWord(text: string, term: string): boolean {
  if (term.length === 0) return false;
  let fromIndex = 0;
  while (fromIndex <= text.length) {
    const idx = text.indexOf(term, fromIndex);
    if (idx < 0) return false;
    const before = idx === 0 ? "" : text.charAt(idx - 1);
    const after =
      idx + term.length >= text.length ? "" : text.charAt(idx + term.length);
    if (!isLetter(before) && !isLetter(after)) return true;
    fromIndex = idx + 1;
  }
  return false;
}

function isLetter(ch: string): boolean {
  if (ch.length === 0) return false;
  return /\p{L}/u.test(ch);
}
