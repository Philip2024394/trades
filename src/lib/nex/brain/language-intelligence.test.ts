// src/lib/nex/brain/language-intelligence.test.ts
//
// NEX Language Intelligence · foundation tests.
// Philip 2026-09-05 · AUTHORIZE · NEX LANGUAGE INTELLIGENCE FOUNDATION

import { describe, it, expect } from "vitest";
import {
  extractInterrogative,
  extractReferents,
  classifyVerbSemantic,
  hasFromPostposition,
  hasSourceNoun,
  hasImperativeOpener,
  analyzeMessage,
  interpretIntent,
  annotateLexicon,
} from "./language-intelligence";

// ─── Interrogative extraction ───────────────────────────────────

describe("extractInterrogative", () => {
  it("finds 'where' at position 0", () => {
    expect(extractInterrogative("where you find them")).toBe("where");
  });
  it("finds 'how' at position 0", () => {
    expect(extractInterrogative("how did you find them?")).toBe("how");
  });
  it("finds 'what' at position 0", () => {
    expect(extractInterrogative("what's the source of these?")).toBe("what");
  });
  it("returns null when there's no interrogative in the first 3 tokens", () => {
    expect(extractInterrogative("find me a hotel please where")).toBeNull();
  });
  it("handles empty message", () => {
    expect(extractInterrogative("")).toBeNull();
  });
});

// ─── Referent extraction ────────────────────────────────────────

describe("extractReferents", () => {
  it("finds deictic plural 'them'", () => {
    const r = extractReferents("where you find them");
    expect(r).toEqual([{ kind: "deictic_plural", token: "them" }]);
  });
  it("finds deictic plural 'these'", () => {
    expect(extractReferents("where are these from?"))
      .toEqual([{ kind: "deictic_plural", token: "these" }]);
  });
  it("finds pronoun plural 'they'", () => {
    expect(extractReferents("where do they come from?"))
      .toContainEqual({ kind: "pronoun_plural", token: "they" });
  });
  it("finds deictic singular 'it'", () => {
    expect(extractReferents("where is it located?"))
      .toContainEqual({ kind: "deictic_singular", token: "it" });
  });
  it("finds ordinal 'first'", () => {
    expect(extractReferents("tell me about the first one"))
      .toContainEqual({ kind: "ordinal", token: "first" });
  });
  it("returns empty when no referent", () => {
    expect(extractReferents("find me a hotel in Jakarta")).toEqual([]);
  });
});

// ─── Verb-semantic classification ───────────────────────────────

describe("classifyVerbSemantic", () => {
  it("'find' → provenance", () => {
    expect(classifyVerbSemantic("where you find them")).toBe("provenance");
  });
  it("'found' → provenance", () => {
    expect(classifyVerbSemantic("how were these found?")).toBe("provenance");
  });
  it("'source' → provenance", () => {
    expect(classifyVerbSemantic("what source are these from?")).toBe("provenance");
  });
  it("'come' → provenance (for 'come from' idiom)", () => {
    expect(classifyVerbSemantic("where did these come from?")).toBe("provenance");
  });
  it("'is' → stative_location", () => {
    expect(classifyVerbSemantic("where is the hotel?")).toBe("stative_location");
  });
  it("'are' → stative_location", () => {
    expect(classifyVerbSemantic("where are the hotels?")).toBe("stative_location");
  });
  it("provenance wins when both appear", () => {
    // "where were these found" contains 'were' (stative) AND 'found' (provenance)
    expect(classifyVerbSemantic("where were these found?")).toBe("provenance");
  });
  it("no verb → other", () => {
    expect(classifyVerbSemantic("hotel")).toBe("other");
  });
});

// ─── Postposition / source-noun / imperative ────────────────────

describe("primitives", () => {
  it("hasFromPostposition: 'where are these from' → true", () => {
    expect(hasFromPostposition("where are these from?")).toBe(true);
  });
  it("hasFromPostposition: 'where are they' → false", () => {
    expect(hasFromPostposition("where are they?")).toBe(false);
  });
  it("hasSourceNoun: 'what source are these from' → true", () => {
    expect(hasSourceNoun("what source are these from?")).toBe(true);
  });
  it("hasSourceNoun: 'find me a hotel' → false", () => {
    expect(hasSourceNoun("find me a hotel")).toBe(false);
  });
  it("hasImperativeOpener: 'find me a hotel' → true", () => {
    expect(hasImperativeOpener("find me a hotel")).toBe(true);
  });
  it("hasImperativeOpener: 'where you find them' → false (interrogative-shape)", () => {
    expect(hasImperativeOpener("where you find them")).toBe(false);
  });
});

