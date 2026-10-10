// src/lib/nex-native/safechat/__eval__/metrics.test.ts
//
// Hand-authored, deterministic unit tests for the classification
// quality metrics module. Every expected value is hand-computed from
// a small matrix so the test doubles as documentation.

import { describe, expect, test } from "vitest";
import {
  buildConfusionMatrix,
  falseNegativeRateOnSerious,
  falsePositiveRateOnBenign,
  overallAccuracy,
  perClassMetrics,
} from "./metrics";

describe("buildConfusionMatrix", () => {
  test("empty input · 4x4 zeros, total 0", () => {
    const m = buildConfusionMatrix([]);
    expect(m.total).toBe(0);
    for (const row of m.counts) {
      for (const v of row) expect(v).toBe(0);
    }
  });

  test("single perfect prediction", () => {
    const m = buildConfusionMatrix([{ expected: 0, actual: 0 }]);
    expect(m.total).toBe(1);
    expect(m.counts[0]![0]).toBe(1);
  });

  test("mix of right and wrong · counts land in [expected][actual]", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 0, actual: 1 },
      { expected: 1, actual: 1 },
      { expected: 3, actual: 2 },
      { expected: 3, actual: 3 },
    ]);
    expect(m.total).toBe(5);
    expect(m.counts[0]![0]).toBe(1);
    expect(m.counts[0]![1]).toBe(1);
    expect(m.counts[1]![1]).toBe(1);
    expect(m.counts[3]![2]).toBe(1);
    expect(m.counts[3]![3]).toBe(1);
  });

  test("ignores malformed level values silently", () => {
    const m = buildConfusionMatrix([
      // @ts-expect-error · intentional bad input
      { expected: 4, actual: 1 },
      { expected: 2, actual: 2 },
    ]);
    expect(m.total).toBe(1);
    expect(m.counts[2]![2]).toBe(1);
  });
});

describe("perClassMetrics", () => {
  test("perfect classifier · precision/recall/f1 all 1 where support > 0", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 1, actual: 1 },
      { expected: 2, actual: 2 },
      { expected: 3, actual: 3 },
    ]);
    const pcm = perClassMetrics(m);
    for (const row of pcm) {
      expect(row.precision).toBe(1);
      expect(row.recall).toBe(1);
      expect(row.f1).toBe(1);
      expect(row.support).toBe(1);
    }
  });

  test("level 0 recall drops when the classifier over-escalates benign items", () => {
    // 10 expected-0 items · 7 classified 0, 3 classified 1
    const inputs = [
      ...Array(7).fill({ expected: 0, actual: 0 }),
      ...Array(3).fill({ expected: 0, actual: 1 }),
    ];
    const pcm = perClassMetrics(buildConfusionMatrix(inputs));
    const l0 = pcm.find((p) => p.level === 0)!;
    expect(l0.recall).toBe(0.7);
    expect(l0.precision).toBe(1); // nothing else was predicted as 0
    expect(l0.support).toBe(10);
  });

  test("level 3 precision drops when a benign item is wrongly flagged as serious", () => {
    const inputs = [
      { expected: 3, actual: 3 },
      { expected: 3, actual: 3 },
      { expected: 0, actual: 3 }, // over-classification into 3
    ];
    const pcm = perClassMetrics(buildConfusionMatrix(inputs));
    const l3 = pcm.find((p) => p.level === 3)!;
    // precision = TP / (TP + FP) = 2 / (2 + 1) = 0.6667
    expect(l3.precision).toBe(0.6667);
    expect(l3.recall).toBe(1); // every expected-3 was predicted 3
    expect(l3.support).toBe(2);
  });

  test("level with zero predictions and zero support · metrics are 0 not NaN", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 0, actual: 0 },
    ]);
    const pcm = perClassMetrics(m);
    const l3 = pcm.find((p) => p.level === 3)!;
    expect(l3.precision).toBe(0);
    expect(l3.recall).toBe(0);
    expect(l3.f1).toBe(0);
    expect(l3.support).toBe(0);
  });

  test("F1 computed as 2*P*R/(P+R)", () => {
    // 2 TP, 1 FP, 1 FN · P = 2/3, R = 2/3 · F1 = 2/3
    const inputs = [
      { expected: 2, actual: 2 },
      { expected: 2, actual: 2 },
      { expected: 2, actual: 1 }, // FN for level 2
      { expected: 1, actual: 2 }, // FP for level 2
    ];
    const pcm = perClassMetrics(buildConfusionMatrix(inputs));
    const l2 = pcm.find((p) => p.level === 2)!;
    expect(l2.precision).toBe(0.6667);
    expect(l2.recall).toBe(0.6667);
    expect(l2.f1).toBe(0.6667);
  });
});

describe("overallAccuracy", () => {
  test("perfect run · 1", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 1, actual: 1 },
      { expected: 2, actual: 2 },
    ]);
    expect(overallAccuracy(m)).toBe(1);
  });

  test("half right, half wrong · 0.5", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 0, actual: 1 },
      { expected: 2, actual: 2 },
      { expected: 3, actual: 2 },
    ]);
    expect(overallAccuracy(m)).toBe(0.5);
  });

  test("empty matrix · 0", () => {
    expect(overallAccuracy(buildConfusionMatrix([]))).toBe(0);
  });
});

describe("falsePositiveRateOnBenign", () => {
  test("every benign kept benign · 0", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 0, actual: 0 },
      { expected: 0, actual: 0 },
    ]);
    expect(falsePositiveRateOnBenign(m)).toBe(0);
  });

  test("half of benign escalated · 0.5", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 0, actual: 0 },
      { expected: 0, actual: 1 },
      { expected: 0, actual: 2 },
    ]);
    expect(falsePositiveRateOnBenign(m)).toBe(0.5);
  });

  test("ignores non-benign rows entirely", () => {
    const m = buildConfusionMatrix([
      { expected: 3, actual: 0 }, // dangerous but not benign-FP
    ]);
    expect(falsePositiveRateOnBenign(m)).toBe(0);
  });
});

describe("falseNegativeRateOnSerious", () => {
  test("every serious caught · 0", () => {
    const m = buildConfusionMatrix([
      { expected: 3, actual: 3 },
      { expected: 3, actual: 3 },
    ]);
    expect(falseNegativeRateOnSerious(m)).toBe(0);
  });

  test("one of two serious items missed · 0.5", () => {
    const m = buildConfusionMatrix([
      { expected: 3, actual: 3 },
      { expected: 3, actual: 2 },
    ]);
    expect(falseNegativeRateOnSerious(m)).toBe(0.5);
  });

  test("misclassified as 0 counts as a false negative", () => {
    const m = buildConfusionMatrix([
      { expected: 3, actual: 0 },
    ]);
    expect(falseNegativeRateOnSerious(m)).toBe(1);
  });

  test("ignores non-serious rows entirely", () => {
    const m = buildConfusionMatrix([
      { expected: 0, actual: 0 },
      { expected: 2, actual: 1 },
    ]);
    expect(falseNegativeRateOnSerious(m)).toBe(0);
  });
});
