// src/lib/nex/brain/language-lexicon.test.ts
//
// NEX Language Intelligence · Lexicon Expansion tests.
// Philip 2026-09-05 · lexicon-only scope, category recognition.

import { describe, it, expect } from "vitest";
import {
  MOTION_VERBS, CONSUMPTION_VERBS, CREATION_VERBS, SENSORY_VERBS,
  COGNITION_VERBS, EMOTION_VERBS, COMMUNICATION_VERBS, TRANSACTION_VERBS,
  POSSESSION_VERBS, MAINTENANCE_VERBS, PROVENANCE_VERBS, STATE_VERBS,
  EVALUATION_VERBS, PEDAGOGICAL_VERBS, ALL_VERB_LEMMAS,
  SPEED_ADVERBS, TIME_ADVERBS, FREQUENCY_ADVERBS, MANNER_ADVERBS,
  INTENSITY_ADVERBS, LOCATION_ADVERBS, DIFFICULTY_ADVERBS, ALL_ADVERB_LEMMAS,
  verbCategory, verbCategories, adverbCategory, adverbCategories,
  isPolysemous, sensesOf, POLYSEMOUS_WORDS,
  hasHomophones, homophonesOf, HOMOPHONE_GROUPS,
} from "./language-lexicon";

// ─── Owner-supplied verb list · exhaustive membership check ─────
//
// Every lemma in the owner-supplied list must be recognised by
// verbCategory(). This is the "did you actually add them?" test.

describe("owner-supplied verbs · exhaustive membership", () => {
  const OWNER_VERBS = [
    "run", "jump", "walk", "swim", "fly", "drive", "ride",
    "sit", "stand", "sleep", "wake",
    "eat", "drink",
    "cook", "bake", "read", "write", "speak", "talk", "listen", "hear",
    "see", "watch", "look", "touch", "feel",
    "think", "believe", "know", "understand", "remember", "forget",
    "love", "hate", "like", "dislike", "want", "need", "wish", "hope",
    "create", "build", "make", "break", "fix", "mend",
    "clean", "wash", "dirty", "soil",
    "buy", "sell", "pay", "cost", "spend", "save", "earn", "lose",
    "find", "seek", "hide", "show", "tell", "ask", "answer", "reply",
    "demand", "offer",
    "give", "take", "bring", "carry", "push", "pull", "lift", "drop",
    "fall", "rise", "grow", "shrink",
    "change", "stay", "remain", "leave", "depart", "arrive", "enter", "exit",
    "open", "close", "shut", "lock", "unlock",
    "start", "begin", "stop", "end", "finish", "continue", "repeat",
    "copy", "paste", "delete", "erase",
    "draw", "paint", "sing", "dance", "play",
    "work", "study", "learn", "teach", "guide", "lead", "follow",
    "chase", "escape",
    "win", "fail", "succeed", "try", "attempt",
    "test", "check", "verify", "confirm", "deny", "refuse", "accept",
    "agree", "disagree", "argue", "debate", "discuss",
    "explain", "describe", "define", "translate", "interpret",
    "misunderstand",
  ];
  for (const lemma of OWNER_VERBS) {
    it(`"${lemma}" is a catalogued verb`, () => {
      expect(ALL_VERB_LEMMAS.has(lemma), `missing verb: ${lemma}`).toBe(true);
      expect(verbCategory(lemma)).not.toBeNull();
    });
  }
});

// ─── Owner-supplied adverb list · exhaustive membership check ───

