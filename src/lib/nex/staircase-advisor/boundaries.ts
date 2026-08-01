// Staircase Advisor · Section 6 boundary + Section 7 handoff enforcement
//
// Two responsibilities:
//   1. Detect boundary requests (price · fit-guarantee) · emit safe handoff message
//   2. Handle unauthored branches (Replacement · Extension) with polite limitation
//      message per Philip 2026-08-01 Option A ("don't hide the gaps · make them
//      explicit product boundaries").

const PRICE_PATTERNS: RegExp[] = [
  /\b(exact|final|guaranteed|specific)\s+price\b/i,
  /\bhow\s+much\s+(will|does|would)\s+(it|this|the\s+staircase)\s+cost\b/i,
  /\bcan\s+you\s+(quote|price)\s+(it|this|me)\b/i,
  /\btell\s+me\s+the\s+(exact\s+)?price\b/i,
  /\bwhat'?s\s+the\s+(exact\s+)?price\b/i,
];

const FIT_GUARANTEE_PATTERNS: RegExp[] = [
  /\bguarantee\s+it\s+(fits|will\s+fit)\b/i,
  /\bwill\s+(it|this|the\s+staircase)\s+(definitely\s+)?fit\b/i,
  /\bwill\s+(it|this)\s+(definitely\s+)?pass\s+(building\s+regulations?|regulations?|inspection|installation)\b/i,
  /\bcan\s+you\s+guarantee\s+(it|this|the\s+fit|the\s+installation)\b/i,
];

export type BoundaryKind = "price" | "fit" | null;

export function isBoundaryRequest(message: string): BoundaryKind {
  if (PRICE_PATTERNS.some((p) => p.test(message))) return "price";
  if (FIT_GUARANTEE_PATTERNS.some((p) => p.test(message))) return "fit";
  return null;
}

export const PRICE_HANDOFF_MESSAGE =
  "I can't quote or guarantee a final price — a quote needs a survey because pricing depends on floor-to-floor height, opening size, materials, balustrade, and finish. What I can do is help you narrow down the direction so the pricing conversation starts with clear preferences. Would you like to do that?";

export const FIT_HANDOFF_MESSAGE =
  "I can't guarantee a specific staircase will fit a property without proper measurements and drawings — a designer needs to measure your space to confirm. What I can do is help you narrow down the style, materials, and layout family so the design conversation starts with clear preferences. Would you like to do that?";

export const REPLACEMENT_HANDOFF_MESSAGE =
  "I can help you explore staircase direction and materials. For a replacement staircase, I need a few more details about your existing space. My replacement pathway is not fully available yet, so a designer would need to confirm the specific solution. Would you still like to explore direction with me, or would you prefer to speak with a designer now?";

export const EXTENSION_HANDOFF_MESSAGE =
  "I can help you explore staircase direction and materials. For an extension, the staircase design depends on how the extension integrates with your existing structure. My extension pathway is not fully available yet, so a designer would need to confirm the specific solution. Would you still like to explore direction with me, or would you prefer to speak with a designer now?";

export const FIVE_TURN_HANDOFF_MESSAGE =
  "You've thought this through — at this point a designer visit or showroom would help you decide with the specifics of your space. Would you like me to help you prepare for that conversation?";
