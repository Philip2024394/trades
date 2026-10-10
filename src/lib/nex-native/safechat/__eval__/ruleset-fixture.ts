// src/lib/nex-native/safechat/__eval__/ruleset-fixture.ts
//
// NEX SafeChat classification evaluation · in-memory mirror of the
// authoritative Phase 1 starter seed at
//   src/lib/nex-native/safechat/_seed-vocabulary.mjs
//
// WHY THIS FILE EXISTS
// -----------------------------------------------------------------
// The evaluation runner must call the sealed classifier code path
// (resolveLevel / computeConfidence / matchVocabulary / matchPatterns)
// without touching the live database. The DB layer is where the seed
// vocabulary + patterns land in production. For a hermetic evaluation
// we recreate the DB-side state in memory FROM THE SEED FILE verbatim,
// so the numbers reflect "what the classifier currently does when the
// production seed is applied."
//
// RULES OF ENGAGEMENT
// -----------------------------------------------------------------
//   · This fixture must mirror _seed-vocabulary.mjs exactly. If the
//     seed file is updated, this file must be updated in lockstep. A
//     drift between the two is a bug that corrupts the evaluation
//     results · the fixture is checked against the seed in a test.
//   · We do NOT alter the ruleset to influence evaluation outcomes.
//   · We do NOT add rules not present in the seed. Future seed
//     expansions require an ethics review (see doctrine), after which
//     this fixture is updated and the evaluation re-run.
//   · This fixture is CODE, not DATA · a drift from the seed is
//     identifiable in git diff.

import type {
  CompiledPattern,
  Severity,
  SignalType,
  VocabCategory,
  VocabularyMatch,
} from "../types";

export interface SeedVocabRow {
  readonly term: string;
  readonly category: VocabCategory;
  readonly severity: Severity;
  readonly language: "en" | "id";
}

export interface SeedPatternRow {
  readonly description: string;
  readonly regex: string;
  readonly language: "en" | "id";
  readonly signalType: SignalType;
  readonly severity: Severity;
}

// -----------------------------------------------------------------
// English vocabulary · mirror of ENGLISH_VOCAB in _seed-vocabulary.mjs
// -----------------------------------------------------------------
export const SEED_VOCAB_EN: readonly SeedVocabRow[] = [
  { term: "boobs", category: "sexual_slang", severity: 1, language: "en" },
  { term: "butt", category: "sexual_slang", severity: 1, language: "en" },
  { term: "sex", category: "explicit_sexual", severity: 2, language: "en" },
  { term: "nude", category: "explicit_sexual", severity: 2, language: "en" },
  { term: "naked", category: "explicit_sexual", severity: 2, language: "en" },
  { term: "kill", category: "violence", severity: 2, language: "en" },
  { term: "gun", category: "violence", severity: 2, language: "en" },
  { term: "suicide", category: "self_harm", severity: 3, language: "en" },
  { term: "drugs", category: "drugs", severity: 2, language: "en" },
  { term: "weed", category: "drugs", severity: 2, language: "en" },
  { term: "our little secret", category: "grooming_indicator", severity: 3, language: "en" },
  { term: "you're so mature", category: "grooming_indicator", severity: 3, language: "en" },
  { term: "do you trust me", category: "grooming_indicator", severity: 2, language: "en" },
  { term: "or else", category: "coercion_indicator", severity: 2, language: "en" },
  { term: "if you love me", category: "coercion_indicator", severity: 2, language: "en" },
  { term: "you owe me", category: "coercion_indicator", severity: 2, language: "en" },
  { term: "pic", category: "image_request", severity: 2, language: "en" },
  { term: "photo", category: "image_request", severity: 2, language: "en" },
  { term: "don't tell", category: "secrecy_request", severity: 3, language: "en" },
  { term: "meet up", category: "meeting_arrangement", severity: 2, language: "en" },
];

// -----------------------------------------------------------------
// Indonesian vocabulary · mirror of INDONESIAN_VOCAB
// -----------------------------------------------------------------
export const SEED_VOCAB_ID: readonly SeedVocabRow[] = [
  { term: "seks", category: "explicit_sexual", severity: 2, language: "id" },
  { term: "telanjang", category: "explicit_sexual", severity: 2, language: "id" },
  { term: "bugil", category: "explicit_sexual", severity: 2, language: "id" },
  { term: "bunuh", category: "violence", severity: 2, language: "id" },
  { term: "pistol", category: "violence", severity: 2, language: "id" },
  { term: "bunuh diri", category: "self_harm", severity: 3, language: "id" },
  { term: "narkoba", category: "drugs", severity: 2, language: "id" },
  { term: "ganja", category: "drugs", severity: 2, language: "id" },
  { term: "rahasia kita", category: "grooming_indicator", severity: 3, language: "id" },
  { term: "kamu dewasa", category: "grooming_indicator", severity: 2, language: "id" },
  { term: "kalau tidak", category: "coercion_indicator", severity: 2, language: "id" },
  { term: "kalau cinta aku", category: "coercion_indicator", severity: 2, language: "id" },
  { term: "foto", category: "image_request", severity: 2, language: "id" },
  { term: "jangan bilang", category: "secrecy_request", severity: 3, language: "id" },
  { term: "ketemuan", category: "meeting_arrangement", severity: 2, language: "id" },
];

