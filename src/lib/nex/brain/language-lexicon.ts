// src/lib/nex/brain/language-lexicon.ts
//
// NEX Language Intelligence · Lexicon Expansion
// Philip 2026-09-05 · scope: lexicon expansion only (owner-selected option)
//
// SCOPE (locked)
//   This file catalogues English vocabulary that NEX's classifier
//   recognises by CATEGORY. It does NOT perform sense disambiguation,
//   morphological analysis, grammar checking, homophone routing, or
//   phrase generation. Those capabilities require their own explicit
//   AUTHORIZE and are deliberately NOT built here.
//
//   Success criterion for this slice: for a given lemma, NEX knows
//   (a) which semantic category it belongs to, and (b) whether it is
//   polysemous / has homophone alternatives. That's it.
//
//   Downstream disambiguation is a future consumer of this data — not
//   part of this slice.
//
// ANTI-CLAIM DISCIPLINE
//   Do not read this file as "NEX understands these words." Read it as
//   "NEX has a first-class lookup table for these words." Understanding
//   requires selecting the right sense in context, which this slice
//   deliberately doesn't attempt.

// ─── VERB CATEGORIES ────────────────────────────────────────────
//
// One set per semantic class. A verb may appear in multiple sets
// (e.g. "lead" is both PEDAGOGICAL_VERBS and polysemous with a noun
// sense — see POLYSEMOUS_WORDS below).

/** Motion / bodily action. */
export const MOTION_VERBS = new Set([
  "run", "jump", "walk", "swim", "fly", "drive", "ride",
  "sit", "stand", "sleep", "wake",
  "fall", "rise", "arrive", "depart", "enter", "exit", "leave",
  "chase", "escape",
]);

/** Consumption / intake. */
export const CONSUMPTION_VERBS = new Set([
  "eat", "drink",
]);

/** Creation / making / altering. */
export const CREATION_VERBS = new Set([
  "create", "build", "make", "break", "fix", "mend",
  "cook", "bake", "draw", "paint", "write", "sing", "dance",
]);

/** Sensory perception. */
export const SENSORY_VERBS = new Set([
  "see", "hear", "watch", "look", "touch", "feel", "listen",
]);

/** Cognition. */
export const COGNITION_VERBS = new Set([
  "think", "believe", "know", "understand", "remember", "forget",
  "misunderstand",
]);

/** Emotion / desire. */
export const EMOTION_VERBS = new Set([
  "love", "hate", "like", "dislike",
  "want", "need", "wish", "hope",
]);

/** Communication. */
export const COMMUNICATION_VERBS = new Set([
  "speak", "talk", "tell", "ask", "answer", "reply",
  "explain", "describe", "define",
  "translate", "interpret",
  "argue", "debate", "discuss",
  "agree", "disagree",
  "demand", "offer",
]);

/** Transaction / commerce. */
export const TRANSACTION_VERBS = new Set([
  "buy", "sell", "pay", "cost", "spend", "save", "earn",
]);

/** Possession / transfer. */
export const POSSESSION_VERBS = new Set([
  "give", "take", "bring", "carry", "push", "pull", "lift", "drop",
  "receive",
]);

/** Cleanliness / condition. */
export const MAINTENANCE_VERBS = new Set([
  "clean", "wash", "dirty", "soil",
]);

/** Provenance / discovery — pre-existing category (extended). */
export const PROVENANCE_VERBS = new Set([
  "find", "seek", "hide", "show",
  "source", "retrieve", "pull", "come", "came", "coming",
  "discover", "get", "got", "getting", "gets",
  "lose",
]);

/** State change / persistence. */
export const STATE_VERBS = new Set([
  "change", "stay", "remain", "continue", "repeat",
  "copy", "paste", "delete", "erase",
  "grow", "shrink",
  "open", "close", "shut", "lock", "unlock",
  "start", "begin", "stop", "end", "finish",
]);

/** Evaluation / verification. */
export const EVALUATION_VERBS = new Set([
  "test", "check", "verify", "confirm", "deny",
  "refuse", "accept",
  "try", "attempt",
  "fail", "succeed", "win",
]);

/** Learning / instruction. */
export const PEDAGOGICAL_VERBS = new Set([
  "study", "learn", "teach", "guide", "lead", "follow",
  "work", "play", "read",
]);

