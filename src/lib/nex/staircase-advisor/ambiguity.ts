// Staircase Advisor · Ambiguity clarification (G06 · Philip 2026-08-01)
//
// When customer language is genuinely ambiguous ("i want it light" · "make
// it clean"), a good advisor NAMES the ambiguity with two specific
// hypotheses rather than asking a generic "can you clarify?" question.
//
// Each ambiguity entry defines:
//   - patterns that match the ambiguous phrasing (precise · avoids false-positives)
//   - two named hypotheses grounded in Philip vocabulary
//   - the clarifying question format
//
// Ambiguity fires BEFORE field extraction so Nex doesn't silently commit
// to one interpretation of an ambiguous message.

import "server-only";

export type AmbiguityPattern = {
  id:              string;
  match_patterns:  RegExp[];
  intro:           string;   // Nex-voice acknowledgment that word can mean multiple things
  hypothesis_a:    string;   // interpretation A · grounded in Philip vocabulary
  hypothesis_b:    string;   // interpretation B · grounded in Philip vocabulary
  clarifier:       string;   // the question that lets the customer pick
  sources:         string[]; // Section 8 evidence trail
};

const AMBIGUITIES: AmbiguityPattern[] = [
  {
    id: "light",
    match_patterns: [
      /\bi\s+want\s+(it|the\s+staircase|the\s+stairs)\s+light\b/i,
      /\bmake\s+(it|the\s+staircase|the\s+stairs)\s+light\b/i,
      /\bsomething\s+light\b/i,
      /\bkeep\s+it\s+light\b/i,
      /\blight\s+staircase\b/i,   // customer says "I want a light staircase" — colour or feel?
      /\blighter\s+side\b/i,
      /\bon\s+the\s+lighter\s+side\b/i,
    ],
    intro: "\"Light\" can mean a couple of different things when we talk about staircases.",
    hypothesis_a: "Light in colour — pale timber like oak or pine, or painted white/off-white — for a bright, airy palette.",
    hypothesis_b: "Light in feel — open risers, glass balustrade, or a floating staircase design — for less visual weight in the space.",
    clarifier: "Which are you leaning toward — a lighter colour palette, or a lighter physical feel?",
    sources: [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Style directions + Flush doors row",
      "wood-intelligence-principles.md · pine and oak colour profiles",
    ],
  },
  {
    id: "open",
    match_patterns: [
      /\bi\s+want\s+(it|the\s+staircase|the\s+stairs)\s+open\b/i,
      /\bmake\s+(it|the\s+staircase|the\s+stairs)\s+open\b/i,
      /\bsomething\s+open\b/i,
      /\bopen\s+staircase\b/i,
      /\bkeep\s+it\s+open\b/i,
    ],
    intro: "\"Open\" is used two different ways in staircase design — worth pinning down.",
    hypothesis_a: "Open construction — open risers (no back on each step) plus a glass or floating design so light passes through the staircase itself.",
    hypothesis_b: "Open feel — a closed-riser staircase with a glass balustrade that keeps the sight-lines open to the rest of the room.",
    clarifier: "Which fits your project better — open construction, or open feel with a solid staircase?",
    sources: [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Flush doors row (Floating stairs · steel spine · open risers)",
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Balustrade choices (glass = more open feel)",
    ],
  },
  {
    id: "warm",
    match_patterns: [
      /\bi\s+want\s+(it|the\s+staircase|the\s+stairs)\s+warm\b/i,
      /\bmake\s+(it|the\s+staircase|the\s+stairs)\s+warm\b/i,
      /\bsomething\s+warm\b/i,
      /\bwarm\s+staircase\b/i,
      /\bwarmer\s+feel\b/i,
    ],
    intro: "\"Warm\" can point to two different design choices.",
    hypothesis_a: "Warm in colour — richer timber tones like oak, walnut, or cherry, often with natural oil finish to bring out grain.",
    hypothesis_b: "Warm in material — timber balusters and closed strings (rather than cold glass/metal) so every surface feels tactile.",
    clarifier: "Are you leaning more toward warm colour, or warm materials throughout?",
    sources: [
      "nex-knowledge-base-staircase-materials-overview.md · Common staircase timbers (oak/walnut/cherry warmth)",
      "nex-knowledge-base-staircase-materials-overview.md · Timber or glass balustrade section",
    ],
  },
  {
    id: "simple",
    match_patterns: [
      /\bi\s+want\s+(it|the\s+staircase|the\s+stairs)\s+simple\b/i,
      /\bkeep\s+it\s+simple\b/i,
      /\bsomething\s+simple\b/i,
      /\bsimple\s+staircase\b/i,
      /\bnothing\s+fancy\b/i,
    ],
    intro: "\"Simple\" usually means one of two things in staircase design.",
    hypothesis_a: "Simple in design — minimal, clean lines, square newels, straight flight, glass balustrade — a modern minimalist look.",
    hypothesis_b: "Simple in cost — painted staircase, pine construction, standard layout — economical without visible compromise.",
    clarifier: "Which fits better — minimal design language, or economical construction?",
    sources: [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Style directions table (Modern row)",
      "nex-knowledge-base-staircase-materials-overview.md · Oak vs Pine (pine as economical default)",
    ],
  },
];

export type AmbiguityMatch = {
  ambiguity:     AmbiguityPattern;
  response_text: string;
  sources:       string[];
};

/** Detect if a message is ambiguous and needs clarification · returns null if not. */
export function matchAmbiguity(message: string): AmbiguityMatch | null {
  for (const amb of AMBIGUITIES) {
    if (amb.match_patterns.some((p) => p.test(message))) {
      const response_text = `${amb.intro} ${amb.hypothesis_a} ${amb.hypothesis_b} ${amb.clarifier}`;
      return { ambiguity: amb, response_text, sources: amb.sources };
    }
  }
  return null;
}
