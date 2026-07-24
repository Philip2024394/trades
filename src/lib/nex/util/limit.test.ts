// Result-limit resolver tests.

import { describe, it, expect } from "vitest";
import { DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT, opportunitySlot, padToLimit, resolveResultLimit } from "./limit";

describe("resolveResultLimit", () => {
  it("defaults to 3 when no number in the ask", () => {
    expect(resolveResultLimit("find me a bricklayer")).toBe(DEFAULT_RESULT_LIMIT);
    expect(resolveResultLimit("compare suppliers")).toBe(3);
  });

  it("respects 'show me N' / 'top N' / 'first N'", () => {
    expect(resolveResultLimit("show me 5 bricklayers")).toBe(5);
    expect(resolveResultLimit("top 10 suppliers")).toBe(10);
    expect(resolveResultLimit("first 7 properties")).toBe(7);
  });

  it("clamps to MAX_RESULT_LIMIT", () => {
    expect(resolveResultLimit("top 500 suppliers")).toBe(MAX_RESULT_LIMIT);
  });

  it("ignores zero / negative / malformed", () => {
    expect(resolveResultLimit("show me 0 suppliers")).toBe(3);
    expect(resolveResultLimit("find me lots of trades")).toBe(3);
  });
});

describe("padToLimit + opportunitySlot", () => {
  it("keeps all matches when >= limit and slices to limit", () => {
    const out = padToLimit(["a", "b", "c", "d"], 3, "trade");
    expect(out).toEqual(["a", "b", "c"]);
  });

  it("pads with opportunity slots when < limit", () => {
    const out = padToLimit(["a"], 3, "trade");
    expect(out.length).toBe(3);
    expect(out[0]).toBe("a");
    expect(out[1]).toContain("(no more matches)");
    expect(out[2]).toContain("(no more matches)");
  });

  it("opportunity text differs per kind", () => {
    expect(opportunitySlot("trade")).toContain("List your trade");
    expect(opportunitySlot("product").toLowerCase()).toContain("product");
    expect(opportunitySlot("property").toLowerCase()).toContain("propert");
  });
});
