// src/lib/nex-native/safechat/vocabulary-reader.test.ts
//
// Hermetic unit tests for the SafeChat vocabulary matcher. No DB, no
// network. The matcher takes an in-memory index so we never need to
// stub pg here.

import { describe, expect, test } from "vitest";
import {
  containsAsWholeWord,
  matchVocabulary,
  normaliseForMatch,
} from "./vocabulary-reader";
import type { VocabularyMatch } from "./types";

function makeIndex(
  rows: Array<Pick<VocabularyMatch, "term" | "category" | "severity" | "language"> & {
    normalisedTerm: string;
    termId: string;
  }>,
): Map<string, VocabularyMatch[]> {
  const map = new Map<string, VocabularyMatch[]>();
  for (const r of rows) {
    const match: VocabularyMatch = {
      termId: r.termId,
      term: r.term,
      category: r.category,
      severity: r.severity,
      language: r.language,
    };
    const bucket = map.get(r.normalisedTerm);
    if (bucket) bucket.push(match);
    else map.set(r.normalisedTerm, [match]);
  }
  return map;
}

describe("normaliseForMatch", () => {
  test("lowercases", () => {
    expect(normaliseForMatch("HELLO")).toBe("hello");
  });

  test("collapses whitespace", () => {
    expect(normaliseForMatch("hello   world")).toBe("hello world");
  });

  test("trims leading + trailing whitespace", () => {
    expect(normaliseForMatch("  hi  ")).toBe("hi");
  });

  test("handles tabs + newlines", () => {
    expect(normaliseForMatch("hi\tthere\nyou")).toBe("hi there you");
  });
});

describe("containsAsWholeWord", () => {
  test("single-word hit at start", () => {
    expect(containsAsWholeWord("drugs are bad", "drugs")).toBe(true);
  });

  test("single-word hit in middle", () => {
    expect(containsAsWholeWord("i love drugs", "drugs")).toBe(true);
  });

  test("single-word rejects substring", () => {
    expect(containsAsWholeWord("drugstore is open", "drugs")).toBe(false);
  });

  test("single-word rejects prefix inside bigger word", () => {
    expect(containsAsWholeWord("adrugstore", "drugs")).toBe(false);
  });

  test("accepts hyphenated boundary", () => {
    // the hyphen is not a letter · counts as a boundary
    expect(containsAsWholeWord("anti-drugs campaign", "drugs")).toBe(true);
  });

  test("empty term returns false", () => {
    expect(containsAsWholeWord("anything", "")).toBe(false);
  });

  test("empty text returns false", () => {
    expect(containsAsWholeWord("", "drugs")).toBe(false);
  });
});

describe("matchVocabulary · single-word", () => {
  test("fires on exact token match", () => {
    const idx = makeIndex([
      { termId: "t1", term: "drugs", normalisedTerm: "drugs", category: "drugs", severity: 2, language: "en" },
    ]);
    const matches = matchVocabulary({
      normalisedText: "the drugs were strong",
      languages: ["en"],
      vocabIndex: idx,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.termId).toBe("t1");
  });

  test("does not fire on substring", () => {
    const idx = makeIndex([
      { termId: "t1", term: "ass", normalisedTerm: "ass", category: "sexual_slang", severity: 1, language: "en" },
    ]);
    const matches = matchVocabulary({
      normalisedText: "pass the salt",
      languages: ["en"],
      vocabIndex: idx,
    });
    expect(matches).toHaveLength(0);
  });

  test("respects language filter", () => {
    const idx = makeIndex([
      { termId: "t1", term: "drugs", normalisedTerm: "drugs", category: "drugs", severity: 2, language: "en" },
      { termId: "t2", term: "narkoba", normalisedTerm: "narkoba", category: "drugs", severity: 2, language: "id" },
    ]);
    const enOnly = matchVocabulary({
      normalisedText: "narkoba drugs",
      languages: ["en"],
      vocabIndex: idx,
    });
    expect(enOnly).toHaveLength(1);
    expect(enOnly[0]!.termId).toBe("t1");
  });
});

describe("matchVocabulary · multi-word", () => {
  test("fires on exact phrase", () => {
    const idx = makeIndex([
      { termId: "t1", term: "send me a pic", normalisedTerm: "send me a pic", category: "image_request", severity: 2, language: "en" },
    ]);
    const matches = matchVocabulary({
      normalisedText: "please send me a pic please",
      languages: ["en"],
      vocabIndex: idx,
    });
    expect(matches).toHaveLength(1);
  });

  test("does not fire on partial phrase", () => {
    const idx = makeIndex([
      { termId: "t1", term: "send me a pic", normalisedTerm: "send me a pic", category: "image_request", severity: 2, language: "en" },
    ]);
    const matches = matchVocabulary({
      normalisedText: "send me",
      languages: ["en"],
      vocabIndex: idx,
    });
    expect(matches).toHaveLength(0);
  });
});

describe("matchVocabulary · edge cases", () => {
  test("empty text returns empty", () => {
    const idx = makeIndex([
      { termId: "t1", term: "x", normalisedTerm: "x", category: "drugs", severity: 1, language: "en" },
    ]);
    expect(
      matchVocabulary({ normalisedText: "", languages: ["en"], vocabIndex: idx }),
    ).toEqual([]);
  });

  test("empty index returns empty", () => {
    const idx = new Map<string, VocabularyMatch[]>();
    expect(
      matchVocabulary({ normalisedText: "hello", languages: ["en"], vocabIndex: idx }),
    ).toEqual([]);
  });

  test("one text can produce multiple matches", () => {
    const idx = makeIndex([
      { termId: "t1", term: "drugs", normalisedTerm: "drugs", category: "drugs", severity: 2, language: "en" },
      { termId: "t2", term: "guns", normalisedTerm: "guns", category: "violence", severity: 2, language: "en" },
    ]);
    const matches = matchVocabulary({
      normalisedText: "drugs and guns",
      languages: ["en"],
      vocabIndex: idx,
    });
    expect(matches).toHaveLength(2);
  });

  test("two terms sharing the same normalisedTerm fan out to both languages", () => {
    const idx = makeIndex([
      { termId: "t1", term: "no", normalisedTerm: "no", category: "coercion_indicator", severity: 1, language: "en" },
      { termId: "t2", term: "no", normalisedTerm: "no", category: "coercion_indicator", severity: 1, language: "id" },
    ]);
    const matches = matchVocabulary({
      normalisedText: "no",
      languages: ["en", "id"],
      vocabIndex: idx,
    });
    expect(matches).toHaveLength(2);
  });
});
