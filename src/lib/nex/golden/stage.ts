// Server-side conversation-stage classifier for the Golden Reply
// retriever. Categorical — regex match / fall-through only, no
// pretend probability score. Falls back to "discovery" (the most
// common state) when nothing matches.
//
// This lives on the server because it's only consulted when we're
// going to the composer — social intents (greeting / goodbye / thanks
// / availability / identity / frustration) short-circuit before this
// runs. See docs/nex/conversation-character-layer.md for the stage
// definitions this classifier implements.

import type { Stage } from "./types";

// Closing signals — user is winding down (must beat other patterns).
const CLOSING_RE = /\b(goodbye|good\s*night|goodnight|bye\b|see\s+(?:you|ya)|catch\s+(?:you|ya)|later[sz]?|take\s+care|all\s+the\s+best|speak\s+soon|thats?\s+(?:all|everything|it)|i(?:m|'m)\s+done|ive\s+got\s+what\s+i\s+need|you'?ve\s+answered|ill\s+think\s+about\s+it|need\s+to\s+think)\b/i;

// Objection signals — resistance, challenge, or price pushback.
// Includes frustration language that reaches the composer (softer
// "actually…" corrections; harder frustrations short-circuit before
// this runs).
const OBJECTION_RE = /\b(too\s+expensive|(?:thats?|its)\s+(?:too\s+much|expensive|a\s+lot|a\s+bit\s+much|steep)|(?:another|the\s+other)\s+(?:company|quote|price)|cheaper\s+(?:elsewhere|somewhere)|beat\s+(?:the|this|that)\s+price|just\s+give\s+me\s+the\s+price|why\s+(?:so|are\s+.+\s+so|is\s+it\s+so)\s+expensive|thats?\s+not\s+(?:right|correct)|prove\s+it|are\s+you\s+(?:sure|guessing)|double\s+check|where\s+did\s+that\s+come\s+from|not\s+what\s+i\s+meant|not\s+what\s+i\s+asked)\b/i;

// Decision signals — user is affirming a choice or asking to move
// forward with a specific option.
const DECISION_RE = /\b(i(?:ll|'ll)\s+(?:go|take|have)\s+(?:with\s+)?the?|i\s+want\s+the?|thats?\s+the\s+one|lets?\s+go\s+with|book\s+it|order\s+it|how\s+do\s+i\s+(?:order|proceed|buy)|ready\s+to\s+(?:order|buy|book)|sign\s+me\s+up)\b/i;

// Recommendation signals — user is asking NEX to weigh in with a
// specific pick, opinion, or comparison verdict.
const RECOMMENDATION_RE = /\b(which\s+(?:one|would|is\s+best)|whats?\s+best|whats?\s+your\s+recommendation|would\s+you\s+recommend|what\s+would\s+you\s+choose|what\s+would\s+you\s+(?:do|pick|buy)|if\s+it\s+(?:was|were)\s+your|help\s+me\s+decide|any\s+advice|your\s+thoughts|your\s+opinion|honest\s+opinion)\b/i;

// Opening signals — greeting or first-turn language. Note that pure
// greetings short-circuit before reaching the composer; this catches
// mixed openers ("morning nex, I need…") on the composer path.
const OPENING_RE = /^\s*(good\s+(?:morning|afternoon|evening|day)|mornin|morning|afternoon|evening|hi\b|hello|hey|alright(?:\s+mate)?|first\s+time|i(?:m|'m)\s+new)/i;

export function classifyStage(text: string): Stage {
  const t = (text ?? "").trim();
  if (!t) return "discovery";
  if (CLOSING_RE.test(t))         return "closing";
  if (OBJECTION_RE.test(t))       return "objection";
  if (DECISION_RE.test(t))        return "decision";
  if (RECOMMENDATION_RE.test(t))  return "recommendation";
  if (OPENING_RE.test(t))         return "opening";
  return "discovery";
}
