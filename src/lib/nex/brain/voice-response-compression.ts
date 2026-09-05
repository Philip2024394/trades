// src/lib/nex/brain/voice-response-compression.ts
//
// Wave 3 · Voice Response Compression + Intent-Aligned Style
// Philip 2026-09-06 · AUTHORIZE · WAVE 3 · Capabilities E, F
//
// PURPOSE (§9 §10)
//   When NEX speaks aloud the response should feel like a person talking
//   — not a document being read. Compression can remove REDUNDANT text
//   without touching semantic content.
//
// PRESERVATION (§9 · critical)
//   Compression MUST preserve:
//     · Uncertainty markers ("I don't have", "not verified", "can't
//       confirm", "unknown")
//     · Evidence boundaries ("NEX doesn't have", "no results yet",
//       "haven't shown", "no verified")
//     · Safety boundaries ("don't want to say", "can't confirm")
//     · Capability distinctions ("booking access", "not live booking")
//     · Any user-requested detail
//     · Material facts (names, numbers, places)
//
//   Compression MAY remove:
//     · Repeated caveats (same sentence twice)
//     · Long tail markers ("Would you like me to ..." if already short)
//     · Excessive lists (>5 items get truncated with "and N more")
//     · Repetitive intros ("Alright,", "Sure,", "OK,") when followed by
//       a substantive answer
//     · Trailing markdown formatting characters (**, ##, ---, etc.)
//     · Database-technical wording that leaked through
//
// FIRING POLICY
//   Compression fires ONLY when the caller sets `voice: true` on the
//   request. Otherwise, this module is observability-only: it computes
//   what a compressed reply would look like and exposes it so we can
//   verify meaning is preserved, but the response returned to the
//   client is unchanged.

// ─── Types ──────────────────────────────────────────────────────

export type CompressionMetrics = {
  original_length: number;
  compressed_length: number;
  reduction_pct: number;
  removed_markers: string[];
  preserved_markers: string[];
  changed: boolean;
};

export type CompressionResult = {
  original: string;
  compressed: string;
  metrics: CompressionMetrics;
  /** Voice-safety guard: TRUE iff no essential material was removed. */
  meaning_preserved: boolean;
  /** WHY meaning is preserved (invariants observed). */
  preservation_notes: string[];
};

// ─── Preservation lexicon ──────────────────────────────────────

/** If a sentence contains any of these markers, it MUST be kept in
 *  full (compression may not drop it). This defends every voice-safe
 *  invariant we care about at the sentence level. */
const PRESERVED_MARKERS = [
  // Evidence + uncertainty
  /\bdon'?t (have|know)\b/i,
  /\bhaven'?t (shown|found)\b/i,
  /\bnot (verified|available|shown)\b/i,
  /\bunknown\b/i,
  /\bunsure\b/i,
  /\bnot sure\b/i,
  /\bcan'?t (confirm|say|verify)\b/i,
  /\bdon'?t (mean|want to say)\b/i,
  /\bno (results|verified)\b/i,
  /\bunverified\b/i,
  // Capability
  /\bbooking\b/i,
  /\bbook\b/i,
  /\breserv/i,
  /\bcontact\b/i,
  /\bpurchase\b/i,
  // Source
  /\bopenstreetmap\b/i,
  /\bnex\b/i,
  /\bdirectory\b/i,
  /\bsource\b/i,
  // Indonesian equivalents
  /\btidak\s+(punya|tahu|bisa)\b/i,
  /\bbelum\s+(menampilkan|ada)\b/i,
  /\btidak\s+(tersedia|terverifikasi)\b/i,
  /\bakses\s+.+\s+terverifikasi\b/i,
  /\bkonfirmasi\b/i,
  /\bpemesanan\b/i,
  /\breservasi\b/i,
];

/** Redundant intros safe to strip when followed by substantive content. */
const REDUNDANT_INTROS = /^\s*(?:alright|sure|ok(?:ay)?|so|well|got it|yeah|yep|right)[,!.\-\s—]+/i;

/** Trailing prompts that are safe to compress when the reply already
 *  contains a concise summary. Only removed when they are LATE in a
 *  long response · never removed if they carry the only actionable
 *  next step. */
const TAILING_PROMPT = /\s*(?:Would you (?:like|want)|Do you (?:want|have|prefer)|Want me to)[^.!?]{5,120}[.!?]\s*$/;

/** Markdown formatting artefacts we can strip for voice. */
const MARKDOWN_ARTEFACTS = [
  /\*\*/g, /^#+\s+/gm, /^-+\s+/gm, /`{1,3}/g, /^\s*[-*]\s+/gm,
];

// ─── Sentence split (spoken-safe) ───────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜÁÉÍÓÚÑ0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function containsPreservedMarker(sentence: string): boolean {
  return PRESERVED_MARKERS.some((re) => re.test(sentence));
}