describe("owner-supplied adverbs · exhaustive membership", () => {
  const OWNER_ADVERBS = [
    "quickly", "slowly", "fast", "rapidly", "suddenly", "abruptly",
    "immediately", "instantly", "promptly",
    "early", "late", "now", "then", "soon", "later",
    "yesterday", "today", "tomorrow", "tonight",
    "always", "never", "sometimes", "often", "rarely", "seldom",
    "frequently", "occasionally", "usually", "generally", "normally", "typically",
    "perfectly", "terribly", "wonderfully", "beautifully", "uglily",
    "loudly", "softly", "quietly", "silently", "noisily",
    "politely", "rudely", "kindly", "meanly",
    "gently", "harshly", "roughly", "smoothly", "easily",
    "difficulty", "hard",
    "well", "badly", "poorly",
    "correctly", "incorrectly", "wrongly", "rightly",
    "truly", "falsely", "honestly", "dishonestly",
    "bravely", "cowardly",
    "carefully", "carelessly", "safely", "dangerously",
    "highly", "lowly", "deeply", "shallowly",
    "widely", "narrowly", "broadly", "closely", "distantly",
    "far", "near", "nearby",
    "here", "there", "everywhere", "nowhere", "somewhere", "anywhere",
    "inside", "outside", "indoors", "outdoors", "upstairs", "downstairs",
    "ahead", "behind", "forward", "backward", "sideways",
  ];
  for (const lemma of OWNER_ADVERBS) {
    it(`"${lemma}" is a catalogued adverb`, () => {
      expect(ALL_ADVERB_LEMMAS.has(lemma), `missing adverb: ${lemma}`).toBe(true);
      expect(adverbCategory(lemma)).not.toBeNull();
    });
  }
});

// ─── Category-specific correctness ──────────────────────────────

describe("verb category assignment · sampled", () => {
  const cases: Array<[string, string]> = [
    ["run",       "motion"],
    ["swim",      "motion"],
    ["eat",       "consumption"],
    ["build",     "creation"],
    ["see",       "sensory"],
    ["think",     "cognition"],
    ["love",      "emotion"],
    ["speak",     "communication"],
    ["buy",       "transaction"],
    ["give",      "possession"],
    ["clean",     "maintenance"],
    ["find",      "provenance"],
    ["change",    "state"],
    ["verify",    "evaluation"],
    ["teach",     "pedagogical"],
  ];
  for (const [verb, cat] of cases) {
    it(`"${verb}" → ${cat}`, () => {
      expect(verbCategory(verb)).toBe(cat);
    });
  }
});

describe("adverb category assignment · sampled", () => {
  const cases: Array<[string, string]> = [
    ["quickly",     "speed"],
    ["yesterday",   "time"],
    ["always",      "frequency"],
    ["politely",    "manner"],
    ["deeply",      "intensity"],
    ["here",        "location"],
    ["difficulty",  "difficulty"],
  ];
  for (const [adv, cat] of cases) {
    it(`"${adv}" → ${cat}`, () => {
      expect(adverbCategory(adv)).toBe(cat);
    });
  }
});

// ─── Multi-category verbs (union queries) ───────────────────────

describe("verbCategories · returns all matching categories", () => {
  it("'find' is provenance only", () => {
    expect(verbCategories("find")).toEqual(["provenance"]);
  });
  it("lookup is case-insensitive", () => {
    expect(verbCategory("EAT")).toBe("consumption");
    expect(verbCategory("Buy")).toBe("transaction");
  });
});

// ─── Unknown token behaviour ────────────────────────────────────

describe("unknown tokens", () => {
  it("verbCategory returns null for non-verbs", () => {
    expect(verbCategory("hotel")).toBeNull();
    expect(verbCategory("")).toBeNull();
    expect(verbCategory("xyzzy")).toBeNull();
  });
  it("adverbCategory returns null for non-adverbs", () => {
    expect(adverbCategory("run")).toBeNull();
    expect(adverbCategory("")).toBeNull();
  });
});

// ─── Homographs · every owner-supplied word catalogued ──────────

