// Voice-check linter — catches character violations before they ship.

import { describe, it, expect } from "vitest";
import { voiceCheck, NEX_PERSONA_SYSTEM } from "./persona";

describe("voiceCheck — catches character violations", () => {
  it("passes clean tradesperson-natural copy", () => {
    expect(voiceCheck("Done. Van Wrap took 40s and cost £0.32. Want business cards to match?")).toEqual([]);
    expect(voiceCheck("I don't have that in my knowledge base yet. Want me to research it?")).toEqual([]);
    expect(voiceCheck("Nothing pending. All caught up.")).toEqual([]);
  });

  it("catches fake emotion", () => {
    expect(voiceCheck("I'm excited to help you with that!").length).toBeGreaterThan(0);
    expect(voiceCheck("I'm thrilled you asked.").length).toBeGreaterThan(0);
    expect(voiceCheck("I love helping trades succeed.").length).toBeGreaterThan(0);
  });

  it("catches AI self-reference", () => {
    expect(voiceCheck("As an AI, I can help you draft that.").length).toBeGreaterThan(0);
    expect(voiceCheck("I'm just an AI language model.").length).toBeGreaterThan(0);
    expect(voiceCheck("I'm an AI trained to help trades.").length).toBeGreaterThan(0);
  });

  it("catches overeager filler", () => {
    expect(voiceCheck("Certainly! I'll do that.").length).toBeGreaterThan(0);
    expect(voiceCheck("Absolutely! Let's build it.").length).toBeGreaterThan(0);
    expect(voiceCheck("I'd be happy to research that for you.").length).toBeGreaterThan(0);
    expect(voiceCheck("Great question! Let me explain.").length).toBeGreaterThan(0);
  });

  it("catches marketing sludge", () => {
    expect(voiceCheck("This revolutionary approach will delve into your workflow.").length).toBeGreaterThan(0);
    expect(voiceCheck("Seamlessly harness the power of AI.").length).toBeGreaterThan(0);
    expect(voiceCheck("Cutting-edge technology to empower your business.").length).toBeGreaterThan(0);
  });

  it("catches software jargon leaking to users", () => {
    expect(voiceCheck("Our compiler processed your prompt.").length).toBeGreaterThan(0);
    expect(voiceCheck("The LLM will handle this pipeline.").length).toBeGreaterThan(0);
  });

  it("catches em dashes (banned everywhere Philip reads output)", () => {
    expect(voiceCheck("Yes — that works.").length).toBeGreaterThan(0);
  });

  it("does NOT flag legitimate uses of 'token' outside jargon", () => {
    // Regex uses negative lookahead: 'token count' / 'token allowance' allowed.
    expect(voiceCheck("Your monthly token count is fine.")).toEqual([]);
  });

  it("reason strings are useful for debugging", () => {
    const v = voiceCheck("Certainly! I'm excited to help.");
    expect(v.length).toBe(2);
    const reasons = v.map((x) => x.reason);
    expect(reasons).toContain("overeager filler");
    expect(reasons).toContain("fake emotion");
  });
});

describe("NEX_PERSONA_SYSTEM", () => {
  it("mentions the 35-year construction anchor", () => {
    expect(NEX_PERSONA_SYSTEM).toContain("35 years");
    expect(NEX_PERSONA_SYSTEM.toLowerCase()).toContain("construction");
  });

  it("lists forbidden phrases explicitly", () => {
    expect(NEX_PERSONA_SYSTEM).toContain("excited");
    expect(NEX_PERSONA_SYSTEM).toContain("As an AI");
    expect(NEX_PERSONA_SYSTEM).toContain("Certainly");
  });

  it("carries the trust rules", () => {
    expect(NEX_PERSONA_SYSTEM).toContain("I couldn't verify");
    expect(NEX_PERSONA_SYSTEM).toContain("Never invent");
  });
});
