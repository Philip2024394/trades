// Cache — deterministic key + expiry.

import { describe, it, expect, beforeEach } from "vitest";
import { _cacheSize, _clearCvCache, cacheKey, getCached, setCached } from "./cache";

beforeEach(() => _clearCvCache());

describe("cacheKey", () => {
  it("same inputs → same key", () => {
    expect(cacheKey("https://x", "analyze")).toBe(cacheKey("https://x", "analyze"));
  });

  it("different kinds → different key (avoid crosstalk)", () => {
    expect(cacheKey("https://x", "analyze")).not.toBe(cacheKey("https://x", "damage"));
  });

  it("context sort is order-independent", () => {
    expect(cacheKey("u", "k", { a: 1, b: 2 })).toBe(cacheKey("u", "k", { b: 2, a: 1 }));
  });

  it("array url is joined for the compare case", () => {
    expect(cacheKey(["a", "b"], "compare")).not.toBe(cacheKey(["b", "a"], "compare"));
  });
});

describe("getCached / setCached", () => {
  it("returns null when miss", () => {
    expect(getCached("miss")).toBeNull();
  });

  it("returns value when hit", () => {
    setCached("k1", { hello: "world" });
    expect(getCached("k1")).toEqual({ hello: "world" });
  });

  it("evicts + returns null past TTL", () => {
    const t0 = 1_000_000;
    setCached("k1", "x", t0);
    // 25h later
    expect(getCached("k1", t0 + 25 * 60 * 60 * 1000)).toBeNull();
    // eviction on read → size falls back to 0
    expect(_cacheSize()).toBe(0);
  });
});
