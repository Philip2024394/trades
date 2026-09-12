// src/lib/nex-language-brain/spelling-normaliser.ts
//
// NEX1 · LANGUAGE BRAIN · DETERMINISTIC SPELLING NORMALISER v0.
//
// taught_by = master_ai_engineer · 2026-09-12
//
// Purpose: repair the small number of high-frequency typos native speakers
// (EN + ID) make in developer speech so that the intent bridge sees the
// intended word, not the wrong one. Deterministic dictionary lookup — no
// fuzzy matching, no probabilistic guessing, no LLM.
//
// Discipline:
//   · Corrections table is a fixed dictionary · additive only via teacher.
//   · Only whole-word corrections · never mid-word substitutions.
//   · Case-insensitive match · case-preserving replacement (Field→Field,
//     FIELD→FIELD, feild→field).
//   · Every applied correction is recorded on the result so the audit trail
//     shows exactly what was changed and why.
//   · Ambiguous corrections (multiple targets) are NOT applied — the pipeline
//     prefers refusal to guessing.

export interface Nex1SpellingCorrection {
  readonly original: string;
  readonly corrected: string;
  readonly position: number; // 0-based word index
}

export interface Nex1NormalisedUtterance {
  readonly original: string;
  readonly normalised: string;
  readonly corrections: readonly Nex1SpellingCorrection[];
}

/**
 * Seed dictionary of common EN + ID developer-speech typos. Keys are the
 * misspelling · values are the canonical form. Additions are teacher-only.
 *
 * Only include corrections that are UNAMBIGUOUS. If a typo could plausibly
 * mean two different words, leave it out — refuse-over-guess is the rule.
 */
const CORRECTIONS: Readonly<Record<string, string>> = Object.freeze({
  // English · common developer typos
  "teh": "the",
  "adn": "and",
  "nad": "and",
  "feild": "field",
  "feilds": "fields",
  "funciton": "function",
  "fucntion": "function",
  "funtion": "function",
  "retrun": "return",
  "reutrn": "return",
  "retrn": "return",
  "priorty": "priority",
  "priorty.": "priority",
  "prioroty": "priority",
  "proprty": "property",
  "propery": "property",
  "nubmer": "number",
  "numer": "number",
  "boolen": "boolean",
  "booelan": "boolean",
  "strig": "string",
  "sring": "string",
  "renmae": "rename",
  "renmame": "rename",
  "optioanl": "optional",
  "optinoal": "optional",
  "backwrds": "backwards",
  "backwards.": "backwards",
  "compatibale": "compatible",
  "compaible": "compatible",
  "immuatable": "immutable",
  "imutable": "immutable",
  "mutae": "mutate",
  "mutat": "mutate",
  "reservaton": "reservation",
  "resrvation": "reservation",
  "explict": "explicit",
  "explict.": "explicit",

  // Indonesian · common developer-speech typos
  "tolomg": "tolong",
  "tolonh": "tolong",
  "tolg": "tolong",
  "tambakhan": "tambahkan",
  "tambakan": "tambahkan",
  "tambhkan": "tambahkan",
  "perbaki": "perbaiki",
  "perbaik": "perbaiki",
  "batakan": "batalkan",
  "batalkn": "batalkan",
  "jaman": "jangan",
  "jangn": "jangan",
  "abikan": "abaikan",
  "abiakan": "abaikan",
  "bertype": "bertipe",
  "berripe": "bertipe",
  "propreti": "properti",
  "propeti": "properti",
  "angkq": "angka",
  "angk": "angka",
  "tekss": "teks",
  "teksz": "teks",
  "resrvasi": "reservasi",
});

/**
 * Preserve the casing pattern of the original word onto the canonical form.
 * Handles three common cases:
 *   · all-lower → all-lower  (feild → field)
 *   · Title-Case → Title-Case (Feild → Field)
 *   · ALL-CAPS → ALL-CAPS (FEILD → FIELD)
 * Mixed casing falls back to lower.
 */
function preserveCase(original: string, canonical: string): string {
  if (original === original.toUpperCase()) return canonical.toUpperCase();
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return canonical[0].toUpperCase() + canonical.slice(1);
  }
  return canonical;
}

/**
 * @summary Deterministically normalise an utterance by replacing known typos
 * with their canonical forms. Word boundaries are ASCII (letters + digits +
 * apostrophe). Punctuation adjacent to a word is preserved.
 *
 * Never guesses. If a token is not in the dictionary, it is left unchanged.
 */
export function normaliseSpelling(input: string): Nex1NormalisedUtterance {
  const original = input;
  const corrections: Nex1SpellingCorrection[] = [];
  // Split on non-word boundaries while preserving the separators for reassembly.
  // Word chars include apostrophes so "don't" stays intact.
  const parts = input.split(/([^A-Za-z']+)/);
  let wordIndex = -1;
  const out = parts.map((part) => {
    if (part.length === 0) return part;
    // Separators are strings of non-word chars · leave untouched.
    if (/^[^A-Za-z']+$/.test(part)) return part;
    wordIndex++;
    const lower = part.toLowerCase();
    const canonical = CORRECTIONS[lower];
    if (canonical && canonical !== lower) {
      const cased = preserveCase(part, canonical);
      corrections.push({ original: part, corrected: cased, position: wordIndex });
      return cased;
    }
    return part;
  });
  return {
    original,
    normalised: out.join(""),
    corrections,
  };
}

/**
 * @summary Return true if a normaliser change might have RESOLVED an
 * ambiguity — used by the pipeline to decide whether to log a "silent
 * spelling correction" event. Purely informational; does not gate behaviour.
 */
export function hasCorrections(n: Nex1NormalisedUtterance): boolean {
  return n.corrections.length > 0;
}