// ─── Feature aggregation ────────────────────────────────────────

describe("analyzeMessage · full feature vector", () => {
  it("'where you find them' → interrogative=where, deictic_plural, provenance", () => {
    const f = analyzeMessage("where you find them");
    expect(f.interrogative).toBe("where");
    expect(f.referents).toEqual([{ kind: "deictic_plural", token: "them" }]);
    expect(f.verb_semantic).toBe("provenance");
    expect(f.has_from_postposition).toBe(false);
    expect(f.has_source_noun).toBe(false);
    expect(f.imperative_opener).toBe(false);
  });
  it("'where are these from?' → interrogative=where, deictic_plural, stative, from=true", () => {
    const f = analyzeMessage("where are these from?");
    expect(f.interrogative).toBe("where");
    expect(f.referents).toEqual([{ kind: "deictic_plural", token: "these" }]);
    expect(f.verb_semantic).toBe("stative_location");
    expect(f.has_from_postposition).toBe(true);
  });
});

// ─── Intent composition · CORE SEMANTIC BOUNDARY ────────────────

describe("interpretIntent · result_provenance_followup shapes", () => {
  const provenanceInputs = [
    "where you find them",
    "where did you find these?",
    "where are these from?",
    "how did you find them?",
    "what source are these from?",
    "where did these come from?",
    "how did you find these?",
    "how were these found?",
    "how were these sourced?",
    "what is the source of these results?",
  ];
  for (const input of provenanceInputs) {
    it(`"${input}" → result_provenance_followup`, () => {
      const intent = interpretIntent(input);
      expect(intent.kind).toBe("result_provenance_followup");
    });
  }
});

describe("interpretIntent · location_query shapes", () => {
  const locationInputs = [
    "where is the hotel?",
    "where is it located?",
    "where is this restaurant?",
  ];
  for (const input of locationInputs) {
    it(`"${input}" → location_query`, () => {
      const intent = interpretIntent(input);
      expect(intent.kind).toBe("location_query");
    });
  }
});

describe("interpretIntent · ordinary shapes", () => {
  const ordinary = [
    "find me a hotel",
    "find me another hotel",
    "show me hotels near Malioboro",
    "find a hotel in Jakarta",
    "i am looking for hotel",
    "tell me more about the first one",
    "hello",
    "hi there",
  ];
  for (const input of ordinary) {
    it(`"${input}" → ordinary`, () => {
      const intent = interpretIntent(input);
      expect(intent.kind).toBe("ordinary");
    });
  }
});

// ─── SEMANTIC-VS-PHRASE PROOF ───────────────────────────────────
//
// This is the architectural guarantee. New surface forms that reuse
// the same feature primitives should classify correctly WITHOUT any
// added phrase-specific rule.

describe("semantic-not-phrase guarantee · novel surface forms", () => {
  it("'how did you retrieve them?' — never in any test list · classifies", () => {
    // 'retrieve' is in PROVENANCE_VERB_LEMMAS; 'them' is deictic_plural;
    // 'how' interrogative. This composition should Just Work.
    expect(interpretIntent("how did you retrieve them?").kind).toBe("result_provenance_followup");
  });
  it("'where did you pull those from?' — novel · classifies", () => {
    // 'pull' provenance verb, 'those' deictic_plural, 'from' postposition.
    // Any two of the three rules should catch this; belt-and-braces.
    expect(interpretIntent("where did you pull those from?").kind).toBe("result_provenance_followup");
  });
  it("'where did you get these?' — novel · classifies", () => {
    expect(interpretIntent("where did you get these?").kind).toBe("result_provenance_followup");
  });
  it("'where do they come from?' — novel · classifies", () => {
    // 'they' pronoun_plural + provenance 'come' + from postposition.
    expect(interpretIntent("where do they come from?").kind).toBe("result_provenance_followup");
  });
  it("'where can I find the hotel?' — imperative-like · NOT provenance", () => {
    // 'find' + 'the hotel' (singular) — the user is asking for location
    // help, not provenance of a prior result. No plural referent → not
    // a provenance follow-up.
    const intent = interpretIntent("where can I find the hotel?");
    expect(intent.kind).not.toBe("result_provenance_followup");
  });
});

