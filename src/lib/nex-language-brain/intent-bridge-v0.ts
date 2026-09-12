// src/lib/nex-language-brain/intent-bridge-v0.ts
//
// NEX1 · LANGUAGE BRAIN · INTENT BRIDGE v0 · deterministic · Path A.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Pipeline:
//   normalise → safety-scan → language-detect → intent-classify → slot-fill →
//   confidence-gate → emit structured intent OR refusal
//
// Independence discipline:
//   · No LLM. No network. Pure regex + registry-driven mapping.
//   · Deterministic: same input · same output.
//   · Refuse rather than guess. Every refusal has a specific class.
//
// Growth path (deferred, but designed-in):
//   · Registry entries are additive. `source: "seed"` are the initial
//     seed patterns · `teacher_added` for teacher-authored expansions ·
//     `corrected` for entries derived from user-correction events.

import type {
  Nex1ClarificationCandidate,
  Nex1IntentBridgeResult,
  Nex1LangTag,
  Nex1LanguageInput,
  Nex1LanguageRegistry,
  Nex1LanguagePattern,
  Nex1SafetyPattern,
} from "./language-types";
import { normaliseSpelling } from "./spelling-normaliser";

const MIN_CONFIDENCE = 0.5;
// If the top two candidate patterns represent DIFFERENT intent kinds and
// their confidences differ by less than this margin, emit a clarification
// request rather than silently picking one.
const AMBIGUITY_MARGIN = 0.05;

export interface Nex1IntentBridgeOptions {
  readonly registry: Nex1LanguageRegistry;
  readonly min_confidence?: number;
  /** If true (default) run the deterministic spelling normaliser before
   *  matching. Setting to false lets a caller test raw utterance behaviour. */
  readonly apply_spelling_normalisation?: boolean;
  /** If true (default) emit a Nex1ClarificationRequest when the top two
   *  candidate matches are within AMBIGUITY_MARGIN AND differ in intent_kind. */
  readonly enable_clarification?: boolean;
}

