// DO NOT MODIFY. Frozen snapshot of safechat-rules-v1.1.0 for comparison.
// Any ruleset changes land in the active rules/*.ts files and bump the version.
// Frozen 2026-10-10 after Wave 1.
//
// Verbatim snapshot of src/lib/nex-native/safechat/rules/secrecy-request-rules.ts
// as it stood at the end of Ruleset Tuning Wave 1 (v1.1.0). See the active file
// for the current (v1.1.1) implementation.

import type {
  RuleModule,
  RuleModuleContext,
  RuleModuleOutput,
} from "../../types";

export const SECRECY_REQUEST_MODULE_NAME = "secrecy_request";

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
];

const SEXUAL_CONTEXT_VOCAB_CATEGORIES = new Set<string>([
  "sexual_slang",
  "explicit_sexual",
  "grooming_indicator",
]);
const SEXUAL_CONTEXT_PATTERN_SIGNALS = new Set<string>([
  "image_request",
]);

export function hasSecrecySignal(ctx: RuleModuleContext): boolean {
  const vocabHit = ctx.vocabularyMatches.some(
    (v) => v.category === "secrecy_request",
  );
  const patternHit = ctx.patternMatches.some(
    (p) => p.signalType === "secrecy_request",
  );
  return vocabHit || patternHit;
}

export function hasBenignCelebrationContext(normalisedText: string): boolean {
  for (const t of BENIGN_CELEBRATION_TOKENS) {
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

  if (inMessageSexual) {
    signals.push("sexual_context_in_message");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 2,
      contributedConfidence: 0.55,
      contributingSignals: signals,
    };
  }

  if (priorSexualContext) {
    signals.push("sexual_context_in_history");
    return {
      moduleName: SECRECY_REQUEST_MODULE_NAME,
      contributedLevel: 2,
      contributedConfidence: 0.5,
      contributingSignals: signals,
    };
  }

  return {
    moduleName: SECRECY_REQUEST_MODULE_NAME,
    contributedLevel: 1,
    contributedConfidence: 0.25,
    contributingSignals: signals,
  };
};
