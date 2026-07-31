// Boundary intent detection · routing repair (Philip 2026-07-30 activation Master Prompt).
//
// The Canonical Refusal Registry (staircase-brain-v1-freeze-candidate.md) declares
// 15 categories of questions NEX must refuse. Content-match routing alone bypasses
// several of these because refusal-shape questions often contain Terminology terms
// or module keywords that match without honouring user intent.
//
// This module runs BEFORE any retrieval and detects the refusal-intent categories
// the audit proved were bypassed. It returns the specific refusal so the fallback
// carries constitutional reasoning, not coverage-limit reasoning.
//
// Rule A: no new refusals invented. Only the existing 15 categories from the
// freeze candidate can be surfaced by this module.
//
// Not intent classification in the ML sense — deterministic keyword detection
// aligned to the refusal registry.

import "server-only";

export type RefusalIntent = {
  category: number;
  name: string;
  reason: string;
} | null;

// Refusal categories aligned to the Canonical Refusal Registry.
const REFUSAL_PATTERNS: Array<{
  category: number;
  name: string;
  reason: string;
  patterns: RegExp[];
}> = [
  {
    category: 1,
    name: "Regulatory / Compliance",
    reason: "NEX has not been authored for building regulations. The Regulations module has not earned inclusion.",
    patterns: [
      /\b(regulations?|regulatory|compliance|compliant|approved\s+doc|approved\s+document)\b/i,
      /\b(building\s+reg|building\s+code|code\s+compliant)\b/i,
      /\b(maximum|minimum)\s+(rise|going|pitch|headroom|handrail\s+height)\b/i,
      /\b(is\s+.*\s+legal|legally\s+compliant)\b/i,
      /\bBS\s*\d+\b/i,
      /\bapproved\s+doc(?:ument)?\s+K\b/i,
    ],
  },
  {
    category: 6,
    name: "Commercial / Recommendations",
    reason: "NEX cannot recommend manufacturers, products, or commercial choices. Commercial neutrality is constitutional.",
    patterns: [
      /\b(which|what)\s+(staircase|manufacturer|installer|company|brand|product)\s+(should|do\s+i|to|is\s+best)\b/i,
      /\brecommend\s+(a|an|me|the|good|best)\b/i,
      /\bwho\s+should\s+i\s+(use|hire|choose|pick)\b/i,
      /\bbest\s+(manufacturer|installer|company|brand|supplier|staircase)\b/i,
      /\b(where|how)\s+(can|do)\s+i\s+buy\b/i,
      /\bdiscount\s+codes?\b/i,
    ],
  },
  {
    category: 7,
    name: "Visual / Image (Observation 003)",
    reason: "NEX does not have a Visual Intelligence layer. Images cannot demonstrate compliance and NEX cannot retrieve them.",
    patterns: [
      /\bshow\s+(me|us)?\s*(a|an|the|some)?\b.*\b(images?|pictures?|photos?|renders?|drawings?|examples?)\b/i,
      /\b(pictures?|photos?|renders?|images?|drawings?)\s+of\b/i,
      /\bcan\s+(this|you)\s+.*\s+(image|photo|picture|render)\b/i,
      /\b(display|render|generate|show)\s+(a|an|the)?\s*(staircase|image)\b/i,
    ],
  },
  {
    category: 2,
    name: "Structural / Manufacturing Safety",
    reason: "NEX cannot certify structural or manufacturing safety without site verification and engineering review.",
    patterns: [
      /\bcan\s+this\s+.*\s+be\s+manufactured\b/i,
      /\bis\s+this\s+.*\s+safe\s+to\s+(manufacture|install|build)\b/i,
      /\b(manufacturing|structural)\s+(safety|feasibility|assessment)\b/i,
      /\b(load|structural)\s+calculation\b/i,
      /\bengineering\s+assessment\b/i,
      /\bcan\s+this\s+(staircase|structure)\s+carry\b/i,
    ],
  },
  {
    category: 15,
    name: "Confidence / Certainty",
    reason: "NEX cannot convert probabilities into certainties. Timber and staircase behaviour depends on context that cannot be verified remotely.",
    patterns: [
      /\bwill\s+.*\s+(never|definitely\s+not)\s+(move|split|crack|squeak|break|fail)\b/i,
      /\b(never|definitely\s+no)\s+(any\s+)?(movement|squeak|split|crack|defect)\b/i,
      /\bguaranteed\s+(no|not)\b/i,
      /\b(will|would)\s+(never|definitely|always)\b/i,
      /\bcompletely\s+(stable|smooth|perfect)\b/i,
      /\babsolutely\s+no\b/i,
      /\bforever\b/i,
      /\bwill\s+not\s+(crack|split|move|break)\s+ever\b/i,
    ],
  },
  {
    category: 4,
    name: "Legal / Contract",
    reason: "NEX cannot give legal advice or interpret contracts. This requires a solicitor.",
    patterns: [
      /\bcan\s+i\s+sue\b/i,
      /\bcontract\s+law\b/i,
      /\blegal\s+advice\b/i,
      /\b(warranty|guarantee)\s+period\b/i,
      /\b(consumer\s+rights|statutory\s+rights)\b/i,
    ],
  },
  {
    category: 5,
    name: "Insurance",
    reason: "NEX cannot interpret specific insurance policies. Customer needs their policy wording and their insurer.",
    patterns: [
      /\binsurance\s+(covers?|policy|claim)\b/i,
      /\bcovered\s+by\s+insurance\b/i,
    ],
  },
];

/** Detect whether a query is a refusal-intent shape. Returns the specific
 *  refusal category if so · null otherwise. Deterministic keyword detection. */
export function detectRefusalIntent(query: string): RefusalIntent {
  for (const cat of REFUSAL_PATTERNS) {
    for (const pat of cat.patterns) {
      if (pat.test(query)) {
        return { category: cat.category, name: cat.name, reason: cat.reason };
      }
    }
  }
  return null;
}

/** Compose a truthful refusal message for a detected intent. */
export function composeRefusalIntent(intent: NonNullable<RefusalIntent>): string {
  return `I cannot answer this truthfully. Category ${intent.category} of the Canonical Refusal Registry (${intent.name}) applies: ${intent.reason}`;
}