/** All verb lemmas, union of the categories above. */
export const ALL_VERB_LEMMAS: ReadonlySet<string> = new Set<string>([
  ...MOTION_VERBS, ...CONSUMPTION_VERBS, ...CREATION_VERBS,
  ...SENSORY_VERBS, ...COGNITION_VERBS, ...EMOTION_VERBS,
  ...COMMUNICATION_VERBS, ...TRANSACTION_VERBS, ...POSSESSION_VERBS,
  ...MAINTENANCE_VERBS, ...PROVENANCE_VERBS, ...STATE_VERBS,
  ...EVALUATION_VERBS, ...PEDAGOGICAL_VERBS,
]);

/** Category label for a verb. Returns null if the token is not a
 *  catalogued verb. Returns the FIRST matching category — a verb may
 *  belong to multiple sets (see `verbCategories()`). */
export type VerbCategory =
  | "motion" | "consumption" | "creation" | "sensory" | "cognition"
  | "emotion" | "communication" | "transaction" | "possession"
  | "maintenance" | "provenance" | "state" | "evaluation" | "pedagogical";

const VERB_CATEGORY_MAP: Array<[Set<string>, VerbCategory]> = [
  [MOTION_VERBS, "motion"],
  [CONSUMPTION_VERBS, "consumption"],
  [CREATION_VERBS, "creation"],
  [SENSORY_VERBS, "sensory"],
  [COGNITION_VERBS, "cognition"],
  [EMOTION_VERBS, "emotion"],
  [COMMUNICATION_VERBS, "communication"],
  [TRANSACTION_VERBS, "transaction"],
  [POSSESSION_VERBS, "possession"],
  [MAINTENANCE_VERBS, "maintenance"],
  [PROVENANCE_VERBS, "provenance"],
  [STATE_VERBS, "state"],
  [EVALUATION_VERBS, "evaluation"],
  [PEDAGOGICAL_VERBS, "pedagogical"],
];

export function verbCategory(token: string): VerbCategory | null {
  const t = (token || "").toLowerCase();
  for (const [set, label] of VERB_CATEGORY_MAP) {
    if (set.has(t)) return label;
  }
  return null;
}

export function verbCategories(token: string): VerbCategory[] {
  const t = (token || "").toLowerCase();
  const out: VerbCategory[] = [];
  for (const [set, label] of VERB_CATEGORY_MAP) {
    if (set.has(t)) out.push(label);
  }
  return out;
}

// ─── ADVERB CATEGORIES ──────────────────────────────────────────

/** Speed. */
export const SPEED_ADVERBS = new Set([
  "quickly", "slowly", "fast", "rapidly",
  "suddenly", "abruptly", "immediately", "instantly", "promptly",
]);

/** Absolute time. */
export const TIME_ADVERBS = new Set([
  "early", "late", "now", "then", "soon", "later",
  "yesterday", "today", "tomorrow", "tonight",
]);

/** Frequency. */
export const FREQUENCY_ADVERBS = new Set([
  "always", "never", "sometimes", "often", "rarely", "seldom",
  "frequently", "occasionally", "usually", "generally", "normally", "typically",
]);

/** Manner. */
export const MANNER_ADVERBS = new Set([
  "perfectly", "terribly", "wonderfully", "beautifully", "uglily",
  "loudly", "softly", "quietly", "silently", "noisily",
  "politely", "rudely", "kindly", "meanly",
  "gently", "harshly", "roughly", "smoothly", "easily",
  "well", "badly", "poorly",
  "correctly", "incorrectly", "wrongly", "rightly",
  "truly", "falsely", "honestly", "dishonestly",
  "bravely", "cowardly",
  "carefully", "carelessly", "safely", "dangerously",
  "hard",
]);

/** Intensity / degree. */
export const INTENSITY_ADVERBS = new Set([
  "highly", "lowly", "deeply", "shallowly",
  "widely", "narrowly", "broadly", "closely", "distantly",
]);

/** Location. */
export const LOCATION_ADVERBS = new Set([
  "far", "near", "nearby",
  "here", "there", "everywhere", "nowhere", "somewhere", "anywhere",
  "inside", "outside", "indoors", "outdoors", "upstairs", "downstairs",
  "ahead", "behind", "forward", "backward", "sideways",
]);

