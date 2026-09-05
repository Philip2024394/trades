// src/lib/nex/brain/implicit-constraints.test.ts
import { describe, it, expect } from "vitest";
import { detectImplicitConstraints } from "./implicit-constraints";

describe("implicit · comparative implicits (§9)", () => {
  it("'somewhere quieter' → CROWDING / LOW", () => {
    const d = detectImplicitConstraints("somewhere quieter");
    expect(d.constraints.some((c) => c.attribute === "CROWDING" && c.direction === "LOW")).toBe(true);
  });
  it("'cheaper' → PRICE / LOW", () => {
    const d = detectImplicitConstraints("cheaper");
    expect(d.constraints[0].attribute).toBe("PRICE");
    expect(d.constraints[0].direction).toBe("LOW");
  });
  it("'somewhere closer' → DISTANCE / LOW", () => {
    const d = detectImplicitConstraints("somewhere closer");
    expect(d.constraints.some((c) => c.attribute === "DISTANCE" && c.direction === "LOW")).toBe(true);
  });
  it("'something better' → QUALITY / HIGH", () => {
    const d = detectImplicitConstraints("something better");
    expect(d.constraints.some((c) => c.attribute === "QUALITY" && c.direction === "HIGH")).toBe(true);
  });
});

describe("implicit · positive adjectives (§9)", () => {
  it("'central' → CENTRALITY / SEEK", () => {
    const d = detectImplicitConstraints("somewhere central");
    expect(d.constraints.some((c) => c.attribute === "CENTRALITY" && c.direction === "SEEK")).toBe(true);
  });
  it("'quiet' → CROWDING / LOW", () => {
    const d = detectImplicitConstraints("somewhere quiet");
    expect(d.constraints.some((c) => c.attribute === "CROWDING" && c.direction === "LOW")).toBe(true);
  });
  it("'cheap' → PRICE / LOW", () => {
    const d = detectImplicitConstraints("somewhere cheap");
    expect(d.constraints.some((c) => c.attribute === "PRICE" && c.direction === "LOW")).toBe(true);
  });
  it("'nice' → QUALITY / SEEK", () => {
    const d = detectImplicitConstraints("somewhere nice");
    expect(d.constraints.some((c) => c.attribute === "QUALITY" && c.direction === "SEEK")).toBe(true);
  });
});

describe("implicit · avoidance ('not too', 'nothing') (§9)", () => {
  it("'not too expensive' → PRICE / AVOID", () => {
    const d = detectImplicitConstraints("not too expensive");
    expect(d.constraints.some((c) => c.attribute === "PRICE" && c.direction === "AVOID")).toBe(true);
    expect(d.constraints[0].hedged).toBe(true);
  });
  it("'nothing too expensive' → PRICE / AVOID", () => {
    const d = detectImplicitConstraints("nothing too expensive");
    expect(d.constraints.some((c) => c.attribute === "PRICE" && c.direction === "AVOID")).toBe(true);
  });
  it("'not too far' → DISTANCE / AVOID", () => {
    const d = detectImplicitConstraints("not too far");
    expect(d.constraints.some((c) => c.attribute === "DISTANCE" && c.direction === "AVOID")).toBe(true);
  });
  it("'not touristy' → TOURISM / AVOID", () => {
    const d = detectImplicitConstraints("I don't want somewhere touristy");
    expect(d.constraints.some((c) => c.attribute === "TOURISM" && c.direction === "AVOID")).toBe(true);
  });
});

describe("implicit · multiple constraints (§16)", () => {
  it("'central, quiet and not too expensive' → 3 constraints", () => {
    const d = detectImplicitConstraints("somewhere central quiet and not too expensive");
    const attrs = d.constraints.map((c) => `${c.attribute}:${c.direction}`);
    expect(attrs).toContain("CENTRALITY:SEEK");
    expect(attrs).toContain("CROWDING:LOW");
    expect(attrs).toContain("PRICE:AVOID");
  });
});

describe("implicit · Indonesian (§20 §16)", () => {
  it("'yang lebih murah' → PRICE / LOW", () => {
    const d = detectImplicitConstraints("yang lebih murah");
    // "murah" ID / "cheaper" not detected because comparative rule uses EN "cheaper"
    // — but bare "murah" is in IMPLICIT_ID_MAP · LOW direction
    expect(d.constraints.some((c) => c.attribute === "PRICE" && c.direction === "LOW")).toBe(true);
  });
  it("'jangan terlalu mahal' → PRICE / AVOID", () => {
    const d = detectImplicitConstraints("jangan terlalu mahal");
    expect(d.constraints.some((c) => c.attribute === "PRICE" && c.direction === "AVOID")).toBe(true);
  });
  it("'tempat yang tenang' → CROWDING / LOW", () => {
    const d = detectImplicitConstraints("tempat yang tenang");
    expect(d.constraints.some((c) => c.attribute === "CROWDING" && c.direction === "LOW")).toBe(true);
  });
});

describe("implicit · NO fabrication (§10)", () => {
  it("no numeric threshold introduced anywhere", () => {
    const d = detectImplicitConstraints("somewhere cheap");
    for (const c of d.constraints) {
      const asAny = c as unknown as Record<string, unknown>;
      // No fields like "threshold" · "value" · "price_max"
      expect(asAny.threshold).toBeUndefined();
      expect(asAny.value).toBeUndefined();
      expect(asAny.price_max).toBeUndefined();
      // Direction is a symbolic label · not a number
      expect(typeof c.direction).toBe("string");
    }
  });
});

describe("implicit · no constraints for plain requests", () => {
  it("'find me a hotel' → 0 constraints", () => {
    expect(detectImplicitConstraints("find me a hotel").constraints.length).toBe(0);
  });
});