export function processLanguageInput(
  input: Nex1LanguageInput,
  opts: Nex1IntentBridgeOptions,
): Nex1IntentBridgeResult {
  const utteranceRaw = input.utterance ?? "";
  // Spelling normalisation runs BEFORE trim/lower so the corrections table
  // sees the utterance exactly as authored. Purely deterministic dictionary
  // lookup · no probabilistic correction.
  const normaliseOn = opts.apply_spelling_normalisation !== false;
  const normalised = normaliseOn
    ? normaliseSpelling(utteranceRaw)
    : { original: utteranceRaw, normalised: utteranceRaw, corrections: [] as const };
  const utterance = normalised.normalised.trim();
  const utteranceLower = utterance.toLowerCase();
  const minConfidence = opts.min_confidence ?? MIN_CONFIDENCE;
  const clarifyOn = opts.enable_clarification !== false;

  // Empty input · refuse ambiguous
  if (utterance.length === 0) {
    return {
      ok: false,
      refusal: {
        refusal_class: "refused_ambiguous",
        detected_language: "unknown",
        reason: "empty utterance",
        taught_by: "master_ai_engineer",
      },
    };
  }

  // ── Safety scan · earliest possible refusal ──
  for (const sp of opts.registry.safety_patterns) {
    const re = compile(sp.regex, "i");
    if (re && re.test(utteranceLower)) {
      return {
        ok: false,
        refusal: {
          refusal_class: sp.refusal_class,
          detected_language: detectLanguage(utteranceLower, input.language_hint),
          reason: `${sp.reason} · matched safety pattern '${sp.id}'`,
          taught_by: "master_ai_engineer",
        },
      };
    }
  }

  // ── Language detection ──
  const detected = detectLanguage(utteranceLower, input.language_hint);
  if (detected === "unknown") {
    return {
      ok: false,
      refusal: {
        refusal_class: "refused_unsupported_language",
        detected_language: "unknown",
        reason: "utterance could not be confidently classified as English or Indonesian",
        taught_by: "master_ai_engineer",
      },
    };
  }

  // ── Intent classification via registry ──
  // Try every pattern whose declared language is compatible with detection.
  // Compatible: exact match, or one side is "mixed_en_id".
  const candidates = opts.registry.intent_patterns.filter((p) => languagesCompatible(p.language, detected));
  const matches: Array<{
    pattern: Nex1LanguagePattern;
    match: RegExpMatchArray;
  }> = [];
  for (const pattern of candidates) {
    const re = compile(pattern.regex, "i");
    if (!re) continue;
    const m = utterance.match(re);
    if (m) matches.push({ pattern, match: m });
  }

  if (matches.length === 0) {
    // Handle reference-anaphora utterances without prior context:
    //   · bare pronouns · "the input" · "the output" · "this function" · "this type"
    // These are engineering instructions whose TARGET is a reference · not an
    // unknown intent. Distinguishing this refusal from refused_unknown_intent
    // helps the caller decide whether to ask "which function?" (recoverable)
    // vs "what did you mean?" (not recoverable).
    const referenceRegex = /\b(?:it|that|these|those|the\s+other\s+one|the\s+input|the\s+output|the\s+array|this\s+function|this\s+type|this\s+field|this\s+method)\b/i;
    if (referenceRegex.test(utterance) && (!input.prior_context || input.prior_context.length === 0)) {
      return {
        ok: false,
        refusal: {
          refusal_class: "refused_reference_unresolved",
          detected_language: detected,
          reason: "utterance uses a reference ('it' / 'that' / 'the input' / 'this function' / etc.) but no prior_context was supplied",
          taught_by: "master_ai_engineer",
        },
      };
    }
    return {
      ok: false,
      refusal: {
        refusal_class: "refused_unknown_intent",
        detected_language: detected,
        reason: "no registered pattern matched the utterance",
        taught_by: "master_ai_engineer",
      },
    };
  }

  // Choose the highest-confidence match; break ties by more required slots
  matches.sort((a, b) =>
    b.pattern.confidence - a.pattern.confidence ||
    b.pattern.required_slots.length - a.pattern.required_slots.length,
  );
  const chosen = matches[0];

  // Ambiguity clarification: if the top two matches represent DIFFERENT
  // intent kinds AND their confidences are within AMBIGUITY_MARGIN, emit a
  // clarification instead of silently picking. Prevents "quiet wrong choice"
  // for utterances that genuinely straddle two intents. Same-kind ties are
  // OK · the sort tiebreaker (more slots) is deterministic.
  if (clarifyOn && matches.length >= 2) {
    const [a, b] = matches;
    if (
      a.pattern.intent_kind !== b.pattern.intent_kind &&
      Math.abs(a.pattern.confidence - b.pattern.confidence) < AMBIGUITY_MARGIN
    ) {
      const candidates: Nex1ClarificationCandidate[] = matches.slice(0, 3).map((m) => {
        const slots: Record<string, string> = { ...(m.pattern.slot_defaults ?? {}) };
        const g = m.match.groups ?? {};
        for (const [k, v] of Object.entries(g)) if (v !== undefined) slots[k] = v;
        return {
          matched_pattern_id: m.pattern.id,
          intent_kind: m.pattern.intent_kind,
          confidence: m.pattern.confidence,
          slots: Object.freeze(slots),
          summary: `${m.pattern.intent_kind} · ${m.pattern.example}`,
        };
      });
      return {
        ok: "clarify",
        clarification: {
          detected_language: detected,
          candidates,
          reason: `top ${candidates.length} candidate intents are within ${AMBIGUITY_MARGIN} confidence and differ in kind`,
          taught_by: "master_ai_engineer",
        },
      };
    }
  }

  // Detect contradiction: if we ALSO matched an opposing intent (e.g. add + remove
  // in the same utterance), refuse. For v0 we only have add · fix · acknowledge ·
  // cancel · clarify · so a single-utterance contradiction is: matched both
  // acknowledge AND cancel_previous · or add_field AND cancel_previous.
  const uniqueKinds = new Set(matches.map((m) => m.pattern.intent_kind));
  if (uniqueKinds.has("acknowledge") && uniqueKinds.has("cancel_previous")) {
    return {
      ok: false,
      refusal: {
        refusal_class: "refused_contradictory",
        detected_language: detected,
        reason: "utterance simultaneously acknowledges and cancels · contradictory",
        taught_by: "master_ai_engineer",
      },
    };
  }

  // v0.2.1 remediation · cancel_previous intent with a specific-referent
  // pronoun ('it') AND no prior_context refuses with reference-unresolved.
  // Example: "change it back" · pattern matches cancel_previous but "it"
  // needs an antecedent. Note: 'that' in "scratch that" is discourse-marker
  // idiom for cancel_previous itself · not a specific referent · so 'that'
  // is intentionally EXCLUDED from this check to preserve regression case
  // en.cancel.2. 'ini/itu' remain excluded for the same discourse-reason.
  if (chosen.pattern.intent_kind === "cancel_previous" && (!input.prior_context || input.prior_context.length === 0)) {
    const specificRefPronoun = /\bit\b/i.test(utterance);
    if (specificRefPronoun) {
      return {
        ok: false,
        refusal: {
          refusal_class: "refused_reference_unresolved",
          detected_language: detected,
          reason: `cancel_previous intent contains 'it' referent · no prior_context supplied · refuse rather than silently cancel an unspecified referent`,
          taught_by: "master_ai_engineer",
        },
      };
    }
  }

  // Extract slots
  const slots: Record<string, string> = { ...(chosen.pattern.slot_defaults ?? {}) };
  const groups = chosen.match.groups ?? {};
  for (const [k, v] of Object.entries(groups)) {
    if (v !== undefined) slots[k] = v;
  }

  // Any slot that resolved to a bare pronoun is a reference · refuse if no
  // prior_context. Example: "make this function return a nullable string"
  // technically parses with target_function="this" · but "this" is not an
  // identifier the engineering brain can act on. Indonesian pronouns are
  // included so "Tolong fix function ini" refuses the same way.
  const referencePronouns = new Set(["it", "that", "this", "these", "those", "ini", "itu"]);
  for (const [k, v] of Object.entries(slots)) {
    const bare = (v ?? "").trim().toLowerCase();
    if (referencePronouns.has(bare) && (!input.prior_context || input.prior_context.length === 0)) {
      return {
        ok: false,
        refusal: {
          refusal_class: "refused_reference_unresolved",
          detected_language: detected,
          reason: `slot '${k}' resolved to reference pronoun '${v}' but no prior_context was supplied`,
          recovered_slots: slots,
          taught_by: "master_ai_engineer",
        },
      };
    }
  }

  // Ensure required slots present
  for (const req of chosen.pattern.required_slots) {
    if (!slots[req] || slots[req].trim().length === 0) {
      return {
        ok: false,
        refusal: {
          refusal_class: "refused_underspecified",
          detected_language: detected,
          reason: `matched pattern '${chosen.pattern.id}' but required slot '${req}' is missing`,
          recovered_slots: slots,
          taught_by: "master_ai_engineer",
        },
      };
    }
  }

  // Confidence gate
  if (chosen.pattern.confidence < minConfidence) {
    return {
      ok: false,
      refusal: {
        refusal_class: "refused_low_confidence",
        detected_language: detected,
        reason: `pattern '${chosen.pattern.id}' confidence ${chosen.pattern.confidence} < threshold ${minConfidence}`,
        recovered_slots: slots,
        taught_by: "master_ai_engineer",
      },
    };
  }

  return {
    ok: true,
    intent: {
      kind: chosen.pattern.intent_kind,
      detected_language: detected,
      confidence: chosen.pattern.confidence,
      matched_pattern_id: chosen.pattern.id,
      slots: Object.freeze(slots),
      rationale: `pattern '${chosen.pattern.id}' matched · example: ${chosen.pattern.example}`,
      taught_by: "master_ai_engineer",
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function compile(source: string, flags: string): RegExp | null {
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

function languagesCompatible(patternLang: Nex1LangTag, detected: Nex1LangTag): boolean {
  if (patternLang === detected) return true;
  if (detected === "mixed_en_id" && (patternLang === "en" || patternLang === "id")) return true;
  return false;
}

/**
 * Simple lexical language detector · sufficient for v0.
 * · Counts English content words and Indonesian markers.
 * · Falls back to English if pure ASCII with no Indonesian markers.
 * · If Indonesian markers appear ALONGSIDE English technical vocabulary
 *   (function · api · field · rename · optional · scratch), classify as
 *   mixed_en_id — real Indonesian developer speech mixes English tech terms
 *   without switching sentence structure.
 */
function detectLanguage(lower: string, hint?: Nex1LangTag): Nex1LangTag {
  if (hint && hint !== "unknown") return hint;
  const idMarkers = [
    "tolong", "tambahkan", "perbaiki", "abaikan", "batalkan",
    "bertipe", "kolom", "properti", "angka", "teks",
    "pada", "yang", "gagal", "iya", "ya", "oke", "sip", "siap", "makasih", "lupakan",
    "jangan", "matikan", "pengaman", "pengujian",
    // Common Indonesian conversational fragments in developer speech
    "bikin", "bisa", "cuma", "hanya", "tapi", "ini", "itu", "dihapus", "hapus", "ubah",
    "tunggu", "tadi", "pakai", "jadi",
  ];
  const enMarkers = [
    "the", "add", "please", "field", "property", "type", "number",
    "string", "boolean", "fix", "failing", "ok", "yes", "cancel",
    "undo", "explain", "what", "wait", "actually",
  ];
  // English technical vocabulary that native Indonesian speakers commonly
  // borrow verbatim while keeping Indonesian sentence structure.
  const enTechMarkers = ["function", "api", "field", "rename", "optional", "scratch"];
  // Subset that carries a VERB / adjective (imperative) sense · presence of
  // any of these + an Indonesian marker signals real code-switching. "field"
  // is intentionally excluded — Indonesian sentences borrow it as a noun so
  // often (with `tambahkan field ...`) that it is not a code-switch signal.
  const enTechForcesCodeSwitch = ["function", "api", "rename", "optional", "scratch"];
  const words = lower.split(/[^a-z]+/).filter(Boolean);
  let idScore = 0;
  let enScore = 0;
  let enTechScore = 0;
  let enTechForcing = 0;
  for (const w of words) {
    if (idMarkers.includes(w)) idScore++;
    if (enMarkers.includes(w)) enScore++;
    if (enTechMarkers.includes(w)) enTechScore++;
    if (enTechForcesCodeSwitch.includes(w)) enTechForcing++;
  }
  const total = idScore + enScore + enTechScore;
  if (total === 0) return "en"; // ASCII-latin utterance with no markers · assume English
  // Code-switching rule: Indonesian sentence borrows an English tech VERB.
  if (idScore >= 1 && enTechForcing >= 1) return "mixed_en_id";
  // Dominance threshold · 66% classifies clearly; below that the utterance
  // meaningfully carries both languages and is 'mixed_en_id'.
  if (idScore / total >= 0.66) return "id";
  if ((enScore + enTechScore) / total >= 0.66) return "en";
  return "mixed_en_id";
}