/** Difficulty. Note: "difficulty" is grammatically a noun; catalogued
 *  here per the owner-provided list. Real adverbial forms: "with
 *  difficulty", "difficultly" — recorded but not asserted grammatical. */
export const DIFFICULTY_ADVERBS = new Set([
  "difficulty", "hard",
]);

/** All adverb lemmas. */
export const ALL_ADVERB_LEMMAS: ReadonlySet<string> = new Set<string>([
  ...SPEED_ADVERBS, ...TIME_ADVERBS, ...FREQUENCY_ADVERBS,
  ...MANNER_ADVERBS, ...INTENSITY_ADVERBS, ...LOCATION_ADVERBS,
  ...DIFFICULTY_ADVERBS,
]);

export type AdverbCategory =
  | "speed" | "time" | "frequency" | "manner"
  | "intensity" | "location" | "difficulty";

const ADVERB_CATEGORY_MAP: Array<[Set<string>, AdverbCategory]> = [
  [SPEED_ADVERBS, "speed"],
  [TIME_ADVERBS, "time"],
  [FREQUENCY_ADVERBS, "frequency"],
  [MANNER_ADVERBS, "manner"],
  [INTENSITY_ADVERBS, "intensity"],
  [LOCATION_ADVERBS, "location"],
  [DIFFICULTY_ADVERBS, "difficulty"],
];

export function adverbCategory(token: string): AdverbCategory | null {
  const t = (token || "").toLowerCase();
  for (const [set, label] of ADVERB_CATEGORY_MAP) {
    if (set.has(t)) return label;
  }
  return null;
}

export function adverbCategories(token: string): AdverbCategory[] {
  const t = (token || "").toLowerCase();
  const out: AdverbCategory[] = [];
  for (const [set, label] of ADVERB_CATEGORY_MAP) {
    if (set.has(t)) out.push(label);
  }
  return out;
}

// ─── POLYSEMOUS WORDS (homographs + homonyms) ───────────────────
//
// This catalogue MARKS words as polysemous and records their known
// senses. It does NOT pick between the senses — that requires context,
// POS tagging, or an LLM, and is out of scope for this slice.
//
// Downstream disambiguation modules can consult this catalogue via
// `isPolysemous(word)` and `sensesOf(word)`.

export type WordSense = {
  sense_id: string;
  pos: "noun" | "verb" | "adjective" | "adverb";
  gloss: string;
  /** True when the sense pronounces differently from other senses of
   *  the same spelling (heteronym / true homograph in the phonetic
   *  sense). False when spelling AND sound are identical (homonym). */
  distinct_pronunciation: boolean;
};

/** Homographs: same spelling, at least two senses that (usually)
 *  differ in pronunciation. Owner-provided list. */
