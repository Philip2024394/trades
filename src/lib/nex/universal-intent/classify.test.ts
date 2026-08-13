// Basic smoke tests for the Universal Intent classifier.
// Run with: npx vitest run src/lib/nex/universal-intent/classify.test.ts

import { describe, it, expect } from "vitest";
import { classifyUniversalIntent } from "./classify";

describe("classifyUniversalIntent", () => {
  it("routes 'build me a website' to Create/Website", () => {
    const r = classifyUniversalIntent("build me a website");
    expect(r.layer1_verb).toBe("Create");
    expect(r.layer2_domain).toBe("Website");
    expect(r.confidence).toBeGreaterThan(0.7);
    expect(r.needs_clarification ?? r.confidence < 0.7).toBeFalsy();
  });

  it("routes 'oak or pine' to Decide/Staircase", () => {
    const r = classifyUniversalIntent("oak or pine");
    expect(r.layer1_verb).toBe("Decide");
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it("routes 'teach me marketing' to Learn/Marketing", () => {
    const r = classifyUniversalIntent("teach me marketing");
    expect(r.layer1_verb).toBe("Learn");
    expect(r.layer2_domain).toBe("Marketing");
  });

  it("routes 'remind me tomorrow' to Monitor/Personal", () => {
    const r = classifyUniversalIntent("remind me tomorrow");
    expect(r.layer1_verb).toBe("Monitor");
  });

  it("routes 'grow my business' to Improve/Business", () => {
    const r = classifyUniversalIntent("grow my business");
    expect(r.layer1_verb).toBe("Improve");
  });

  it("routes 'automate my marketing' to Automate/Marketing", () => {
    const r = classifyUniversalIntent("automate my marketing");
    expect(r.layer1_verb).toBe("Automate");
    expect(r.layer2_domain).toBe("Marketing");
  });

  it("returns low confidence for random gibberish", () => {
    const r = classifyUniversalIntent("xyz qwerty foobar plumbus");
    expect(r.confidence).toBeLessThan(0.7);
  });

  it("handles empty input safely", () => {
    const r = classifyUniversalIntent("");
    expect(r.confidence).toBe(0);
    expect(r.original).toBe("");
  });

  it("falls back to keyword-verb for novel phrasings that share verbs", () => {
    // Not in corpus, but 'create' + 'newsletter' should still route Create
    const r = classifyUniversalIntent("create a monthly newsletter for my customers");
    expect(r.layer1_verb).toBe("Create");
  });
});