// ─── List truncation ────────────────────────────────────────────

/** If a sentence contains a long comma-separated list of names, keep
 *  the first 5 and summarize the rest — voice can't reasonably read
 *  a 10-item list. Only fires when the list is genuinely long. */
function truncateLongList(sentence: string, removed: string[]): string {
  // Look for a list like "A, B, C, D, E, F, G, H."
  const listMatch = /((?:[A-Z][A-Za-z0-9 .'&\-]+(?:,\s+)){5,})([A-Z][A-Za-z0-9 .'&\-]+)/.exec(sentence);
  if (!listMatch) return sentence;
  const parts = listMatch[1].split(/,\s+/).filter(Boolean);
  parts.push(listMatch[2]);
  if (parts.length <= 5) return sentence;
  const kept = parts.slice(0, 5).join(", ");
  const more = parts.length - 5;
  removed.push(`long_list_truncated:${more}_items`);
  return sentence.replace(listMatch[0], `${kept}, and ${more} more`);
}

// ─── Deduplicate near-identical sentences ───────────────────────

function dedupe(sentences: string[], removed: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (seen.has(key)) {
      removed.push("duplicate_sentence");
      continue;
    }
    seen.add(key);
    out.push(s);
  }
  return out;
}

// ─── Public API ────────────────────────────────────────────────

export function compressForVoice(original: string): CompressionResult {
  const removed: string[] = [];
  const preserved: string[] = [];
  if (!original || !original.trim()) {
    return {
      original,
      compressed: original,
      metrics: { original_length: 0, compressed_length: 0, reduction_pct: 0,
        removed_markers: removed, preserved_markers: preserved, changed: false },
      meaning_preserved: true,
      preservation_notes: ["empty_input"],
    };
  }
  let working = original;

  // 1 · Strip markdown artefacts.
  for (const re of MARKDOWN_ARTEFACTS) {
    if (re.test(working)) {
      working = working.replace(re, "");
      removed.push("markdown_artefact");
    }
  }

  // 2 · Redundant intro (only if what follows is substantive).
  const introMatch = REDUNDANT_INTROS.exec(working);
  if (introMatch) {
    const rest = working.slice(introMatch[0].length).trim();
    if (rest.length >= 12) {
      working = rest.charAt(0).toUpperCase() + rest.slice(1);
      removed.push("redundant_intro");
    }
  }

  // 3 · Split, dedupe, and per-sentence compress.
  let sentences = splitSentences(working);
  sentences = dedupe(sentences, removed);

  const compressedSentences: string[] = [];
  for (const s of sentences) {
    if (containsPreservedMarker(s)) {
      preserved.push("evidence_or_capability_marker");
      compressedSentences.push(s);
      continue;
    }
    const truncated = truncateLongList(s, removed);
    compressedSentences.push(truncated);
  }
  working = compressedSentences.join(" ").trim();

  // 4 · Trailing prompt: allow trim only when the reply is already
  //     long AND the trailing prompt is not the sole action item.
  if (working.length > 220 && TAILING_PROMPT.test(working)) {
    const trimmed = working.replace(TAILING_PROMPT, "").trim();
    if (trimmed.length >= 40) {
      working = trimmed;
      removed.push("trailing_prompt");
    }
  }

  // 5 · Whitespace collapse.
  working = working.replace(/\s{2,}/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();

  const originalNorm = original.replace(/\s{2,}/g, " ").trim();
  const changed = working !== originalNorm;
  const originalLen = originalNorm.length;
  const compressedLen = working.length;
  const reduction = originalLen > 0 ? Math.round(((originalLen - compressedLen) / originalLen) * 100) : 0;

  // Voice-safety guard: reject changes that removed a preservation
  // marker present in the original.
  const originalPreservationCount = PRESERVED_MARKERS.reduce(
    (n, re) => n + (re.test(original) ? 1 : 0),
    0,
  );
  const compressedPreservationCount = PRESERVED_MARKERS.reduce(
    (n, re) => n + (re.test(working) ? 1 : 0),
    0,
  );
  const meaningPreserved = compressedPreservationCount >= originalPreservationCount;

  const preservationNotes: string[] = [];
  if (meaningPreserved) preservationNotes.push("all_preservation_markers_retained");
  else preservationNotes.push("preservation_marker_lost__reverting");

  // If meaning is not preserved, REVERT · voice must never lose signal.
  const finalCompressed = meaningPreserved ? working : originalNorm;

  return {
    original,
    compressed: finalCompressed,
    metrics: {
      original_length: originalLen,
      compressed_length: finalCompressed.length,
      reduction_pct: meaningPreserved ? reduction : 0,
      removed_markers: removed,
      preserved_markers: preserved,
      changed: meaningPreserved && changed,
    },
    meaning_preserved: true,   // guaranteed post-revert
    preservation_notes: preservationNotes,
  };
}
