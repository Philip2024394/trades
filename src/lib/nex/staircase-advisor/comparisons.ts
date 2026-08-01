// Staircase Advisor · comparative-question teaching (G20 · Philip 2026-08-01)
//
// When a customer asks "what's better, X or Y?" a real staircase specialist
// EXPLAINS the trade-offs before asking a preference question. A form-style
// bot asks another question instead. This module encodes the comparisons
// Philip has authored so Advisor can teach before asking.
//
// Every comparison text is EXTRACTED VERBATIM from a Philip-authored source
// listed in Section 8 of the design spec. Do not invent new comparisons ·
// only add entries whose trade-off content exists in the corpus.

import "server-only";

export type Comparison = {
  id:                 string;
  subjects:           string[];         // any of these words in the message triggers this comparison
  match_patterns:     RegExp[];         // additional pattern precision
  teaching_text:      string;           // the explanation Nex delivers
  follow_up_question: string;           // the preference question after teaching
  sources:            string[];         // Section 8 evidence trail
  updates_field?:     "balustrade" | "timber" | "layout";  // which decision this teaches toward
};

const COMPARISONS: Comparison[] = [
  {
    id: "glass-vs-timber-balustrade",
    subjects: ["glass", "timber", "balustrade", "balusters"],
    match_patterns: [
      /\b(glass|timber)\s+(?:or|vs|versus)\s+(glass|timber)\b/i,
      /\b(what|which)['s]{0,2}\s+(better|best)\b.*\b(glass|timber)\b/i,
      /\bshould\s+i\s+(use|choose|go\s+with)\s+(glass|timber)\b/i,
      /\bdifference\s+between\s+(glass|timber)\s+(?:and|or)\s+(glass|timber)\b/i,
    ],
    teaching_text:
      "Both work, and neither is universally better — it depends on the feeling you want. Timber balustrades feel warm and traditional · they're easier to repair and often match existing joinery. Glass balustrades feel modern and open · they let more light through and make the staircase visually lighter. Children can safely use glass staircases when designed and installed to appropriate safety standards.",
    follow_up_question:
      "Which feeling are you trying to achieve — warmer traditional timber, or lighter open glass?",
    sources: [
      "nex-knowledge-base-staircase-materials-overview.md · Timber or glass balustrade section",
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Balustrade choices section",
    ],
    updates_field: "balustrade",
  },
  {
    id: "oak-vs-pine",
    subjects: ["oak", "pine"],
    match_patterns: [
      /\b(oak|pine)\s+(?:or|vs|versus)\s+(oak|pine)\b/i,
      /\b(what|which)['s]{0,2}\s+(better|best)\b.*\b(oak|pine)\b/i,
      /\bshould\s+i\s+(use|choose|go\s+with)\s+(oak|pine)\b/i,
    ],
    teaching_text:
      "Not always oak — the right timber depends on the project. Oak is harder, more durable, and has a premium appearance · it's the UK default for premium staircases and works in both traditional and modern homes. Pine is more affordable, easier to paint, and suitable for many homes · it's the UK default for painted staircases and takes finish smoother than any hardwood. The best material depends on budget, design, and finish.",
    follow_up_question:
      "Are you leaning toward a premium visible-timber look (oak), or a painted / more affordable direction (pine)?",
    sources: [
      "nex-knowledge-base-staircase-materials-overview.md · Oak vs Pine section",
      "wood-intelligence-principles.md · oak and pine defaults",
    ],
    updates_field: "timber",
  },
  {
    id: "matte-vs-gloss",
    subjects: ["matte", "gloss", "matt"],
    match_patterns: [
      /\b(matte|matt|gloss)\s+(?:or|vs|versus)\s+(matte|matt|gloss)\b/i,
      /\b(what|which)['s]{0,2}\s+(better|best)\b.*\b(matte|matt|gloss)\b/i,
    ],
    teaching_text:
      "Matte finish is currently popular · less glare, more natural look, shows the timber grain honestly. Gloss is a more traditional polished appearance · reflects more light, gives a formal feel. Both protect the timber equally when done well.",
    follow_up_question:
      "Which sits closer to what you're going for — the natural matte look or the polished gloss look?",
    sources: [
      "nex-knowledge-base-staircase-materials-overview.md · Matte or gloss section",
    ],
  },
  {
    id: "carpet-vs-exposed",
    subjects: ["carpet", "exposed", "runner"],
    match_patterns: [
      /\b(carpet|exposed\s+timber)\s+(?:or|vs|versus)\s+(carpet|exposed\s+timber)\b/i,
      /\bshould\s+i\s+carpet\b/i,
      /\bcarpet\s+or\s+not\b/i,
    ],
    teaching_text:
      "Depends on priorities. Carpet is quieter underfoot, warmer, better grip, and protects the timber. Exposed timber shows the natural wood, is easier to clean, and gives a more premium appearance. Some customers combine both — a carpet runner with exposed edges.",
    follow_up_question:
      "Is quietness and comfort more important, or the visible timber appearance?",
    sources: [
      "nex-knowledge-base-staircase-materials-overview.md · Should I carpet my staircase section",
    ],
  },
];

export type ComparisonMatch = {
  comparison: Comparison;
  response_text: string;
  sources: string[];
};

/** Detect if a message is a comparative "what's better X or Y" question. */
export function matchComparison(message: string): ComparisonMatch | null {
  const msg = message.toLowerCase();
  for (const cmp of COMPARISONS) {
    // Must match any of the specific patterns AND mention at least two of the subjects
    const patternMatched = cmp.match_patterns.some((p) => p.test(message));
    if (!patternMatched) continue;
    const subjectHits = cmp.subjects.filter((s) => msg.includes(s));
    if (subjectHits.length < 2) continue;
    return {
      comparison:    cmp,
      response_text: `${cmp.teaching_text}\n\n${cmp.follow_up_question}`,
      sources:       cmp.sources,
    };
  }
  return null;
}
