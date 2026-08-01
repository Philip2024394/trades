// Staircase Advisor · Negative Feedback detection (Philip 2026-08-01)
//
// When a customer says "you are stupid" · "no that's not what I asked" ·
// "useless" · etc., that is FEEDBACK about the previous answer, not a new
// staircase question. Nex must:
//   1. Acknowledge the frustration without arguing
//   2. State what went wrong (referring to the previous topic)
//   3. Offer to recover the previous task
//
// Never re-route into the mandatory project_type gate or restart the
// conversation flow. That's the specific failure mode Philip flagged as P0.

import "server-only";

// Philip 2026-08-01 · Contracted AND expanded forms so "that is wrong" fires the
// same as "that's wrong" · "this is not what I asked" fires the same as "this isn't
// what I asked" · etc. Regression sweep found the contraction gap.
const NEG_FEEDBACK_PATTERNS: RegExp[] = [
  // Direct insults · negative characterisations · contracted OR expanded
  /\b(you'?re|you\s+are|nex\s+is)\s+(stupid|useless|dumb|wrong|hopeless|broken|thick|rubbish)\b/i,
  /\b(you'?re|you\s+are)\s+(not\s+)?(getting\s+it|understanding|listening)\b/i,
  // "that's / that is wrong / not what I asked"
  /\b(that'?s|that\s+is)\s+(wrong|useless|not\s+what|not\s+right|not\s+it|not\s+helpful|not\s+the\s+answer|off)\b/i,
  /\bthis\s+(isn'?t|is\s+not)\s+what\s+i\s+asked\b/i,
  /\bi\s+asked\s+(for|about)\b/i,
  /\b(that'?s|that\s+is)\s+not\s+what\s+i\s+(asked|meant|wanted)\b/i,
  // Frustration markers
  /\b(wtf|for\s+f['*]{0,2}s\s+sake|come\s+on|seriously|really\?)\b/i,
  /\b(rubbish|nonsense|garbage|utter\s+nonsense)\b/i,
  // Standalone rejection
  /^(no|nope|not\s+really|don'?t\s+understand|do\s+not\s+understand|no\s+that'?s\s+wrong)\.?!?$/i,
  /^(useless|hopeless|broken|stupid)\.?!?$/i,
];

export function isNegativeFeedback(message: string): boolean {
  const trimmed = message.trim();
  return NEG_FEEDBACK_PATTERNS.some((p) => p.test(trimmed));
}

/** Build a Nex-voice acknowledgment that owns the problem and offers to
 *  recover the previous topic. Reads state.last_user_query if present so
 *  the response references what the customer was actually working on. */
export function buildFeedbackResponse(lastUserQuery: string | undefined): string {
  const trimmed = lastUserQuery?.trim() ?? "";
  if (trimmed.length > 0 && trimmed.length < 200) {
    return `You're right to push back — that response wasn't what you asked for. You were looking for information about "${trimmed}". Let me try again properly. What specifically would you like me to focus on — a description of the design, examples of how it's built, or something else?`;
  }
  return "You're right to push back — I understand the last response didn't land well. Could you tell me again exactly what you're trying to find out, and I'll focus on that specifically?";
}
