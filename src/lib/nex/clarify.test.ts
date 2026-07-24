// Clarification helper — asks for more when the prompt is thin.

import { describe, it, expect } from "vitest";
import { assessAnswerPrompt, assessResearchPrompt, assessUnknownPrompt } from "./clarify";

describe("assessAnswerPrompt", () => {
  it("returns clarify for very short input", () => {
    const c = assessAnswerPrompt("VAT");
    expect(c).not.toBeNull();
    expect(c!.speak).toContain("accurate information");
  });

  it("returns clarify for empty input", () => {
    const c = assessAnswerPrompt("");
    expect(c).not.toBeNull();
  });

  it("returns null for a real question", () => {
    expect(assessAnswerPrompt("what is the VAT threshold in the UK")).toBeNull();
  });
});

describe("assessResearchPrompt", () => {
  it("clarifies when topic is one word", () => {
    const c = assessResearchPrompt("stairs");
    expect(c).not.toBeNull();
    expect(c!.speak.toLowerCase()).toContain("research");
  });

  it("clarifies when topic is only two words", () => {
    const c = assessResearchPrompt("uk stairs");
    expect(c).not.toBeNull();
  });

  it("returns null for a proper topic", () => {
    expect(assessResearchPrompt("UK domestic staircase max rise regulations")).toBeNull();
  });

  it("suggestion list scaffolds a better prompt", () => {
    const c = assessResearchPrompt("stairs")!;
    expect(c.suggestions?.length).toBeGreaterThan(0);
    expect(c.suggestions?.some((s) => s.toLowerCase().includes("stairs"))).toBe(true);
  });
});

describe("assessUnknownPrompt", () => {
  it("always returns a reply, never null", () => {
    const c = assessUnknownPrompt("banana pancakes");
    expect(c).toBeDefined();
    expect(c.speak).toContain("accurate answer");
  });

  it("echoes the merchant's words when given", () => {
    const c = assessUnknownPrompt("build a nuclear reactor");
    expect(c.speak).toContain("build a nuclear reactor");
  });

  it("handles empty input", () => {
    const c = assessUnknownPrompt("");
    expect(c.speak).toContain("Tell me what you're trying to get done");
  });

  it("suggestions offer four sensible next moves", () => {
    const c = assessUnknownPrompt("");
    expect(c.suggestions?.length).toBe(4);
  });
});
