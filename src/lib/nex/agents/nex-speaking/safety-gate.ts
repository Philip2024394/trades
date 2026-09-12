// src/lib/nex/agents/nex-speaking/safety-gate.ts
//
// NEX Speaking Intelligence Engineer · Phase 3 · safety gate
// Philip 2026-09-07 · AUTHORIZE Phase 3
//
// Inherits every safety doctrine from day one:
//   · Life-safety supersession (self-harm detection · warmth-before-phone · country crisis lines)
//   · Medical / legal / veterinary disclaimers
//   · Multilingual + humor doctrine (6-test humor gate · never-humor contexts)
//   · Language interaction discipline (spelling suggest never choose)
//
// Deterministic · keyword-based · no LLM inference. Bias toward WARM
// FALSE-POSITIVE: if uncertain whether a signal is real, treat as real.

import type { SafetySignal, SpeakingLanguage, SpeakingRegister, UserContext } from "./types";
import { matchTaughtLifeSafetyPattern } from "./taught-patterns";

// ─── Language detection (deterministic · keyword-based) ─────────

/** Detect the language of the user's message using character-set +
 *  common-word heuristics. Returns "unknown" when confidence is low. */
export function detectLanguage(text: string, hint?: SpeakingLanguage): SpeakingLanguage {
  if (hint && hint !== "unknown") return hint;
  const t = (text ?? "").trim();
  if (!t) return "unknown";

  // Japanese: presence of Hiragana / Katakana / CJK unified ideographs
  if (/[぀-ゟ゠-ヿ一-鿿]/.test(t)) return "ja";

  // Indonesian: high-frequency Indonesian function words + verbs.
  // Guard against English cognates by requiring multiple hits · but
  // relax to 1 hit for short messages (<40 chars) where a single
  // strong marker is sufficient.
  const idLower = t.toLowerCase();
  const idMarkers = [
    /\byang\b/, /\btidak\b/, /\bsaya\b/, /\bkamu\b/, /\banda\b/,
    /\bapa\b/, /\bkenapa\b/, /\bdengan\b/, /\bini\b/, /\bitu\b/,
    /\bsedang\b/, /\bsudah\b/, /\bakan\b/, /\bharus\b/, /\bbisa\b/,
    /\bterima kasih\b/, /\bselamat\b/, /\bhalo\b/,
    // common verbs + adjectives that distinguish ID from EN
    /\bingin\b/, /\bmati\b/, /\bhidup\b/, /\bkuat\b/, /\bmenanyakan\b/,
    /\btentang\b/, /\bakomodasi\b/, /\btersedia\b/, /\bmohon\b/,
    /\bpeduli\b/, /\btidak ada\b/, /\bpesan\b/,
  ];
  let idHits = 0;
  for (const rx of idMarkers) if (rx.test(idLower)) idHits += 1;
  const shortText = t.length < 40;
  if (idHits >= (shortText ? 1 : 2)) return "id";

  // English: default when text is Latin script + not clearly Indonesian
  if (/[a-z]/i.test(t)) return "en";

  return "unknown";
}

// ─── Life-safety signal detection ───────────────────────────────
//
// Bias toward FALSE POSITIVE: any plausible signal → treat as real.
// Multiple patterns across languages. Detection is intentionally broad.

const LIFE_SAFETY_PATTERNS: RegExp[] = [
  // English · explicit
  /\bkill\s+myself\b/i,
  /\bend\s+(?:my|it\s+all|things)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon.?t\s+want\s+to\s+(?:be|live)\b/i,
  /\bhurt\s+myself\b/i,
  /\bharm\s+myself\b/i,
  /\bno\s+reason\s+to\s+(?:go\s+on|live|continue)\b/i,
  /\bcan.?t\s+do\s+this\s+any\s?more\b/i,
  /\bbetter\s+off\s+without\s+me\b/i,
  /\bnothing\s+matters\b/i,
  /\bjust\s+want\s+the\s+pain\s+to\s+stop\b/i,
  /\ballready\s+taken\b|\balready\s+swallowed\b|\balready\s+cut\b/i,
  // Bahasa Indonesia
  /\bingin\s+mati\b/i,
  /\bmau\s+mati\b/i,
  /\bbunuh\s+diri\b/i,
  /\btidak\s+ingin\s+hidup\b/i,
  /\btidak\s+kuat\s+lagi\b/i,
  /\bmenyakiti\s+diri\b/i,
  // Japanese
  /死にたい/,
  /自殺/,
  /消えたい/,
  /生きていたくない/,
  /終わりにしたい/,
];

