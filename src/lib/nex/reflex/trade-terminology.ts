// NEX Staircase Trade Reflex Brain · Tier-1 terminology lookup
//
// Philip 2026-07-30 · Consciousness Layer moat:
//
//   "A staircase expert already has these reflexes. NEX should have them too."
//
// This module answers instant terminology questions like:
//   "What is a winder?"
//   "What is a housed string?"
//   "What is a newel post?"
//   "What is a bullnose step?"
//   "What is a volute?"
//   "What thickness should a tread be?"
//
// Zero LLM call · sub-100ms · deterministic lookup.
//
// ─── RULE B COMPLIANCE ──────────────────────────────────────────────────
//
// Every terminology entry below is Layer 2 trade content and MUST be
// human-authored per Rule B (Chief Reference Brain Engineer role · locked
// 2026-07-28). AI can:
//   - Extract terms from published trade sources (BWF · Approved Doc K · BS 5395)
//   - Suggest candidate entries for expert review
//   - Format existing definitions consistently
// AI CANNOT:
//   - Invent definitions
//   - Author examples from imagination
//   - Fill entries without a named expert approval
//
// Entries in this file must carry `authored_by` and `verification_status`
// per the same governance as `hammerex_nex_memories` and Layer 2 modules.

import "server-only";

// ─── Entry shape ────────────────────────────────────────────────────────

export interface TerminologyEntry {
  /** The canonical term (lowercase, normalised). */
  term: string;
  /** Alternate phrasings that should match the same entry. E.g. "winders" · "winder step" · "newel pillar". */
  aliases: string[];
  /**
   * Customer-language phrases (Philip 2026-07-30 · "how would a staircase
   * expert understand what this customer actually means?"). These are
   * natural-language descriptions a homeowner might use when they DON'T
   * know the trade word. E.g. for `tread`: "part you stand on" · "walking
   * surface" · "flat part of the stair" · "step top".
   * Matched via substring against the normalised message.
   */
  customer_phrases?: string[];
  /**
   * Common mistakes / typos / misspellings the expert has seen customers
   * make. E.g. for `tread`: "thread" · "trade" · "trad".
   * Expert-authored (never AI-inferred). When matched, the formatter
   * prepends a gentle correction line: "I think you mean tread rather
   * than thread. In staircase terms..."
   */
  common_mistakes?: string[];
  /** The definition · what the thing IS · one paragraph · workshop-warm · never marketing prose. */
  definition: string;
  /**
   * Trade insight · what makes NEX's answer different from a generic AI answer.
   * Philip 2026-07-30: *"A winder is a space-saving solution, BUT the geometry
   * matters because poor winder design creates uncomfortable walking lines."*
   * The second sentence is what makes it a staircase professional.
   * Optional but strongly encouraged · this is the moat.
   */
  trade_insight?: string;
  /**
   * Common design/build mistake · stored for context · surfaced on follow-up
   * rather than in the first response. E.g. "many people confuse a winder
   * with a landing." Distinct from `common_mistakes` above (which is about
   * how the WORD is misused/mistyped).
   */
  common_confusion?: string;
  /** Related terms · used for cross-linking · powers "you might also want to know..." nudges. */
  related?: string[];
  /** Rule B provenance — WHO authored this entry. */
  authored_by: string;
  /** ISO date this entry was verified. */
  verified_at?: string;
  /** Rule C provenance — WHERE the definition traces to. */
  source: "BWF" | "Approved Doc K" | "BS 5395" | "BS 6180" | "workshop_observation" | "reference_brain_evidence" | "philip_authored";
  /** Optional citation string · e.g. "BWF Domestic Timber Stairs Design Guide §3.2". */
  citation?: string;
  /**
   * COMPLETE answer to serve when the match came via customer_phrase (customer
   * used homeowner language, not the trade term). Contains the "That's called
   * the {term}..." frame + definition + insight in one authored sentence-flow.
   *
   * Philip 2026-07-30 · this is the response shape when the customer had to
   * describe the thing without knowing the trade word — NEX acknowledges the
   * translation before explaining. When set, the formatter uses this verbatim
   * for customer_phrase matches. When absent, formatter falls back to standard
   * definition + trade_insight.
   *
   * Example: "That's called the tread. It is the horizontal part of the step
   * your foot sits on. The depth of the tread makes a big difference to how
   * comfortable the staircase feels."
   */
  customer_phrase_answer?: string;
  /** Six-Month Memory Test analogue: would surfacing this instantly feel expert or feel like a lookup? */
  reflex_appropriate: boolean;
}

