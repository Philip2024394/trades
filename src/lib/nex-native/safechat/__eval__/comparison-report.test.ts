// src/lib/nex-native/safechat/__eval__/comparison-report.test.ts
//
// Hand-authored deterministic tests for the baseline-vs-revised
// comparator. Each test constructs small synthetic EvaluationReport
// pairs so the expected values are hand-verifiable.

import { describe, expect, test } from "vitest";
import {
  buildComparison,
  buildPerItemMap,
  computePerCategoryStats,
} from "./comparison-report";
import type {
  CorpusItem,
  EvaluationReport,
} from "./evaluation-runner";
import type { RiskLevel } from "../types";

function corpusItem(
  id: string,
  category_tag: string,
  expected_level: RiskLevel,
): CorpusItem {
  return {
    id,
    text: "<synthetic>",
    language: "en",
    expected_level,
    category_tag,
  };
}

function emptyLanguageSummary() {
  return {
    accuracy: 0,
    perClass: [],
  };
}

function makeReport(args: {
  version: "safechat-rules-v1.0.0" | "safechat-rules-v1.1.0";
  passing: readonly { id: string; expected_level: RiskLevel; actualLevel: RiskLevel }[];
  failing: readonly {
    id: string;
    expected_level: RiskLevel;
    actualLevel: RiskLevel;
    category_tag: string;
  }[];
  seriousRiskRecall?: { numerator: number; denominator: number };
  falsePositiveRateOnBenign?: number;
}): EvaluationReport {
  return {
    runAt: "2026-10-10T00:00:00.000Z",
    classifierVersion: args.version,
    rulesetSource: "test-fixture",
    corpusTotals: { en: 0, id: 0, mixed: 0 },
    overall: {
      accuracy: 0,
      falsePositiveRateOnBenign: args.falsePositiveRateOnBenign ?? 0,
      falseNegativeRateOnSerious: 0,
    },
    perLanguage: {
      en: emptyLanguageSummary(),
      id: emptyLanguageSummary(),
      mixed: emptyLanguageSummary(),
    },
    perCategoryTag: {},
    consistency: {
      duplicateRunDeltaCount: 0,
      description: "test",
    },
    failingItems: args.failing.map((f) => ({
      item: {
        id: f.id,
        text: "<synthetic>",
        language: "en",
        expected_level: f.expected_level,
        category_tag: f.category_tag,
      },
      actualLevel: f.actualLevel,
      actualConfidence: 0,
      ruleMatches: [],
      correct: false,
      delta: f.actualLevel - f.expected_level,
    })),
    passingItems: [...args.passing],
    seriousRiskRecall: args.seriousRiskRecall ?? { numerator: 0, denominator: 0 },
  };
}

describe("buildPerItemMap", () => {
  test("merges passing + failing items keyed by id", () => {
    const report = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "p1", expected_level: 0, actualLevel: 0 }],
      failing: [{ id: "f1", expected_level: 3, actualLevel: 2, category_tag: "serious" }],
    });
    const map = buildPerItemMap(report);
    expect(map.size).toBe(2);
    expect(map.get("p1")).toEqual({ expectedLevel: 0, actualLevel: 0 });
    expect(map.get("f1")).toEqual({ expectedLevel: 3, actualLevel: 2 });
  });

  test("empty report · empty map", () => {
    const report = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [],
      failing: [],
    });
    expect(buildPerItemMap(report).size).toBe(0);
  });
});

