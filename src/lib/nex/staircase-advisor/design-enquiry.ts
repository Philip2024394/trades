// Staircase Advisor · Design-enquiry detection (Philip 2026-08-01)
//
// Detects messages like "have you got straight stairs?" or "do you have oak
// staircases?" — the customer is BROWSING for a design, not asking a
// knowledge question or answering a form field.
//
// When a design-enquiry is detected, the Advisor tags state so the next turn
// can be interpreted as a physical-location answer (hallway · loft · etc.)
// rather than restarting the Section 4.1 project_type flow.

import "server-only";

// ─── Detection patterns ──────────────────────────────────────────
//
// True design-enquiry shape: "have you / do you have / got any / show me / any"
// combined with a staircase reference (stair · staircase · flight · design ·
// style · type). Excludes definition questions ("what is") and how-to questions
// ("how do I") which are knowledge intent, not design browsing.

// Regex alternation is left-to-right · list LONGER alternatives first so
// "stairs" matches "stairs" (not "stair" leaving a stray "s" that breaks \b).
const SUBJECT_ALT = "staircases|staircase|stairs|stair|flights|flight|designs|design|styles|style|types|type|examples|example";

const DESIGN_ENQUIRY_PATTERNS: RegExp[] = [
  // "have you [got] X stairs" / "have you X staircases"
  new RegExp(`\\bhave\\s+you\\s+(got\\s+)?[a-z\\s]{0,40}(${SUBJECT_ALT})\\b`, "i"),
  // "do you have X" / "do you do X" / "do you carry X"
  new RegExp(`\\bdo\\s+you\\s+(have|got|do|carry|offer|make|stock)\\s+[a-z\\s]{0,40}(${SUBJECT_ALT})\\b`, "i"),
  // "got any X stairs" / "any X staircase"
  new RegExp(`\\bgot\\s+any\\s+[a-z\\s]{0,40}(${SUBJECT_ALT})\\b`, "i"),
  new RegExp(`\\bany\\s+[a-z\\s]{0,40}(${SUBJECT_ALT})\\b(?!.*\\?.*how|.*\\?.*what)`, "i"),
  // "show me X" / "show me some X" / "any examples"
  new RegExp(`\\bshow\\s+me\\s+([a-z\\s]{0,40}\\s+)?(${SUBJECT_ALT})\\b`, "i"),
  // "can I see X"
  new RegExp(`\\bcan\\s+i\\s+see\\s+[a-z\\s]{0,40}(${SUBJECT_ALT})\\b`, "i"),
  // "what X do you [have/offer/do]"
  /\bwhat\s+(kinds?|types?|styles?|designs?)\s+of\s+(staircases|staircase|stairs|stair)\s+do\s+you\b/i,
];

/** True if the message looks like a design-browsing enquiry. */
export function isDesignEnquiry(message: string): boolean {
  return DESIGN_ENQUIRY_PATTERNS.some((p) => p.test(message));
}

// ─── Attribute extraction from the enquiry text ──────────────────
//
// Parse whatever design hints the customer packed into the enquiry so we can
// (a) remember them across turns via state.design_enquiry_context and
// (b) filter Visual Brain retrieval by them later without needing the full
// message to be repeated.

export type DesignEnquiryContext = {
  staircase_type?: string;
  design_style?:   string;
  materials?:      string[];
};

export function extractDesignEnquiryContext(message: string): DesignEnquiryContext {
  const lower = message.toLowerCase();
  const ctx: DesignEnquiryContext = {};

  // staircase_type
  if      (/\bstraight\s+(flight|stair|staircase|stairs)?/.test(lower)) ctx.staircase_type = "straight";
  else if (/\bquarter[\s-]turn|l[\s-]shaped|l\s+shape/.test(lower))     ctx.staircase_type = "quarter-turn";
  else if (/\bhalf[\s-]turn|u[\s-]shaped|u\s+shape|dog[\s-]leg/.test(lower)) ctx.staircase_type = "half-turn";
  else if (/\bspiral|helical/.test(lower))                              ctx.staircase_type = "spiral";
  else if (/\bcurved|sweeping/.test(lower))                             ctx.staircase_type = "curved";
  else if (/\bfloating|cantilever/.test(lower))                         ctx.staircase_type = "floating";
  else if (/\bwinder/.test(lower))                                      ctx.staircase_type = "winder";

  // design_style
  if      (/\bmodern|contemporary|minimalist|minimal\b/.test(lower))         ctx.design_style = "contemporary";
  else if (/\btraditional|classic|heritage|victorian|edwardian|georgian\b/.test(lower)) ctx.design_style = "traditional";
  else if (/\bindustrial|loft|reclaimed\b/.test(lower))                      ctx.design_style = "industrial";
  else if (/\bluxury|premium|bespoke\b/.test(lower))                         ctx.design_style = "luxury";
  else if (/\bbiophilic|planted|green\s+wall\b/.test(lower))                 ctx.design_style = "biophilic";

  // materials (multi-hit)
  const materials: string[] = [];
  if (/\boak\b/.test(lower))                     materials.push("oak");
  if (/\bwalnut\b/.test(lower))                  materials.push("walnut");
  if (/\bpine\b/.test(lower))                    materials.push("pine");
  if (/\bash\b/.test(lower))                     materials.push("ash");
  if (/\bmahogany\b/.test(lower))                materials.push("mahogany");
  if (/\bglass\b/.test(lower))                   materials.push("glass");
  if (/\bsteel|metal\b/.test(lower))             materials.push("steel");
  if (/\bcarpet\b/.test(lower))                  materials.push("carpet");
  if (materials.length > 0) ctx.materials = materials;

  return ctx;
}

