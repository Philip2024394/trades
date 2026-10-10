// src/lib/nex-native/safechat/__eval__/evaluation-runner.ts
//
// NEX SafeChat classification quality · hermetic evaluation runner.
//
// WHAT THIS DOES
// -----------------------------------------------------------------
//   · Takes one or more hand-authored corpora (CorpusItem[]).
//   · For each item, runs the SAME pure classifier functions used in
//     production (resolveLevel + computeConfidence + matchVocabulary +
//     matchPatterns + deriveSignals) against an in-memory mirror of
//     the Phase 1 seed ruleset (ruleset-fixture.ts).
//   · For items that carry a `priorMessages` array, builds a synthetic
//     HistoryEntry[] and calls deriveSignals directly, so multi-message
//     scenarios (repeated_pressure, escalation_pattern, time_pressure,
//     platform_switch) can be evaluated hermetically — without a DB.
//   · Compares the predicted level to the item's expected level and
//     collects per-category / per-language / overall metrics.
//   · Supports a `runEachItemTwice` consistency check (if the second
//     run disagrees with the first, that's a classifier non-determinism
//     bug · we report it).
//   · Accepts a `rulesetVersion` parameter · the string the comparison
//     report tags each run with (v1.0.0 or v1.1.0). The actual rule
//     logic is whatever `resolveLevel` currently does; the version
//     string is a label, not a selector. When R-RULES's refactored
//     v1.1.0 compose module lands, this runner can be re-pointed by
//     swapping the import; the harness contract stays identical.
//
// WHAT THIS DOES NOT DO
// -----------------------------------------------------------------
//   · No DB reads · no DB writes.
//   · No logging of body text (not even on failures that live inside
//     this process · the caller may optionally include body text when
//     writing the final report, but only because every corpus item is
//     synthetic).
//   · No feature flag, no hook invocation · we are measuring the
//     classifier only. The hook/feature-flag path has its own tests.
//   · We do NOT mutate the ruleset to influence the numbers.

import {
  applyAllRuleModules,
  applyAllRuleModulesV1_1_0Frozen,
  computeConfidence,
  detectLanguageHeuristic,
  resolveLevel,
} from "../classifier";
import { matchPatterns } from "../pattern-detector";
import {
  deriveSignals,
  emptySignals,
  type HistoryEntry,
} from "../conversation-signal-aggregator";
import { composeResult } from "../rules/compose";
import { composeResult as composeResultV1_1_0Frozen } from "../rules/_frozen-v1-1-0/compose";
import {
  SAFECHAT_CLASSIFIER_VERSION_V1_0_0,
  SAFECHAT_CLASSIFIER_VERSION_V1_1_0,
  SAFECHAT_CLASSIFIER_VERSION_V1_1_1,
  type RiskLevel,
  type RuleMatchEntry,
  type RuleModuleContext,
  type SafechatRulesetVersion,
} from "../types";
import { matchVocabulary, normaliseForMatch } from "../vocabulary-reader";
import {
  buildConfusionMatrix,
  falseNegativeRateOnSerious,
  falsePositiveRateOnBenign,
  overallAccuracy,
  perClassMetrics,
  type PerClassMetrics,
} from "./metrics";
import { buildRulesetFixture } from "./ruleset-fixture";

export type CorpusLanguage = "en" | "id" | "mixed";

/** Shape of a single prior-message classification carried on a
 *  multi-message corpus item. Enough to drive deriveSignals · no body
 *  text leakage required. */
export interface PriorClassification {
  readonly level: RiskLevel;
  readonly ruleMatches: readonly RuleMatchEntry[];
  readonly signals?: Record<string, unknown>;
  /** Minutes before the current message, as a negative integer. */
  readonly timestamp_offset_minutes: number;
}

export interface CorpusItem {
  readonly id: string;
  readonly text: string;
  readonly language: CorpusLanguage;
  readonly expected_level: RiskLevel;
  readonly category_tag: string;
  readonly notes?: string;
  readonly sender_profile?: "peer" | "adult_contact" | "unknown";
  readonly conversation_context?: string;
  /** Multi-message scenarios · the aggregator consumes this. */
  readonly priorMessages?: readonly PriorClassification[];
}