describe("computePerCategoryStats", () => {
  test("perfect classifier on one category · precision=recall=f1=1", () => {
    const corpus: CorpusItem[] = [
      corpusItem("a", "benign", 0),
      corpusItem("b", "benign", 0),
    ];
    const perItem = new Map([
      ["a", { expectedLevel: 0 as RiskLevel, actualLevel: 0 as RiskLevel }],
      ["b", { expectedLevel: 0 as RiskLevel, actualLevel: 0 as RiskLevel }],
    ]);
    const stats = computePerCategoryStats(corpus, perItem);
    // benign has expected level 0 · neither expectedFlagged nor
    // actualFlagged · precision/recall are 0 (no positive support)
    expect(stats.benign.total).toBe(2);
    expect(stats.benign.correct).toBe(2);
    expect(stats.benign.accuracy).toBe(1);
    expect(stats.benign.precision).toBe(0);
    expect(stats.benign.recall).toBe(0);
  });

  test("category with all expected-flagged, all actual-flagged, all correct · precision=recall=1", () => {
    const corpus: CorpusItem[] = [
      corpusItem("a", "serious", 3),
      corpusItem("b", "serious", 3),
    ];
    const perItem = new Map([
      ["a", { expectedLevel: 3 as RiskLevel, actualLevel: 3 as RiskLevel }],
      ["b", { expectedLevel: 3 as RiskLevel, actualLevel: 3 as RiskLevel }],
    ]);
    const stats = computePerCategoryStats(corpus, perItem);
    expect(stats.serious.precision).toBe(1);
    expect(stats.serious.recall).toBe(1);
    expect(stats.serious.f1).toBe(1);
    expect(stats.serious.accuracy).toBe(1);
  });

  test("one false positive in category · precision drops", () => {
    // 2 items in category · 1 is expected flagged (actual flagged
    // too, TP) and the other is expected clean but actual flagged (FP).
    const corpus: CorpusItem[] = [
      corpusItem("a", "mixed", 3),
      corpusItem("b", "mixed", 0),
    ];
    const perItem = new Map([
      ["a", { expectedLevel: 3 as RiskLevel, actualLevel: 3 as RiskLevel }],
      ["b", { expectedLevel: 0 as RiskLevel, actualLevel: 2 as RiskLevel }],
    ]);
    const stats = computePerCategoryStats(corpus, perItem);
    // precision = TP / (TP + FP) = 1 / 2 = 0.5
    expect(stats.mixed.precision).toBe(0.5);
    // recall = TP / expectedPos = 1 / 1 = 1
    expect(stats.mixed.recall).toBe(1);
    // f1 = 2*0.5*1/(0.5+1) = 1/1.5 ~ 0.6667
    expect(stats.mixed.f1).toBe(0.6667);
    // accuracy = correct / total = 1/2 = 0.5
    expect(stats.mixed.accuracy).toBe(0.5);
  });

  test("one false negative in category · recall drops", () => {
    const corpus: CorpusItem[] = [
      corpusItem("a", "fn-category", 3),
      corpusItem("b", "fn-category", 3),
    ];
    const perItem = new Map([
      ["a", { expectedLevel: 3 as RiskLevel, actualLevel: 3 as RiskLevel }],
      ["b", { expectedLevel: 3 as RiskLevel, actualLevel: 0 as RiskLevel }],
    ]);
    const stats = computePerCategoryStats(corpus, perItem);
    // precision = TP / (TP + FP) = 1 / 1 = 1 (only one actually
    // flagged, and it was correct)
    expect(stats["fn-category"].precision).toBe(1);
    // recall = TP / expectedPos = 1 / 2 = 0.5
    expect(stats["fn-category"].recall).toBe(0.5);
    expect(stats["fn-category"].f1).toBe(0.6667);
    expect(stats["fn-category"].accuracy).toBe(0.5);
  });

  test("corpus item without a classification is skipped silently", () => {
    const corpus: CorpusItem[] = [
      corpusItem("a", "benign", 0),
      corpusItem("b", "benign", 0),
    ];
    const perItem = new Map([
      ["a", { expectedLevel: 0 as RiskLevel, actualLevel: 0 as RiskLevel }],
    ]);
    const stats = computePerCategoryStats(corpus, perItem);
    expect(stats.benign.total).toBe(1);
  });
});

