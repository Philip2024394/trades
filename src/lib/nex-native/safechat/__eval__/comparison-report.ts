// src/lib/nex-native/safechat/__eval__/comparison-report.ts
//
// NEX SafeChat classification quality · baseline-vs-revised comparator.
//
// WHAT THIS DOES
// -----------------------------------------------------------------
//   · Takes two EvaluationReports (baseline and revised) produced by
//     the hermetic runner over the SAME corpus, plus the shared
//     corpus (needed because passing items in the serialised report
//     don't retain category_tag · we keep the EvaluationReport shape
//     tight by stripping passing-item metadata).
//   · Produces a Comparison object with per-category precision/recall/
//     F1 for each run, deltas, and lists of regressions and
//     improvements item-by-item.
//
// Pure · no I/O · deterministic.

import type {
  CorpusItem,
  EvaluationReport,
} from "./evaluation-runner";
import type { RiskLevel } from "../types";

/** Per-category precision/recall/F1 for a single run.
 *
 *  precision/recall here are a "flagged vs. not-flagged" proxy for
 *  the category_tag · "positive" means the classifier produced level
 *  >= 1 within that tag, "truePos" means expected AND actual >= 1.
 *  That's the headline most useful for category_tags that mix levels
 *  (e.g. the grooming category spans levels 2-3 depending on how
 *  many indicators fire). For per-level precision/recall across all
 *  four levels, see metrics.ts perClassMetrics on the per-language
 *  buckets inside EvaluationReport. */
export interface PerCategoryStats {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

/** Difference in each metric for a category · revised minus baseline. */
export interface PerCategoryDelta {
  readonly accuracyDelta: number;
  readonly precisionDelta: number;
  readonly recallDelta: number;
  readonly f1Delta: number;
}

export interface RegressionOrImprovement {
  readonly itemId: string;
  readonly category: string;
  readonly expectedLevel: RiskLevel;
  readonly baselineLevel: RiskLevel;
  readonly revisedLevel: RiskLevel;
}

export interface Comparison {
  readonly baselineVersion: string;
  readonly revisedVersion: string;
  readonly corpusVersion: string;
  readonly perCategoryBaseline: Record<string, PerCategoryStats>;
  readonly perCategoryRevised: Record<string, PerCategoryStats>;
  readonly perCategoryDelta: Record<string, PerCategoryDelta>;
  readonly seriousRiskRecall: {
    readonly baseline: { readonly numerator: number; readonly denominator: number };
    readonly revised: { readonly numerator: number; readonly denominator: number };
  };
  readonly falsePositiveRateOnBenign: {
    readonly baseline: number;
    readonly revised: number;
  };
  /** Items the revised ruleset got WRONG that the baseline got RIGHT. */
  readonly regressions: readonly RegressionOrImprovement[];
  /** Items the revised ruleset FIXED (baseline wrong · revised right). */
  readonly improvements: readonly RegressionOrImprovement[];
}

function round4(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10000) / 10000;
}

interface PerItemClassification {
  readonly actualLevel: RiskLevel;
  readonly expectedLevel: RiskLevel;
}

/** Join a report's passing + failing items into a Map keyed by id. */
export function buildPerItemMap(
  report: EvaluationReport,
): Map<string, PerItemClassification> {
  const map = new Map<string, PerItemClassification>();
  for (const p of report.passingItems) {
    map.set(p.id, {
      actualLevel: p.actualLevel,
      expectedLevel: p.expected_level,
    });
  }
  for (const f of report.failingItems) {
    map.set(f.item.id, {
      actualLevel: f.actualLevel,
      expectedLevel: f.item.expected_level,
    });
  }
  return map;
}

/** Compute per-category stats from a corpus + a per-id classification
 *  map. */