const HOMOGRAPH_ENTRIES: Array<[string, WordSense[]]> = [
  ["lead", [
    { sense_id: "lead.guide.v",   pos: "verb", gloss: "to guide",              distinct_pronunciation: true },
    { sense_id: "lead.metal.n",   pos: "noun", gloss: "a heavy metal",          distinct_pronunciation: true },
  ]],
  ["tear", [
    { sense_id: "tear.drop.n",    pos: "noun", gloss: "a drop of water from the eye", distinct_pronunciation: true },
    { sense_id: "tear.rip.v",     pos: "verb", gloss: "to rip paper",           distinct_pronunciation: true },
  ]],
  ["wind", [
    { sense_id: "wind.air.n",     pos: "noun", gloss: "moving air",             distinct_pronunciation: true },
    { sense_id: "wind.turn.v",    pos: "verb", gloss: "to turn a clock key",    distinct_pronunciation: true },
  ]],
  ["live", [
    { sense_id: "live.alive.v",       pos: "verb",      gloss: "to be alive",         distinct_pronunciation: true },
    { sense_id: "live.broadcast.adj", pos: "adjective", gloss: "a real-time broadcast", distinct_pronunciation: true },
  ]],
  ["bow", [
    { sense_id: "bow.weapon.n",   pos: "noun", gloss: "a weapon for arrows",    distinct_pronunciation: true },
    { sense_id: "bow.bend.v",     pos: "verb", gloss: "to bend at the waist",   distinct_pronunciation: true },
  ]],
  ["minute", [
    { sense_id: "minute.time.n",     pos: "noun",      gloss: "a unit of time",  distinct_pronunciation: true },
    { sense_id: "minute.tiny.adj",   pos: "adjective", gloss: "extremely small", distinct_pronunciation: true },
  ]],
  ["bass", [
    { sense_id: "bass.fish.n",    pos: "noun", gloss: "a type of fish",         distinct_pronunciation: true },
    { sense_id: "bass.sound.n",   pos: "noun", gloss: "a deep sound",           distinct_pronunciation: true },
  ]],
  ["desert", [
    { sense_id: "desert.place.n",   pos: "noun", gloss: "a dry, sandy area",     distinct_pronunciation: true },
    { sense_id: "desert.abandon.v", pos: "verb", gloss: "to abandon someone",    distinct_pronunciation: true },
  ]],
  ["content", [
    { sense_id: "content.happy.adj", pos: "adjective", gloss: "happy and satisfied",       distinct_pronunciation: true },
    { sense_id: "content.ideas.n",   pos: "noun",      gloss: "the ideas inside a book",   distinct_pronunciation: true },
  ]],
  ["object", [
    { sense_id: "object.thing.n",     pos: "noun", gloss: "a physical thing",   distinct_pronunciation: true },
    { sense_id: "object.disagree.v",  pos: "verb", gloss: "to disagree",         distinct_pronunciation: true },
  ]],
  ["row", [
    { sense_id: "row.line.n",     pos: "noun", gloss: "a line of chairs",       distinct_pronunciation: true },
    { sense_id: "row.argument.n", pos: "noun", gloss: "a noisy argument",       distinct_pronunciation: true },
  ]],
  ["sow", [
    { sense_id: "sow.plant.v",    pos: "verb", gloss: "to plant seeds",         distinct_pronunciation: true },
    { sense_id: "sow.pig.n",      pos: "noun", gloss: "a female pig",           distinct_pronunciation: true },
  ]],
  ["close", [
    { sense_id: "close.near.adj", pos: "adjective", gloss: "near",              distinct_pronunciation: true },
    { sense_id: "close.shut.v",   pos: "verb",      gloss: "to shut a door",    distinct_pronunciation: true },
  ]],
  ["refuse", [
    { sense_id: "refuse.decline.v", pos: "verb", gloss: "to say no",            distinct_pronunciation: true },
    { sense_id: "refuse.waste.n",   pos: "noun", gloss: "garbage or waste",     distinct_pronunciation: true },
  ]],
  ["wound", [
    { sense_id: "wound.injury.n",   pos: "noun", gloss: "an injury",             distinct_pronunciation: true },
    { sense_id: "wound.wrapped.v",  pos: "verb", gloss: "wrapped around something", distinct_pronunciation: true },
  ]],
];

