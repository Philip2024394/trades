// Staircase Advisor · trigger patterns (Section 3 of the design spec)
//
// Advisor mode engages when the customer message is a decision request.
// Information requests continue to route through the knowledge bridge.
// Priority rule (Section 3): if a message matches both an Advisor trigger
// AND a knowledge intent, Advisor wins.

import type { AdvisorState } from "./state";
import { isBoundaryRequest } from "./boundaries";
import { matchComparison } from "./comparisons";
import { matchTruthTopic } from "./truth-answer";
import { matchAmbiguity } from "./ambiguity";
import { retrieveTruth } from "./truth-retrieval";
import { isIdentityProbe } from "./identity";
import { isObviouslyInScope } from "./scope-classifier";

// T09 fix 2026-08-01 · project-context patterns · on a staircase chat, a
// customer stating their project (building a house / renovating / etc.)
// is a decision-guidance signal even without the word "staircase". Symptom
// the fix addresses: "i am building a house" did not trigger Advisor and
// fell through to composer that served an unrelated article.
const PROJECT_CONTEXT_PATTERNS: RegExp[] = [
  /\bnew\s+build\b/i,
  /\b(building|constructing|build)\s+(a\s+|my\s+|our\s+)?(new\s+|own\s+)?(house|home)\b/i,
  /\bnew\s+(house|home)\b/i,
  /\bself[\s-]?build\b/i,
  /\brenovating\b/i,
  /\b(my|our|the|new|an)\s+extension\b/i,
  /\bloft\s+conversion\b/i,
];

// T09 fix 2026-08-01 · "i need X staircase" / "i want X staircase" without
// requiring the "for a new build" tail. Excludes knowledge queries
// ("i need to know about staircases") via negative lookahead.
const DECISION_CONTEXT_PATTERNS: RegExp[] = [
  /\bi\s+(need|want|would\s+like)(?!\s+to\s+know|\s+to\s+understand|\s+information|\s+details)\s+[a-z\s]{0,40}(staircase|stairs)\b/i,
];

// Section 3 · Explicit trigger phrases (verbatim from Philip 2026-08-01 Pass 1 context)
const TRIGGER_PATTERNS: RegExp[] = [
  // Help-choose
  /\bhelp\s+me\s+choose\b/i,
  /\bwhat\s+(would|do)\s+you\s+recommend\b/i,
  /\bwhat\s+staircase\s+should\s+i\b/i,
  /\bhelp\s+me\s+pick\b/i,

  // Suit-my-property
  /\bwhat\s+staircase\s+(would|will|suits?)\s+.*(house|home|property|hall|hallway)\b/i,
  /\bwhat\s+staircase\s+(works?|fits?)\s+(best\s+)?(here|for\s+my\s+(house|home))\b/i,

  // Space-constrained
  /\b(small|tight|limited|narrow)\s+(hallway|hall|space|footprint)\b/i,
  /\bwhat\s+fits\s+in\s+(a\s+)?(tight|small|narrow|limited)\b/i,
  /\bhelp\s+me\s+choose.*small\b/i,

  // Style-uncertain
  /\bi\s+don'?t\s+know\s+what\s+(style|staircase|kind|type)\s+(i\s+)?(want|need)\b/i,
  /\bi\s+don'?t\s+know\s+what\s+i\s+want\b/i,
  /\bnot\s+sure\s+what\s+(style|staircase|kind)\b/i,

  // Material-choice-help
  /\bwhich\s+(wood|timber|material)\s+should\s+i\s+(choose|pick|use)\b/i,
  /\bwhich\s+material\s+is\s+best\s+for\s+me\b/i,

  // Design-help
  /\bcan\s+you\s+help\s+me\s+design\b/i,
  /\bdesign\s+help\b/i,

  // Behavioural · "I need/want [modifiers] staircase for [project context]"
  /\bi\s+(need|want|am\s+looking\s+for)\s+[a-z\s]{0,40}staircase\s+for\s+(my|a|an|the)\s+(new\s+build|renovation|extension|loft|replacement)\b/i,
];

// Section 4.1 · Replacement branch triggers (unauthored branch · handled with limitation message)
const REPLACEMENT_PATTERNS: RegExp[] = [
  /\breplace\s+(my\s+)?(old\s+)?(staircase|stairs)\b/i,
  /\bi\s+want\s+to\s+replace\s+(my\s+)?(staircase|stairs)\b/i,
  /\bnew\s+staircase\s+in\s+place\s+of\s+(my\s+)?(old\s+|existing\s+)?(staircase|stairs)\b/i,
];