// ─── Lexicon annotation integration ─────────────────────────────
//
// analyzeMessage() now returns a `lexicon` field populated from
// language-lexicon.ts. Existing intent-composition rules do NOT
// depend on this field — it's additive. The tests here guarantee
// the annotation is correct AND that no existing intent behaviour
// changed.

describe("annotateLexicon · surfaces verbs/adverbs/polysemy/homophones per-token", () => {
  it("'run quickly' → 1 motion verb + 1 speed adverb", () => {
    const a = annotateLexicon("run quickly");
    expect(a.verbs).toEqual([{ token: "run", categories: ["motion"] }]);
    expect(a.adverbs).toEqual([{ token: "quickly", categories: ["speed"] }]);
  });

  it("'I always eat here' → time+frequency-ish adverbs + consumption verb + location adverb", () => {
    const a = annotateLexicon("I always eat here");
    expect(a.verbs.map((v) => v.token)).toContain("eat");
    expect(a.adverbs.map((v) => v.token)).toEqual(expect.arrayContaining(["always", "here"]));
  });

  it("'i saw a lead bass yesterday' → 2 polysemous tokens + time adverb", () => {
    // 'lead' and 'bass' are both polysemous; 'yesterday' is a time adverb.
    const a = annotateLexicon("i saw a lead bass yesterday");
    const polysemous = a.polysemous_tokens.map((p) => p.token);
    expect(polysemous).toEqual(expect.arrayContaining(["lead", "bass"]));
    expect(a.adverbs.map((v) => v.token)).toContain("yesterday");
  });

  it("'their meat is here' → 3 homophone-group tokens (their, meat, here)", () => {
    // Note: 'here' is BOTH a homophone (here/hear) AND a location adverb —
    // both annotations should fire.
    const a = annotateLexicon("their meat is here");
    const homophones = a.homophone_tokens.map((h) => h.token);
    expect(homophones).toEqual(expect.arrayContaining(["their", "meat", "here"]));
    // 'here' also present as an adverb
    expect(a.adverbs.map((v) => v.token)).toContain("here");
  });

  it("empty message → all annotation arrays empty", () => {
    const a = annotateLexicon("");
    expect(a.verbs).toEqual([]);
    expect(a.adverbs).toEqual([]);
    expect(a.polysemous_tokens).toEqual([]);
    expect(a.homophone_tokens).toEqual([]);
  });

  it("case-insensitive · 'RUN' still detected", () => {
    const a = annotateLexicon("RUN");
    expect(a.verbs).toEqual([{ token: "run", categories: ["motion"] }]);
  });
});

describe("analyzeMessage includes lexicon annotation", () => {
  it("returns the lexicon field on every call", () => {
    const f = analyzeMessage("where you find them");
    expect(f.lexicon).toBeDefined();
    expect(f.lexicon.verbs.map((v) => v.token)).toContain("find");
  });

  it("adds 'them' as neither verb nor adverb (referent handled elsewhere)", () => {
    const f = analyzeMessage("where you find them");
    expect(f.lexicon.verbs.map((v) => v.token)).not.toContain("them");
    expect(f.lexicon.adverbs.map((v) => v.token)).not.toContain("them");
  });
});

// ─── REGRESSION GUARD · additive extension must not break intent ─
//
// The whole point of doing the lexicon additively: existing intent
// composition results must be byte-identical to before the expansion.
// If any of these fail, the intent contract broke.

describe("REGRESSION · intent composition unchanged after lexicon expansion", () => {
  const provenance = [
    "where you find them",
    "where did you find these?",
    "where are these from?",
    "how did you find them?",
    "what source are these from?",
    "where did these come from?",
    "how were these found?",
  ];
  for (const m of provenance) {
    it(`"${m}" still → result_provenance_followup`, () => {
      expect(interpretIntent(m).kind).toBe("result_provenance_followup");
    });
  }

  const location = ["where is the hotel?", "where is it located?"];
  for (const m of location) {
    it(`"${m}" still → location_query`, () => {
      expect(interpretIntent(m).kind).toBe("location_query");
    });
  }

  const ordinary = ["find me a hotel", "show me hotels near Malioboro"];
  for (const m of ordinary) {
    it(`"${m}" still → ordinary`, () => {
      expect(interpretIntent(m).kind).toBe("ordinary");
    });
  }
});
