import { describe, it, expect } from "vitest";
import { classifyIdentity } from "./classify";
import { registerToAudienceLevel } from "./types";

describe("classifyIdentity", () => {
  it("respects explicit self-identification 'I'm the joiner'", () => {
    const r = classifyIdentity("I'm the joiner, need CNC files for a straight flight staircase");
    expect(r.register).toBe("joiner");
    expect(r.confidence).toBeGreaterThan(0.95);
    expect(r.needs_clarification).toBe(false);
  });

  it("classifies architect from planning + regs vocabulary", () => {
    const r = classifyIdentity("I need to check the specification against Approved Doc K for building control");
    expect(r.register).toBe("architect");
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it("classifies business_owner from 'my cake business'", () => {
    const r = classifyIdentity("I own a cake business and want to build my customers");
    expect(r.register).toBe("business_owner");
  });

  it("classifies homeowner_novice from consumer language", () => {
    const r = classifyIdentity("we want to renovate our home but no idea where to start");
    expect(r.register).toBe("homeowner_novice");
  });

  it("returns needs_clarification=true for ambiguous input", () => {
    const r = classifyIdentity("hi");
    expect(r.needs_clarification).toBe(true);
    expect(r.confidence).toBeLessThan(0.7);
  });

  it("handles empty input safely", () => {
    const r = classifyIdentity("");
    expect(r.confidence).toBe(0);
    expect(r.needs_clarification).toBe(true);
  });

  it("registerToAudienceLevel maps correctly", () => {
    expect(registerToAudienceLevel("homeowner_novice")).toBe(1);
    expect(registerToAudienceLevel("homeowner_informed")).toBe(2);
    expect(registerToAudienceLevel("joiner")).toBe(3);
    expect(registerToAudienceLevel("architect")).toBe(3);
  });
});
