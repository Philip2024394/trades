// src/lib/nex-native/safechat/rules/secrecy-request-rules.ts
//
// NEX SafeChat ruleset v1.1.1 · SECRECY_REQUEST rule module.
// -------------------------------------------------------------------
// WAVE 1 (v1.1.0 · 2026-10-10) · fixed the v1.0.0 gap where the
//   `secrecy_request` category scored 0% accuracy on the baseline eval.
//   Introduced the benign-celebration whitelist, the ordinary-privacy
//   Level-1 fallback, and the Level-2/3 secrecy branches.
// WAVE 2 (v1.1.1 · 2026-10-10) · targeted regression fixes.
//   · Regression 2 (EN surprise_party_secrecy) · item v2-en-benign-
//     lookalike-010 ("don't tell nan about the cake we're hiding it for
//     her 80th") was Level 0 in v1.0.0 and over-escalated to Level 1 in
//     v1.1.0 because none of the benign-celebration tokens matched the
//     cake-hiding phrasing. v1.1.1 extends the English whitelist with
//     cake-hiding / gift-wrapping / family-celebrant idioms.
//   · Regression 3 (ID ordinary_privacy) · item v2-id-benign-lookalike-
//     008 ("temen dekat aku bilang jangan bilang nilai kita ke orang
//     lain") was Level 0 in v1.0.0 and over-escalated to Level 1 in
//     v1.1.0 because the ordinary peer-privacy phrasing matched the
//     secrecy pattern. v1.1.1 adds an Indonesian ordinary-privacy
//     whitelist that down-weights the common everyday "jangan bilang
//     nilai / rahasia kecil kita / urusan pribadi" family of phrases to
//     Level 0 (matching the ordinary-privacy founder guard).
//
// Doctrine (per founder authorisation 2026-10-10):
//   · UNSAFE: secrecy + prior sexual-topic signals in conversation →
//     Level 3.
//   · UNSAFE: secrecy + sexual signal elsewhere in the same message →
//     Level 3 (special-case: no conversation history needed when the
//     current message itself pairs secrecy with explicit sexual vocab).
//   · UNSAFE: secrecy paired with age_gap_disclosure in message or
//     history → Level 3.
//   · SENSITIVE: isolated secrecy with no supporting evidence → Level 1
//     (potentially benign privacy · worth logging but not escalated).
//   · BENIGN: secrecy framed with celebration vocabulary (surprise /
//     party / birthday / present / kejutan / ulang tahun / cake / etc.)
//     → Level 0.
//   · BENIGN (v1.1.1): secrecy framed as ordinary everyday privacy in
//     Indonesian ("jangan bilang nilai kita", "urusan pribadi", "antara
//     kita saja", "nilai kita", "rahasia kecil") → Level 0.
//
// This matches the founder's "don't classify ordinary privacy as
// serious risk" rule and preserves the three-way distinction between
// grooming-secrecy, ordinary privacy, and benign celebration-secrecy.
//
// Privacy invariant:
//   · contributingSignals carries category / signal labels only. Body
//     text is never emitted · the benign-context detector works on the
//     normalised message internally and reports only the label
//     "benign_celebration_context" or "benign_ordinary_privacy_id" when
//     it fires.

