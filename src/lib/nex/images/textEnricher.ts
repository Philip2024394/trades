// src/lib/nex/images/textEnricher.ts
//
// NEX Text Enricher — Level B (Philip 2026-07-27).
// Input: raw shorthand description (possibly tired grammar, misspelled).
// Output: cleaned + enriched description ready for the parser.
//
// LEVEL B contract:
//   ✓ Fix spelling (staircase / joinery domain dictionary)
//   ✓ Expand shorthand into full terms so classifier + retrieval have
//     enough signal (u-shape → half-turn (U-shape) staircase)
//   ✓ Add SAFE design context (short qualifier per known term).
//     Example: "oak" → "oak (durable hardwood commonly used for premium
//     internal staircases)". NO regulations, NO fabricated dimensions,
//     NO opinion — only well-established well-known facts.
//   ✓ Grammar cleanup — proper sentence, capitalisation, terminal period.
//   ✗ NEVER add facts not implied by the input.
//   ✗ NEVER change what Philip said — only expand and correct.
//
// Every enrichment is logged so `human_description_raw` +
// `human_description` + `enrichment_corrections` + `enrichment_added_facts`
// give a full audit trail on the manifest row.

export type EnrichmentResult = {
  original: string;
  cleaned: string;
  enriched: string;
  corrections: string[];
  added_facts: string[];
};

// -------- Domain spelling dictionary --------
// Additions welcome as we spot more of Philip's typos.
const SPELLING: Record<string, string> = {
  thead: "tread",
  theads: "treads",
  thread: "tread",     // when clearly meaning tread (context: staircase)
  threads: "treads",
  riser: "riser",
  risers: "risers",
  quater: "quarter",
  quater_turn: "quarter turn",
  quatr: "quarter",
  ballistrade: "balustrade",
  ballustrade: "balustrade",
  balustade: "balustrade",
  balluster: "baluster",
  ballusters: "balusters",
  banister: "banister",
  bannister: "banister",
  bannisters: "banisters",
  newele: "newel",
  newl: "newel",
  handrale: "handrail",
  handrai: "handrail",
  handrails: "handrails",
  stringer: "stringer",
  stringr: "stringer",
  stiracse: "staircase",
  staicase: "staircase",
  staircse: "staircase",
  stairs: "stairs",
  walnute: "walnut",
  walnnut: "walnut",
  wallnut: "walnut",
  mahogeny: "mahogany",
  mahogney: "mahogany",
  mahogny: "mahogany",
  mohagony: "mahogany",
  laquer: "lacquer",
  lacquered: "lacquered",
  mittered: "mitred",
  mittred: "mitred",
  mitered: "mitred",
  spindal: "spindle",
  spindel: "spindle",
  spindals: "spindles",
  cantelever: "cantilever",
  cantelver: "cantilever",
  cantiliver: "cantilever",
  cantiliver_stair: "cantilever staircase",
  cantelever_stair: "cantilever staircase",
  fabricationn: "fabrication",
  fabracation: "fabrication",
  ply: "ply",
  plywod: "plywood",
  plywoods: "plywood",
  timbr: "timber",
  timbre: "timber",
  timbers: "timber",
  imgae: "image",
  imgaes: "images",
  reserach: "research",
  reserach_engine: "research engine",
  chack: "check",
  understaircase: "under-stair",
  understairs: "under-stair",
  understair: "under-stair",
  underneth: "underneath",
  wooden: "wooden",
  ligting: "lighting",
  lignting: "lighting",
};

// -------- Layout expansions (short → full term the classifier likes) --------
const LAYOUT_EXPANSIONS: Array<{ match: RegExp; expansion: string }> = [
  { match: /\bu[- ]?shape\b/i,        expansion: "half-turn (U-shape / dog-leg) staircase" },
  { match: /\bl[- ]?shape\b/i,        expansion: "quarter-turn (L-shape) staircase" },
  { match: /\bdog[- ]?leg\b/i,        expansion: "half-turn (dog-leg) staircase with landing" },
  { match: /\bhalf[- ]?turn\b/i,      expansion: "half-turn (U-shape / dog-leg) staircase" },
  { match: /\bquarter[- ]?turn\b/i,   expansion: "quarter-turn (L-shape) staircase" },
  { match: /\bquarter[- ]?landing\b/i, expansion: "quarter-landing staircase" },
  { match: /\bhalf[- ]?landing\b/i,   expansion: "half-landing staircase" },
  { match: /\bwinder\b/i,             expansion: "winder staircase (shaped treads to turn)" },
  { match: /\bspiral\b/i,             expansion: "spiral staircase" },
  { match: /\bhelical\b/i,            expansion: "helical (curved) staircase" },
  { match: /\bfloating\b/i,           expansion: "floating cantilever staircase" },
  { match: /\bcantilever\b/i,         expansion: "cantilever staircase" },
  { match: /\balternating[- ]?tread\b/i, expansion: "alternating tread (space saver) staircase" },
  { match: /\bspace[- ]?saver\b/i,    expansion: "alternating tread (space saver) staircase" },
  { match: /\bstraight\b/i,           expansion: "straight staircase" },
  { match: /\bopen[- ]?well\b/i,      expansion: "open-well staircase" },
];

