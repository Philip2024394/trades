// Staircase Advisor · Short follow-up detection + topic memory (Philip 2026-08-01)
//
// A staircase consultant conversation naturally has short follow-ups:
//
//   User: "have you information on under-stair storage?"
//   Nex:  <full answer about under-stair storage>
//   User: "ok show me"       ← INHERITS "under-stair storage"
//   User: "examples please"  ← INHERITS "under-stair storage"
//   User: "images"           ← INHERITS "under-stair storage"
//
// Without topic memory, the second turn's short reply gets treated as a fresh
// staircase question and Nex either resets to the mandatory project_type
// flow or returns unrelated content. This module lets the Advisor detect
// short follow-ups and enrich the query with the previous topic.

import "server-only";

// Short follow-up patterns · these are answers/requests that inherit the
// previous topic rather than start a new one. Bounded (short word count)
// so full-sentence questions never accidentally trigger.
const FOLLOW_UP_PATTERNS: RegExp[] = [
  // Affirmative continuations
  /^(ok(ay)?|yes|yeah|yep|sure|please|thanks?|great|good|nice|perfect)[\s.,!?]*$/i,
  // Visual-request shortcuts (very common per Philip's transcripts)
  /^(show|show\s+me|display|render|render\s+me|see|let['s]{0,2}\s+see|give\s+me|can\s+i\s+see)(\s+(it|them|those|these|examples|pictures|images|photos|some|a\s+few|more))?[\s.,!?]*$/i,
  /^(images?|pictures?|photos?|examples?|examples\s+please|photos\s+please|images\s+please|show\s+images?)[\s.,!?]*$/i,
  /^(any\s+)?(images?|pictures?|photos?|examples?|more)[\s.,!?]*$/i,
  // Continuation cues
  /^(go\s+on|continue|more|any\s+more|another|another\s+one|next|and)[\s.,!?]*$/i,
  // Referring to prior item
  /^(that\s+one|this\s+one|the\s+first|the\s+second|the\s+last|the\s+one\s+you\s+mentioned)[\s.,!?]*$/i,
  // Combined "ok show me the X"
  /^(ok|okay|please|now)\s+show\s+me\s+(the\s+)?(image|images|pictures?|example|examples|photos?)[\s.,!?]*$/i,
  // Combined "ok show me" / "please show me" / "now show me" (no explicit object · inherits topic)
  /^(ok(ay)?|please|now|then|so)\s+(show|display|see|give|tell)\s*(me)?(\s+(it|them|those|these|examples|pictures|images|photos|some|a\s+few|more))?[\s.,!?]*$/i,
  // "yes please" / "yeah go on" / "ok great" · affirmative combos
  /^(yes|yeah|yep|ok(ay)?|sure)\s+(please|thanks?|go\s+on|continue|more|great|good)[\s.,!?]*$/i,
];

// Philip 2026-08-01 · CONTINUE_PREVIOUS_TASK operator vocabulary.
// Very short utterances (≤3 words) that read as continuation cues rather than
// standalone staircase questions. The caller applies this ONLY when a topic
// exists in state (state.last_user_query set) · never on a fresh conversation.
const CONTINUATION_OPERATOR_WORDS = new Set([
  "show", "showme",
  "yes", "yeah", "yep", "sure",
  "ok", "okay",
  "please",
  "images", "image", "pictures", "picture", "photos", "photo",
  "examples", "example",
  "that", "those", "these",
  "another", "next", "more",
  "continue", "go", "carry", "keep",
  "one",
]);

/** Continuation operator · a very short utterance (≤3 words) whose tokens are
 *  all continuation words. Caller must confirm state.last_user_query exists
 *  before treating this as a follow-up. */
export function isContinuationOperator(message: string): boolean {
  const trimmed = message.trim().toLowerCase().replace(/[.,!?]+$/g, "");
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  // Every word must be a continuation-operator word (or a small stopword)
  const STOPS = new Set(["me", "them", "those", "these", "a", "the", "it"]);
  return words.every((w) => CONTINUATION_OPERATOR_WORDS.has(w) || STOPS.has(w));
}

export function isShortFollowUp(message: string): boolean {
  const trimmed = message.trim();
  // Cap at 8 words · genuine questions almost always exceed this
  if (trimmed.split(/\s+/).length > 8) return false;
  if (FOLLOW_UP_PATTERNS.some((p) => p.test(trimmed))) return true;
  // Philip 2026-08-01 · CONTINUE_PREVIOUS_TASK · catches "show", "yes", "ok",
  // "that one", "those", "another", "next", "more" · any ≤3-word utterance
  // built entirely from continuation operators.
  return isContinuationOperator(message);
}

// Sub-classification: is the follow-up specifically an IMAGE request?
const IMAGE_FOLLOW_UP_PATTERNS: RegExp[] = [
  /\b(images?|pictures?|photos?|photograph|photographs|examples?\s+of\s+image|see\s+examples?|show\s+me|display|see\s+it)\b/i,
];
export function isImageFollowUp(message: string): boolean {
  if (!isShortFollowUp(message)) return false;
  return IMAGE_FOLLOW_UP_PATTERNS.some((p) => p.test(message));
}

/** Enrich a short follow-up with the previous user query so downstream
 *  retrieval (knowledge composer + Visual Brain) sees the full topic
 *  context. Returns the enriched string, or the original message if no
 *  previous topic is stored.
 *
 *  Example:
 *    message      = "ok show me"
 *    last_query   = "have you information on under-stair storage?"
 *    → enriched   = "ok show me · in the context of: have you information on under-stair storage?"
 */
export function enrichWithLastTopic(
  message: string,
  lastUserQuery: string | undefined,
): string {
  const trimmed = (lastUserQuery ?? "").trim();
  if (trimmed.length === 0 || trimmed.length > 400) return message;
  return `${message} · in the context of: ${trimmed}`;
}