// -----------------------------------------------------------------
// Patterns · mirror of PATTERNS array
// -----------------------------------------------------------------
export const SEED_PATTERNS: readonly SeedPatternRow[] = [
  {
    description: "en · explicit send-image request",
    regex: "send\\s+(me\\s+)?(a\\s+)?(pic|photo|picture|selfie|snap)",
    language: "en",
    signalType: "image_request",
    severity: 2,
  },
  {
    description: "en · show-me-your-X request",
    regex: "show\\s+me\\s+(your|some)\\s+\\w+",
    language: "en",
    signalType: "image_request",
    severity: 2,
  },
  {
    description: "en · don't tell someone (secrecy)",
    regex: "don[’']?t\\s+tell\\s+(your\\s+)?(mum|mom|parents|anyone|dad)",
    language: "en",
    signalType: "secrecy_request",
    severity: 3,
  },
  {
    description: "id · jangan bilang siapa-siapa (secrecy)",
    regex: "jangan\\s+bilang(\\s+siapa[-\\s]?siapa)?",
    language: "id",
    signalType: "secrecy_request",
    severity: 3,
  },
  {
    description: "en · let's meet up / can we meet",
    regex: "(let[’']?s|can\\s+we|wanna)\\s+(meet(\\s+up)?|hang\\s+out)",
    language: "en",
    signalType: "meeting_arrangement",
    severity: 2,
  },
  {
    description: "id · ayo ketemuan",
    regex: "(ayo|yuk)\\s+ketemuan",
    language: "id",
    signalType: "meeting_arrangement",
    severity: 2,
  },
  {
    description: "en · switch to WhatsApp / Signal / Telegram",
    regex: "(move|switch|go|chat|dm)\\s+(to|on)\\s+(whatsapp|signal|telegram|snapchat|insta|instagram)",
    language: "en",
    signalType: "platform_switch_invitation",
    severity: 2,
  },
  {
    description: "id · pindah ke WhatsApp / Telegram",
    regex: "pindah\\s+(ke|di)\\s+(whatsapp|wa|telegram|signal|snapchat|ig|instagram)",
    language: "id",
    signalType: "platform_switch_invitation",
    severity: 2,
  },
  {
    description: "en · repeated pressure after a refusal",
    regex: "(come\\s+on|please\\s+please|just\\s+(one|a\\s+little))",
    language: "en",
    signalType: "repeated_pressure_after_refusal",
    severity: 2,
  },
  {
    description: "en · age gap disclosure",
    regex: "i['’]?m\\s+\\d{2}\\s+(and|,)\\s+you['’]?re\\s+\\d{1,2}",
    language: "en",
    signalType: "age_gap_disclosure",
    severity: 3,
  },
];

/** Normalise a vocabulary term the same way the seed does
 *  (lowercase + whitespace collapse). */
function normalise(term: string): string {
  return term.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Build the vocab index (same shape as loadVocabularyForLanguages
 *  returns from the DB) from the seed rows. */
export function buildVocabIndex(
  rows: readonly SeedVocabRow[],
): ReadonlyMap<string, readonly VocabularyMatch[]> {
  const map = new Map<string, VocabularyMatch[]>();
  for (const [idx, row] of rows.entries()) {
    const key = normalise(row.term);
    const match: VocabularyMatch = {
      // Synthetic deterministic id · the classifier does not look at
      // the shape of the id, only treats it as a stable reference.
      termId: `fixture-${row.language}-${idx}`,
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

/** Compile the seed patterns with the same flags the production
 *  compiler uses (case-insensitive). Invalid regex (shouldn't happen
 *  for the audited seed) throws loudly here · we want the fixture
 *  tests to flag that drift immediately. */
export function compileSeedPatterns(
  rows: readonly SeedPatternRow[],
): readonly CompiledPattern[] {
  return rows.map((row, idx) => ({
    patternId: `fixture-pattern-${row.language}-${idx}`,
    signalType: row.signalType,
    severity: row.severity,
    language: row.language,
    regex: new RegExp(row.regex, "i"),
  }));
}

/** Convenience · build the full {vocabIndex, compiled} pair for a
 *  language set. The runner uses this. */
export function buildRulesetFixture(languages: readonly string[]): {
  readonly vocabIndex: ReadonlyMap<string, readonly VocabularyMatch[]>;
  readonly compiled: readonly CompiledPattern[];
} {
  const vocabRows = [
    ...(languages.includes("en") ? SEED_VOCAB_EN : []),
    ...(languages.includes("id") ? SEED_VOCAB_ID : []),
  ];
  const patternRows = SEED_PATTERNS.filter((p) =>
    languages.includes(p.language),
  );
  return {
    vocabIndex: buildVocabIndex(vocabRows),
    compiled: compileSeedPatterns(patternRows),
  };
}