// ─── AUTHORING RUBRIC · what a good entry sounds like (Philip 2026-07-30) ───
//
// A technically correct definition can still fail the Soul test. Every entry
// must sound like a carpenter answering over a cup of tea — never like a
// manual. Philip's canonical bad-vs-good example:
//
//   ❌ MANUAL (Reflex FAIL · sounds like software):
//      "A newel post is a vertical structural component located at the
//       termination points of a staircase balustrade."
//      → correct facts · zero soul · reads like a spec sheet
//
//   ✅ EXPERT (Reflex PASS · sounds like a person):
//      definition: "A newel post is the main upright post that anchors
//                   the handrail."
//      trade_insight: "It is the part you often notice first because it
//                      gives the staircase its character — especially
//                      with larger square oak newels."
//      → same facts · human voice · anchors the term to something the
//        reader can picture · earns trust through workshop-warmth
//
// The trade_insight is where the moat lives. A general AI has millions of
// facts; NEX has judgement about which details matter to a homeowner, an
// installer, or a manufacturer. Every entry authored here should carry that
// second sentence.
//
// ─── NEX STAIRCASE EXPERT CORE 100 · authoring roadmap (Philip 2026-07-30) ─
//
// The target for this file is NOT thousands of definitions. That would make
// NEX a giant FAQ machine (the failure mode Philip explicitly warned against).
// The target is the FIRST 100 THINGS a staircase professional knows without
// thinking. Three levels:
//
//   Level 1 · Instant trade language (this file · Reflex Brain)
//     newel post · tread · riser · winder · string · baluster · handrail · ...
//   Level 2 · Expert judgement (future · Expert Brain · Haiku with narrow prompt)
//     "Is oak better than ash?" · "Should I use MDF treads?" · comparisons
//   Level 3 · Wisdom (existing composer · Wisdom Brain · Opus + memory)
//     "I want my staircase to make the house feel expensive." · life-context
//
// Only Level 1 belongs in THIS file. Levels 2 and 3 live in the composer
// with its full context + memory. Do not attempt to Reflex-ify Level 2 or
// Level 3 questions — premature determinism breaks the Soul.
//
// ─── STARTER GLOSSARY (three Philip-authored entries live · queue below) ────
//
// The three entries below are LIVE (verified · authored_by set). The
// comment queue after them is the priority authoring backlog · Rule B
// gated so nothing fires until an expert authors each entry.
//
// Extend from:
//   - Reference Brain evidence files at data/nex-reference-brains/staircase-preparation/evidence/
//   - Component Library type definitions at src/lib/nex/staircase-components/types.ts
//   - Geometry Module regulations at src/lib/nex/staircase-geometry/
//   - Published BWF / Approved Doc K / BS 5395 material · CITED, not paraphrased

