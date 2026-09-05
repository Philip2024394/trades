// src/lib/nex/brain/refinement-voice.ts
//
// Stage 3.41.o · Refinement Voice · natural-language acknowledgement
// (Philip 2026-09-01).
//
// CONSTITUTIONAL CONTRACT (Philip's exact framing):
//
//   "Renderer must consume the existing structured refinement result
//    and produce natural Indonesian/Indonesian-English acknowledgement
//    without re-parsing the raw message."
//
// This module NEVER touches the raw user message. It NEVER touches
// abandonment / reference / entity detection. It is a pure function
// of RefinementDetection → natural acknowledgement.
//
// Philip's canonical examples:
//   detectRefinement("Yang lebih murah")              → "Oke, aku cari yang lebih murah."
//   detectRefinement("Gak usah pake paylater, cash aja") → "Siap, cash aja."
//   detectRefinement("yang direct flight")            → "Siap, aku fokus ke direct flight."

import type { RefinementDetection, RefinementFamily } from "./refinement-detector";

export type RefinementVoiceLanguage = "id" | "en";

export type RefinementVoiceOptions = {
  /** Force output language. Defaults to `id` (Indonesian NEX default). */
  language?: RefinementVoiceLanguage;
};

export type RefinementVoice = {
  reply:    string;
  intent:   "refinement_ack";
  family:   RefinementFamily;
  language: RefinementVoiceLanguage;
  /** The matched phrase from the detector — surfaced for observability. */
  phrase:   string;
};

// ─── Tail extractors ───────────────────────────────────────────────
//
// Each family's phrase has a predictable shape (per the detector's
// regex). These extractors pull out the semantic core so the
// acknowledgement sounds natural in Indonesian.
//
// Guarded: extractors NEVER re-parse the raw user message. They
// operate ONLY on the matched phrase.

function extractExcludeTail(phrase: string): string {
  // "jangan yang X" or "jangan pake X" (possibly followed by ", Y aja")
  const stripped = phrase.replace(/^\s*jangan\s+(yang|pake)\s+/i, "");
  const beforeComma = stripped.split(",")[0].trim();
  return beforeComma.toLowerCase() || phrase.toLowerCase();
}

function extractRequireTail(phrase: string): string {
  // "yang X (aja)?" or "the X (one)?"
  return phrase
    .replace(/^\s*(yang|the)\s+/i, "")
    .replace(/\s+aja\s*$/i, "")
    .replace(/\s+one\s*$/i, "")
    .trim()
    .toLowerCase() || phrase.toLowerCase();
}

function extractComparativeTail(phrase: string): string {
  // Comparative phrases already read naturally ("yang lebih murah") —
  // just normalize case.
  return phrase.trim().toLowerCase() || phrase.toLowerCase();
}

function extractSkipTail(phrase: string): string {
  // "yang X below/above N skip" — strip trailing "skip/lewat/lewatin"
  return phrase
    .replace(/\s+(skip|lewat|lewatin)\s*$/i, "")
    .trim()
    .toLowerCase() || phrase.toLowerCase();
}

function extractSwapPreferred(phrase: string): string {
  // "gak usah pake X, Y aja" — pull Y (the preferred alternative).
  const m = phrase.match(/,\s*(.+?)\s+aja\b/i);
  return (m ? m[1] : phrase).trim().toLowerCase();
}

// ─── ID templates (default · Indonesian NEX) ────────────────────────
const ID_TEMPLATES: Record<RefinementFamily, (phrase: string) => string> = {
  exclude:           (p) => `Siap, aku hindari ${extractExcludeTail(p)}.`,
  require:           (p) => `Siap, aku fokus ke ${extractRequireTail(p)}.`,
  comparative:       (p) => `Oke, aku cari ${extractComparativeTail(p)}.`,
  skip_by_attribute: (p) => `Sip, aku skip ${extractSkipTail(p)}.`,
  swap:              (p) => `Siap, ${extractSwapPreferred(p)} aja.`,
};

// ─── EN templates ──────────────────────────────────────────────────
const EN_TEMPLATES: Record<RefinementFamily, (phrase: string) => string> = {
  exclude:           (p) => `Got it, I'll avoid ${extractExcludeTail(p)}.`,
  require:           (p) => `Got it, I'll focus on ${extractRequireTail(p)}.`,
  comparative:       (p) => `Okay, looking for ${extractComparativeTail(p)}.`,
  skip_by_attribute: (p) => `Got it, skipping ${extractSkipTail(p)}.`,
  swap:              (p) => `Got it, ${extractSwapPreferred(p)} it is.`,
};

/**
 * Render a natural-language acknowledgement of a refinement.
 *
 * Returns `null` when the detection did not match — refinement voice
 * is a pure consumer of refinement classifications and NEVER speaks
 * on non-refinement input.
 *
 * Default language is Indonesian (`id`). Pass `{ language: "en" }` to
 * force English output. The detector's own `language` field is
 * consulted only when it is unambiguously `en` (bare comparative
 * "cheaper" / "nearer" · bare `the X one` require).
 */
export function renderRefinementVoice(
  detection: RefinementDetection,
  options: RefinementVoiceOptions = {},
): RefinementVoice | null {
  if (!detection.matched) return null;

  const lang: RefinementVoiceLanguage =
    options.language
    ?? (detection.language === "en" ? "en" : "id");

  const templates = lang === "en" ? EN_TEMPLATES : ID_TEMPLATES;
  const reply = templates[detection.family](detection.phrase);

  return {
    reply,
    intent:   "refinement_ack",
    family:   detection.family,
    language: lang,
    phrase:   detection.phrase,
  };
}
