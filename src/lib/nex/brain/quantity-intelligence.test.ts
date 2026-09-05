// src/lib/nex/brain/quantity-intelligence.test.ts
import { describe, it, expect } from "vitest";
import { detectQuantity, decideQuantityGate, type QuantityKind } from "./quantity-intelligence";

const expectKind = (msg: string, kind: QuantityKind, value?: number) => {
  it(`"${msg}" → ${kind}${value ? ` value=${value}` : ""}`, () => {
    const c = detectQuantity(msg);
    expect(c.kind).toBe(kind);
    if (value !== undefined) expect(c.value).toBe(value);
  });
};

describe("quantity · exact (§7)", () => {
  expectKind("show me two hotels", "EXACT", 2);
  expectKind("give me 3 restaurants", "EXACT", 3);
  expectKind("show me one place", "EXACT", 1);
  expectKind("tunjukkan dua hotel", "EXACT", 2);
});

describe("quantity · at_least / at_most / only (§7)", () => {
  expectKind("show me at least three", "AT_LEAST", 3);
  expectKind("no more than three", "AT_MOST", 3);
  expectKind("not more than 5", "AT_MOST", 5);
  expectKind("up to four", "AT_MOST", 4);
  expectKind("only two", "ONLY", 2);
  expectKind("just two", "ONLY", 2);
  expectKind("hanya dua", "ONLY", 2);
  expectKind("paling banyak tiga", "AT_MOST", 3);
  expectKind("tidak lebih dari dua", "AT_MOST", 2);
  expectKind("setidaknya lima", "AT_LEAST", 5);
});

describe("quantity · incremental / another (§7)", () => {
  expectKind("show me two more", "INCREMENTAL", 2);
  expectKind("two more please", "INCREMENTAL", 2);
  expectKind("another one", "INCREMENTAL", 1);
  expectKind("another two", "INCREMENTAL", 2);
  expectKind("dua lagi", "INCREMENTAL", 2);
});

describe("quantity · ordinal range (§7 §8)", () => {
  expectKind("show me the first two", "ORDINAL_RANGE", 2);
  expectKind("the last three", "ORDINAL_RANGE", 3);
  expectKind("dua pertama", "ORDINAL_RANGE", 2);
  expectKind("tiga terakhir", "ORDINAL_RANGE", 3);
});

describe("quantity · quantifiers", () => {
  expectKind("all of them", "ALL");
  expectKind("give me everything", "ALL");
  expectKind("semua", "ALL");
  expectKind("none of them", "NONE");
  expectKind("several hotels", "SEVERAL");
  expectKind("beberapa restoran", "SEVERAL");
  expectKind("many places", "MANY");
  expectKind("few options", "FEW");
});

describe("quantity · unspecified", () => {
  expectKind("find me hotels", "UNSPECIFIED");
  expectKind("carikan hotel", "UNSPECIFIED");
});

describe("quantity gate · fresh incremental without result set", () => {
  it("'two more' with no result set → gate fires clarification", () => {
    const g = decideQuantityGate({ userMessage: "two more please", hasActiveResultSet: false, activeLanguage: "EN" });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) {
      expect(g.reply.toLowerCase()).toContain("more of what");
      expect(g.reply.toLowerCase()).not.toContain("521 real listings");
    }
  });
  it("'two more' WITH result set → gate does NOT fire", () => {
    const g = decideQuantityGate({ userMessage: "two more please", hasActiveResultSet: true, activeLanguage: "EN" });
    expect(g.shouldGate).toBe(false);
  });
  it("'the first two' with no result set → gate fires", () => {
    const g = decideQuantityGate({ userMessage: "show me the first two", hasActiveResultSet: false, activeLanguage: "EN" });
    expect(g.shouldGate).toBe(true);
  });
  it("'show me two hotels' (EXACT) → gate does NOT fire even fresh", () => {
    const g = decideQuantityGate({ userMessage: "show me two hotels", hasActiveResultSet: false, activeLanguage: "EN" });
    expect(g.shouldGate).toBe(false);
  });
});
