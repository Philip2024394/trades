// Matchmaker — parseMatchIntent pure function tests.

import { describe, it, expect } from "vitest";
import { parseMatchIntent } from "./matchmaker";

describe("parseMatchIntent", () => {
  it("finds a bricklayer", () => {
    const i = parseMatchIntent("find me a bricklayer near M25");
    expect(i?.trade).toBe("bricklayer");
    expect(i?.area).toBe("M25");
  });

  it("normalises aliases", () => {
    expect(parseMatchIntent("i need a brickie")?.trade).toBe("bricklayer");
    expect(parseMatchIntent("recommend a sparky")?.trade).toBe("electrician");
    expect(parseMatchIntent("find a chippy")?.trade).toBe("carpenter");
  });

  it("parses city area", () => {
    const i = parseMatchIntent("recommend a roofer in Manchester");
    expect(i?.trade).toBe("roofer");
    expect(i?.area).toBe("manchester");
  });

  it("parses urgency", () => {
    expect(parseMatchIntent("find a plumber today")?.urgency).toBe("today");
    expect(parseMatchIntent("recommend a scaffolder this week")?.urgency).toBe("this_week");
  });

  it("returns null when no trade word present", () => {
    expect(parseMatchIntent("find me someone to help")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(parseMatchIntent("")).toBeNull();
  });
});