/** Homonyms: same spelling AND same sound, different meaning. */
const HOMONYM_ENTRIES: Array<[string, WordSense[]]> = [
  ["bark", [
    { sense_id: "bark.dog.n",  pos: "noun", gloss: "the sound a dog makes",     distinct_pronunciation: false },
    { sense_id: "bark.tree.n", pos: "noun", gloss: "the outer layer of a tree", distinct_pronunciation: false },
  ]],
  ["bat", [
    { sense_id: "bat.animal.n", pos: "noun", gloss: "a flying mammal",           distinct_pronunciation: false },
    { sense_id: "bat.sports.n", pos: "noun", gloss: "a wooden stick used in sports", distinct_pronunciation: false },
  ]],
  ["mean", [
    { sense_id: "mean.unkind.adj", pos: "adjective", gloss: "unkind",           distinct_pronunciation: false },
    { sense_id: "mean.signify.v",  pos: "verb",      gloss: "to signify or intend", distinct_pronunciation: false },
  ]],
  ["well", [
    { sense_id: "well.healthy.adj", pos: "adjective", gloss: "healthy",         distinct_pronunciation: false },
    { sense_id: "well.water.n",     pos: "noun",      gloss: "a deep hole for water", distinct_pronunciation: false },
  ]],
  ["watch", [
    { sense_id: "watch.look.v",   pos: "verb", gloss: "to look at something",   distinct_pronunciation: false },
    { sense_id: "watch.time.n",   pos: "noun", gloss: "a timepiece worn on the wrist", distinct_pronunciation: false },
  ]],
  ["fly", [
    { sense_id: "fly.insect.n", pos: "noun", gloss: "a small winged insect",    distinct_pronunciation: false },
    { sense_id: "fly.move.v",   pos: "verb", gloss: "to move through the air",  distinct_pronunciation: false },
  ]],
  ["scale", [
    { sense_id: "scale.weigh.n",  pos: "noun", gloss: "an instrument to weigh things", distinct_pronunciation: false },
    { sense_id: "scale.fish.n",   pos: "noun", gloss: "the outer flake on a fish",     distinct_pronunciation: false },
  ]],
  ["bank", [
    { sense_id: "bank.money.n", pos: "noun", gloss: "a place to keep money",     distinct_pronunciation: false },
    { sense_id: "bank.river.n", pos: "noun", gloss: "the side of a river",       distinct_pronunciation: false },
  ]],
  ["match", [
    { sense_id: "match.fire.n",  pos: "noun", gloss: "a small stick used to start a fire", distinct_pronunciation: false },
    { sense_id: "match.game.n",  pos: "noun", gloss: "a game between two teams",   distinct_pronunciation: false },
  ]],
  ["right", [
    { sense_id: "right.correct.adj", pos: "adjective", gloss: "correct",         distinct_pronunciation: false },
    { sense_id: "right.side.n",      pos: "noun",      gloss: "the opposite of left", distinct_pronunciation: false },
  ]],
  ["rock", [
    { sense_id: "rock.stone.n", pos: "noun", gloss: "a large stone",             distinct_pronunciation: false },
    { sense_id: "rock.music.n", pos: "noun", gloss: "a style of music",          distinct_pronunciation: false },
  ]],
  ["spring", [
    { sense_id: "spring.season.n", pos: "noun", gloss: "a season of the year",   distinct_pronunciation: false },
    { sense_id: "spring.coil.n",   pos: "noun", gloss: "a coiled metal wire",    distinct_pronunciation: false },
  ]],
  ["fair", [
    { sense_id: "fair.just.adj",     pos: "adjective", gloss: "just and equal",  distinct_pronunciation: false },
    { sense_id: "fair.festival.n",   pos: "noun",      gloss: "an outdoor festival", distinct_pronunciation: false },
  ]],
  ["trip", [
    { sense_id: "trip.journey.n", pos: "noun", gloss: "a journey",               distinct_pronunciation: false },
    { sense_id: "trip.stumble.v", pos: "verb", gloss: "to stumble and fall",     distinct_pronunciation: false },
  ]],
  ["palm", [
    { sense_id: "palm.hand.n",  pos: "noun", gloss: "the inside of your hand",   distinct_pronunciation: false },
    { sense_id: "palm.tree.n",  pos: "noun", gloss: "a type of tropical tree",   distinct_pronunciation: false },
  ]],
];

/** Combined polysemous map (homographs + homonyms). */
export const POLYSEMOUS_WORDS: ReadonlyMap<string, ReadonlyArray<WordSense>> = (() => {
  const m = new Map<string, WordSense[]>();
  for (const [word, senses] of HOMOGRAPH_ENTRIES) m.set(word, senses);
  for (const [word, senses] of HOMONYM_ENTRIES)   m.set(word, senses);
  return m;
})();

export function isPolysemous(word: string): boolean {
  return POLYSEMOUS_WORDS.has((word || "").toLowerCase());
}

export function sensesOf(word: string): ReadonlyArray<WordSense> {
  return POLYSEMOUS_WORDS.get((word || "").toLowerCase()) ?? [];
}

// ─── HOMOPHONE GROUPS ───────────────────────────────────────────
//
// Different spellings, same sound. Matter primarily when the message
// arrives via STT (voice input) and the transcriber picked one
// spelling. This catalogue records the groups so a future homophone-
// aware disambiguation layer can consult them. This slice does NOT
// perform routing.

/** Every group is a list of spellings that share pronunciation. */
export const HOMOPHONE_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
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

/** Return the homophone group a word belongs to (including itself),
 *  or [] if the word is not part of any catalogued group. */
export function homophonesOf(word: string): ReadonlyArray<string> {
  const t = (word || "").toLowerCase();
  for (const group of HOMOPHONE_GROUPS) {
    if (group.includes(t)) return group;
  }
  return [];
}

export function hasHomophones(word: string): boolean {
  return homophonesOf(word).length > 0;
}