export function detectLifeSafetySignal(text: string): boolean {
  if (!text) return false;
  // Baseline hardcoded patterns · inviolate
  for (const rx of LIFE_SAFETY_PATTERNS) if (rx.test(text)) return true;
  // Phase 4 · taught-knowledge extension · additive only
  // Never removes a hardcoded pattern · never weakens detection.
  // See taught-patterns.ts for full 6-safety-gate discipline.
  try {
    if (matchTaughtLifeSafetyPattern(text)) return true;
  } catch { /* store unavailable · fall through with baseline only */ }
  return false;
}

// ─── Medical / legal / bereavement / financial / abuse detection ─

const MEDICAL_PERSONAL_PATTERNS: RegExp[] = [
  /\bmy\s+(?:doctor|symptom|diagnos|medication|dose|prescription)/i,
  /\bshould\s+i\s+take\b.*(?:medication|pill|dose)/i,
  /\bis\s+(?:this|it)\s+(?:cancer|serious|dangerous)\b/i,
  /\bmy\s+condition\b/i,
  /\bsakit\s+saya\b/i,          // ID
  /\bdiagnosa\s+saya\b/i,       // ID
  /\bharuskah\s+saya\s+minum\b/i, // ID
  /私の症状/, /私の病気/, /診断/,  // JA
];

const LEGAL_PERSONAL_PATTERNS: RegExp[] = [
  /\bmy\s+(?:case|lawyer|attorney|lawsuit|contract|landlord|tenant|divorce|custody)/i,
  /\bcan\s+i\s+(?:sue|be\s+sued|be\s+arrested|be\s+deported)\b/i,
  /\bis\s+this\s+legal\b/i,
  /\bmy\s+rights\b/i,
  /\bkasus\s+saya\b/i,          // ID
  /\bpengacara\s+saya\b/i,      // ID
  /\bhak\s+saya\b/i,            // ID
  /私の裁判/, /私の権利/, /訴える/, // JA
];

const BEREAVEMENT_PATTERNS: RegExp[] = [
  /\bmy\s+(?:mother|father|husband|wife|son|daughter|friend|dog|cat)\s+(?:died|passed|is\s+gone)/i,
  /\brecent(?:ly)?\s+lost\b/i,
  /\bfuneral\b/i,
  /\bmeninggal\b/i,             // ID
  /\bkehilangan\b/i,            // ID
  /亡くなった/, /他界/,            // JA
];

const FINANCIAL_DISTRESS_PATTERNS: RegExp[] = [
  /\blost\s+my\s+job\b/i,
  /\bcan.?t\s+pay\s+(?:rent|bills|mortgage)/i,
  /\beviction\b/i,
  /\bbankrupt/i,
  /\bkehilangan\s+pekerjaan\b/i, // ID
  /\btidak\s+bisa\s+bayar\b/i,   // ID
  /失業/, /家賃が払えない/,        // JA
];