// -------- Safe design-context qualifiers (Level B) --------
// Added ONCE per description, only if the term appears and no fuller mention
// of the same concept exists already.
const CONTEXT_QUALIFIERS: Array<{ match: RegExp; qualifier: string; label: string }> = [
  { match: /\boak\b/i,            qualifier: "Oak is a durable hardwood commonly used for premium internal staircases.", label: "oak context" },
  { match: /\bwalnut\b/i,         qualifier: "American Black Walnut is a dark chocolate-brown premium hardwood favoured for luxury internal staircases.", label: "walnut context" },
  { match: /\bmahogany\b/i,       qualifier: "Mahogany is a rich reddish-brown premium hardwood, traditional in period staircases.", label: "mahogany context" },
  { match: /\bpine\b/i,           qualifier: "Pine is a cost-effective softwood commonly used for painted staircases.", label: "pine context" },
  { match: /\bash\b/i,            qualifier: "Ash is a pale hardwood with bold grain, often painted or stained.", label: "ash context" },
  { match: /\bteak\b/i,           qualifier: "Teak is a naturally durable hardwood used where moisture resistance matters.", label: "teak context" },
  { match: /\bglass\s+balustrade\b|\bglass\s+panels?\b/i, qualifier: "Glass balustrade panels create a contemporary open feel.", label: "glass balustrade context" },
  { match: /\bcut\s+string\b/i,   qualifier: "Cut string staircases expose the stepped tread profile — traditional joinery character.", label: "cut string context" },
  { match: /\bclosed\s+string\b/i, qualifier: "Closed string staircases fully enclose the tread ends — clean modern profile.", label: "closed string context" },
  { match: /\bnewel\b/i,          qualifier: "The newel post anchors the balustrade at each change of direction or termination.", label: "newel context" },
  { match: /\bstringer\b/i,       qualifier: "The stringer is the main structural side member carrying the tread and riser loads.", label: "stringer context" },
  { match: /\bwedge\b|\bwedges\b/i, qualifier: "Timber wedges lock treads and risers into housed string joints, eliminating movement over time.", label: "wedge context" },
  { match: /\bangle\s+block\b|\bglue\s+block\b/i, qualifier: "Angle blocks (glue blocks) reinforce every tread-to-riser joint to prevent squeaking.", label: "angle block context" },
  { match: /\bscroll\s+bracket\b/i, qualifier: "Scroll brackets are carved timber pieces beneath each tread on traditional cut-string staircases.", label: "scroll bracket context" },
  { match: /\bfloating\b|\bcantilever\b/i, qualifier: "Floating / cantilever staircases carry every tread load through concealed steel back into a structural wall or steel skeleton.", label: "cantilever context" },
  { match: /\bunder[- ]?stair\b/i, qualifier: "Under-stair space is joinery-family territory — same suppliers make the staircase and the under-stair feature.", label: "under-stair context" },
];

// -------- Public API --------

export function enrichHumanDescription(
  raw: string,
  staircase_kind: "full" | "component" | "related" = "full"
): EnrichmentResult {
  const original = raw;

  // 1. SPELLING — apply per-word replacements (case-insensitive)
  const corrections: string[] = [];
  let cleaned = raw
    .split(/(\s+|[.,;:!?])/)
    .map((token) => {
      const trimmed = token.trim().toLowerCase();
      if (SPELLING[trimmed] && SPELLING[trimmed] !== trimmed) {
        const fixed = SPELLING[trimmed];
        corrections.push(`${trimmed}→${fixed}`);
        // Preserve capitalisation
        if (token[0] && token[0] === token[0].toUpperCase() && token !== token.toUpperCase()) {
          return fixed.charAt(0).toUpperCase() + fixed.slice(1);
        }
        return fixed;
      }
      return token;
    })
    .join("")
    .trim();

  // 2. GRAMMAR — capitalise, ensure single spacing, terminal period
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (!/[.!?]$/.test(cleaned)) cleaned += ".";
  }

  // 3. LAYOUT SHORTHAND EXPANSION — add expanded term as a follow-up sentence
  //    only if the shorthand appears and the expansion isn't already present.
  const added_facts: string[] = [];
  const layoutSentences: string[] = [];
  const seenLayouts = new Set<string>();
  for (const { match, expansion } of LAYOUT_EXPANSIONS) {
    if (match.test(cleaned) && !cleaned.toLowerCase().includes(expansion.toLowerCase())) {
      const key = expansion.toLowerCase();
      if (seenLayouts.has(key)) continue;
      seenLayouts.add(key);
      layoutSentences.push(`Layout: ${expansion}.`);
      added_facts.push(`layout expansion: ${expansion.split(" ")[0]}`);
    }
  }

  // 4. SAFE DESIGN-CONTEXT QUALIFIERS (Level B — one qualifier per matched term)
  const contextSentences: string[] = [];
  const seenLabels = new Set<string>();
  for (const { match, qualifier, label } of CONTEXT_QUALIFIERS) {
    if (match.test(cleaned) && !seenLabels.has(label)) {
      seenLabels.add(label);
      contextSentences.push(qualifier);
      added_facts.push(label);
    }
  }

  // 5. Assemble enriched text
  const parts = [cleaned];
  if (layoutSentences.length > 0) parts.push(layoutSentences.join(" "));
  if (contextSentences.length > 0) parts.push(contextSentences.join(" "));
  const enriched = parts.join(" ");

  return {
    original,
    cleaned,
    enriched,
    corrections,
    added_facts,
  };
}
