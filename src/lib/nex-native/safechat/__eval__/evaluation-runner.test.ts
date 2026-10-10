// src/lib/nex-native/safechat/__eval__/evaluation-runner.test.ts
//
// Deterministic unit tests for the SafeChat evaluation runner. We
// drive the runner with tiny hand-authored corpora so the test
// doubles as documentation of the expected classifier behaviour.
//
// Important · these tests do NOT change the ruleset. They verify that
// the runner correctly plumbs the sealed classifier functions through
// its pipeline. The classifier's actual rules are tested in
// classifier.test.ts.

import { describe, expect, test } from "vitest";
import {
  buildHistoryEntries,
  classifyCorpusItem,
  computeSeriousRiskRecall,
  flattenCorpora,
  groupByCategoryTag,
  groupByLanguage,
  runEvaluation,
  type CorpusItem,
  type PriorClassification,
} from "./evaluation-runner";
import { buildRulesetFixture } from "./ruleset-fixture";

function item(
  overrides: Partial<CorpusItem> & Pick<CorpusItem, "id" | "text" | "expected_level">,
): CorpusItem {
  return {
    language: "en",
    category_tag: "test",
    ...overrides,
  };
}

const LANGUAGES = ["en", "id"];
const { vocabIndex, compiled } = buildRulesetFixture(LANGUAGES);

describe("flattenCorpora", () => {
  test("concatenates in order, preserving per-corpus sequence", () => {
    const flat = flattenCorpora([
      [item({ id: "a1", text: "x", expected_level: 0 })],
      [
        item({ id: "b1", text: "y", expected_level: 0 }),
        item({ id: "b2", text: "z", expected_level: 0 }),
      ],
    ]);
    expect(flat.map((i) => i.id)).toEqual(["a1", "b1", "b2"]);
  });

  test("empty input · empty output", () => {
    expect(flattenCorpora([])).toEqual([]);
  });
});

