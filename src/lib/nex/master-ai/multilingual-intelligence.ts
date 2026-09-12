// src/lib/nex/master-ai/multilingual-intelligence.ts
//
// NEX Master AI · Multilingual Intelligence (F-Wave §16)
// Philip 2026-09-07 · AUTHORIZE
//
// The architecture must NOT assume English-only intelligence.
// Master AI must handle English + Indonesian + Japanese as first-class
// intelligence languages where relevant.
//
// PRESERVATION:
//   · Never treat translation as REPLACEMENT of the original evidence
//   · Original text + language always retained · translation is additive
//   · Translation provenance mandatory (who / when / method / confidence)
//   · UNKNOWN language is a valid record · never guess

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { multilingualTranslationsPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// First-class languages
// ═════════════════════════════════════════════════════════════════════

export type FirstClassLanguage = "en" | "id" | "ja" | "unknown";

export const FIRST_CLASS_LANGUAGES: readonly FirstClassLanguage[] = Object.freeze(["en", "id", "ja", "unknown"] as const);

export function isFirstClassLanguage(x: string): x is FirstClassLanguage {
  return (FIRST_CLASS_LANGUAGES as readonly string[]).includes(x);
}

// ═════════════════════════════════════════════════════════════════════
// Translation record
// ═════════════════════════════════════════════════════════════════════

export type TranslationMethod =
  | "HUMAN"                                        // human translator
  | "AI_MODEL"                                     // machine translation
  | "AUTO_DETECT_ONLY"                             // no translation, just detection
  | "PROVIDED_BY_SOURCE";                          // source itself provided both

export type TranslationRecord = {
  translation_id: string;
  recorded_at_iso: string;
  original_text: string;                           // MANDATORY · never lost
  original_language: FirstClassLanguage;           // MANDATORY · unknown allowed
  translated_text: string | null;                  // null when only detection
  target_language: FirstClassLanguage | null;      // null when only detection
  method: TranslationMethod;
  method_ref: string;                              // model name · translator id · "n/a"
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  provenance_note: string;                         // required ≥ 5 chars
  evidence_ref: string | null;                     // ledger reference
};

export class InvalidTranslationError extends Error {
  constructor(reason: string) { super(`invalid_translation:${reason}`); }
}

export function recordTranslation(input: Omit<TranslationRecord, "translation_id" | "recorded_at_iso">): TranslationRecord {
  if (!input.original_text || input.original_text.length === 0) throw new InvalidTranslationError("original_text_required");
  if (!isFirstClassLanguage(input.original_language)) throw new InvalidTranslationError(`original_language_not_first_class:${input.original_language}`);
  if (input.target_language && !isFirstClassLanguage(input.target_language)) throw new InvalidTranslationError(`target_language_not_first_class:${input.target_language}`);
  if (input.translated_text !== null && input.target_language === null) throw new InvalidTranslationError("translated_text_requires_target_language");
  if (input.translated_text === null && input.method !== "AUTO_DETECT_ONLY") throw new InvalidTranslationError("null_translated_text_requires_AUTO_DETECT_ONLY_method");
  if (!input.provenance_note || input.provenance_note.trim().length < 5) throw new InvalidTranslationError("provenance_note_too_short");
  const rec: TranslationRecord = {
    ...input,
    translation_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(multilingualTranslationsPath(), rec);
  return rec;
}

export function readAllTranslations(): TranslationRecord[] {
  return readJsonlAll<TranslationRecord>(multilingualTranslationsPath());
}

/** Simple heuristic language detection for the three first-class
 *  languages. Deterministic · never claims HIGH confidence · returns
 *  UNKNOWN when uncertain. Real intelligence should use a proper model
 *  when higher confidence needed. */
export function detectLanguage(text: string): { language: FirstClassLanguage; confidence: TranslationRecord["confidence"] } {
  if (!text || text.length < 3) return { language: "unknown", confidence: "UNKNOWN" };
  const lower = text.toLowerCase();
  // Japanese: presence of hiragana (U+3040-309F), katakana (U+30A0-30FF), or CJK Unified Ideographs (U+4E00-9FFF)
  if (/[぀-ゟ゠-ヿ一-鿿]/.test(text)) {
    return { language: "ja", confidence: "MEDIUM" };
  }
  // Indonesian: presence of common Bahasa words unlikely in English
  const bahasaMarkers = /\b(dan|yang|dari|untuk|dengan|adalah|akan|tidak|ini|itu|pada|dalam|atau|bahwa|penyelenggara|peraturan|nomor|tahun|jaringan|jasa)\b/i;
  if (bahasaMarkers.test(lower)) {
    return { language: "id", confidence: "MEDIUM" };
  }
  // English: default fallback for latin-script text
  const englishMarkers = /\b(the|and|of|to|is|in|that|for|with|on|as|by|this|but|not|are|from|which|will|be|have)\b/i;
  if (englishMarkers.test(lower)) {
    return { language: "en", confidence: "MEDIUM" };
  }
  return { language: "unknown", confidence: "UNKNOWN" };
}

/** Group translations by original_language to summarise language coverage. */
export function summariseLanguageCoverage(): Record<FirstClassLanguage, number> {
  const out: Record<FirstClassLanguage, number> = { en: 0, id: 0, ja: 0, unknown: 0 };
  for (const t of readAllTranslations()) out[t.original_language]++;
  return out;
}

export function _resetMultilingualForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(multilingualTranslationsPath())) fs.unlinkSync(multilingualTranslationsPath()); } catch { /* ignore */ }
}
