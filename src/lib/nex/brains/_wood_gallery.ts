// Wood gallery — registry of the staircase wood cards Nex can surface
// in the chat when a specific timber is being discussed.
//
// Each card carries: display name, country of origin, flag, image URL.
// The composer detects which woods are mentioned in Nex's answer (or
// the user's question) and returns matching card metadata. The chat UI
// shows each card once per session and offers a "see again" button
// for repeats — same wood mentioned again doesn't re-render the card
// unless the user asks.

export type WoodCard = {
  id:         string;    // slug — used for shown-tracking in UI
  name:       string;    // display name on the card
  country:    string;    // origin country / region label
  flag:       string;    // ISO country code (or "EU" for European)
  imageUrl:   string;    // full URL to the card image
  keywords:   string[];  // words / phrases that trigger this card
  strength:   string;    // hardness label — e.g. "Soft (380 lbf Janka)"
  popularity: string;    // UK homeowner popularity — e.g. "Very popular"
  notes:      string;    // one-line trade summary shown under image + on fullscreen
  jankaLbf:   number;    // Janka hardness number (lbf) for visual scale bar
  jankaBand:  "soft" | "medium" | "hard" | "very-hard";  // colour-coded plain-English band
};

export const WOOD_GALLERY: WoodCard[] = [
  {
    id:         "white-deal-pine",
    name:       "White Deal Pine",
    country:    "Scandinavia",
    flag:       "SE",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2005_05_15%20PM.png?updatedAt=1784801131318",
    keywords:   ["white deal", "whitewood", "european whitewood", "scandinavian whitewood", "spruce joinery"],
    strength:   "Softwood · ~380 lbf Janka",
    popularity: "Very popular · painted stairs default",
    notes:      "Pale blonde softwood, ideal painted white or cream. Dents more easily than hardwood — best under paint or carpet.",
    jankaLbf:   380,
    jankaBand:  "soft"
  },
  {
    id:         "yellow-pine",
    name:       "Yellow Pine",
    country:    "United States",
    flag:       "US",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/Untitleddssaxzx.png",
    keywords:   ["yellow pine", "southern yellow pine", "syp", "longleaf", "loblolly", "shortleaf pine", "slash pine"],
    strength:   "Dense softwood · ~870 lbf Janka",
    popularity: "Niche · bespoke feature stairs",
    notes:      "The godfather of the pine family. Bold striped grain, wide plank availability, hardwood-like durability.",
    jankaLbf:   870,
    jankaBand:  "medium"
  },
  {
    id:         "mahogany",
    name:       "Mahogany",
    country:    "United States",
    flag:       "US",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_58_28%20PM.png?updatedAt=1784800723722",
    keywords:   ["mahogany", "swietenia", "genuine mahogany"],
    strength:   "Hardwood · ~800 lbf Janka (Genuine)",
    popularity: "Historic prestige · restoration + luxury",
    notes:      "The Rolls-Royce of staircase timbers for 250 years. Genuine Swietenia is CITES-restricted — modern 'mahogany' is often Sapele.",
    jankaLbf:   800,
    jankaBand:  "medium"
  },
  {
    id:         "maple",
    name:       "Maple",
    country:    "Europe",
    flag:       "EU",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_56_51%20PM.png?updatedAt=1784800626639",
    keywords:   ["maple", "hard maple", "rock maple", "sugar maple", "acer saccharum", "soft maple"],
    strength:   "Hardwood · ~1450 lbf Janka (Hard maple)",
    popularity: "Growing · Nordic modern designs",
    notes:      "One of the palest hardwoods. Gym-floor durability, blotches under stain — best clear-finished.",
    jankaLbf:   1450,
    jankaBand:  "very-hard"
  },
  {
    id:         "cherry",
    name:       "Cherry",
    country:    "United States",
    flag:       "US",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_55_42%20PM.png?updatedAt=1784800558921",
    keywords:   ["cherry", "american cherry", "prunus serotina", "black cherry"],
    strength:   "Hardwood · ~950 lbf Janka",
    popularity: "Niche · character-driven bespoke",
    notes:      "Ages before your eyes. Deepens dramatically under UV over 12 months — never stain, let time do the colour work.",
    jankaLbf:   950,
    jankaBand:  "medium"
  },
  {
    id:         "walnut",
    name:       "Walnut",
    country:    "United States",
    flag:       "US",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_53_57%20PM.png?updatedAt=1784800454735",
    keywords:   ["walnut", "american black walnut", "juglans nigra", "european walnut"],
    strength:   "Hardwood · ~1010 lbf Janka",
    popularity: "Premium · dark hardwood favourite",
    notes:      "The only true dark hardwood native to North America. Federal period heritage, deep chocolate-brown, softens slightly under UV.",
    jankaLbf:   1010,
    jankaBand:  "hard"
  },
  {
    id:         "red-deal-knotty",
    name:       "Red Deal Pine Knotty",
    country:    "Finland",
    flag:       "FI",
    imageUrl:   "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_51_16%20PM.png?updatedAt=1784800291180",
    keywords:   ["red deal", "knotty pine", "european redwood", "scandinavian redwood", "pinus sylvestris"],
    strength:   "Softwood · ~540 lbf Janka",
    popularity: "Popular · cottage + Scandi character",
    notes:      "Warm honey-orange with sound red-brown knots. Slow-grown Nordic pine, best clear-finished or lightly oiled.",
    jankaLbf:   540,
    jankaBand:  "soft"
  },
  {
    id:         "american-oak",
    name:     "American Oak",
    country:  "United States",
    flag:     "US",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_45_12%20PM.png?updatedAt=1784799936797",
    keywords: ["american oak", "american white oak", "white oak", "quercus alba"],
    strength:   "Hardwood · ~1360 lbf Janka",
    popularity: "Very popular · most-specified hardwood",
    notes:      "The UK homeowner's default hardwood. Deepest stairparts range in the trade, warm honey-gold tone, straight grain.",
    jankaLbf:   1360,
    jankaBand:  "very-hard"
  }
];