describe("buildComparison", () => {
  const corpusVersion = "v2";

  test("identical baseline and revised · zero regressions, zero improvements, zero deltas", () => {
    const corpus: CorpusItem[] = [
      corpusItem("a", "benign", 0),
      corpusItem("b", "serious", 3),
    ];
    const perfectReport = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [
        { id: "a", expected_level: 0, actualLevel: 0 },
        { id: "b", expected_level: 3, actualLevel: 3 },
      ],
      failing: [],
      seriousRiskRecall: { numerator: 1, denominator: 1 },
    });
    const revised = {
      ...perfectReport,
      classifierVersion: "safechat-rules-v1.1.0",
    } as EvaluationReport;
    const cmp = buildComparison({
      baseline: perfectReport,
      revised,
      corpus,
      corpusVersion,
    });
    expect(cmp.regressions).toEqual([]);
    expect(cmp.improvements).toEqual([]);
    expect(cmp.perCategoryDelta.benign.accuracyDelta).toBe(0);
    expect(cmp.perCategoryDelta.serious.accuracyDelta).toBe(0);
  });

  test("baseline wrong on one item · revised right · 1 improvement, 0 regressions", () => {
    const corpus: CorpusItem[] = [corpusItem("a", "grooming", 3)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [],
      failing: [{ id: "a", expected_level: 3, actualLevel: 2, category_tag: "grooming" }],
      seriousRiskRecall: { numerator: 0, denominator: 1 },
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [{ id: "a", expected_level: 3, actualLevel: 3 }],
      failing: [],
      seriousRiskRecall: { numerator: 1, denominator: 1 },
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.improvements.length).toBe(1);
    expect(cmp.improvements[0]!.itemId).toBe("a");
    expect(cmp.improvements[0]!.baselineLevel).toBe(2);
    expect(cmp.improvements[0]!.revisedLevel).toBe(3);
    expect(cmp.regressions).toEqual([]);
    expect(cmp.seriousRiskRecall.baseline.numerator).toBe(0);
    expect(cmp.seriousRiskRecall.revised.numerator).toBe(1);
  });

  test("baseline right on one item · revised wrong · 1 regression, 0 improvements", () => {
    const corpus: CorpusItem[] = [corpusItem("a", "benign", 0)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "a", expected_level: 0, actualLevel: 0 }],
      failing: [],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [],
      failing: [{ id: "a", expected_level: 0, actualLevel: 1, category_tag: "benign" }],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.regressions.length).toBe(1);
    expect(cmp.regressions[0]!.itemId).toBe("a");
    expect(cmp.regressions[0]!.baselineLevel).toBe(0);
    expect(cmp.regressions[0]!.revisedLevel).toBe(1);
    expect(cmp.improvements).toEqual([]);
  });

  test("regression + improvement in the same comparison are reported in separate lists", () => {
    const corpus: CorpusItem[] = [
      corpusItem("fix-me", "grooming", 3),
      corpusItem("break-me", "benign", 0),
    ];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "break-me", expected_level: 0, actualLevel: 0 }],
      failing: [{ id: "fix-me", expected_level: 3, actualLevel: 2, category_tag: "grooming" }],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [{ id: "fix-me", expected_level: 3, actualLevel: 3 }],
      failing: [{ id: "break-me", expected_level: 0, actualLevel: 1, category_tag: "benign" }],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.regressions.length).toBe(1);
    expect(cmp.regressions[0]!.itemId).toBe("break-me");
    expect(cmp.improvements.length).toBe(1);
    expect(cmp.improvements[0]!.itemId).toBe("fix-me");
  });

  test("records baseline/revised versions on the output", () => {
    const corpus: CorpusItem[] = [corpusItem("a", "benign", 0)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "a", expected_level: 0, actualLevel: 0 }],
      failing: [],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [{ id: "a", expected_level: 0, actualLevel: 0 }],
      failing: [],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.baselineVersion).toBe("safechat-rules-v1.0.0");
    expect(cmp.revisedVersion).toBe("safechat-rules-v1.1.0");
    expect(cmp.corpusVersion).toBe("v2");
  });

  test("falsePositiveRateOnBenign is copied from each report", () => {
    const corpus: CorpusItem[] = [corpusItem("a", "benign", 0)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "a", expected_level: 0, actualLevel: 0 }],
      failing: [],
      falsePositiveRateOnBenign: 0.3,
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [{ id: "a", expected_level: 0, actualLevel: 0 }],
      failing: [],
      falsePositiveRateOnBenign: 0.1,
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.falsePositiveRateOnBenign.baseline).toBe(0.3);
    expect(cmp.falsePositiveRateOnBenign.revised).toBe(0.1);
  });

  test("delta is computed as revised minus baseline per category", () => {
    const corpus: CorpusItem[] = [
      corpusItem("a", "fix", 3),
      corpusItem("b", "fix", 3),
    ];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "a", expected_level: 3, actualLevel: 3 }],
      failing: [{ id: "b", expected_level: 3, actualLevel: 0, category_tag: "fix" }],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [
        { id: "a", expected_level: 3, actualLevel: 3 },
        { id: "b", expected_level: 3, actualLevel: 3 },
      ],
      failing: [],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.perCategoryBaseline.fix.recall).toBe(0.5);
    expect(cmp.perCategoryRevised.fix.recall).toBe(1);
    expect(cmp.perCategoryDelta.fix.recallDelta).toBe(0.5);
    expect(cmp.perCategoryDelta.fix.accuracyDelta).toBe(0.5);
  });

  test("item missing from one side is skipped silently in regression/improvement detection", () => {
    const corpus: CorpusItem[] = [
      corpusItem("shared", "x", 3),
      corpusItem("only-baseline", "x", 3),
    ];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "only-baseline", expected_level: 3, actualLevel: 3 }],
      failing: [{ id: "shared", expected_level: 3, actualLevel: 2, category_tag: "x" }],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [{ id: "shared", expected_level: 3, actualLevel: 3 }],
      failing: [],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.improvements.length).toBe(1);
    expect(cmp.improvements[0]!.itemId).toBe("shared");
  });

  test("seriousRiskRecall copies both numerator/denominator exactly", () => {
    const corpus: CorpusItem[] = [corpusItem("a", "s", 3)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "a", expected_level: 3, actualLevel: 3 }],
      failing: [],
      seriousRiskRecall: { numerator: 42, denominator: 100 },
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [{ id: "a", expected_level: 3, actualLevel: 3 }],
      failing: [],
      seriousRiskRecall: { numerator: 75, denominator: 100 },
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.seriousRiskRecall.baseline).toEqual({ numerator: 42, denominator: 100 });
    expect(cmp.seriousRiskRecall.revised).toEqual({ numerator: 75, denominator: 100 });
  });

  test("empty corpus · empty category stats, empty regression/improvement lists", () => {
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [],
      failing: [],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [],
      failing: [],
    });
    const cmp = buildComparison({
      baseline,
      revised,
      corpus: [],
      corpusVersion: "v2",
    });
    expect(cmp.perCategoryBaseline).toEqual({});
    expect(cmp.perCategoryRevised).toEqual({});
    expect(cmp.perCategoryDelta).toEqual({});
    expect(cmp.regressions).toEqual([]);
    expect(cmp.improvements).toEqual([]);
  });

  test("category present only in baseline shows accuracyDelta = -baseline accuracy", () => {
    const corpus: CorpusItem[] = [corpusItem("a", "only-baseline-tag", 0)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "a", expected_level: 0, actualLevel: 0 }],
      failing: [],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [],
      failing: [],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.perCategoryDelta["only-baseline-tag"].accuracyDelta).toBe(-1);
  });

  test("regressions list captures baseline and revised actual levels", () => {
    const corpus: CorpusItem[] = [corpusItem("x", "cat", 2)];
    const baseline = makeReport({
      version: "safechat-rules-v1.0.0",
      passing: [{ id: "x", expected_level: 2, actualLevel: 2 }],
      failing: [],
    });
    const revised = makeReport({
      version: "safechat-rules-v1.1.0",
      passing: [],
      failing: [{ id: "x", expected_level: 2, actualLevel: 3, category_tag: "cat" }],
    });
    const cmp = buildComparison({ baseline, revised, corpus, corpusVersion });
    expect(cmp.regressions[0]).toEqual({
      itemId: "x",
      category: "cat",
      expectedLevel: 2,
      baselineLevel: 2,
      revisedLevel: 3,
    });
  });

  test("corpusVersion label is passed through verbatim", () => {
    const corpus: CorpusItem[] = [];
    const baseline = makeReport({ version: "safechat-rules-v1.0.0", passing: [], failing: [] });
    const revised = makeReport({ version: "safechat-rules-v1.1.0", passing: [], failing: [] });
    const cmp = buildComparison({
      baseline,
      revised,
      corpus,
      corpusVersion: "mixed-v1-plus-v2",
    });
    expect(cmp.corpusVersion).toBe("mixed-v1-plus-v2");
  });
});
