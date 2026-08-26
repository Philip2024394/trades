// NEX INTENT DETECTOR · lightweight semantic → guidance routing.
//
// Reads user-typed text (or NEX's own outbound intent) and maps it to a
// guidance target + intent so `guide()` can be fired proactively as part
// of the same conversational turn.
//
// Doctrine (Philip 2026-08-26): NEX should never fire the beam just because
// a button exists. The beam fires because NEX is TALKING ABOUT that thing.
// The detector's job is to figure out what NEX is talking about.
//
// MVP: keyword matches (bilingual EN/ID) with simple weighting.
// Future: replace with model-driven intent classifier or hook into brain reply.

import type { NexTarget, NexIntent } from "./nexPersonality";

export interface DetectedIntent {
  target: NexTarget;
  intent: NexIntent;
  /** Optional follow-up guide (fires after the first completes). */
  followUp?: DetectedIntent;
}

// Keyword patterns per target. Multiple hits raise confidence; first-target-wins.
const PATTERNS: Array<{ target: NexTarget; keywords: RegExp[]; intent: NexIntent }> = [
  {
    target: "food",
    intent: "recommend",
    keywords: [
      /\brestaurants?\b/i, /\brestoran\b/i,
      /\bfood\b/i, /\bmakanan?\b/i,
      /\beat\b/i, /\bmakan\b/i,
      /\bhungry\b/i, /\blapar\b/i,
      /\bdinner\b/i, /\blunch\b/i, /\bbreakfast\b/i,
      /\bcafe\b/i, /\bkafe\b/i, /\bwarung\b/i,
      /\bcuisine\b/i, /\bmenu\b/i,
    ],
  },
  {
    target: "discovery",
    intent: "recommend",
    keywords: [
      /\bshow me\b/i, /\btunjukk?an\b/i,
      /\bexplore\b/i, /\bjelajah\b/i,
      /\bdiscover(y)?\b/i, /\btemukan\b/i,
      /\baround\b/i, /\bnearby\b/i, /\bdekat\b/i,
      /\bwhat( )?can\b/i, /\bapa saja\b/i,
    ],
  },
  {
    target: "search",
    intent: "recommend",
    keywords: [
      /\bsearch\b/i, /\bcari\b/i,
      /\bfind\b/i, /\btemukan\b/i,
      /\blooking for\b/i, /\bmencari\b/i,
    ],
  },
  {
    target: "favorites",
    intent: "familiar",
    keywords: [
      /\bfavou?rites?\b/i, /\bfavorit\b/i,
      /\bsaved\b/i, /\btersimpan\b/i,
      /\bmy list\b/i,
    ],
  },
  {
    target: "history",
    intent: "familiar",
    keywords: [
      /\bhistory\b/i, /\briwayat\b/i,
      /\brecent\b/i, /\bterakhir\b/i,
      /\blast time\b/i, /\bprevious\b/i,
    ],
  },
  {
    target: "profile",
    intent: "familiar",
    keywords: [
      /\bprofile\b/i, /\bprofil\b/i,
      /\baccount\b/i, /\bakun\b/i,
      /\bmy( info)?\b/i, /\bsaya\b/i,
    ],
  },
];

/**
 * Detect the guidance intent behind a user utterance. Returns null if no
 * match — caller should just let the brain reply normally with no beam.
 */
export function detectIntent(text: string): DetectedIntent | null {
  const t = text.trim();
  if (!t) return null;

  for (const p of PATTERNS) {
    for (const kw of p.keywords) {
      if (kw.test(t)) {
        // Special case · restaurant / food queries chain into a second guide
        // that points at a specific card AFTER the user lands on the Food
        // artifact. NexAppShell wires this follow-up to fire on artifact
        // mount + first card registration.
        if (p.target === "food") {
          return {
            target: "food",
            intent: "recommend",
            followUp: { target: "food-card" as NexTarget, intent: "recommend" },
          };
        }
        return { target: p.target, intent: p.intent };
      }
    }
  }
  return null;
}