// ─── Install-location vocabulary ─────────────────────────────────
//
// Physical-space words a customer might use in reply to "where will the
// staircase be installed?" — plus canonical mapping used by retrieval.
// This is the vocabulary used for both multi-word and bare-word extraction
// in flow.ts.

export const INSTALL_LOCATION_VOCAB: Record<string, string> = {
  hallway:      "hallway",
  hall:         "hallway",
  entrance:     "hallway",
  "entrance hall": "hallway",
  foyer:        "hallway",
  porch:        "hallway",
  reception:    "hallway",
  corridor:     "hallway",
  vestibule:    "hallway",
  landing:      "landing",
  loft:         "loft",
  "loft conversion": "loft",
  extension:    "extension",
  "new build":  "new-build",
  "new-build":  "new-build",
  renovation:   "renovation",
  renovate:     "renovation",
  another:      "other",
  other:        "other",
  somewhere:    "other",
  elsewhere:    "other",
};

// Compiled bare-word regex from vocab keys · anchored to start-of-message so
// only clean single/short-phrase replies match (avoids catching "hallway" that
// appears mid-sentence in an unrelated question).
export const INSTALL_LOCATION_BARE_WORD = /^(hallway|hall|entrance\s+hall|entrance|foyer|porch|reception|corridor|vestibule|landing|loft\s+conversion|loft|extension|new[\s-]?build|renovation|renovate|another\s+location|another|other|somewhere\s+else|elsewhere)\b\.?$/i;

// Multi-word install-location patterns (fire even without next_decision_required
// hint · used to catch "we're doing a hallway install" mid-sentence).
export const INSTALL_LOCATION_PHRASES: Array<[RegExp, string]> = [
  [/\bfor\s+(a\s+|my\s+|our\s+|the\s+)?hallway\b/i,   "hallway"],
  [/\bin\s+(the\s+|my\s+|our\s+|a\s+)?hallway\b/i,     "hallway"],
  [/\bhallway\s+(install|installation|staircase|stair)/i, "hallway"],
  [/\b(entrance|foyer|porch|reception|corridor|vestibule)\s+(install|installation|staircase|stair|way|area)/i, "hallway"],
  [/\bfor\s+(a\s+|my\s+|our\s+|the\s+)?loft\s+conversion\b/i, "loft"],
  [/\bfor\s+(a\s+|my\s+|our\s+|the\s+)?extension\b/i,         "extension"],
  [/\bfor\s+(a\s+|my\s+|our\s+|the\s+)?new[\s-]build\b/i,     "new-build"],
  [/\bfor\s+(a\s+|my\s+|our\s+|the\s+)?renovation\b/i,        "renovation"],
  // Philip 2026-08-02 · Priority 2 · statement-form install-location capture.
  // "we're renovating our hallway" · "planning our loft conversion" · etc.
  [/\b(?:renovating|building|extending|planning|designing|working\s+on|doing)\s+(?:a\s+|my\s+|our\s+|the\s+)?hallway\b/i, "hallway"],
  [/\b(?:renovating|building|extending|planning|designing|working\s+on|doing)\s+(?:a\s+|my\s+|our\s+|the\s+)?(entrance|foyer|porch|reception|corridor|vestibule)\b/i, "hallway"],
  [/\b(?:renovating|building|extending|planning|designing|working\s+on|doing|converting)\s+(?:a\s+|my\s+|our\s+|the\s+)?loft(\s+conversion)?\b/i, "loft"],
  [/\b(?:renovating|building|extending|planning|designing|working\s+on|doing)\s+(?:a\s+|my\s+|our\s+|the\s+)?extension\b/i, "extension"],
  [/\b(?:renovating|building|planning|designing)\s+(?:a\s+|my\s+|our\s+|the\s+)?new[\s-]build\b/i, "new-build"],
];