export interface EvalResult {
  readonly item: CorpusItem;
  readonly actualLevel: RiskLevel;
  readonly actualConfidence: number;
  readonly ruleMatches: readonly string[]; // category / signalType only
  readonly correct: boolean;
  readonly delta: number; // actualLevel - item.expected_level
}

export interface LanguageSummary {
  readonly accuracy: number;
  readonly perClass: readonly PerClassMetrics[];
}

export interface EvaluationReport {
  readonly runAt: string;
  readonly classifierVersion: SafechatRulesetVersion;
  readonly rulesetSource: string;
  readonly corpusTotals: Record<CorpusLanguage, number>;
  readonly overall: {
    readonly accuracy: number;
    readonly falsePositiveRateOnBenign: number;
    readonly falseNegativeRateOnSerious: number;
  };
  readonly perLanguage: Record<CorpusLanguage, LanguageSummary>;
  readonly perCategoryTag: Record<string, { readonly total: number; readonly correct: number }>;
  readonly consistency: {
    readonly duplicateRunDeltaCount: number;
    readonly description: string;
  };
  /**
   * Items where the classifier disagreed with the expected level.
   * These include body text · acceptable because every corpus item
   * is synthetic (see corpus-*.json authoring rules).
   */
  readonly failingItems: readonly EvalResult[];
  /**
   * Items where the classifier matched the expected level. Only id +
   * level info · no body text (keeps the report file reviewable
   * without re-reading all the synthetic content).
   */
  readonly passingItems: readonly {
    readonly id: string;
    readonly expected_level: RiskLevel;
    readonly actualLevel: RiskLevel;
  }[];
  /**
   * Exact numerator/denominator for serious-risk recall · the founder's
   * headline. numerator = expected-3 items classified at 3.
   * denominator = total expected-3 items.
   */
  readonly seriousRiskRecall: {
    readonly numerator: number;
    readonly denominator: number;
  };
}

export interface RunEvaluationArgs {
  readonly corpora: readonly (readonly CorpusItem[])[];
  readonly runEachItemTwice?: boolean;
  /** The two heuristic languages the Phase 1 classifier supports.
   *  Mirrors PHASE_1_LANGUAGES in classifier.ts. Overridable for tests. */
  readonly languages?: readonly string[];
  /** Clock source for runAt · defaults to Date. Test override. */
  readonly now?: () => Date;
  /** Version label this run is tagged with · defaults to v1.1.0 (the
   *  current head). Pass "safechat-rules-v1.0.0" when running the
   *  frozen baseline. */
  readonly rulesetVersion?: SafechatRulesetVersion;
}

const KNOWN_RULESET_VERSIONS: readonly SafechatRulesetVersion[] = [
  SAFECHAT_CLASSIFIER_VERSION_V1_0_0,
  SAFECHAT_CLASSIFIER_VERSION_V1_1_0,
  SAFECHAT_CLASSIFIER_VERSION_V1_1_1,
];

/** Build a HistoryEntry[] from a corpus item's priorMessages. The
 *  current message's hypothetical timestamp is "now" (synthetic ·
 *  wall-clock irrelevant · only the ordering of offsets matters). */
export function buildHistoryEntries(
  priorMessages: readonly PriorClassification[],
  now: Date,
): readonly HistoryEntry[] {
  if (priorMessages.length === 0) return [];
  const base = now.getTime();
  return priorMessages.map((p) => {
    const classifiedAt = new Date(
      base + p.timestamp_offset_minutes * 60_000,
    ).toISOString();
    const signalsObj =
      p.signals && typeof p.signals === "object" ? p.signals : {};
    return {
      level: p.level,
      ruleMatches: p.ruleMatches,
      signals: signalsObj,
      classifiedAt,
    };
  });
}

/**
 * Classify a single corpus item using the sealed pure functions +
 * the in-memory seed fixture. Returns the EvalResult the runner uses
 * to build its matrices.
 *
 * The rulesetVersion parameter selects:
 *   · v1.0.0 · the frozen resolveLevel + computeConfidence path (same
 *     behaviour the baseline wave shipped).
 *   · v1.1.0 · applyAllRuleModules + composeResult (the revised
 *     per-category composer path · see rules/*.ts).
 */