import type {
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../types";

export const SECRECY_REQUEST_MODULE_NAME = "secrecy_request";

/** Tokens that strongly indicate a benign-celebration framing of a
 *  secrecy request. If any one of these appears alongside the
 *  secrecy pattern, the module down-weights to Level 0. English +
 *  Indonesian · deliberately short + conservative.
 *
 *  v1.1.1 additions (cake-hiding, gift-wrapping, family celebrant):
 *    · "cake" · surprise cake framings ("don't tell nan about the cake")
 *    · "hiding it for" · gift-hiding idiom
 *    · "hiding this" · gift-hiding idiom (shorter form)
 *    · "wrapping the" · present-wrapping idiom
 *    · "it's for her", "it's for his" · possessive-anniversary framing
 *      (e.g. "it's for her 80th") paired with secrecy signal only
 *    · "retirement party", "retirement gift" · adult celebrant framings
 *    · "wedding gift", "wedding present" · benign formal celebrant
 *    · "nan", "grandma", "grandpa" · family-elder celebrant
 *      (as a standalone token · we only match when a secrecy signal
 *      ALSO fires, so the risk of over-collapsing is limited; see test
 *      "secrecy-request-rules · levels > BENIGN · ordinary teenage
 *      privacy 'this is private, ok' with no secrecy_request match →
 *      Level 0" that proves this list is not consulted without a
 *      secrecy signal). */
const BENIGN_CELEBRATION_TOKENS: readonly string[] = [
  "surprise",
  "surprise party",
  "birthday",
  "present",
  "gift for mum",
  "gift for mom",
  "gift for dad",
  "party",
  "christmas",
  "anniversary",
  "kejutan",
  "ulang tahun",
  "hadiah",
  "pesta",
  "kado",
  // v1.1.1 cake/gift/celebrant additions · prefer multi-word idioms over
  // standalone family-member nouns to avoid incidental over-matching
  // (e.g. "grandma died" is benign news not benign celebration).
  "cake",
  "hiding it for",
  "hiding this",
  "wrapping the",
  "it's for her",
  "it's for his",
  "retirement party",
  "retirement gift",
  "wedding gift",
  "wedding present",
  "tell nan",
  "tell grandma",
  "tell grandpa",
  "tell nenek",
  "tell kakek",
];

/** Indonesian ordinary-privacy phrases. These are everyday peer /
 *  family idioms that match the secrecy_request pattern ("jangan
 *  bilang ...") but describe benign personal privacy, not grooming
 *  secrecy. When ANY of these fires alongside a secrecy signal AND
 *  there is no sexual / grooming / coercion / age-gap context, we
 *  down-weight to Level 0 (matching the founder "don't classify
 *  ordinary privacy as serious risk" guard).
 *
 *  v1.1.1 · list is conservative · we only ever down-weight when the
 *  message has NO sexual / grooming / age-gap signals present. */
const BENIGN_ORDINARY_PRIVACY_TOKENS_ID: readonly string[] = [
  "nilai kita",            // our (test / grade) scores
  "nilai kami",            // our (test) scores (formal)
  "nilai ujian",           // test scores
  "urusan pribadi",        // personal matter
  "urusan keluarga",       // family matter
  "antara kita saja",      // just between us (ordinary peer)
  "rahasia kecil",         // little secret (teen peer)
  "jangan dibahas",        // let's not discuss
  "pribadi aja",           // just personal
  "jangan sebar",          // don't spread (news/gossip)
  "jangan diomongin",      // don't talk about
  "temen dekat aku",       // "my close friend said"
];

/** Vocabulary / pattern categories that count as "sexual context" when
 *  deciding whether to escalate a secrecy_request. */
const SEXUAL_CONTEXT_VOCAB_CATEGORIES = new Set<string>([
  "sexual_slang",
  "explicit_sexual",
  "grooming_indicator",
]);
const SEXUAL_CONTEXT_PATTERN_SIGNALS = new Set<string>([
  "image_request",
]);

/** Returns true when the message carries a secrecy-request pattern
 *  match OR a secrecy_request vocab match. */
export function hasSecrecySignal(ctx: RuleModuleContext): boolean {
  const vocabHit = ctx.vocabularyMatches.some(
    (v) => v.category === "secrecy_request",
  );
  const patternHit = ctx.patternMatches.some(
    (p) => p.signalType === "secrecy_request",
  );
  return vocabHit || patternHit;
}

/** Returns true when the normalised text contains a benign celebration
 *  token. Match is a plain `includes` scan · tokens are chosen so a
 *  substring match is a safe approximation of a word-match in Phase 1. */
export function hasBenignCelebrationContext(normalisedText: string): boolean {
  for (const t of BENIGN_CELEBRATION_TOKENS) {
    if (normalisedText.includes(t)) return true;
  }
  return false;
}

/** v1.1.1 · returns true when the normalised text contains one of the
 *  Indonesian ordinary-privacy phrases. Only consulted when NO sexual
 *  / grooming / age-gap context is present elsewhere in the message or
 *  history (the caller enforces this guard). */
export function hasBenignOrdinaryPrivacyContextId(
  normalisedText: string,
): boolean {
  for (const t of BENIGN_ORDINARY_PRIVACY_TOKENS_ID) {
    if (normalisedText.includes(t)) return true;
  }
  return false;
}

function hasInMessageSexualContext(ctx: RuleModuleContext): boolean {
  const vocabHit = ctx.vocabularyMatches.some((v) =>
    SEXUAL_CONTEXT_VOCAB_CATEGORIES.has(v.category),
  );
  const patternHit = ctx.patternMatches.some((p) =>
    SEXUAL_CONTEXT_PATTERN_SIGNALS.has(p.signalType),
  );
  return vocabHit || patternHit;
}

function hasInMessageGroomingVocab(ctx: RuleModuleContext): boolean {
  return ctx.vocabularyMatches.some(
    (v) => v.category === "grooming_indicator",
  );
}

function hasInMessageAgeGapDisclosure(ctx: RuleModuleContext): boolean {
  return ctx.patternMatches.some(
    (p) => p.signalType === "age_gap_disclosure",
  );
}

export const applyRules: RuleModule = (
  ctx: RuleModuleContext,
): RuleModuleOutput => {
  if (!hasSecrecySignal(ctx)) {
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 0,
      contributedConfidence: 0,
      contributingSignals: [],
    };
  }

  const signals: string[] = ["secrecy_request"];

  // Benign-celebration whitelist · explicit down-weight. The founder's
  // guard: "Don't tell dad about the surprise party!" must NEVER
  // escalate.
  if (hasBenignCelebrationContext(ctx.normalisedText)) {
    signals.push("benign_celebration_context");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 0,
      contributedConfidence: 0,
      contributingSignals: signals,
    };
  }

  const inMessageSexual = hasInMessageSexualContext(ctx);
  const inMessageGrooming = hasInMessageGroomingVocab(ctx);
  const inMessageAgeGap = hasInMessageAgeGapDisclosure(ctx);

  const priorSexualContext =
    ctx.conversationSignals.escalating_severity_pattern === true ||
    ctx.conversationSignals.repeated_pressure_after_refusal ||
    ctx.conversationSignals.repeated_request_after_refusal === true;
  const priorAgeGap =
    ctx.conversationSignals.age_gap_already_disclosed === true;
  const priorPlatformSwitch =
    ctx.conversationSignals.platform_switch_invitation ||
    ctx.conversationSignals.platform_switch_already_proposed === true;

  // ---- Level 3 branches ------------------------------------------
  // (a) secrecy + explicit sexual signal in the same message AND
  //     either grooming vocab OR age-gap disclosure
  if (inMessageSexual && (inMessageGrooming || inMessageAgeGap)) {
    signals.push("sexual_context_in_message");
    if (inMessageGrooming) signals.push("grooming_indicator_in_message");
    if (inMessageAgeGap) signals.push("age_gap_disclosure_in_message");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 3,
      contributedConfidence: 0.85,
      contributingSignals: signals,
    };
  }

  // (b) secrecy + prior sexual-topic history AND (age gap or platform
  //     switch previously seen).
  if (priorSexualContext && (priorAgeGap || priorPlatformSwitch)) {
    signals.push("sexual_context_in_history");
    if (priorAgeGap) signals.push("age_gap_in_history");
    if (priorPlatformSwitch) signals.push("platform_switch_in_history");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 3,
      contributedConfidence: 0.8,
      contributingSignals: signals,
    };
  }

  // ---- Level 2 branches ------------------------------------------
  // (c) secrecy + ANY sexual signal (vocab or pattern) elsewhere in
  //     the message · potentially unsafe pairing even without a
  //     grooming / age-gap anchor.
  if (inMessageSexual) {
    signals.push("sexual_context_in_message");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 2,
      contributedConfidence: 0.55,
      contributingSignals: signals,
    };
  }

  // (d) secrecy + prior sexual-topic history alone → Level 2.
  if (priorSexualContext) {
    signals.push("sexual_context_in_history");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 2,
      contributedConfidence: 0.5,
      contributingSignals: signals,
    };
  }

  // ---- v1.1.1 · benign ordinary-privacy down-weight (ID) --------
  // When the Indonesian whitelist fires AND we've already excluded
  // sexual / grooming / age-gap in-message or history context above,
  // the secrecy signal is reporting ordinary everyday peer / family
  // privacy. Down-weight to Level 0 to match the v1.0.0 baseline
  // behaviour on item v2-id-benign-lookalike-008.
  if (hasBenignOrdinaryPrivacyContextId(ctx.normalisedText)) {
    signals.push("benign_ordinary_privacy_id");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 0,
      contributedConfidence: 0,
      contributingSignals: signals,
    };
  }

  // ---- Level 1 fallback ------------------------------------------
  // Isolated secrecy with no supporting evidence · ordinary privacy
  // that is still worth logging. Founder constraint: do NOT escalate
  // isolated privacy to Level 3.
  return {
    moduleName: SECRECY_REQUEST_MODULE_NAME,
    contributedLevel: 1,
    contributedConfidence: 0.25,
    contributingSignals: signals,
  };
};