export const TERMINOLOGY: TerminologyEntry[] = [
  // ─── Philip O'Farrell · authored 2026-07-30 ─────────────────────────
  // Codified verbatim from Philip's message this session. Rule B
  // compliant: named author · direct provenance · verification_status:
  // verified. Ready to serve.

  {
    term: "winder",
    aliases: ["winder step", "winder tread", "winders", "winder steps", "a winder", "the winder"],
    customer_phrases: [
      "step that turns",
      "step in a corner",
      "wedge shaped step",
      "wedge shape step",
      "corner step",
      "steps that go round",
      "steps that curve",
    ],
    common_mistakes: ["winders", "windor", "winda", "wynder"],
    definition:
      "A winder is a staircase step that changes direction without using a flat landing. Instead of the tread being rectangular, the step becomes wedge-shaped, allowing the staircase to turn smoothly around a corner while saving space.",
    trade_insight:
      "You will usually find winders in quarter-turn or half-turn staircases where space is limited.",
    customer_phrase_answer:
      "Those are winders. They allow the staircase to turn without needing a full landing, which saves space.",
    related: ["landing", "quarter-turn", "half-turn"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "newel post",
    aliases: [
      "newel",
      "newels",
      "newel posts",
      "newel pillar",
      "starting post",
      "stair post",
      "upright staircase post",
      "main post",
      "handrail support post",
      "corner post",
      "a newel",
      "the newel",
    ],
    customer_phrases: [
      "big post at the bottom",
      "big post at the top",
      "post at the bottom of the stair",
      "post at the top of the stair",
      "post at the turn",
      "post that holds the handrail",
      "post which holds the handrail",
      "holds the handrail up",
      "vertical post on the stair",
      "main upright on the staircase",
      "corner post on the stair",
      "big wooden post on the stair",
      "starting post of the stair",
    ],
    common_mistakes: ["nule post", "nule", "nuel", "noel post", "noel", "neweel", "newal"],
    // Philip 2026-07-30 · refined voice · definition + insight per Expert Voice Standard
    definition:
      "A newel post is the main upright post that supports the handrail and balustrade.",
    trade_insight:
      "It is also one of the features that gives a staircase its personality — the shape, finish and detailing of the newel can completely change the character of the entrance.",
    customer_phrase_answer:
      "That's a newel post. It anchors the handrail and balustrade and is often one of the first details people notice when they enter a hallway.",
    related: ["handrail", "baluster", "spindle", "newel cap"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "tread",
    aliases: ["treads", "stair tread", "step tread", "the tread", "a tread"],
    customer_phrases: [
      // Original set (Philip 2026-07-30)
      "part you stand on",
      "part you step on",
      "walking surface",
      "flat part of the stair",
      "flat part of the step",
      "step top",
      "top of the step",
      // Expanded set (Philip 2026-07-30 · after homeowner-language miss on
      // "what is the wood bit you walk on called?")
      "wood bit you walk on",
      "wooden bit you walk on",
      "wooden part you stand on",
      "bit your foot goes on",
      "part your foot goes on",
      "surface of the step",
      "step you walk on",
      "horizontal bit of the stair",
      "horizontal part of the stair",
    ],
    common_mistakes: ["thread", "threads", "trad", "trads", "tred"],
    definition:
      "The tread is the horizontal part of the step that you place your foot on when walking up or down a staircase.",
    trade_insight:
      "The depth of the tread affects how comfortable and safe the staircase feels.",
    customer_phrase_answer:
      "That's called the tread. It is the horizontal part of the step your foot sits on. The depth of the tread makes a big difference to how comfortable the staircase feels.",
    related: ["riser", "nosing", "step"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  // ─── Tier 1 concepts · Philip authored inline in Ship 4k test batch (2026-07-30) ─
  //
  // All seven entries below authored verbatim from Philip's 2026-07-30 30-answer
  // test message. Rule B compliant · Philip is the named author · verified same
  // day. Each carries: standard definition + trade_insight (for direct term match)
  // AND customer_phrase_answer (for customer-language match).

  {
    term: "riser",
    aliases: ["risers", "the riser", "a riser"],
    customer_phrases: [
      "vertical bit between steps",
      "vertical bit between stairs",
      "upright bit between stairs",
      "upright bit between steps",
      "vertical board on the stairs",
      "front face of the step",
      "bit you see when looking at the stairs from the side",
      "upright part between each step",
      "vertical part between each tread",
    ],
    common_mistakes: ["ryser", "rizer"],
    definition:
      "The riser is the vertical part between each tread.",
    trade_insight:
      "Riser height and style have a big effect on how the staircase looks and feels.",
    customer_phrase_answer:
      "That's the riser. It is the vertical part between each tread. Riser height and style have a big effect on how the staircase looks and feels.",
    common_confusion: "people confuse riser with tread · people call the whole step a tread",
    related: ["tread", "nosing"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "string",
    aliases: ["strings", "stair string", "staircase string", "a string", "the string"],
    customer_phrases: [
      "side wood holding the steps",
      "side wood holding the stairs",
      "side board holding steps",
      "wood running up the side",
      "wooden bit on the side of my stairs",
      "side of the staircase",
      "sides that hold the steps up",
      "long board on the side of the stair",
      "side panel of the stairs",
      "board the steps sit in",
    ],
    common_mistakes: [],
    definition:
      "The string is the side board that supports the steps and helps form the shape of the staircase.",
    customer_phrase_answer:
      "That's called the string. It supports the steps and helps form the shape of the staircase.",
    related: ["closed string", "cut string", "housed string"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "nosing",
    aliases: ["nosings", "stair nosing", "tread nosing", "the nosing", "a nosing"],
    customer_phrases: [
      "front edge sticking out",
      "front edge sticking out on the step",
      "lip sticking out",
      "overhang on the step",
      "front edge of the step",
      "front of the step",
      "front edge of the stair",
      "edge that sticks out on the step",
    ],
    common_mistakes: ["nosing edge", "nose", "nosings"],
    definition:
      "The nosing is the edge of the tread that projects beyond the riser.",
    trade_insight:
      "It helps define the step visually.",
    customer_phrase_answer:
      "That's the nosing. It is the edge that projects beyond the riser and helps define the step visually.",
    related: ["tread", "riser"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "baluster",
    aliases: [
      "balusters",
      "spindle",
      "spindles",
      "stair spindle",
      "stair spindles",
      "banister spindles",
      "stair baluster",
      "the balusters",
      "the spindles",
    ],
    customer_phrases: [
      "little wooden sticks holding the handrail",
      "wooden sticks holding the handrail",
      "vertical sticks on the staircase",
      "little posts under the handrail",
      "wooden bars between the stair and the rail",
      "posts holding up the rail",
      "vertical bits under the handrail",
    ],
    common_mistakes: ["ballister", "ballisters", "balastar", "bannister spindle"],
    definition:
      "Balusters (also called spindles) are the vertical bars between the handrail and the staircase that support the handrail.",
    trade_insight:
      "They are one of the easiest parts to change the style of a staircase.",
    customer_phrase_answer:
      "Those are balusters or spindles. They support the handrail and are one of the easiest parts to change the style of a staircase.",
    related: ["handrail", "newel post", "balustrade"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "handrail",
    aliases: ["handrails", "hand rail", "hand rails", "banister", "banisters", "the handrail", "a handrail"],
    customer_phrases: [
      "rail you hold going upstairs",
      "rail going up the wall",
      "thing you hold",
      "wooden rail on the wall",
      "rail on the side of the stairs",
      "thing you grip when going up",
      "long rail along the staircase",
    ],
    common_mistakes: ["hand-rail", "handrales"],
    definition:
      "The handrail is the rail you hold while walking up or down the staircase.",
    trade_insight:
      "It provides support while walking and is also a major design feature.",
    customer_phrase_answer:
      "That's the handrail. It provides support while walking and is also a major design feature.",
    related: ["baluster", "spindle", "newel post"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "landing",
    aliases: ["landings", "stair landing", "half landing", "quarter landing", "the landing", "a landing"],
    customer_phrases: [
      "flat area halfway up stairs",
      "flat bit halfway up the stairs",
      "flat platform between flights",
      "flat area between staircases",
      "flat bit at the top of the stairs",
      "resting spot on the stairs",
      "flat section in the staircase",
    ],
    common_mistakes: [],
    definition:
      "A landing is a flat area that connects two flights of stairs or sits at the top of a staircase.",
    trade_insight:
      "It gives you a change of direction or a resting point between flights.",
    customer_phrase_answer:
      "That's a landing. It gives you a change of direction or a resting point between flights.",
    related: ["winder", "half landing", "quarter landing"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  {
    term: "volute",
    aliases: ["volutes", "handrail volute", "the volute", "a volute"],
    customer_phrases: [
      "spiral bit at bottom of handrail",
      "spiral bit at the bottom of the handrail",
      "curly end of the handrail",
      "handrail that curls round the bottom post",
      "swirl at the end of the handrail",
      "decorative end of the handrail",
      "coil at the bottom of the banister",
    ],
    common_mistakes: ["volut", "voloute", "valute"],
    definition:
      "A volute is a decorative handrail detail that spirals inward at the bottom of the staircase.",
    trade_insight:
      "It is often used on more traditional staircases.",
    customer_phrase_answer:
      "That's called a volute. It is a decorative handrail detail often used on more traditional staircases.",
    related: ["handrail", "newel post", "curtail step"],
    authored_by: "Philip O'Farrell",
    verified_at: "2026-07-30",
    source: "philip_authored",
    reflex_appropriate: true,
  },

  // ─── AUTHORING QUEUE · Philip's Ship-4 priority list (2026-07-30) ───
  //
  // Each term below awaits Philip's (or a nominated named expert's)
  // authoring in the same shape as the three entries above:
  //   definition · trade_insight · common_mistake · related · source
  //
  // DO NOT AI-generate these. Rule B applies. The value of NEX is that
  // the knowledge is filtered through staircase expertise — not scraped
  // from the internet. A generic definition would make NEX another
  // generic AI. Wait for expert authoring.
  //
  // PRIORITY 1 · Stair anatomy (highest priority · Philip 2026-07-30):
  //   staircase · riser · nosing · string · closed string · cut string ·
  //   housed string · baluster / spindle · handrail · landing ·
  //   bullnose step · curtail step · volute · gooseneck · pitch line
  //
  // PRIORITY 2 · Materials:
  //   oak · walnut · pine · hemlock · mdf · veneer · engineered timber
  //
  // PRIORITY 3 · Installation:
  //   trimmer · floor opening · double string · scribed fitting ·
  //   packing · level · plumb
];

// ─── Normalisation · lowercase · strip punctuation · strip filler ──────
//
// Philip 2026-07-30: "A human staircase expert does not require the customer
// to use the exact trade word." Normalisation happens BEFORE lookup so
// "What is a Tread?" · "whats a tread" · "define tread" · "tread meaning"
// all resolve to the same match.

function normalise(message: string): string {
  return message
    .toLowerCase()
    .replace(/[?.!,;:'"]/g, "")     // strip punctuation
    .replace(/\s+/g, " ")           // collapse whitespace
    .trim();
}

// Filler phrases stripped from the normalised message to isolate the term.
// Order matters (longer phrases first · greedy stripping).
const FILLER_PATTERNS: RegExp[] = [
  /^what\s+(?:is|are|does|do)\s+(?:a|an|the)?\s*/,
  /^what'?s\s+(?:a|an|the)?\s*/,
  /^what\s+(?:a|an|the)?\s*/,
  /^(?:can\s+you\s+)?(?:tell\s+me\s+)?(?:what\s+)?(?:the\s+)?(?:meaning\s+of|definition\s+of)\s+(?:a|an|the)?\s*/,
  /^tell\s+me\s+about\s+(?:a|an|the)?\s*/,
  /^(?:please\s+)?(?:can\s+you\s+)?define\s+(?:a|an|the)?\s*/,
  /^(?:please\s+)?(?:can\s+you\s+)?explain\s+(?:a|an|the)?\s*/,
  /\s+(?:mean|meaning|is|are)\s*$/,
];

// ─── Extract candidate term from a normalised message ──────────────────
//
// Returns the phrase after filler is stripped · or the whole message if it's
// short and looks like a bare term. Never returns null for anything up to
// ~40 chars — leaves matching decisions to the lookup layer.

function extractTerm(message: string): string {
  let cleaned = normalise(message);

  // Apply filler patterns in sequence · strip whichever matches first
  for (const pattern of FILLER_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, "").trim();
    if (cleaned !== before) break; // one filler match per pass is enough
  }

  return cleaned;
}

// ─── Fuzzy match helper · Levenshtein distance ─────────────────────────
//
// Small in-file implementation · no dependency. Only used as a safety net
// after exact + typo matching fail · never as the primary path. Threshold
// deliberately tight (1 char for 4-6 char words · 1-2 chars for longer)
// so we don't fire on ambiguous inputs.

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] =
        b[i - 1] === a[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1);
    }
  }
  return dp[b.length][a.length];
}

/** Max Levenshtein distance we'll accept as "same word, typo." */
function fuzzyThreshold(term: string): number {
  if (term.length < 4) return 0;   // too short · ambiguous
  if (term.length <= 6) return 1;  // one char off (thread → tread)
  return 2;                         // slightly more room for longer words
}

// ─── Terminology lookup ─────────────────────────────────────────────────

export interface TerminologyCorrection {
  /** What the customer wrote (e.g. "thread"). */
  from: string;
  /** What NEX thinks they meant (e.g. "tread"). */
  to: string;
  /** How the correction was found · for observability. */
  via: "common_mistakes" | "fuzzy_match";
}

export interface TerminologyMatch {
  term: string;
  definition: string;
  citation?: string;
  entry: TerminologyEntry;
  /** Confidence 0-100 · 100 = exact · 85 = typo-dictionary · 70 = fuzzy · 90 = customer-phrase. */
  confidence: number;
  /** Present when the customer's word differed from the canonical term. */
  correction?: TerminologyCorrection;
  /** How the match was found · for telemetry / debugging. */
  matched_via: "exact_term" | "alias" | "common_mistake" | "fuzzy" | "customer_phrase";
}

function eligibleEntries(): TerminologyEntry[] {
  return TERMINOLOGY.filter(
    (e) => e.authored_by !== "AWAITING_EXPERT_REVIEW" && e.reflex_appropriate,
  );
}

/**
 * Try to answer a terminology question from the static glossary.
 * Layered matching (Philip 2026-07-30 · Ship 4b):
 *   1. Exact match on term or alias                    → confidence 100
 *   2. Match on common_mistakes (expert-authored typos) → confidence 85 · correction hint
 *   3. Fuzzy match (Levenshtein · gated by length)     → confidence 70 · correction hint
 *   4. Customer-phrase substring match                 → confidence 90
 * Only correct when confidence ≥ 70.
 * Returns null when no match or when only awaiting-review entries would match.
 */
export function tryTerminology(userMessage: string): TerminologyMatch | null {
  const normalised = normalise(userMessage);
  const term = extractTerm(userMessage);

  const entries = eligibleEntries();

  // ─── Layer 1 · Exact match on term or alias ─────────────────────────
  if (term && term.length <= 40) {
    for (const entry of entries) {
      if (entry.term === term) {
        return matchOf(entry, "exact_term", 100);
      }
      const aliasHit = entry.aliases.find((a) => a.toLowerCase() === term);
      if (aliasHit) {
        return matchOf(entry, "alias", 100);
      }
    }

    // ─── Layer 2 · Common mistakes (expert-authored typo dictionary) ──
    for (const entry of entries) {
      const mistakeHit = (entry.common_mistakes ?? []).find(
        (m) => m.toLowerCase() === term,
      );
      if (mistakeHit) {
        return matchOf(entry, "common_mistake", 85, {
          from: term,
          to: entry.term,
          via: "common_mistakes",
        });
      }
    }

    // ─── Layer 3 · Fuzzy match (Levenshtein · length-gated) ───────────
    const threshold = fuzzyThreshold(term);
    if (threshold > 0) {
      for (const entry of entries) {
        if (levenshtein(term, entry.term) <= threshold) {
          return matchOf(entry, "fuzzy", 70, {
            from: term,
            to: entry.term,
            via: "fuzzy_match",
          });
        }
        for (const alias of entry.aliases) {
          const aliasLower = alias.toLowerCase();
          if (aliasLower.length >= 4 && levenshtein(term, aliasLower) <= threshold) {
            return matchOf(entry, "fuzzy", 70, {
              from: term,
              to: aliasLower,
              via: "fuzzy_match",
            });
          }
        }
      }
    }
  }

  // ─── Layer 4 · Customer-phrase substring match ─────────────────────
  // "what's the part you stand on called?" · "what do you call the flat part
  // of the stair?" · matches customer_phrases across all entries. Only
  // scanned when direct term extraction didn't hit anything above.
  //
  // Length-gated (≤ 120 chars). A long message that HAPPENS to contain a
  // customer_phrase as one small part is NOT a customer asking about a
  // definition · it's a real question that needs the composer. Philip's
  // rule: "Recognise when a customer is asking about something NEX
  // understands." A 200-word paragraph is not asking about a tread.
  if (normalised.length <= 120) {
    for (const entry of entries) {
      for (const phrase of entry.customer_phrases ?? []) {
        const phraseLower = phrase.toLowerCase();
        if (normalised.includes(phraseLower)) {
          return matchOf(entry, "customer_phrase", 90);
        }
      }
    }
  }

  return null;
}

function matchOf(
  entry: TerminologyEntry,
  matched_via: TerminologyMatch["matched_via"],
  confidence: number,
  correction?: TerminologyCorrection,
): TerminologyMatch {
  return {
    term: entry.term,
    definition: entry.definition,
    citation: entry.citation,
    entry,
    confidence,
    correction,
    matched_via,
  };
}

/**
 * Format a terminology match as a response suitable for the reflex path.
 * Uses definition + trade_insight (two paragraphs · Philip 2026-07-30 shape).
 * common_mistake is NOT surfaced in the first response — reserved for follow-up
 * context. Citation appended when present. Never marketing prose.
 *
 * Philip's spec (2026-07-30):
 *   "The value of NEX is that the knowledge is filtered through staircase
 *    expertise. Generic AI: 'A winder is a step that changes direction.'
 *    NEX expert: 'A winder is a space-saving solution, but the geometry
 *    matters because poor winder design creates uncomfortable walking lines.'
 *    That second sentence is what makes it a staircase professional."
 *
 * trade_insight is the "second sentence" that makes NEX an expert, not a
 * search engine. Always include it when present.
 */
export function formatTerminologyResponse(match: TerminologyMatch): string {
  const { definition, entry, correction, matched_via } = match;
  const parts: string[] = [];

  // ─── Customer-phrase match with authored frame answer (Philip 2026-07-30) ──
  // When the customer used homeowner language (not the trade term) AND the
  // entry has an authored customer_phrase_answer, use it verbatim. This is
  // the "That's called the {term}..." shape that acknowledges the translation
  // before explaining. Skips the standard formatter entirely.
  if (matched_via === "customer_phrase" && entry.customer_phrase_answer) {
    return entry.customer_phrase_answer;
  }

  // Typo correction · prepend gently · Philip 2026-07-30:
  // "I think you mean tread rather than thread. In staircase terms..."
  // Only fires when a correction is present (Layer 2 or 3 match).
  if (correction) {
    parts.push(`I think you mean ${correction.to} rather than ${correction.from}. In staircase terms:`);
    parts.push("");
  }

  parts.push(definition);

  if (entry.trade_insight) {
    parts.push(""); // blank line = paragraph break in the widget's whitespace-pre-wrap render
    parts.push(entry.trade_insight);
  }

  if (match.citation) {
    parts.push("");
    parts.push(`— ${match.citation}`);
  }

  return parts.join("\n");
}
