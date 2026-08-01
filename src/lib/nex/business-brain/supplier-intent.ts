// Business Brain · Supplier Intent Detection (Philip 2026-08-02)
//
// Detects when a customer message crosses from staircase-knowledge intent into
// supplier-connection intent. Once matched, the Staircase Advisor hands control
// to the Supplier Preparation Workflow (Business Brain).
//
// Kept intentionally CONSERVATIVE — false positives would drag every "how do
// I choose oak" question into a workflow. Patterns require an explicit
// buy / make / connect / supplier verb.

import "server-only";

const SUPPLIER_INTENT_PATTERNS: RegExp[] = [
  // "Who can make/build/manufacture..."
  /\bwho\s+(?:can|could)\s+(make|build|manufacture|supply|produce|fabricate|install|fit)\b/i,
  /\bwho\s+(makes|builds|manufactures|supplies|produces|fabricates|installs)\b/i,

  // "Can I buy / purchase / order..."
  /\b(?:can|could)\s+(?:i|we|you)\s+(buy|purchase|order|get)\s+(?:one|this|these|it|that|a|an|the)\b/i,
  /\bhow\s+(?:do|can|could)\s+(?:i|we)\s+(buy|purchase|order|get)\b/i,

  // "Find / recommend / connect me..." with supplier vocabulary
  /\b(?:find|recommend|suggest|connect)\s+(?:me\s+)?(?:with\s+)?(?:a\s+|an\s+|any\s+)?(?:staircase\s+|stair\s+)?(supplier|manufacturer|maker|builder|installer|professional|company|business|specialist|expert|joiner|carpenter)\b/i,

  // Direct requests for a professional connection
  /\b(?:i|we)\s+(?:need|want|would\s+like|am\s+looking\s+for)\s+(?:a\s+|an\s+|some\s+)?(?:staircase\s+|stair\s+)?(supplier|manufacturer|maker|builder|installer|professional|specialist|expert|joiner|carpenter|company|quote)\b/i,
  /\b(?:looking|searching)\s+for\s+(?:a\s+|an\s+|some\s+)?(?:staircase\s+|stair\s+)?(supplier|manufacturer|maker|builder|installer|professional|specialist|expert|joiner|carpenter|company)\b/i,

  // "Get a quote / send a brief / place an order"
  /\b(?:get|request|arrange|send|prepare)\s+(?:a\s+|an\s+)?(quote|quotation|brief|enquiry|inquiry|estimate)\b/i,
  /\bconnect\s+(?:me\s+)?(?:to|with)\s+(?:a\s+|the\s+)?(designer|manufacturer|professional|specialist|team)\b/i,

  // Slightly softer · "arrange manufacture" · "get one made"
  /\b(?:get|have)\s+(?:one|this|it|a\s+staircase)\s+(made|built|manufactured|installed|fitted)\b/i,
  /\bplace\s+an?\s+order\b/i,

  // Philip 2026-08-02 · journey-validation gap fix ·
  // "Can someone build one like this for me?" · "Could someone make this?"
  /\b(?:can|could|would|will)\s+someone\s+(make|build|manufacture|create|produce|supply|install|fit|do|help)\b/i,

  // "I need / want / am looking for someone to make/build..."
  /\b(?:i|we)\s+(?:need|want|would\s+like|am\s+looking\s+for)\s+someone\s+(?:to\s+)?(make|build|manufacture|create|produce|supply|install|fit|help|do)\b/i,

  // "Find/looking for someone (to/who can) make/build..."
  /\b(?:find|looking\s+for|searching\s+for)\s+someone\s+(?:to\s+|who\s+(?:can|could)\s+)?(make|build|manufacture|create|produce|install|fit|help|do)\b/i,

  // "Can this be made?" / "Could this be built?" — passive voice
  /\b(?:can|could)\s+(?:this|it|these|one)\s+be\s+(made|built|manufactured|produced|created|supplied|installed|fitted)\b/i,

  // "I want / need this made" — action verb without "someone"
  /\b(?:i|we)\s+(?:want|need|would\s+like)\s+(?:this|it|one|a\s+staircase|these|something\s+like\s+this|one\s+of\s+these|these\s+made)\s+(made|built|manufactured|installed|fitted|produced|created)\b/i,

  // Softer buying intent · "I want to buy/order" · "I'd like to purchase"
  // Handles both "I'd/we'd" contractions AND "I would like to" long form.
  /\b(?:i|we|i'?d|we'?d)\s+(?:would\s+like\s+to|'?d\s+like\s+to|like\s+to|want\s+to|need\s+to)\s+(buy|purchase|order|commission|arrange|get|have)\b/i,

  // "Can you find (me) someone" — request for a match, verb-neutral
  /\b(?:can|could|will|would)\s+you\s+find\s+(?:me\s+)?(?:a\s+|an\s+|any\s+)?(?:staircase\s+|stair\s+)?(?:supplier|manufacturer|maker|builder|installer|professional|specialist|expert|joiner|carpenter|company|someone)\b/i,
  // "find someone near me" · "find a supplier near me"
  /\bfind\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:supplier|manufacturer|maker|builder|installer|professional|specialist|expert|joiner|carpenter|someone)\s+(?:near\s+(?:me|us|here)|in\s+my\s+area|locally|close\s+by)\b/i,
];