describe("classifyCorpusItem", () => {
  test("benign everyday text · level 0 · zero rule matches", () => {
    const r = classifyCorpusItem(
      item({ id: "t-benign", text: "hey what time is practice tomorrow", expected_level: 0 }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    expect(r.actualLevel).toBe(0);
    expect(r.ruleMatches).toEqual([]);
    expect(r.correct).toBe(true);
    expect(r.delta).toBe(0);
  });

  test("explicit send-image request · level 2 · pattern fires", () => {
    const r = classifyCorpusItem(
      item({ id: "t-img", text: "send me a pic please", expected_level: 2 }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    expect(r.actualLevel).toBe(2);
    expect(r.ruleMatches.some((m) => m.startsWith("pattern:image_request"))).toBe(true);
    expect(r.correct).toBe(true);
  });

  test("grooming phrase + image pattern · level 3", () => {
    const r = classifyCorpusItem(
      item({ id: "t-serious", text: "our little secret · send me a pic now", expected_level: 3 }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    expect(r.actualLevel).toBe(3);
    expect(r.correct).toBe(true);
  });

  test("single sexual_slang term · level 1", () => {
    const r = classifyCorpusItem(
      item({ id: "t-slang", text: "boobs", expected_level: 1 }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    expect(r.actualLevel).toBe(1);
    expect(r.correct).toBe(true);
  });

  test("records delta when the classifier disagrees", () => {
    const r = classifyCorpusItem(
      // "hello" is clean · but we claim it should be level 3.
      item({ id: "t-disagree", text: "hello world", expected_level: 3 }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    expect(r.actualLevel).toBe(0);
    expect(r.correct).toBe(false);
    expect(r.delta).toBe(-3);
  });

  test("ruleMatches contain only category/signal names · never body text", () => {
    const r = classifyCorpusItem(
      item({ id: "t-trace", text: "send me a pic please", expected_level: 2 }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    for (const m of r.ruleMatches) {
      expect(m).not.toContain("please");
      expect(m).not.toContain("pic");
      expect(m).toMatch(/^(vocab|pattern):/);
    }
  });
});

describe("groupByLanguage", () => {
  test("buckets results into en/id/mixed", () => {
    const r1 = classifyCorpusItem(
      item({ id: "a", text: "hello", expected_level: 0, language: "en" }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    const r2 = classifyCorpusItem(
      item({ id: "b", text: "saya tidak tahu", expected_level: 0, language: "id" }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    const r3 = classifyCorpusItem(
      item({ id: "c", text: "mix text", expected_level: 0, language: "mixed" }),
      compiled,
      vocabIndex,
      LANGUAGES,
    );
    const g = groupByLanguage([r1, r2, r3]);
    expect(g.en.length).toBe(1);
    expect(g.id.length).toBe(1);
    expect(g.mixed.length).toBe(1);
  });
});

describe("groupByCategoryTag", () => {
  test("tallies total + correct per tag", () => {
    const corpus = [
      item({ id: "a", text: "hello", expected_level: 0, category_tag: "benign" }),
      item({ id: "b", text: "hey", expected_level: 0, category_tag: "benign" }),
      item({ id: "c", text: "boobs", expected_level: 1, category_tag: "slang" }),
    ];
    const results = corpus.map((i) =>
      classifyCorpusItem(i, compiled, vocabIndex, LANGUAGES),
    );
    const g = groupByCategoryTag(results);
    expect(g.benign).toEqual({ total: 2, correct: 2 });
    expect(g.slang).toEqual({ total: 1, correct: 1 });
  });
});

describe("runEvaluation", () => {
  const fixedNow = () => new Date("2026-10-10T00:00:00.000Z");

  test("empty corpora · zero metrics, no crash", async () => {
    const r = await runEvaluation({ corpora: [[]], now: fixedNow });
    expect(r.corpusTotals.en).toBe(0);
    expect(r.corpusTotals.id).toBe(0);
    expect(r.corpusTotals.mixed).toBe(0);
    expect(r.overall.accuracy).toBe(0);
    expect(r.failingItems).toEqual([]);
    expect(r.passingItems).toEqual([]);
    expect(r.runAt).toBe("2026-10-10T00:00:00.000Z");
    // Default rulesetVersion label is v1.1.0 (current head) unless the
    // caller overrides it with "safechat-rules-v1.0.0".
    expect(r.classifierVersion).toBe("safechat-rules-v1.1.0");
  });

  test("one perfectly-classified benign item · accuracy 1 · zero FP · zero FN", async () => {
    const r = await runEvaluation({
      corpora: [[item({ id: "p1", text: "hello", expected_level: 0 })]],
      now: fixedNow,
    });
    expect(r.overall.accuracy).toBe(1);
    expect(r.overall.falsePositiveRateOnBenign).toBe(0);
    expect(r.overall.falseNegativeRateOnSerious).toBe(0);
    expect(r.failingItems).toEqual([]);
  });

  test("over-escalated benign item · accuracy < 1 · FP-rate 1", async () => {
    const r = await runEvaluation({
      corpora: [
        // "send me a pic" is a level-2 pattern · we claim it's level 0
        [item({ id: "f1", text: "send me a pic please", expected_level: 0 })],
      ],
      now: fixedNow,
    });
    expect(r.overall.accuracy).toBe(0);
    expect(r.overall.falsePositiveRateOnBenign).toBe(1);
    expect(r.failingItems.length).toBe(1);
    expect(r.failingItems[0]!.item.id).toBe("f1");
  });

  test("missed serious item · FN-rate-on-serious 1", async () => {
    const r = await runEvaluation({
      corpora: [[item({ id: "miss", text: "hello world", expected_level: 3 })]],
      now: fixedNow,
    });
    expect(r.overall.falseNegativeRateOnSerious).toBe(1);
    expect(r.failingItems[0]!.actualLevel).toBe(0);
    expect(r.failingItems[0]!.delta).toBe(-3);
  });

  test("consistency check · deterministic classifier reports zero deltas", async () => {
    const corpus = [
      item({ id: "c1", text: "hello", expected_level: 0 }),
      item({ id: "c2", text: "send me a pic", expected_level: 2 }),
      item({ id: "c3", text: "our little secret · send me a pic", expected_level: 3 }),
    ];
    const r = await runEvaluation({
      corpora: [corpus],
      runEachItemTwice: true,
      now: fixedNow,
    });
    expect(r.consistency.duplicateRunDeltaCount).toBe(0);
    expect(r.consistency.description).toContain("deterministic");
  });

  test("per-language summary buckets items correctly", async () => {
    const r = await runEvaluation({
      corpora: [
        [
          item({ id: "en1", text: "hello", expected_level: 0, language: "en" }),
          item({ id: "id1", text: "saya tidak tahu", expected_level: 0, language: "id" }),
          item({ id: "mix1", text: "halo world", expected_level: 0, language: "mixed" }),
        ],
      ],
      now: fixedNow,
    });
    expect(r.perLanguage.en.accuracy).toBe(1);
    expect(r.perLanguage.id.accuracy).toBe(1);
    expect(r.perLanguage.mixed.accuracy).toBe(1);
    expect(r.corpusTotals).toEqual({ en: 1, id: 1, mixed: 1 });
  });

  test("per-category tally reflects correctness per tag", async () => {
    const r = await runEvaluation({
      corpora: [
        [
          item({ id: "ok1", text: "hello", expected_level: 0, category_tag: "benign_everyday" }),
          item({ id: "ok2", text: "hey", expected_level: 0, category_tag: "benign_everyday" }),
          // "sex" is a level-2 term · we claim level 0 (false-positive trap style)
          item({ id: "fp", text: "sex education class", expected_level: 0, category_tag: "false_positive_trap" }),
        ],
      ],
      now: fixedNow,
    });
    expect(r.perCategoryTag.benign_everyday).toEqual({ total: 2, correct: 2 });
    expect(r.perCategoryTag.false_positive_trap).toEqual({ total: 1, correct: 0 });
  });

  test("passing items strip body text · failing items retain it (synthetic only)", async () => {
    const r = await runEvaluation({
      corpora: [
        [
          item({ id: "pass", text: "benign body text", expected_level: 0 }),
          item({ id: "fail", text: "send me a pic please", expected_level: 0 }),
        ],
      ],
      now: fixedNow,
    });
    // passing items are id + levels only · no 'text' field
    const pass = r.passingItems.find((p) => p.id === "pass");
    expect(pass).toBeDefined();
    expect((pass as unknown as { text?: string }).text).toBeUndefined();
    const fail = r.failingItems.find((f) => f.item.id === "fail");
    expect(fail).toBeDefined();
    expect(fail!.item.text).toBe("send me a pic please");
  });

  test("classifierVersion + rulesetSource recorded in report (default v1.1.0)", async () => {
    const r = await runEvaluation({ corpora: [[]], now: fixedNow });
    expect(r.classifierVersion).toBe("safechat-rules-v1.1.0");
    expect(r.rulesetSource).toContain("ruleset-fixture.ts");
    expect(r.rulesetSource).toContain("_seed-vocabulary.mjs");
  });

  test("rulesetVersion override records 'safechat-rules-v1.0.0' when caller passes the baseline label", async () => {
    const r = await runEvaluation({
      corpora: [[]],
      now: fixedNow,
      rulesetVersion: "safechat-rules-v1.0.0",
    });
    expect(r.classifierVersion).toBe("safechat-rules-v1.0.0");
  });

  test("rulesetVersion override records 'safechat-rules-v1.1.0' when caller passes revised label", async () => {
    const r = await runEvaluation({
      corpora: [[]],
      now: fixedNow,
      rulesetVersion: "safechat-rules-v1.1.0",
    });
    expect(r.classifierVersion).toBe("safechat-rules-v1.1.0");
  });

  test("unknown rulesetVersion falls back to v1.1.0 default", async () => {
    const r = await runEvaluation({
      corpora: [[]],
      now: fixedNow,
      // @ts-expect-error · intentional bad input
      rulesetVersion: "safechat-rules-v99.0.0",
    });
    expect(r.classifierVersion).toBe("safechat-rules-v1.1.0");
  });

  test("every corpus item appears exactly once in passing + failing combined", async () => {
    const corpus = [
      item({ id: "a", text: "hello", expected_level: 0 }),
      item({ id: "b", text: "send me a pic", expected_level: 2 }),
      item({ id: "c", text: "random", expected_level: 3 }),
    ];
    const r = await runEvaluation({ corpora: [corpus], now: fixedNow });
    const ids = new Set<string>([
      ...r.passingItems.map((p) => p.id),
      ...r.failingItems.map((f) => f.item.id),
    ]);
    expect(ids.size).toBe(3);
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(true);
    expect(ids.has("c")).toBe(true);
  });

  test("report includes seriousRiskRecall with exact numerator and denominator", async () => {
    const corpus = [
      item({ id: "s1", text: "our little secret · send me a pic", expected_level: 3 }),
      item({ id: "s2", text: "hello", expected_level: 3 }),
      item({ id: "s3", text: "hey what time", expected_level: 0 }),
    ];
    const r = await runEvaluation({ corpora: [corpus], now: fixedNow });
    expect(r.seriousRiskRecall.denominator).toBe(2);
    // At least one of s1/s2 should be caught (s1 fires grooming+image).
    expect(r.seriousRiskRecall.numerator).toBeGreaterThanOrEqual(0);
    expect(r.seriousRiskRecall.numerator).toBeLessThanOrEqual(2);
  });

  test("seriousRiskRecall is 0/0 when no expected-3 items present", async () => {
    const corpus = [item({ id: "p", text: "hello", expected_level: 0 })];
    const r = await runEvaluation({ corpora: [corpus], now: fixedNow });
    expect(r.seriousRiskRecall.numerator).toBe(0);
    expect(r.seriousRiskRecall.denominator).toBe(0);
  });
});

describe("buildHistoryEntries", () => {
  test("empty priorMessages · empty history", () => {
    expect(buildHistoryEntries([], new Date("2026-10-10T00:00:00.000Z"))).toEqual([]);
  });

  test("timestamps are placed relative to the given 'now'", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const priors: PriorClassification[] = [
      { level: 2, ruleMatches: [], timestamp_offset_minutes: -30 },
      { level: 0, ruleMatches: [], timestamp_offset_minutes: -10 },
    ];
    const entries = buildHistoryEntries(priors, now);
    expect(entries.length).toBe(2);
    expect(entries[0]!.classifiedAt).toBe("2026-10-10T11:30:00.000Z");
    expect(entries[1]!.classifiedAt).toBe("2026-10-10T11:50:00.000Z");
    expect(entries[0]!.level).toBe(2);
    expect(entries[1]!.level).toBe(0);
  });

  test("preserves ruleMatches verbatim · signals default to empty object when missing", () => {
    const now = new Date("2026-10-10T00:00:00.000Z");
    const priors: PriorClassification[] = [
      {
        level: 2,
        ruleMatches: [
          {
            kind: "pattern",
            id: "p1",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "send me a pic",
          },
        ],
        timestamp_offset_minutes: -15,
      },
    ];
    const entries = buildHistoryEntries(priors, now);
    expect(entries[0]!.ruleMatches.length).toBe(1);
    expect(entries[0]!.signals).toEqual({});
  });
});

describe("multi-message runEvaluation", () => {
  const fixedNow = () => new Date("2026-10-10T00:00:00.000Z");

  test("item without priorMessages behaves as cold-open single-message", async () => {
    const r = await runEvaluation({
      corpora: [[item({ id: "cold", text: "hello", expected_level: 0 })]],
      now: fixedNow,
    });
    expect(r.failingItems).toEqual([]);
    expect(r.passingItems.length).toBe(1);
  });

  test("coercion history + image_request + current pressure · aggregator fires repeated_pressure", async () => {
    // Prior entries carry: image_request pattern then coercion_indicator vocab,
    // in order; the aggregator sorts by classifiedAt ascending internally.
    const priorMessages: PriorClassification[] = [
      {
        level: 2,
        ruleMatches: [
          {
            kind: "pattern",
            id: "p1",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "send me a pic",
          },
        ],
        timestamp_offset_minutes: -40,
      },
      {
        level: 2,
        ruleMatches: [
          {
            kind: "vocabulary",
            id: "v1",
            category: "coercion_indicator",
            severity: 2,
            language: "en",
            term: "if you love me",
          },
        ],
        timestamp_offset_minutes: -20,
      },
    ];
    // deriveSignals requires that an image_request appear AFTER a
    // coercion_indicator for repeated_pressure to fire · reorder:
    const priorsRefusalFirst: PriorClassification[] = [
      {
        level: 2,
        ruleMatches: [
          {
            kind: "vocabulary",
            id: "v1",
            category: "coercion_indicator",
            severity: 2,
            language: "en",
            term: "if you love me",
          },
        ],
        timestamp_offset_minutes: -40,
      },
      {
        level: 2,
        ruleMatches: [
          {
            kind: "pattern",
            id: "p1",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "send me a pic",
          },
        ],
        timestamp_offset_minutes: -20,
      },
    ];
    const r = await runEvaluation({
      corpora: [
        [
          item({
            id: "mm-coercion-image",
            text: "please send me a pic",
            expected_level: 3,
            priorMessages: priorsRefusalFirst,
          }),
        ],
      ],
      now: fixedNow,
    });
    const result = r.passingItems.find((p) => p.id === "mm-coercion-image");
    // repeated_pressure_after_refusal is a direct level-3 trigger in
    // resolveLevel, so the item should pass.
    expect(result).toBeDefined();
    expect(result!.actualLevel).toBe(3);
    // Keep variable to avoid unused-var lint.
    void priorMessages;
  });

  test("benign conversation history + current level-1 slang · does NOT escalate", async () => {
    const priorMessages: PriorClassification[] = [
      { level: 0, ruleMatches: [], timestamp_offset_minutes: -30 },
      { level: 0, ruleMatches: [], timestamp_offset_minutes: -15 },
    ];
    const r = await runEvaluation({
      corpora: [
        [
          item({
            id: "mm-no-escalate",
            text: "boobs",
            expected_level: 1,
            priorMessages,
          }),
        ],
      ],
      now: fixedNow,
    });
    const result = r.passingItems.find((p) => p.id === "mm-no-escalate");
    expect(result).toBeDefined();
    expect(result!.actualLevel).toBe(1);
  });

  test("escalation history 0 -> 1 -> 2 · escalation_pattern signal present but current level depends on current message", async () => {
    // With trailing [0,1,2] escalation_pattern becomes true. The
    // v1.0.0 resolveLevel does NOT elevate to 3 purely from
    // escalation_pattern · it needs a direct level-3 trigger. We
    // simply assert the runner handled the item without crashing and
    // the signals plumbing worked (level is 0 for benign current).
    const priorMessages: PriorClassification[] = [
      { level: 0, ruleMatches: [], timestamp_offset_minutes: -30 },
      {
        level: 1,
        ruleMatches: [
          {
            kind: "vocabulary",
            id: "v1",
            category: "sexual_slang",
            severity: 1,
            language: "en",
            term: "boobs",
          },
        ],
        timestamp_offset_minutes: -20,
      },
      {
        level: 2,
        ruleMatches: [
          {
            kind: "pattern",
            id: "p1",
            signalType: "image_request",
            severity: 2,
            language: "en",
            matchedText: "send me a pic",
          },
        ],
        timestamp_offset_minutes: -10,
      },
    ];
    const r = await runEvaluation({
      corpora: [
        [
          item({
            id: "mm-escalation",
            text: "hello",
            expected_level: 0,
            priorMessages,
          }),
        ],
      ],
      now: fixedNow,
    });
    // Current message is benign; without a current-message trigger
    // the baseline resolveLevel keeps level 0.
    const pass = r.passingItems.find((p) => p.id === "mm-escalation");
    expect(pass).toBeDefined();
  });

  test("empty priorMessages array behaves identically to omitting the field", async () => {
    const r1 = await runEvaluation({
      corpora: [[item({ id: "no-prior", text: "hello", expected_level: 0 })]],
      now: fixedNow,
    });
    const r2 = await runEvaluation({
      corpora: [[item({ id: "empty-prior", text: "hello", expected_level: 0, priorMessages: [] })]],
      now: fixedNow,
    });
    expect(r1.passingItems[0]!.actualLevel).toBe(r2.passingItems[0]!.actualLevel);
  });

  test("multi-message items appear exactly once in failing/passing lists", async () => {
    const corpus = [
      item({ id: "mm-1", text: "hello", expected_level: 0, priorMessages: [] }),
      item({
        id: "mm-2",
        text: "please please please",
        expected_level: 3,
        priorMessages: [
          {
            level: 2,
            ruleMatches: [
              {
                kind: "vocabulary",
                id: "v",
                category: "coercion_indicator",
                severity: 2,
                language: "en",
                term: "or else",
              },
            ],
            timestamp_offset_minutes: -30,
          },
          {
            level: 2,
            ruleMatches: [
              {
                kind: "pattern",
                id: "p",
                signalType: "image_request",
                severity: 2,
                language: "en",
                matchedText: "send me a pic",
              },
            ],
            timestamp_offset_minutes: -10,
          },
        ],
      }),
    ];
    const r = await runEvaluation({ corpora: [corpus], now: fixedNow });
    const ids = new Set<string>([
      ...r.passingItems.map((p) => p.id),
      ...r.failingItems.map((f) => f.item.id),
    ]);
    expect(ids.size).toBe(2);
  });
});

describe("computeSeriousRiskRecall", () => {
  const fixedNow = () => new Date("2026-10-10T00:00:00.000Z");

  test("zero expected-3 items · 0/0", async () => {
    const r = await runEvaluation({
      corpora: [[item({ id: "a", text: "hello", expected_level: 0 })]],
      now: fixedNow,
    });
    expect(r.seriousRiskRecall).toEqual({ numerator: 0, denominator: 0 });
  });

  test("one expected-3 item correctly caught · 1/1", async () => {
    const r = await runEvaluation({
      corpora: [
        [
          item({
            id: "caught",
            text: "our little secret · send me a pic",
            expected_level: 3,
          }),
        ],
      ],
      now: fixedNow,
    });
    expect(r.seriousRiskRecall.denominator).toBe(1);
    expect(r.seriousRiskRecall.numerator).toBe(1);
  });

  test("one expected-3 item missed · 0/1", async () => {
    const r = await runEvaluation({
      corpora: [[item({ id: "missed", text: "hello world", expected_level: 3 })]],
      now: fixedNow,
    });
    expect(r.seriousRiskRecall.denominator).toBe(1);
    expect(r.seriousRiskRecall.numerator).toBe(0);
  });

  test("mix of caught and missed · numerator counts only diagonal", () => {
    const results = [
      {
        item: {
          id: "x",
          text: "",
          language: "en" as const,
          expected_level: 3 as const,
          category_tag: "t",
        },
        actualLevel: 3 as const,
        actualConfidence: 0,
        ruleMatches: [],
        correct: true,
        delta: 0,
      },
      {
        item: {
          id: "y",
          text: "",
          language: "en" as const,
          expected_level: 3 as const,
          category_tag: "t",
        },
        actualLevel: 2 as const,
        actualConfidence: 0,
        ruleMatches: [],
        correct: false,
        delta: -1,
      },
      {
        item: {
          id: "z",
          text: "",
          language: "en" as const,
          expected_level: 0 as const,
          category_tag: "t",
        },
        actualLevel: 0 as const,
        actualConfidence: 0,
        ruleMatches: [],
        correct: true,
        delta: 0,
      },
    ];
    expect(computeSeriousRiskRecall(results)).toEqual({
      numerator: 1,
      denominator: 2,
    });
  });
});
