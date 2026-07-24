// OPS answer router — classifier.

import { describe, it, expect } from "vitest";
import { classifyOpsQuestion } from "./answer";

describe("classifyOpsQuestion", () => {
  it("routes 'morning nex, what's today looking like?'", () => {
    expect(classifyOpsQuestion("morning nex, what's today looking like?").kind).toBe("morning_briefing");
  });
  it("routes 'good morning nex'", () => {
    expect(classifyOpsQuestion("good morning nex").kind).toBe("morning_briefing");
  });
  it("routes 'morning briefing'", () => {
    expect(classifyOpsQuestion("morning briefing").kind).toBe("morning_briefing");
  });
  it("routes 'run my business'", () => {
    expect(classifyOpsQuestion("run my business").kind).toBe("morning_briefing");
  });
  it("routes 'prepare today's work'", () => {
    expect(classifyOpsQuestion("prepare today's work").kind).toBe("morning_briefing");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyOpsQuestion("hello there").kind).toBe("none");
  });
});