/** Detect which wood cards should surface based on the text of the
 *  question + answer. Returns an ordered list — earliest-mentioned
 *  wood first — with duplicates removed. */
export function detectWoodsInText(question: string, answer: string): WoodCard[] {
  const combined = `${question}\n${answer}`.toLowerCase();
  const detected: Array<{ card: WoodCard; firstIndex: number }> = [];

  for (const card of WOOD_GALLERY) {
    let earliestIndex = -1;
    for (const kw of card.keywords) {
      const idx = combined.indexOf(kw.toLowerCase());
      if (idx !== -1 && (earliestIndex === -1 || idx < earliestIndex)) {
        earliestIndex = idx;
      }
    }
    if (earliestIndex !== -1) {
      detected.push({ card, firstIndex: earliestIndex });
    }
  }

  detected.sort((a, b) => a.firstIndex - b.firstIndex);
  return detected.map((d) => d.card);
}

// ─── Visual Value Test ─────────────────────────────────────────
//
// Context-aware image display. Wood cards should only surface when
// the question is genuinely visual/materials-focused. Even if a wood
// name appears in the question, skip the card when the topic is
// procedural (price, regulations, delivery, warranty, history).

/** Question is clearly procedural — do NOT auto-show images even if a
 *  timber is named in the question. Users don't want a wood card when
 *  they're asking "how much does oak cost" — the topic is price. */
const PROCEDURAL_QUESTION_PATTERNS: RegExp[] = [
  // Price / cost patterns
  /\bhow\s+much\b/i,
  /\bcost\s+of\b/i,
  /\bprice\s+of\b/i,
  /\bprice\s+for\b/i,
  /\bexpensive\b/i,
  /\baffordable\b/i,
  /\bbudget\b/i,
  /\b£\s?\d/,
  // Regulation / compliance patterns
  /\bregulation(s)?\b/i,
  /\bapproved\s+document\b/i,
  /\bpart\s+k\b/i,
  /\bpart\s+m\b/i,
  /\bpart\s+b\b/i,
  /\bbs\s?\d/i,
  /\bcompliant\b/i,
  /\blegal\b/i,
  /\bbuilding\s+control\b/i,
  /\bfd30\b/i,
  // Delivery / warranty / lead time patterns
  /\blead\s+time\b/i,
  /\bdelivery\b/i,
  /\bwarranty\b/i,
  /\bguarantee\b/i,
  /\bhow\s+long\s+does\b/i,
  // Company / history patterns
  /\bhistory\s+of\b/i,
  /\bwhen\s+was\b/i,
  /\bwho\s+(invented|created|discovered|makes|manufactures?)\b/i,
  // Pure procedural how-to
  /\bhow\s+do\s+i\s+(install|fit|repair|fix|remove)\b/i
];

/** Question is clearly a VISUAL request — signals that images add
 *  value here, even if the wood was already shown earlier. Overrides
 *  the "already shown" suppression. */
const VISUAL_REQUEST_PATTERNS: RegExp[] = [
  /\bshow\s+me\b/i,
  /\bwhat\s+does\s+.{1,30}\s+look\s+like\b/i,
  /\blook\s+like\b/i,
  /\bexample(s)?\s+of\b/i,
  /\bgrain\s+of\b/i,
  /\bcolour\s+of\b/i,
  /\bappearance\b/i,
  /\bpicture\s+of\b/i,
  /\bimage(s)?\s+of\b/i,
  /\bsee\s+it\s+again\b/i,
  /\bcan\s+i\s+see\b/i
];

/** Comparison intent — override the "already shown" suppression so
 *  both/all mentioned woods can appear side by side when comparing. */
const COMPARISON_PATTERNS: RegExp[] = [
  /\bcompare\b/i,
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bdifference\s+between\b/i,
  /\b.{1,20}\s+or\s+.{1,20}\?$/i,   // "oak or walnut?"
  /\bwhich\s+is\s+(better|best)\s+for\b/i
];

export type VisualIntent = "visual" | "procedural" | "neutral";

/** Classify a user's question for image-display purposes.
 *  - "visual" → definitely show images, override "already shown"
 *  - "procedural" → do NOT auto-show images even if woods are named
 *  - "neutral" → default behaviour (show first-mention, skip repeats) */
export function classifyVisualIntent(question: string): VisualIntent {
  const q = question.trim();
  if (PROCEDURAL_QUESTION_PATTERNS.some((p) => p.test(q))) return "procedural";
  if (VISUAL_REQUEST_PATTERNS.some((p) => p.test(q)))    return "visual";
  return "neutral";
}

/** True when the question is asking to compare two or more things —
 *  the client-side "already shown" suppression should be relaxed so
 *  side-by-side comparison actually renders side by side. */
export function isComparisonQuestion(question: string): boolean {
  return COMPARISON_PATTERNS.some((p) => p.test(question));
}