export function isSupplierIntent(message: string): boolean {
  if (typeof message !== "string" || message.length === 0) return false;
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;
  for (const rx of SUPPLIER_INTENT_PATTERNS) if (rx.test(trimmed)) return true;
  return false;
}

// Extraction hints for common single-turn provisions embedded in the trigger
// message · e.g. "who can make this oak staircase with glass" → materials.
// Bigger-picture extraction happens turn-by-turn inside supplier-workflow.ts.
export type SeedFromMessage = {
  materials?:      string[];
  staircase_type?: string;
  design_style?:   string;
};

const MATERIAL_PATTERNS: Array<[RegExp, string]> = [
  [/\boak\b/i, "oak"],
  [/\bwalnut\b/i, "walnut"],
  [/\bash\b/i, "ash"],
  [/\bmaple\b/i, "maple"],
  [/\bglass\b/i, "glass_balustrade"],
  [/\bstainless\b/i, "stainless"],
  [/\bbrass\b/i, "brass"],
  [/\bbronze\b/i, "bronze"],
  [/\bpainted\b/i, "painted_timber"],
];

const STAIRCASE_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(straight\s+flight|straight\s+stairs?|straight)\b/i, "straight_flight"],
  [/\b(quarter\s+turn|quarter-turn)\b/i, "quarter_turn"],
  [/\b(half\s+turn|half-turn)\b/i, "half_turn"],
  [/\b(spiral|helical)\b/i, "spiral"],
  [/\b(curved|sweeping)\b/i, "curved"],
  [/\b(floating|cantilever(?:ed)?)\b/i, "floating"],
];

const STYLE_PATTERNS: Array<[RegExp, string]> = [
  [/\bmodern\b/i, "modern"],
  [/\bcontemporary\b/i, "contemporary"],
  [/\btraditional\b/i, "traditional"],
  [/\bindustrial\b/i, "industrial"],
  [/\bluxury\b/i, "luxury"],
];

export function seedFromMessage(message: string): SeedFromMessage {
  const seed: SeedFromMessage = {};

  const mats: string[] = [];
  for (const [rx, tag] of MATERIAL_PATTERNS) if (rx.test(message)) mats.push(tag);
  if (mats.length > 0) seed.materials = Array.from(new Set(mats));

  for (const [rx, tag] of STAIRCASE_TYPE_PATTERNS) {
    if (rx.test(message)) { seed.staircase_type = tag; break; }
  }
  for (const [rx, tag] of STYLE_PATTERNS) {
    if (rx.test(message)) { seed.design_style = tag; break; }
  }
  return seed;
}
