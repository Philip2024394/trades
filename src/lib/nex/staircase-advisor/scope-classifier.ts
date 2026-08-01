// Nex scope classifier · Philip 2026-08-01 · replaces off-topic regex sprawl
//
// Directive from Philip:
//   "Don't hard-code hundreds of patterns. Instead ask one question
//   internally: Does this relate to the Staircase Brain? If yes → answer.
//   If no → politely redirect."
//
// Two-tier design · optimises for latency and cost:
//   1. FAST PATH · staircase-keyword heuristic (0ms · always in-scope)
//   2. SLOW PATH · Haiku LLM classifier (~200ms · $0.0003/call · only when
//      no keyword hits · handles the rare cases regex would miss anyway)
//
// The regex list is now ONE line (staircase vocabulary) instead of dozens
// of off-topic pattern arrays.

import "server-only";
import { completeJson } from "@/lib/llm/anthropic";

// Fast path · any of these words in the message means it's in-scope.
// Cheap · deterministic · no LLM call needed.
// Philip 2026-08-01 · added physical-space words (hallway · entrance · foyer ·
// porch · reception · corridor · vestibule) so single-word installation-context
// replies pass the scope check instead of triggering the LLM classifier fallback.
// Philip 2026-08-02 · added glass-material vocabulary so questions like
// "difference between clear and low iron glass" pass the fast-path check.
// Also added metal-material vocabulary (stainless · brass · bronze) which
// surface in the newel-posts / balustrade knowledge domain.
const STAIRCASE_KEYWORDS = /\b(staircase|stair|stairs|step|steps|newel|baluster|handrail|balustrade|balusters|spindle|spindles|tread|treads|riser|risers|nosing|winder|winders|landing|string|closed[\s-]string|cut[\s-]string|flight|bullnose|curtail|loft\s+conversion|extension|renovation|renovate|new[\s-]build|oak|pine|walnut|ash|beech|mahogany|walnut|cherry|sapele|hemlock|softwood|hardwood|joinery|joiner|carpenter|carpentry|timber|wooden|glass|glass\s+balustrade|toughened|laminated|low[\s-]iron|frameless|tinted|frosted|stainless|brass|bronze|steel|aluminium|banister|rail|installation|install|fit|fitter|manufacturer|survey|surveyor|design|designer|interior|building\s+control|part\s+k|riseandrun|rise\s+and\s+run|nex\s+stairplan|stairplan|warranty|guarantee|delivery|quote|price|hallway|entrance|foyer|porch|reception|corridor|vestibule)\b/i;

// Identity/scope-probe questions · very short common patterns kept as fast regex
// because they have bounded variants and appear often. Beyond these, the LLM
// classifier decides.
const OBVIOUS_IDENTITY_PATTERN = /\bare\s+you\s+(a\s+|an\s+)?(ai|bot|chatbot|robot|human|real)\b/i;

export type ScopeResult = "in_scope" | "off_topic";

/** Fast-path check · no LLM cost. Returns true when message clearly relates to staircase/business. */
export function isObviouslyInScope(message: string): boolean {
  return STAIRCASE_KEYWORDS.test(message);
}

/** Identity probe · quick check without LLM. Bounded set of patterns. */
export function isObviousIdentityProbe(message: string): boolean {
  return OBVIOUS_IDENTITY_PATTERN.test(message);
}

// ─── LLM classifier · slow path · called only when heuristic uncertain ───

const CLASSIFIER_SYSTEM_PROMPT = `You classify customer messages for Nex — a UK staircase specialist system.

Return JSON: { "in_scope": true|false, "category": "staircase" | "business" | "off_topic" }

IN SCOPE (return in_scope=true):
- Anything about staircases · materials · design · installation
- Anything about the Nex Stairplan business (quotes · delivery · warranty · service · orders · contact)
- Renovation · extension · loft conversion · new-build questions (any construction that involves stairs)
- Trade / apprentice questions related to staircase making
- Timber species questions (oak · pine · walnut · etc.)

OFF SCOPE (return in_scope=false):
- Weather · sports · politics · celebrities · movies · music · recipes · cooking
- Medical · legal · financial advice
- General trivia · random facts
- Programming · unrelated tech questions
- Anything that has nothing to do with staircases or Nex Stairplan business

Return ONLY the JSON · no prose.`;

type ClassifierOutput = { in_scope: boolean; category?: string };

/**
 * Classify a message via LLM · only called when fast path is uncertain.
 * Falls open (in_scope=true) if the classifier is unavailable · Advisor
 * proceeds to normal flow · composer boundaries handle any remaining
 * off-topic gracefully.
 */
export async function classifyScope(message: string): Promise<ScopeResult> {
  try {
    const result = await completeJson<ClassifierOutput>({
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
      maxTokens: 60,
      temperature: 0,
      model: "claude-haiku-4-5-20251001",
    });
    if (!result) return "in_scope"; // API failure · fall open
    return result.in_scope === false ? "off_topic" : "in_scope";
  } catch {
    return "in_scope"; // Never block the customer on classifier failure
  }
}

/**
 * Combined check · fast heuristic first · LLM fallback only when uncertain.
 * Returns "in_scope" quickly for staircase-worded messages · defers to LLM
 * only for the ambiguous cases the heuristic can't classify.
 */
export async function determineScope(message: string): Promise<ScopeResult> {
  if (isObviouslyInScope(message)) return "in_scope";
  // No staircase keyword · could be off-topic OR could be a valid question
  // that doesn't use domain vocab ("help me pick something for my house").
  // Defer to the LLM.
  return classifyScope(message);
}
