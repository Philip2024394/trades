// NEX Mascot Meaning · Expression → semantic language · 2026-08-27.
//
// Doctrine (Philip 2026-08-27):
//   · mascot.expression IS the semantic identity (authoritative)
//   · this file is the PRESENTATION LAYER for that identity, not a competing
//     taxonomy · every value here derives from an expression
//   · meaning = short authoritative sentence ("I'm laughing" · "Sending love")
//   · personal templates = softer human phrasings the sender can pick from
//   · never auto-generate awkward robotic sentences from unknown expressions ·
//     fall back to a graceful blank editable line instead
//
// V2 EXTENSION POINT (deferred · do NOT implement yet):
//   The personal message could later be brain-generated from conversation
//   context (what the other person just said + user's tone history). When
//   that ships, replace `pickPersonalTemplate` with a brain call and keep
//   the deterministic fallback for offline / brain-error scenarios. The
//   `<input>` in the drawer confirm card stays exactly the same · only the
//   default value source changes.

import type { NexMascotExpression } from "../nex-actions/types";

export interface ExpressionMeaning {
  /** Short authoritative sentence · uppercase-eligible · never > 4 words. */
  meaning: string;
  /** Rotation pool of softer human phrasings for the editable personal line. */
  templates: string[];
}

/**
 * Core dictionary · 12 expressions covered · aligns with NexMascotExpression.
 * Add new expressions here (with proper meaning + templates) rather than
 * relying on auto-fallback for anything user-visible.
 */
export const EXPRESSION_MEANINGS: Record<NexMascotExpression, ExpressionMeaning> = {
  laugh: {
    meaning: "I'm laughing",
    templates: [
      "That was hilarious!",
      "You got me — dying 😂",
      "I actually laughed out loud.",
      "Okay, that was too funny.",
      "This is not okay 😂",
    ],
  },
  approve: {
    meaning: "That's a yes",
    templates: [
      "Absolutely — go for it.",
      "Yep, I'm in.",
      "Fully approve.",
      "Solid call.",
      "You have my vote.",
    ],
  },
  boss: {
    meaning: "Nailed it",
    templates: [
      "Boss move.",
      "That's how it's done.",
      "You handled that perfectly.",
      "Respect.",
      "Absolute leader energy.",
    ],
  },
  romantic: {
    meaning: "Sending love",
    templates: [
      "Thinking of you 💛",
      "Just a little love your way.",
      "You mean everything to me.",
      "Sending warmth.",
      "Cannot wait to see you.",
    ],
  },
  cozy: {
    meaning: "Feeling cosy",
    templates: [
      "Perfect vibe right now.",
      "Nothing better than this.",
      "Warm and settled.",
      "Slow-morning mood.",
    ],
  },
  rainy: {
    meaning: "One of those days",
    templates: [
      "Grey today, but okay.",
      "Curling up and riding it out.",
      "Rainy-day mood.",
      "Bit of a mellow one.",
    ],
  },
  sunny: {
    meaning: "Feeling bright",
    templates: [
      "Great day for it.",
      "Sunshine mode activated.",
      "Everything feels lighter today.",
      "Absolute vibes.",
    ],
  },
  confused: {
    meaning: "Thinking about this",
    templates: [
      "Not sure yet, thinking it through.",
      "Give me a sec.",
      "Hmm, let me sit with that.",
      "Chewing on this one.",
    ],
  },
  celebrate: {
    meaning: "Worth celebrating",
    templates: [
      "We did it! 🎉",
      "Time to celebrate.",
      "Absolutely earned this one.",
      "Big win.",
    ],
  },
  birthday: {
    meaning: "Happy birthday!",
    templates: [
      "Have the best day 🎂",
      "Cheers to another year!",
      "Wishing you an amazing birthday.",
      "Hope today spoils you.",
    ],
  },
  explosive: {
    meaning: "Buckle up",
    templates: [
      "Here we go.",
      "Big move incoming.",
      "This one's going to be intense.",
    ],
  },
  premium: {
    // NEVER "I'm premium" (Philip 2026-08-27 · anti-robotism rule). Instead
    // frame as recognition of something special / high-quality.
    meaning: "Something special",
    templates: [
      "This one's worth it.",
      "Top-tier right here.",
      "A cut above.",
      "Genuinely rare.",
    ],
  },
  generic: {
    // Deliberately empty · used for expressions that map to `generic` in the
    // registry (e.g. reminder, food, walk). Meaning stays blank so the card
    // shows only the mascot + an editable personal line · the user writes
    // whatever they want. Prevents robotic auto-generated sentences.
    meaning: "",
    templates: [""],
  },
};

/** Look up meaning + templates for an expression. Never returns null. */
export function resolveMeaning(expression: string): ExpressionMeaning {
  const key = expression as NexMascotExpression;
  return EXPRESSION_MEANINGS[key] ?? EXPRESSION_MEANINGS.generic;
}

/** True when the expression has a proper meaning + templates (not fallback). */
export function hasKnownMeaning(expression: string): boolean {
  const e = expression as NexMascotExpression;
  if (!(e in EXPRESSION_MEANINGS)) return false;
  return EXPRESSION_MEANINGS[e].meaning.length > 0;
}

/**
 * Deterministic-per-call random pick from the templates pool.
 * `seed` allows reproducible picks (used by tests) · omit for random UX.
 */
export function pickPersonalTemplate(expression: string, seed?: number): string {
  const { templates } = resolveMeaning(expression);
  if (templates.length === 0) return "";
  const idx = seed !== undefined
    ? ((seed % templates.length) + templates.length) % templates.length
    : Math.floor(Math.random() * templates.length);
  return templates[idx] ?? "";
}
