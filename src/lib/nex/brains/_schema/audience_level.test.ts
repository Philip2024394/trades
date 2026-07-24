import { describe, expect, it } from "vitest";
import { AUDIENCE_LEVEL_LABELS, AudienceLevelSchema, FactSchema, RuleSchema, PlaybookSchema } from "./common";

describe("AudienceLevelSchema", () => {
  it("accepts levels 1 through 5", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(AudienceLevelSchema.safeParse(n).success).toBe(true);
    }
  });

  it("rejects out-of-range values", () => {
    for (const n of [0, 6, 3.5, -1, "3"]) {
      expect(AudienceLevelSchema.safeParse(n).success).toBe(false);
    }
  });

  it("labels every level", () => {
    expect(AUDIENCE_LEVEL_LABELS[1]).toBe("Homeowner");
    expect(AUDIENCE_LEVEL_LABELS[5]).toBe("Expert / Manufacturer");
  });
});

describe("audience_level is optional on module items", () => {
  const evidence = [{ source: "test" }];

  it("Fact validates without audience_level", () => {
    expect(FactSchema.safeParse({
      id: "f1", statement: "s", evidence, confidence: "medium"
    }).success).toBe(true);
  });

  it("Fact validates with audience_level", () => {
    expect(FactSchema.safeParse({
      id: "f1", statement: "s", evidence, confidence: "medium", audience_level: 1
    }).success).toBe(true);
  });

  it("Rule validates with audience_level 4", () => {
    expect(RuleSchema.safeParse({
      id: "r1", applies_when: {}, then: "do X", evidence: [], confidence: "high", audience_level: 4
    }).success).toBe(true);
  });

  it("Playbook validates with audience_level 3", () => {
    expect(PlaybookSchema.safeParse({
      id: "pb1", title: "T",
      steps: [{ order: 0, action: "step 1" }],
      evidence: [], confidence: "medium", audience_level: 3
    }).success).toBe(true);
  });

  it("Rule rejects audience_level 7 (out of range)", () => {
    expect(RuleSchema.safeParse({
      id: "r1", applies_when: {}, then: "do X", evidence: [], confidence: "high", audience_level: 7
    }).success).toBe(false);
  });
});