// Section 4.1 · Extension branch triggers (unauthored branch · handled with limitation message)
const EXTENSION_PATTERNS: RegExp[] = [
  /\bstaircase\s+for\s+(my\s+|the\s+|our\s+)?extension\b/i,
  /\bstaircase\s+in\s+(my\s+|our\s+)?(new\s+)?extension\b/i,
  /\b(adding|building)\s+an?\s+extension\b.*staircase\b/i,
];

export function shouldTriggerAdvisor(message: string, state: AdvisorState): boolean {
  // Philip 2026-08-01 · Advisor is the single Nex personality entry point.
  // Every message goes through Advisor · Advisor decides what to do:
  //   - identity probe → Nex identity response
  //   - off-topic (classifier) → warm redirect
  //   - staircase question → knowledge composition
  //   - preference answer → state extraction
  // This gives customers "one consistent Nex personality regardless of
  // which internal component produced the answer."
  return true;
}

// Legacy exports kept for anyone importing them · logic is now Advisor-owned
export function _legacyTriggerCheck(message: string, state: AdvisorState): boolean {
  if (isIdentityProbe(message)) return true;
  if (isObviouslyInScope(message)) return true;
  if (state.advisor_active) return true;
  // Standard advisor triggers (Section 3 patterns)
  if (TRIGGER_PATTERNS.some((p) => p.test(message))) return true;
  // T09 fix · project-context statements ("i am building a house") on a
  // staircase chat are decision-guidance signals · trigger Advisor so
  // it can extract project_type and progress the conversation.
  if (PROJECT_CONTEXT_PATTERNS.some((p) => p.test(message))) return true;
  // T09 fix · "i need X staircase" / "i want X staircase" · trigger
  // Advisor so it can extract preferences and continue.
  if (DECISION_CONTEXT_PATTERNS.some((p) => p.test(message))) return true;
  // Unauthored-branch messages must engage Advisor so it can emit the honest
  // limitation message (T05 fix · 2026-08-01 · symptom: fell through to
  // bridge · served gateway article instead of Replacement handoff).
  if (REPLACEMENT_PATTERNS.some((p) => p.test(message))) return true;
  if (EXTENSION_PATTERNS.some((p) => p.test(message))) return true;
  // Safety-critical boundary messages must engage Advisor so it can emit
  // the price/fit refusal (T06 fix · 2026-08-01 · symptom: fell through to
  // composer · served pricing content when customer asked for exact price).
  if (isBoundaryRequest(message) !== null) return true;
  // G20 · comparative-question teaching (Philip 2026-08-01) · "what's better
  // glass or timber" is a decision-guidance signal even without other
  // trigger patterns · Advisor must engage to teach the trade-offs.
  if (matchComparison(message) !== null) return true;
  // Truth Answer Composer (Philip 2026-08-01 · "bring nex alive to answer
  // from truth herself") · direct topic questions engage Advisor so Nex can
  // answer with a verbatim Philip snippet in her own voice.
  if (matchTruthTopic(message) !== null) return true;
  // G06 · Ambiguity clarification (Philip 2026-08-01) · vague preferences
  // ("i want it light" · "keep it simple") engage Advisor so Nex can offer
  // two specific hypotheses rather than silently guessing.
  if (matchAmbiguity(message) !== null) return true;
  // Truth Retrieval (Philip 2026-08-01 · phase 2 of "answer from truth herself")
  // · full corpus search. When retrieval finds a strong Philip snippet match,
  // Advisor engages so Nex can compose the answer in her voice rather than
  // letting the whole article ship via Runtime Core.
  if (retrieveTruth(message) !== null) return true;
  return false;
}

export function isReplacementBranch(message: string): boolean {
  return REPLACEMENT_PATTERNS.some((p) => p.test(message));
}

export function isExtensionBranch(message: string): boolean {
  return EXTENSION_PATTERNS.some((p) => p.test(message));
}

// T09 fix 2026-08-01 · customer asks for images DURING an Advisor conversation.
// Verified Visual Library isn't wired yet · Nex acknowledges + continues.
// Only applies inside Advisor flow (state.advisor_active) · fresh image
// requests still fall through to the runtime bridge / composer.
const IMAGE_REQUEST_PATTERNS: RegExp[] = [
  /\b(image|images|picture|pictures|photo|photos|photograph|photographs)\b/i,
  /\b(see|show)\s+(?:me\s+)?(?:an?\s+|some\s+)?(image|picture|photo|photograph|inspiration|examples)\b/i,
  /\bcan\s+i\s+see\b/i,
];

export function isImageRequest(message: string): boolean {
  return IMAGE_REQUEST_PATTERNS.some((p) => p.test(message));
}