export function classifyCorpusItem(
  item: CorpusItem,
  compiled: ReturnType<typeof buildRulesetFixture>["compiled"],
  vocabIndex: ReturnType<typeof buildRulesetFixture>["vocabIndex"],
  languages: readonly string[],
  now: Date = new Date(),
  rulesetVersion: SafechatRulesetVersion = SAFECHAT_CLASSIFIER_VERSION_V1_1_0,
): EvalResult {
  const text = item.text;
  const normalised = normaliseForMatch(text);

  // The classifier always considers PHASE_1_LANGUAGES in production ·
  // even if detectLanguageHeuristic says 'id', vocabulary + pattern
  // matching also run for 'en'. That's by design (code-switching).
  const languageDetected = detectLanguageHeuristic(text);

  const vocabulary = matchVocabulary({
    normalisedText: normalised,
    languages,
    vocabIndex,
  });
  const patterns = matchPatterns({ text, languages, compiled });

  // Build conversation signals · hermetic. If the item carries a
  // priorMessages history, feed it through deriveSignals. Otherwise
  // emptySignals (same as a cold-open single-message classification).
  const signals = item.priorMessages && item.priorMessages.length > 0
    ? deriveSignals(buildHistoryEntries(item.priorMessages, now))
    : emptySignals();

  let actualLevel: RiskLevel;
  let confidence: number;
  if (rulesetVersion === SAFECHAT_CLASSIFIER_VERSION_V1_1_1) {
    // v1.1.1 · ACTIVE category-module composer with the Wave-2 fixes.
    const ctx: RuleModuleContext = {
      text,
      normalisedText: normalised,
      language: languageDetected ?? "en",
      vocabularyMatches: vocabulary,
      patternMatches: patterns,
      conversationSignals: signals,
    };
    const outputs = applyAllRuleModules(ctx);
    const composed = composeResult({
      moduleOutputs: outputs,
      vocabulary,
      patterns,
      signals,
      languageDetected,
      version: rulesetVersion,
    });
    actualLevel = composed.level;
    confidence = composed.confidence;
  } else if (rulesetVersion === SAFECHAT_CLASSIFIER_VERSION_V1_1_0) {
    // v1.1.0 FROZEN · sealed Wave-1 behaviour via _frozen-v1-1-0/.
    const ctx: RuleModuleContext = {
      text,
      normalisedText: normalised,
      language: languageDetected ?? "en",
      vocabularyMatches: vocabulary,
      patternMatches: patterns,
      conversationSignals: signals,
    };
    const outputs = applyAllRuleModulesV1_1_0Frozen(ctx);
    const composed = composeResultV1_1_0Frozen({
      moduleOutputs: outputs,
      vocabulary,
      patterns,
      signals,
      languageDetected,
      version: rulesetVersion,
    });
    actualLevel = composed.level;
    confidence = composed.confidence;
  } else {
    // v1.0.0 · frozen resolveLevel.
    actualLevel = resolveLevel({ vocabulary, patterns, signals });
    confidence = computeConfidence({ vocabulary, patterns, signals });
  }

  const ruleMatches: string[] = [
    ...vocabulary.map((v) => `vocab:${v.category}:${v.language}`),
    ...patterns.map((p) => `pattern:${p.signalType}:${p.language}`),
  ];

  return {
    item,
    actualLevel,
    actualConfidence: confidence,
    ruleMatches,
    correct: actualLevel === item.expected_level,
    delta: actualLevel - item.expected_level,
  };
}

/** Flatten N corpora into one array · preserves order. */
export function flattenCorpora(
  corpora: readonly (readonly CorpusItem[])[],
): readonly CorpusItem[] {
  const out: CorpusItem[] = [];
  for (const c of corpora) {
    for (const item of c) out.push(item);
  }
  return out;
}

/** Group results by language for the perLanguage summary. */
export function groupByLanguage(
  results: readonly EvalResult[],
): Record<CorpusLanguage, readonly EvalResult[]> {
  const buckets: Record<CorpusLanguage, EvalResult[]> = {
    en: [],
    id: [],
    mixed: [],
  };
  for (const r of results) {
    buckets[r.item.language].push(r);
  }
  return buckets;
}

/** Tally correct/total per category_tag. */
export function groupByCategoryTag(
  results: readonly EvalResult[],
): Record<string, { total: number; correct: number }> {
  const map: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    const bucket = map[r.item.category_tag] ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (r.correct) bucket.correct += 1;
    map[r.item.category_tag] = bucket;
  }
  return map;
}