export function computePerCategoryStats(
  corpus: readonly CorpusItem[],
  perItem: Map<string, PerItemClassification>,
): Record<string, PerCategoryStats> {
  const buckets: Record<
    string,
    { total: number; correct: number; expectedPos: number; actualPos: number; truePos: number }
  > = {};
  for (const item of corpus) {
    const classification = perItem.get(item.id);
    if (!classification) continue;
    const tag = item.category_tag;
    const bucket = buckets[tag] ?? {
      total: 0,
      correct: 0,
      expectedPos: 0,
      actualPos: 0,
      truePos: 0,
    };
    bucket.total += 1;
    if (classification.actualLevel === item.expected_level) bucket.correct += 1;
    const expectedFlagged = item.expected_level >= 1;
    const actualFlagged = classification.actualLevel >= 1;
    if (expectedFlagged) bucket.expectedPos += 1;
    if (actualFlagged) bucket.actualPos += 1;
    if (expectedFlagged && actualFlagged) bucket.truePos += 1;
    buckets[tag] = bucket;
  }
  const out: Record<string, PerCategoryStats> = {};
  for (const [tag, b] of Object.entries(buckets)) {
    const accuracy = b.total === 0 ? 0 : b.correct / b.total;
    const precision = b.actualPos === 0 ? 0 : b.truePos / b.actualPos;
    const recall = b.expectedPos === 0 ? 0 : b.truePos / b.expectedPos;
    const f1 =
      precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    out[tag] = {
      total: b.total,
      correct: b.correct,
      accuracy: round4(accuracy),
      precision: round4(precision),
      recall: round4(recall),
      f1: round4(f1),
    };
  }
  return out;
}

/** Build the complete comparison from two reports over the same
 *  corpus. */
export function buildComparison(args: {
  readonly baseline: EvaluationReport;
  readonly revised: EvaluationReport;
  readonly corpus: readonly CorpusItem[];
  readonly corpusVersion: string;
}): Comparison {
  const { baseline, revised, corpus, corpusVersion } = args;

  const baselineById = buildPerItemMap(baseline);
  const revisedById = buildPerItemMap(revised);

  const perCategoryBaseline = computePerCategoryStats(corpus, baselineById);
  const perCategoryRevised = computePerCategoryStats(corpus, revisedById);

  const perCategoryDelta: Record<string, PerCategoryDelta> = {};
  const tags = new Set<string>([
    ...Object.keys(perCategoryBaseline),
    ...Object.keys(perCategoryRevised),
  ]);
  for (const tag of tags) {
    const b = perCategoryBaseline[tag];
    const r = perCategoryRevised[tag];
    perCategoryDelta[tag] = {
      accuracyDelta: round4((r?.accuracy ?? 0) - (b?.accuracy ?? 0)),
      precisionDelta: round4((r?.precision ?? 0) - (b?.precision ?? 0)),
      recallDelta: round4((r?.recall ?? 0) - (b?.recall ?? 0)),
      f1Delta: round4((r?.f1 ?? 0) - (b?.f1 ?? 0)),
    };
  }

  const regressions: RegressionOrImprovement[] = [];
  const improvements: RegressionOrImprovement[] = [];
  for (const item of corpus) {
    const b = baselineById.get(item.id);
    const r = revisedById.get(item.id);
    if (!b || !r) continue;
    const baselineCorrect = b.actualLevel === item.expected_level;
    const revisedCorrect = r.actualLevel === item.expected_level;
    if (baselineCorrect && !revisedCorrect) {
      regressions.push({
        itemId: item.id,
        category: item.category_tag,
        expectedLevel: item.expected_level,
        baselineLevel: b.actualLevel,
        revisedLevel: r.actualLevel,
      });
    } else if (!baselineCorrect && revisedCorrect) {
      improvements.push({
        itemId: item.id,
        category: item.category_tag,
        expectedLevel: item.expected_level,
        baselineLevel: b.actualLevel,
        revisedLevel: r.actualLevel,
      });
    }
  }

  return {
    baselineVersion: baseline.classifierVersion,
    revisedVersion: revised.classifierVersion,
    corpusVersion,
    perCategoryBaseline,
    perCategoryRevised,
    perCategoryDelta,
    seriousRiskRecall: {
      baseline: baseline.seriousRiskRecall,
      revised: revised.seriousRiskRecall,
    },
    falsePositiveRateOnBenign: {
      baseline: baseline.overall.falsePositiveRateOnBenign,
      revised: revised.overall.falsePositiveRateOnBenign,
    },
    regressions,
    improvements,
  };
}
