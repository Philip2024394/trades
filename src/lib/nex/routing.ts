// NEX AI · request-to-model-role routing.
//
// Extracted from src/app/api/nex/converse/stream/route.ts so the
// NEX AI Guardian regression suite can assert routing decisions
// without duplicating the heuristic. Any change here is
// automatically caught by the Guardian's routing.json cases.
//
// Semantics (2026-08-30):
//   - Image attached           → vision.primary_local
//   - Message hits a HARD_HINT → brain.primary_local (7B)
//   - Message length > 260     → brain.primary_local (7B)
//   - Otherwise                → brain.fast_local (3B)
//
// HARD_HINTS + length threshold mirror the pre-existing Anthropic
// `pickModel` split — the local fleet uses the same axis so both
// providers behave symmetrically.

import type { NexModelRole } from "./brain/model-registry";

export const HARD_HINTS = [
  "should i", "why did", "analyse", "analyze", "compare",
  "strategy", "recommend", "explain why", "break down",
  "how am i doing", "growth", "trend",
] as const;

export const LONG_MESSAGE_CHARS = 260;

export type RoutingInput = {
  /** User's raw message. Trimmed but otherwise unchanged. */
  message: string;
  /** True when the request has an image attachment. Forces vision role. */
  hasImage: boolean;
};

export type RoutingDecision = {
  role: NexModelRole;
  /** Machine-readable reason for the pick · surfaces in DB
   *  context_snapshot and Guardian regression reports. Values:
   *   - `image_attached`
   *   - `hard_hint:<phrase>`
   *   - `length_gt_260`
   *   - `default_fast`
   */
  reason: string;
};

export function pickRole(input: RoutingInput): RoutingDecision {
  if (input.hasImage) return { role: "vision.primary_local", reason: "image_attached" };

  const q = input.message.toLowerCase();
  const hit = HARD_HINTS.find((h) => q.includes(h));
  if (hit) return { role: "brain.primary_local", reason: `hard_hint:${hit}` };

  if (input.message.length > LONG_MESSAGE_CHARS) {
    return { role: "brain.primary_local", reason: "length_gt_260" };
  }

  return { role: "brain.fast_local", reason: "default_fast" };
}
