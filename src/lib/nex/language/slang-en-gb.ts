// src/lib/nex/language/slang-en-gb.ts
//
// Founder BEGIN 2026-09-10 · UK English slang starter dictionary.
// Founder-editable · additive. Grows as the founder uses NEX and phrases the
// engine can't resolve appear in the observability log.
//
// Only entries that meaningfully shift meaning · pure filler like "bloody"
// or "innit" stays out (they don't change the intent).
//
// Structure: surface_form (lowercased · space-normalised) → canonical_token
//   canonical_tokens are what intent-parser scores against.

export const UK_SLANG_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  // Contractions / spoken forms
  "gonna": "going to", "gunna": "going to", "wanna": "want to", "gotta": "have to",
  "kinda": "kind of", "sorta": "sort of", "outta": "out of",
  "y'know": "you know", "ya know": "you know",
  "cos": "because", "cuz": "because", "coz": "because",
  "n": "and", "&": "and", "+": "and",
  "u": "you", "ur": "your", "r": "are",
  "pls": "please", "plz": "please",
  "thx": "thanks", "ta": "thanks",
  "prob": "probably", "prolly": "probably",
  "def": "definitely",
  "obvs": "obviously",

  // People (may signal audience · not always removable)
  "bloke": "person", "mate": "person", "lad": "person", "lass": "person",
  "chap": "person", "geezer": "person", "guv": "person",
  "peeps": "people", "folks": "people", "guys": "people",

  // Slangy adjectives · map to functional canon
  "dodgy": "broken", "duff": "broken", "knackered": "broken", "buggered": "broken",
  "bust": "broken", "busted": "broken", "banjaxed": "broken",
  "wonky": "broken", "kaput": "broken", "banjo'd": "broken",
  "naff": "bad", "pants": "bad", "shite": "bad", "dire": "bad",
  "ropey": "unreliable", "ropy": "unreliable",
  "dead": "very", "well": "very", "proper": "very", "right": "very", "dead-on": "correct",
  "spot on": "correct", "bang on": "correct", "sound": "correct",
  "sorted": "fixed", "sussed": "figured out",
  "chuffed": "happy", "gutted": "unhappy", "made up": "happy",

  // Verbs · map to canonical action words nex1 recognises
  "chuck in": "add", "chuck on": "add", "bung in": "add", "bung on": "add",
  "slap on": "add", "stick in": "add", "stick on": "add", "shove in": "add",
  "throw in": "add", "throw on": "add",
  "whack in": "add", "whack on": "add",
  "knock up": "build", "knock together": "build", "knock out": "build",
  "sort out": "fix", "sort": "fix", "sort it": "fix",
  "patch up": "fix", "bodge": "fix",
  "rip out": "remove", "rip up": "remove", "yank out": "remove",
  "bin it": "remove", "bin": "remove", "chuck out": "remove", "toss": "remove",
  "have a butcher's": "look at", "have a gander": "look at", "have a look": "look at",
  "give it a bash": "try", "give it a go": "try", "have a crack": "try",
  "walk me through": "explain", "run me through": "explain", "talk me through": "explain",
  "break it down": "explain", "spell it out": "explain",
  "give me the gist": "summarise", "gist": "summary",

  // Common tech/product slang
  "thingy": "thing", "thingie": "thing", "thingummy": "thing", "thingamajig": "thing",
  "whatsit": "thing", "doodah": "thing", "doobrey": "thing", "doohickey": "thing",
  "bit": "part", "bits": "parts",
  "kit": "system", "kit out": "configure",
  "the works": "everything", "the lot": "everything",
  "the biz": "the system", "the beast": "the system",

  // Amounts / directions
  "loads": "many", "loads of": "many", "heaps": "many", "tonnes": "many", "tons": "many",
  "a couple": "two", "a fair few": "several",
  "a smidge": "slightly", "a tad": "slightly", "a touch": "slightly",
  "way": "very", "well over": "more than",
});
