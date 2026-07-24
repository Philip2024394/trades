// Basket parser — pure function tests.

import { describe, it, expect } from "vitest";
import { parseBasketRequest } from "./basket";

describe("parseBasketRequest", () => {
  it("recognises explicit qty + material ('120 concrete blocks')", () => {
    const p = parseBasketRequest("120 concrete blocks");
    expect(p.keyword).toBe("concrete block");
    expect(p.qty).toBe(120);
    expect(p.unit).toBe("each");
    expect(p.parsed_confidence).toBe("high");
  });

  it("recognises material with no qty as low confidence", () => {
    const p = parseBasketRequest("find me some plasterboard");
    expect(p.keyword).toBe("plasterboard");
    expect(p.qty).toBeNull();
    expect(p.parsed_confidence).toBe("low");
  });

  it("recognises area form + material ('plasterboard for 42m² of ceiling')", () => {
    const p = parseBasketRequest("plasterboard for 42m² of ceiling");
    expect(p.keyword).toBe("plasterboard");
    expect(p.qty).toBeNull();
    expect(p.hint_area_m2).toBe(42);
    expect(p.parsed_confidence).toBe("medium");
  });

  it("recognises bricks / timber / paint aliases", () => {
    expect(parseBasketRequest("500 bricks").keyword).toBe("brick");
    expect(parseBasketRequest("50m of timber").keyword).toBe("timber");
    expect(parseBasketRequest("6 paint tins").keyword).toBe("paint");
  });

  it("unknown material — falls back to low confidence + verbatim keyword", () => {
    const p = parseBasketRequest("2 widgets");
    expect(p.parsed_confidence).toBe("low");
    expect(p.qty).toBe(2);
    expect(p.parse_reason.toLowerCase()).toContain("couldn't recognise");
  });

  it("empty string → low confidence with no qty", () => {
    const p = parseBasketRequest("");
    expect(p.parsed_confidence).toBe("low");
    expect(p.qty).toBeNull();
  });
});
