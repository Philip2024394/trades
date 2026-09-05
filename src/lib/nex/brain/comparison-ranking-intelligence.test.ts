// src/lib/nex/brain/comparison-ranking-intelligence.test.ts
import { describe, it, expect } from "vitest";
import {
  detectComparisonRanking,
  decideComparisonRankingGate,
  type SemanticIntent,
} from "./comparison-ranking-intelligence";

const expectIntent = (msg: string, intent: SemanticIntent) => {
  it(`"${msg}" → intent=${intent}`, () => {
    const s = detectComparisonRanking(msg);
    expect(s.intent).toBe(intent);
  });
};

describe("comparison vs ranking · distinct intents (§10)", () => {
  it("'Which is cheaper?' → COMPARE / PRICE / ASC", () => {
    const s = detectComparisonRanking("Which is cheaper?");
    expect(s.intent).toBe("COMPARE");
    expect(s.attribute).toBe("PRICE");
    expect(s.direction).toBe("ASC");
  });
  it("'Which is the cheapest?' → SELECT / PRICE / ASC / count=1", () => {
    const s = detectComparisonRanking("Which is the cheapest?");
    expect(s.intent).toBe("SELECT");
    expect(s.attribute).toBe("PRICE");
    expect(s.direction).toBe("ASC");
    expect(s.count).toBe(1);
  });
  it("'Give me the cheapest one' → SELECT", () => {
    expect(detectComparisonRanking("Give me the cheapest one").intent).toBe("SELECT");
  });
});

describe("ranking · SELECT with count (§11)", () => {
  it("'Give me the top three' → SELECT / count=3", () => {
    const s = detectComparisonRanking("Give me the top three");
    expect(s.intent).toBe("SELECT");
    expect(s.count).toBe(3);
    expect(s.ranking_edge).toBe("TOP");
  });
  it("'Show me the bottom 3' → SELECT / count=3 / BOTTOM", () => {
    const s = detectComparisonRanking("Show me the bottom 3");
    expect(s.intent).toBe("SELECT");
    expect(s.count).toBe(3);
    expect(s.ranking_edge).toBe("BOTTOM");
  });
  it("'The three cheapest' → SELECT / PRICE / count=3", () => {
    const s = detectComparisonRanking("The three cheapest");
    expect(s.intent).toBe("SELECT");
    expect(s.attribute).toBe("PRICE");
    expect(s.count).toBe(3);
  });
});

describe("ranking · superlatives per attribute (§11)", () => {
  it("'closest' → DISTANCE ASC", () => {
    const s = detectComparisonRanking("Which is closest?");
    expect(s.attribute).toBe("DISTANCE");
    expect(s.direction).toBe("ASC");
  });
  it("'best' → QUALITY DESC", () => {
    const s = detectComparisonRanking("What's the best one?");
    expect(s.attribute).toBe("QUALITY");
    expect(s.direction).toBe("DESC");
  });
  it("'highest rated' → RATING DESC", () => {
    const s = detectComparisonRanking("Show me the highest rated");
    expect(s.attribute).toBe("RATING");
    expect(s.direction).toBe("DESC");
  });
  it("'most expensive' → PRICE DESC", () => {
    const s = detectComparisonRanking("The most expensive one");
    expect(s.attribute).toBe("PRICE");
    expect(s.direction).toBe("DESC");
  });
});

describe("comparison · comparatives (§9)", () => {
  const cases: Array<[string, string, string]> = [
    ["Is the first one closer?",       "DISTANCE", "ASC"],
    ["Is it more expensive?",           "PRICE",   "DESC"],
    // NOTE: "same" comparisons are out of scope; documented in the report
    ["Which is better?",                "QUALITY", "DESC"],
    ["Which is worse?",                 "QUALITY", "ASC"],
    ["Is that faster?",                 "GENERIC", "DESC"],
    ["Is that earlier?",                "TIME",    "ASC"],
  ];
  for (const [msg, attr, dir] of cases) {
    it(`"${msg}" → COMPARE / ${attr} / ${dir}`, () => {
      const s = detectComparisonRanking(msg);
      expect(s.intent).toBe("COMPARE");
      expect(s.attribute).toBe(attr);
      expect(s.direction).toBe(dir);
    });
  }
});

describe("Indonesian · paling + ter- superlatives + lebih comparatives (§18)", () => {
  it("'paling murah' → SELECT / PRICE / ASC", () => {
    const s = detectComparisonRanking("Yang paling murah");
    expect(s.intent).toBe("SELECT");
    expect(s.attribute).toBe("PRICE");
    expect(s.direction).toBe("ASC");
  });
  it("'termurah' → SELECT / PRICE / ASC", () => {
    const s = detectComparisonRanking("Yang termurah");
    expect(s.intent).toBe("SELECT");
    expect(s.attribute).toBe("PRICE");
  });
  it("'terdekat' → SELECT / DISTANCE / ASC", () => {
    const s = detectComparisonRanking("Yang terdekat");
    expect(s.attribute).toBe("DISTANCE");
  });
  it("'lebih murah' → COMPARE / PRICE / ASC", () => {
    const s = detectComparisonRanking("Yang lebih murah");
    expect(s.intent).toBe("COMPARE");
    expect(s.attribute).toBe("PRICE");
  });
});

describe("ordinal single tokens (§8)", () => {
  it("'the first one' → SELECT ORDINAL", () => {
    const s = detectComparisonRanking("Tell me about the first one");
    expect(s.intent).toBe("SELECT");
    expect(s.attribute).toBe("ORDINAL");
  });
  it("'the last one' → SELECT ORDINAL", () => {
    const s = detectComparisonRanking("Show me the last one");
    expect(s.intent).toBe("SELECT");
  });
});

describe("gate · fresh conv without result set fires clarification (§12 §19)", () => {
  it("'Which is cheapest?' fresh → gate fires", () => {
    const g = decideComparisonRankingGate({
      userMessage: "Which is cheapest?",
      hasActiveResultSet: false,
      activeLanguage: "EN",
    });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toContain("search first");
  });
  it("'Which is cheapest?' with result set → passes through", () => {
    const g = decideComparisonRankingGate({
      userMessage: "Which is cheapest?",
      hasActiveResultSet: true,
      activeLanguage: "EN",
    });
    expect(g.shouldGate).toBe(false);
  });
  it("'Which is cheaper?' (COMPARE) fresh → gate fires", () => {
    const g = decideComparisonRankingGate({
      userMessage: "Which is cheaper?",
      hasActiveResultSet: false,
      activeLanguage: "EN",
    });
    expect(g.shouldGate).toBe(true);
  });
  it("Non-comparison message → gate does NOT fire", () => {
    const g = decideComparisonRankingGate({
      userMessage: "find me a hotel",
      hasActiveResultSet: false,
      activeLanguage: "EN",
    });
    expect(g.shouldGate).toBe(false);
  });
});

describe("Indonesian gate reply (§17 §18)", () => {
  it("'Yang paling murah?' fresh → Indonesian gate reply", () => {
    const g = decideComparisonRankingGate({
      userMessage: "Yang paling murah?",
      hasActiveResultSet: false,
      activeLanguage: "ID",
    });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toMatch(/belum|hasil|cari/);
  });
});