describe("owner-supplied homographs · catalogued as polysemous", () => {
  const HOMOGRAPHS = [
    "lead", "tear", "wind", "live", "bow", "minute", "bass",
    "desert", "content", "object", "row", "sow", "close", "refuse", "wound",
  ];
  for (const w of HOMOGRAPHS) {
    it(`"${w}" is polysemous`, () => {
      expect(isPolysemous(w)).toBe(true);
      expect(sensesOf(w).length).toBeGreaterThanOrEqual(2);
    });
  }
});

// ─── Homonyms · every owner-supplied word catalogued ────────────

describe("owner-supplied homonyms · catalogued as polysemous", () => {
  const HOMONYMS = [
    "bark", "bat", "mean", "well", "watch", "fly", "scale",
    "bank", "match", "right", "rock", "spring", "fair", "trip", "palm",
  ];
  for (const w of HOMONYMS) {
    it(`"${w}" is polysemous`, () => {
      expect(isPolysemous(w)).toBe(true);
      expect(sensesOf(w).length).toBeGreaterThanOrEqual(2);
    });
  }
});

// ─── Sense metadata quality ─────────────────────────────────────

describe("polysemous entry quality · sampled", () => {
  it("'lead' has verb + noun senses with distinct_pronunciation", () => {
    const s = sensesOf("lead");
    expect(s.some((x) => x.pos === "verb" && /guide/i.test(x.gloss))).toBe(true);
    expect(s.some((x) => x.pos === "noun" && /metal/i.test(x.gloss))).toBe(true);
    expect(s.every((x) => x.distinct_pronunciation)).toBe(true);
  });
  it("'bark' has two noun senses with same pronunciation", () => {
    const s = sensesOf("bark");
    expect(s.length).toBe(2);
    expect(s.every((x) => x.pos === "noun")).toBe(true);
    expect(s.every((x) => !x.distinct_pronunciation)).toBe(true);
  });
  it("'right' has adjective + noun senses (correct + side)", () => {
    const s = sensesOf("right");
    expect(s.some((x) => /correct/i.test(x.gloss))).toBe(true);
    expect(s.some((x) => /left/i.test(x.gloss))).toBe(true);
  });
  it("every polysemous entry has ≥2 distinct sense_ids", () => {
    for (const [word, senses] of POLYSEMOUS_WORDS.entries()) {
      const ids = new Set(senses.map((s) => s.sense_id));
      expect(ids.size, `${word} has duplicate sense_ids`).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── Homophones · owner-supplied groups catalogued ──────────────

describe("owner-supplied homophones · all groups catalogued", () => {
  const OWNER_GROUPS: string[][] = [
    ["their", "there", "they're"],
    ["to", "too", "two"],
    ["your", "you're"],
    ["its", "it's"],
    ["here", "hear"],
    ["see", "sea"],
    ["break", "brake"],
    ["flour", "flower"],
    ["weak", "week"],
    ["right", "write"],
    ["sun", "son"],
    ["buy", "by", "bye"],
    ["cell", "sell"],
    ["meat", "meet"],
    ["piece", "peace"],
  ];
  for (const group of OWNER_GROUPS) {
    for (const word of group) {
      it(`"${word}" resolves to group [${group.join(", ")}]`, () => {
        expect(hasHomophones(word)).toBe(true);
        const resolved = homophonesOf(word);
        for (const alt of group) {
          expect(resolved.includes(alt), `${alt} missing from ${word}'s group`).toBe(true);
        }
      });
    }
  }
});

describe("homophone lookup · unknown word", () => {
  it("returns empty array for a word with no homophone group", () => {
    expect(homophonesOf("hotel")).toEqual([]);
    expect(hasHomophones("hotel")).toBe(false);
  });
});

// ─── HOMOPHONE_GROUPS invariant · every alternate resolves ──────

describe("HOMOPHONE_GROUPS · self-consistency", () => {
  it("every word in every group resolves to the same group", () => {
    for (const group of HOMOPHONE_GROUPS) {
      for (const word of group) {
        const resolved = homophonesOf(word);
        expect(resolved.length).toBe(group.length);
      }
    }
  });
});