/** Exact numerator/denominator for level-3 recall. */
export function computeSeriousRiskRecall(
  results: readonly EvalResult[],
): { numerator: number; denominator: number } {
  let numerator = 0;
  let denominator = 0;
  for (const r of results) {
    if (r.item.expected_level === 3) {
      denominator += 1;
      if (r.actualLevel === 3) numerator += 1;
    }
  }
  return { numerator, denominator };
}

/** Main entry · pure async orchestration. */
export async function runEvaluation(
  args: RunEvaluationArgs,
): Promise<EvaluationReport> {
  const languages = args.languages ?? ["en", "id"];
  const { vocabIndex, compiled } = buildRulesetFixture(languages);
  const nowFn = args.now ?? (() => new Date());
  const items = flattenCorpora(args.corpora);
  const rulesetVersion: SafechatRulesetVersion =
    args.rulesetVersion && KNOWN_RULESET_VERSIONS.includes(args.rulesetVersion)
      ? args.rulesetVersion
      : SAFECHAT_CLASSIFIER_VERSION_V1_1_0;

  const now = nowFn();
  const first: EvalResult[] = items.map((it) =>
    classifyCorpusItem(it, compiled, vocabIndex, languages, now, rulesetVersion),
  );

  let duplicateRunDeltaCount = 0;
  let consistencyDescription = "runEachItemTwice=false · consistency not checked";
  if (args.runEachItemTwice) {
    const second: EvalResult[] = items.map((it) =>
      classifyCorpusItem(it, compiled, vocabIndex, languages, now, rulesetVersion),
    );
    for (let i = 0; i < first.length; i += 1) {
      if (first[i]!.actualLevel !== second[i]!.actualLevel) {
        duplicateRunDeltaCount += 1;
      }
    }
    consistencyDescription =
      duplicateRunDeltaCount === 0
        ? "ran every item twice · zero disagreements · classifier deterministic for this corpus"
        : `ran every item twice · ${duplicateRunDeltaCount} item(s) disagreed between runs · classifier is NON-DETERMINISTIC · investigate`;
  }

  const corpusTotals: Record<CorpusLanguage, number> = {
    en: 0,
    id: 0,
    mixed: 0,
  };
  for (const it of items) corpusTotals[it.language] += 1;

  const overallMatrix = buildConfusionMatrix(
    first.map((r) => ({ expected: r.item.expected_level, actual: r.actualLevel })),
  );

  const grouped = groupByLanguage(first);
  const perLanguage: Record<CorpusLanguage, LanguageSummary> = {
    en: summariseBucket(grouped.en),
    id: summariseBucket(grouped.id),
    mixed: summariseBucket(grouped.mixed),
  };

  const perCategoryTag = groupByCategoryTag(first);

  const failingItems = first.filter((r) => !r.correct);
  const passingItems = first
    .filter((r) => r.correct)
    .map((r) => ({
      id: r.item.id,
      expected_level: r.item.expected_level,
      actualLevel: r.actualLevel,
    }));

  const seriousRiskRecall = computeSeriousRiskRecall(first);

  return {
    runAt: now.toISOString(),
    classifierVersion: rulesetVersion,
    rulesetSource:
      "src/lib/nex-native/safechat/__eval__/ruleset-fixture.ts (mirror of _seed-vocabulary.mjs)",
    corpusTotals,
    overall: {
      accuracy: overallAccuracy(overallMatrix),
      falsePositiveRateOnBenign: falsePositiveRateOnBenign(overallMatrix),
      falseNegativeRateOnSerious: falseNegativeRateOnSerious(overallMatrix),
    },
    perLanguage,
    perCategoryTag,
    consistency: {
      duplicateRunDeltaCount,
      description: consistencyDescription,
    },
    failingItems,
    passingItems,
    seriousRiskRecall,
  };
}

function summariseBucket(
  bucket: readonly EvalResult[],
): LanguageSummary {
  const matrix = buildConfusionMatrix(
    bucket.map((r) => ({
      expected: r.item.expected_level,
      actual: r.actualLevel,
    })),
  );
  return {
    accuracy: overallAccuracy(matrix),
    perClass: perClassMetrics(matrix),
  };
}
