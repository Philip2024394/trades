// Staircase Advisor · Truth Answer Composer (Philip 2026-08-01)
//
// Mission: "bring nex alive to answer from truth herself."
//
// This module lets Nex respond to questions that arise mid-conversation
// (or fresh) by pulling a verbatim snippet from Philip-authored evidence
// and wrapping it in Nex's voice — a lightweight intro, the verbatim
// truth, and an optional follow-up that returns to the Advisor flow.
//
// This is retrieval + templated composition (no LLM · no invention).
// Every snippet is EXTRACTED VERBATIM from a Philip file listed in
// Section 8 of the design spec. To add a topic, add an entry whose
// text is already in the corpus.

import "server-only";

export type TruthTopic = {
  id:              string;
  match_patterns:  RegExp[];      // patterns that mean "customer is asking about this"
  intro:           string;        // Nex-voice lead-in (short · natural)
  snippet:         string;        // VERBATIM from Philip source
  source:          string;        // citation for the trace
  follow_up?:      string;        // optional follow-up sentence tying back to Advisor flow
};

const TOPICS: TruthTopic[] = [
  {
    id: "handrail-importance",
    match_patterns: [
      /\b(how\s+)?important.{0,10}(is\s+)?(the\s+)?handrail\b/i,
      /\bwhy\s+(is\s+)?(the\s+)?handrail\s+(important|matter|matters)\b/i,
      /\bhandrail\s+(quality|matters?|important)\b/i,
      /\btell\s+me\s+about\s+(the\s+)?handrail\b/i,
    ],
    intro: "The handrail is one of the details customers underestimate most.",
    snippet:
      "It's what people touch every day. A premium staircase gets its luxury feel from handrail profile, smooth sanding, timber selection, and finish quality. When you're deciding where to invest, the handrail is worth spending on — you'll touch it every time you use the stairs.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · three most expensive mistakes + spend-where-visible",
    follow_up: "Would you like to continue exploring your staircase direction?",
  },
  {
    id: "children-glass-safety",
    match_patterns: [
      /\b(are|is)\s+glass\s+(stair|staircases?)\s+safe\b/i,
      /\bglass\s+staircase\s+(safe|safety)\b/i,
      /\bchildren\s+(on|with)\s+glass\b/i,
      /\bkids\s+(on|with)\s+glass\b/i,
      /\bsafe\s+for\s+(children|kids)\b/i,
    ],
    intro: "This comes up often — let me give you the honest answer.",
    snippet:
      "Children can safely use glass staircases when designed and installed to appropriate safety standards, with suitable toughened or laminated glass where required. Neither glass nor timber is universally better — it depends on the design and the feeling you want.",
    source: "nex-knowledge-base-staircase-materials-overview.md · Timber or glass balustrade section",
    follow_up: "Would you like to continue narrowing down the direction, or explore glass vs timber trade-offs in more detail?",
  },
  {
    id: "best-question-to-ask-manufacturer",
    match_patterns: [
      /\bbest\s+question\s+(to\s+ask|for)\b/i,
      /\bwhat\s+(should|do)\s+i\s+ask\s+(a\s+|any\s+)?(staircase\s+)?(company|manufacturer|maker|supplier)\b/i,
      /\bhow\s+(do\s+i|should\s+i)\s+(choose|pick)\s+(a\s+|the\s+)?(staircase\s+)?(company|manufacturer|supplier)\b/i,
    ],
    intro: "There is one question that reveals more than any other.",
    snippet:
      "Ask any staircase company: \"If this staircase were going into your own home, what would you change and why?\" The answer reveals whether they're thinking about long-term quality, appearance, durability, and customer satisfaction — not just completing another order.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · The single best question to ask",
    follow_up: "Would you like to keep working on your direction, or hear about the questions worth asking any manufacturer?",
  },
  {
    id: "three-most-expensive-mistakes",
    match_patterns: [
      /\b(most\s+expensive|biggest|common(est)?|worst)\s+mistakes?\b/i,
      /\bwhat\s+(should|do)\s+i\s+avoid\b/i,
      /\bmistakes?\s+to\s+avoid\b/i,
    ],
    intro: "There are three that come up again and again.",
    snippet:
      "First, wrong measurements — small errors create large problems. Second, choosing style before layout — style must fit the building geometry, not the other way around. Third, ignoring the handrail — it's what people touch every day, and a premium staircase gets its luxury feel from handrail profile, smooth sanding, timber selection, and finish quality.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · The three most expensive mistakes",
    follow_up: "Would you like to continue on your project direction, or explore any of these in more depth?",
  },
  {
    id: "under-stair-space",
    match_patterns: [
      /\bunder[\s-]?stair(s)?\b/i,
      /\bwhat\s+(can|to)\s+do\s+(with\s+)?(the\s+)?(space\s+)?under(neath)?\s+(the\s+)?stair\b/i,
      /\bunder\s+(the\s+)?stair(s|case)?\s+(space|storage|ideas?)\b/i,
    ],
    intro: "Under-stair space is one of the most valuable parts of the project.",
    snippet:
      "Options include storage (pull-out drawers · cupboards · shoe storage), display (bookshelves · lighting · wine storage), and working space (a small office or reading area). Most staircases waste this space; the best designs treat it as a feature.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Under-stair section",
    follow_up: "Would you like to continue with your staircase direction?",
  },
  {
    id: "spend-where-visible",
    match_patterns: [
      /\bwhere\s+(should|do)\s+i\s+spend\b/i,
      /\bbudget\s+(priority|priorities|allocation)\b/i,
      /\bworth\s+spending\s+on\b/i,
      /\bwhere\s+to\s+save\s+(money|budget)\b/i,
    ],
    intro: "There is a simple rule that saves customers a lot of money without sacrificing appearance.",
    snippet:
      "Allocate material and finish budget preferentially to components the owner touches daily and sees prominently. Spend more on: handrail · visible treads · newel posts · feature balustrade — anything the customer touches or sees. Spend less on: hidden structure · painted components · areas nobody sees. Result: the staircase looks premium and costs materially less than 'all oak everything'.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Where to spend, where to save section (Principle B)",
    follow_up: "Would you like to keep exploring your direction?",
  },
  // ── Second wave · 10 new topics added 2026-08-01 ──────────────
  {
    id: "led-lighting",
    match_patterns: [
      /\bled\s+(lighting|lights?|strips?)\b/i,
      /\blights?\s+(on|under|for)\s+(the\s+)?(stair|staircase|steps?)\b/i,
      /\bstaircase\s+lighting\b/i,
      /\bshould\s+i\s+(add|use|have)\s+(lighting|lights?|led)\b/i,
    ],
    intro: "Lighting is increasingly popular and can transform a staircase visually.",
    snippet:
      "Common locations: under handrail · wall string · under floating treads · on the landing. Lighting can transform a staircase visually — it turns a functional element into a feature of the room, especially in the evening.",
    source: "nex-knowledge-base-staircase-materials-overview.md · LED lighting section",
    follow_up: "Would you like to keep working through your direction?",
  },
  {
    id: "design-for-future-repairs",
    match_patterns: [
      /\b(future|later)\s+repairs?\b/i,
      /\b(how\s+)?long\s+(will|do)\s+.{0,20}(last|maintain)\b/i,
      /\b(20|50|years?)\s+(ahead|later|down\s+the\s+(line|road))\b/i,
      /\blifetime\s+(cost|value)\b/i,
      /\bcheapest\s+.{0,20}\s+(long\s+term|lifetime|over\s+time)\b/i,
    ],
    intro: "A good staircase is designed with 20 to 50 years ahead in mind.",
    snippet:
      "Ask: can the handrail be refinished? Can damaged treads be repaired? Are replacement parts available? Will the style age well? The cheapest staircase is not always the cheapest over its lifetime.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Design for future repairs section",
    follow_up: "Would you like to continue with your project direction?",
  },
  {
    id: "proportions-matter",
    match_patterns: [
      /\bproportions?\s+(matter|important)\b/i,
      /\brise\s+(and|vs|or)\s+going\b/i,
      /\bstep\s+(height|depth)\b/i,
      /\bwhy\s+does\s+.{0,20}\s+feel\s+(uncomfortable|awkward|off)\b/i,
    ],
    intro: "A beautiful staircase is often about proportion, not just expensive materials.",
    snippet:
      "The relationship between rise (step height) and going (step depth) determines walking comfort and appearance. A staircase can be technically correct but feel uncomfortable if the proportions are wrong. Good proportions are what make a staircase feel right underfoot — even before you notice the materials.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Proportions matter section",
    follow_up: "Would you like to keep exploring your direction?",
  },
  {
    id: "starting-step-options",
    match_patterns: [
      /\b(first|starting)\s+step\b/i,
      /\bbullnose\b/i,
      /\bcurtail\b/i,
      /\bfeature\s+(step|newel)\s+at\s+the\s+bottom\b/i,
      /\bdecorative\s+(start|first\s+step)\b/i,
    ],
    intro: "The starting step is often what makes a staircase memorable.",
    snippet:
      "Options include: bullnose step · double bullnose · sweeping curved start (curtail) · feature newel · open tread start · decorative apron. Many staircases are remembered because of the starting step — it's a small decision with a large visual return.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Starting step section",
    follow_up: "Would you like to continue with your direction?",
  },
  {
    id: "kiln-drying-certification",
    match_patterns: [
      /\bkiln[\s-]?dried\b/i,
      /\bfsc\b/i,
      /\bcertified\s+(timber|wood)\b/i,
      /\bresponsibly\s+managed\b/i,
      /\btimber\s+(origin|source|quality|grade)\b/i,
      /\bwhere\s+does\s+the\s+(timber|wood|oak|pine)\s+come\s+from\b/i,
    ],
    intro: "Fair questions to ask any staircase company.",
    snippet:
      "Which species? Is it kiln dried? Is it certified from responsibly managed forests? Is it solid or engineered/laminated? Customers increasingly value origin transparency — a good manufacturer will answer these clearly.",
    source: "nex-knowledge-base-staircase-materials-overview.md · Timber grade and origin section",
    follow_up: "Would you like to continue with your project direction?",
  },
  {
    id: "should-i-carpet",
    match_patterns: [
      /\bshould\s+i\s+carpet\b/i,
      /\bcarpet\s+(my\s+|the\s+)?stair(case)?\b/i,
      /\bcarpet\s+runner\b/i,
      /\bcarpet\s+or\s+not\b/i,
    ],
    intro: "It depends on priorities.",
    snippet:
      "Carpet is quieter, warmer, better grip, and protects the timber. Exposed timber shows the natural wood, is easier to clean, and gives a more premium appearance. Some customers combine both — a carpet runner with exposed edges is a popular compromise.",
    source: "nex-knowledge-base-staircase-materials-overview.md · Should I carpet my staircase section",
    follow_up: "Would you like to continue exploring your direction?",
  },
  {
    id: "why-oak-varies",
    match_patterns: [
      /\bwhy\s+do(es)?\s+.{0,20}\s+oak\s+.{0,30}\s+different\b/i,
      /\btwo\s+(oak\s+)?stair(case)?s?\s+look\s+different\b/i,
      /\b(will|does|is)\s+.{0,20}\s+oak\s+.{0,30}\s+(consistent|uniform|identical|match)\b/i,
      /\bwhy\s+.{0,20}\s+(grain|colour|colour)\s+.{0,20}\s+different\b/i,
    ],
    intro: "This is one of the things worth understanding about natural timber.",
    snippet:
      "Timber is natural. Colour, grain, knots, and growth conditions vary tree-to-tree. Every board is unique. Two oak staircases will not look identical — and this is a feature of real timber, not a fault. If perfect uniformity matters, painted finishes or engineered materials give more control.",
    source: "nex-knowledge-base-staircase-materials-overview.md · Why do two oak staircases look different section",
    follow_up: "Would you like to keep exploring your direction?",
  },
  {
    id: "doors-match-staircase",
    match_patterns: [
      /\b(should|do)\s+.{0,10}\s+doors\s+match\s+(the\s+)?stair(case)?\b/i,
      /\bmatch(ing)?\s+doors?\s+(and|with|to)\s+stair(case)?\b/i,
      /\b(internal|interior)\s+doors?\s+.{0,20}\s+(match|coordinate|pair)\b/i,
    ],
    intro: "Generally yes — the staircase and internal doors belong to the same design language.",
    snippet:
      "Traditional houses often pair 4-panel doors with a turned staircase. Modern houses often pair Shaker doors with square newels and black balusters. Contemporary houses often pair flush doors with a glass balustrade. When the doors and staircase are chosen together, the whole interior feels considered.",
    source: "nex-knowledge-base-staircase-materials-overview.md · Should internal doors match section",
    follow_up: "Would you like to keep working on your direction?",
  },
  {
    id: "match-flooring",
    match_patterns: [
      /\b(should|do)\s+.{0,15}\s+stair(case)?\s+match\s+(the\s+)?(floor|flooring)\b/i,
      /\bmatch\s+(the\s+)?(floor|flooring)\b/i,
      /\bstair(case)?\s+(and|vs|or)\s+(floor|flooring)\b/i,
    ],
    intro: "Not always — and often contrast is what makes an interior interesting.",
    snippet:
      "Great interiors often contrast: oak floor + painted staircase · walnut floor + oak staircase · stone floor + oak staircase. Colours and styles should complement, not necessarily match. Forcing a match can make a room feel over-designed; deliberate contrast gives the eye something to enjoy.",
    source: "nex-knowledge-base-staircase-materials-overview.md · Should the staircase match the flooring section",
    follow_up: "Would you like to keep exploring your direction?",
  },
  {
    id: "start-with-layout",
    match_patterns: [
      /\bwhere\s+(do|should)\s+i\s+start\b/i,
      /\bwhat\s+comes\s+first\b/i,
      /\bhow\s+do\s+i\s+design\s+(a\s+)?stair(case)?\b/i,
      /\b(critical\s+)?measurements?\s+(before|first)\b/i,
    ],
    intro: "The design must start with the building, not the staircase.",
    snippet:
      "A customer often sees a beautiful curved staircase online and wants it. But the house may not have enough space, correct structure, or budget. Critical measurements before any style decision: floor-to-floor height, available length, opening size, headroom, wall positions. The staircase you can build is the staircase your building allows.",
    source: "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Start with the layout section (Principle A)",
    follow_up: "Would you like to continue exploring your direction?",
  },
];

export type TruthAnswer = {
  topic:    TruthTopic;
  text:     string;
  sources:  string[];
};

/** Match a customer message to a truth topic · returns null if no confident match. */
export function matchTruthTopic(message: string): TruthAnswer | null {
  for (const topic of TOPICS) {
    if (topic.match_patterns.some((p) => p.test(message))) {
      const parts = [topic.intro, topic.snippet];
      if (topic.follow_up) parts.push(topic.follow_up);
      return {
        topic,
        text:    parts.join(" "),
        sources: [topic.source],
      };
    }
  }
  return null;
}
