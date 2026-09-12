// src/lib/nex/unconfirmed-labeler/index.ts
//
// Founder Doctrine #6 · Truth or Unconfirmed · last-mile label enforcer.
// ADR-0122 · 2026-09-10.
//
// Wraps unverified claims in a NEX response with an "Unconfirmed:" prefix
// (or language variant). Runs at the very end of the response composer so
// the user sees the label at the head of any affected sentence.
//
// Rule:
//   · A reply is labeled if the underlying claim did NOT trace to a
//     verified evidence item (trust_layer in canonical_* set).
//   · The labeler adds the prefix only to sentences that contain a claim
//     · not to greetings, clarifying questions, or navigation copy.
//   · Language variant honored via user preferences (Phase 19).

import type { LanguageCode } from "@/lib/nex/personalization/language-packs";

const _PREFIX_BY_LANG: Record<LanguageCode, string> = {
  en: "Unconfirmed:",
  id: "Belum diverifikasi:",
  fr: "Non vérifié:",
  es: "Sin verificar:",
  de: "Unbestätigt:",
  ja: "未確認:",
  zh: "未经证实:",
  pt: "Não verificado:",
  it: "Non verificato:",
  ar: "غير مؤكد:",
};

export function prefixForLanguage(code: string | null | undefined): string {
  if (!code) return _PREFIX_BY_LANG.en;
  const base = code.toLowerCase().split(/[-_]/)[0] as LanguageCode;
  return _PREFIX_BY_LANG[base] ?? _PREFIX_BY_LANG.en;
}

// ═══════════════════════════════════════════════════════════════════
// Categories of content that DEFAULT to unconfirmed unless verified.
// If any keyword matches, the sentence is treated as an unverified
// claim and receives the prefix.
// ═══════════════════════════════════════════════════════════════════

const _UNVERIFIED_HINTS = [
  // Storytelling / folklore
  /\blegend(s|ary)?\b/i, /\bfolklore\b/i, /\bmyth(s|ology|ical)?\b/i,
  /\bfable(s)?\b/i, /\btale(s)?\b/i, /\bstory says\b/i,
  // Spiritual / religious claims
  /\b(soul|spirit|reincarnation|karma|afterlife|nirvana|heaven|hell|deity|deities|god(s|dess)?)\b/i,
  /\b(revelation|prophecy|prophet|scripture|sacred text)\b/i,
  // Historical uncertainty markers
  /\b(rumou?red|allegedly|reportedly|it is said|it is believed|traditionally held|according to legend)\b/i,
  /\b(some say|others claim|folk tradition|oral history|unverified)\b/i,
  // Speculation
  /\b(might have|may have|could have|would have|possibly|perhaps|supposedly)\s+been\b/i,
  /\b(some (people|scholars|historians|believers))\s+(believe|claim|say|argue|hold)\b/i,
];

const _CERTAINTY_HINTS = [
  /\bbased on what we have on record\b/i,
  /\baccording to verified\b/i,
  /\bconfirmed by\b/i,
  /\bdocumented in\b/i,
  /\bofficial source\b/i,
  /\bpublicly recorded\b/i,
];

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export interface LabelResult {
  labeled_text: string;
  unconfirmed_claim_count: number;
  prefix_used: string;
  reason_hints: string[];      // which categories triggered
}

export interface LabelInput {
  text: string;
  has_verified_evidence: boolean;      // does the reply trace to verified evidence?
  language?: string | null;
}

function isLikelyUnverified(sentence: string): { hit: boolean; reason: string | null } {
  for (const re of _UNVERIFIED_HINTS) {
    if (re.test(sentence)) return { hit: true, reason: re.source };
  }
  return { hit: false, reason: null };
}

function isLikelyVerifiedNarration(sentence: string): boolean {
  for (const re of _CERTAINTY_HINTS) if (re.test(sentence)) return true;
  return false;
}

function splitSentences(text: string): string[] {
  // Simple sentence splitter · preserves the trailing punctuation.
  const out: string[] = [];
  const re = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0];
    if (s.trim().length > 0) out.push(s);
  }
  return out;
}

/**
 * Applies Doctrine #6 to a rendered reply.
 *
 * If `has_verified_evidence=false`, EVERY sentence that reads like a
 * factual claim is prefixed. Greetings + clarifying questions are left
 * alone.
 *
 * If `has_verified_evidence=true`, only sentences that match unverified
 * hints (legend, spiritual, rumor, speculation) are prefixed — because
 * a verified reply may still narrate a legend within a broader context.
 */
export function applyDoctrine6(input: LabelInput): LabelResult {
  const prefix = prefixForLanguage(input.language);
  const sentences = splitSentences(input.text);
  const reasons = new Set<string>();
  let count = 0;

  const rebuilt = sentences.map((raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return raw;
    // Skip greetings, clarifying questions, empty small-talk.
    if (/^\s*(hi|hello|hey|halo|salut|hola|hallo|olá|ciao|مرحبا|你好|こんにちは)[!.,]?\s*/i.test(trimmed)) return raw;
    if (/\?\s*$/.test(trimmed) && !/^\s*(Yes|No)\b/i.test(trimmed)) return raw;   // pure questions
    if (isLikelyVerifiedNarration(trimmed) && input.has_verified_evidence) return raw;

    const { hit, reason } = isLikelyUnverified(trimmed);
    // If we have no verified evidence AT ALL for this reply, every substantive
    // sentence receives the prefix. If we do have verified evidence, only
    // sentences that match unverified hints receive it.
    const needsPrefix = hit || (!input.has_verified_evidence && trimmed.length > 12);
    if (!needsPrefix) return raw;

    // Already prefixed? (idempotence)
    if (trimmed.startsWith(prefix)) return raw;

    if (reason) reasons.add(reason);
    count += 1;
    return raw.replace(/^\s*/, (ws) => `${ws}${prefix} `);
  });

  return {
    labeled_text: rebuilt.join(""),
    unconfirmed_claim_count: count,
    prefix_used: prefix,
    reason_hints: [...reasons],
  };
}

/**
 * Convenience for the composer · returns the doctrine banner note to
 * embed in the response envelope.
 */
export function doctrine6Note(count: number): string {
  if (count === 0) {
    return "Doctrine #6 · Truth or Unconfirmed · reply traces to verified evidence · nothing labeled.";
  }
  return `Doctrine #6 · Truth or Unconfirmed · ${count} unverified claim${count === 1 ? "" : "s"} labeled · NEX never presents legend, spiritual belief, or unverified history as fact.`;
}