const ABUSE_PATTERNS: RegExp[] = [
  /\b(?:my|hus?band|wife|partner|boyfriend|girlfriend)\s+(?:hits|hurts|beats|threatens)\s+me\b/i,
  /\b(?:i'?m|i\s+am|feel)\s+(?:being\s+)?(?:abused|threatened|controlled)\b/i,
  /\bafraid\s+to\s+go\s+home\b/i,
  /\bdipukul\b/i,               // ID
  /\bkekerasan\s+rumah\s+tangga\b/i, // ID
  /暴力/, /虐待/,                  // JA
];

export function detectSafetySignal(ctx: UserContext): SafetySignal {
  const t = ctx.message ?? "";
  // Priority (most-specific first · life-safety always highest):
  //   1. life_safety      (highest · always wins)
  //   2. abuse            (specific violence indicators)
  //   3. medical_personal (specific medical vocabulary OR stated condition)
  //   4. legal_personal   (specific legal vocabulary OR stated situation)
  //   5. bereavement      (specific loss vocabulary)
  //   6. financial_distress (broader · matches on ambient words like "eviction")
  if (detectLifeSafetySignal(t)) return "life_safety";
  for (const rx of ABUSE_PATTERNS) if (rx.test(t)) return "abuse_context";
  if (ctx.has_stated_medical_condition) return "medical_personal";
  for (const rx of MEDICAL_PERSONAL_PATTERNS) if (rx.test(t)) return "medical_personal";
  if (ctx.has_stated_legal_situation) return "legal_personal";
  for (const rx of LEGAL_PERSONAL_PATTERNS) if (rx.test(t)) return "legal_personal";
  for (const rx of BEREAVEMENT_PATTERNS) if (rx.test(t)) return "bereavement";
  for (const rx of FINANCIAL_DISTRESS_PATTERNS) if (rx.test(t)) return "financial_distress";
  return "none";
}

// ─── Register selection (deterministic) ─────────────────────────

export function selectRegister(signal: SafetySignal, ctx: UserContext): SpeakingRegister {
  if (signal !== "none" || ctx.explicit_serious_request) return "distressed";
  // Default: formal for unknown users (respectful · adjustable in later phases)
  return "formal";
}

// ─── Humor gate (6-test doctrine · hard-blocked contexts) ────────

export function humorGateBlocked(signal: SafetySignal, ctx: UserContext): boolean {
  if (signal !== "none") return true;
  if (ctx.explicit_serious_request) return true;
  return false;
}

// ─── Country-specific crisis line lookup ───────────────────────

const CRISIS_LINES: Record<string, string[]> = {
  ID: [
    "Kementerian Kesehatan crisis line + local NGO Into The Light · Yayasan Pulih",
    "Global fallback · findahelpline.com · Befrienders Worldwide directory",
  ],
  US: [
    "988 Suicide & Crisis Lifeline",
    "Crisis Text Line · text HOME to 741741",
  ],
  UK: [
    "Samaritans · 116 123",
    "Shout SMS · text 85258",
  ],
  JP: [
    "TELL Lifeline",
    "Yorisoi Hotline · Inochi no Denwa",
  ],
  AU: [
    "Lifeline · 13 11 14",
    "Beyond Blue · 1300 22 4636",
  ],
};

export function crisisLinesForCountry(country?: string, language?: SpeakingLanguage): string[] {
  const c = (country ?? "").toUpperCase();
  if (c && CRISIS_LINES[c]) return CRISIS_LINES[c];
  // Infer from language when country is missing
  if (language === "id") return CRISIS_LINES.ID!;
  if (language === "ja") return CRISIS_LINES.JP!;
  // Global fallback
  return ["Global fallback · findahelpline.com · Befrienders Worldwide directory · IASP directory"];
}

// ─── Spelling suggestion (never auto-correct) ───────────────────
//
// Extremely narrow deterministic checker. Only fires on a small set
// of well-known misspellings with unambiguous corrections. Suggestion
// only · caller must respect user's original text.

const KNOWN_MISSPELLINGS: Record<string, { correction: string; language: SpeakingLanguage }> = {
  "recieve": { correction: "receive", language: "en" },
  "seperate": { correction: "separate", language: "en" },
  "accomodate": { correction: "accommodate", language: "en" },
  "definately": { correction: "definitely", language: "en" },
  "occured": { correction: "occurred", language: "en" },
  "teh": { correction: "the", language: "en" },
  "acheive": { correction: "achieve", language: "en" },
};

export function detectSpellingSuggestions(
  text: string,
  language: SpeakingLanguage,
  safetySignal: SafetySignal,
  ctx: UserContext,
): Array<{ original: string; suggested: string }> {
  // Hard block: no spelling suggestions in distressed contexts or when
  // user asked to preserve text verbatim
  if (safetySignal !== "none") return [];
  if (ctx.explicit_serious_request) return [];

  const suggestions: Array<{ original: string; suggested: string }> = [];
  const tokens = (text ?? "").split(/(\s+|[.,!?;:])/);
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (KNOWN_MISSPELLINGS[lower]) {
      const entry = KNOWN_MISSPELLINGS[lower]!;
      // Only suggest if the language matches (avoid cross-language false positives)
      if (entry.language === language) {
        suggestions.push({ original: tok, suggested: entry.correction });
      }
    }
  }
  return suggestions;
}
