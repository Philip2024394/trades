// src/lib/nex/live-chat-completion/question-factory/fingerprint.ts
//
// Founder BEGIN Phase 2 · deterministic question fingerprint.
//
// SHA-256 hex over (domain · entity_ref · intent_slug · normalised_text ·
// language). Same fingerprint = same variant = UPSERT collision = zero
// duplicate rows in nex.question_variant.

import { createHash } from "node:crypto";

/**
 * Normalise a raw question for fingerprint stability + lookup:
 *   - lower case
 *   - collapse whitespace
 *   - strip trailing "?" and "!" and "."
 *   - strip surrounding whitespace
 * The composer does the exact same normalisation before hot lookup, so
 * fingerprints line up whether the question came from the generator OR
 * from a live user turn.
 */
export function normaliseQuestion(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[!.?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeFingerprint(input: {
  domain: string;
  entity_ref: string;
  intent_slug: string;
  normalised_text: string;
  language: "en" | "id";
}): string {
  const h = createHash("sha256");
  h.update(input.domain);
  h.update("|");
  h.update(input.entity_ref);
  h.update("|");
  h.update(input.intent_slug);
  h.update("|");
  h.update(input.normalised_text);
  h.update("|");
  h.update(input.language);
  return h.digest("hex");
}
