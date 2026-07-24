import { describe, expect, it } from "vitest";
import {
  FactSchema,
  KNOWLEDGE_CLASSIFICATION_LABELS,
  KnowledgeClassificationSchema,
  PlaybookSchema,
  RuleSchema
} from "./common";

const evidence = [{ source: "test" }];

describe("KnowledgeClassificationSchema", () => {
  it("accepts every classification", () => {
    for (const c of [
      "expert_observation", "repair_procedure", "diagnostic_procedure",
      "professional_recommendation", "industry_good_practice",
      "safety_advice", "manufacturer_guidance"
    ] as const) {
      expect(KnowledgeClassificationSchema.safeParse(c).success).toBe(true);
    }
  });

  it("rejects unknown classifications", () => {
    expect(KnowledgeClassificationSchema.safeParse("marketing_copy").success).toBe(false);
    expect(KnowledgeClassificationSchema.safeParse("").success).toBe(false);
  });

  it("labels every classification", () => {
    expect(KNOWLEDGE_CLASSIFICATION_LABELS.repair_procedure).toBe("Repair Procedure");
    expect(KNOWLEDGE_CLASSIFICATION_LABELS.safety_advice).toBe("Safety Advice");
  });
});

describe("classification + safety_note are optional on module items", () => {
  it("Fact validates without classification/safety_note (backwards compatible)", () => {
    expect(FactSchema.safeParse({
      id: "f1", statement: "s", evidence, confidence: "medium"
    }).success).toBe(true);
  });

  it("Fact validates with classification and safety_note", () => {
    expect(FactSchema.safeParse({
      id: "f1", statement: "s", evidence, confidence: "medium",
      classification: "repair_procedure",
      safety_note: "Structural damage should be assessed by a qualified staircase professional."
    }).success).toBe(true);
  });

  it("Rule validates with a safety_advice classification", () => {
    expect(RuleSchema.safeParse({
      id: "r1", applies_when: {}, then: "escalate to professional",
      evidence: [], confidence: "high",
      classification: "safety_advice"
    }).success).toBe(true);
  });

  it("Playbook validates with safety_note attached", () => {
    expect(PlaybookSchema.safeParse({
      id: "pb1", title: "Fix a loose tread from below",
      steps: [{ order: 0, action: "identify the wedge" }],
      evidence: [], confidence: "medium",
      classification: "repair_procedure",
      safety_note: "Work at height requires appropriate PPE."
    }).success).toBe(true);
  });

  it("rejects a malformed classification value", () => {
    expect(FactSchema.safeParse({
      id: "f1", statement: "s", evidence, confidence: "medium",
      classification: "not_a_class"
    }).success).toBe(false);
  });
});

describe("RiskLevel on Rule + Playbook", () => {
  it("Rule validates with risk_level medium", () => {
    expect(RuleSchema.safeParse({
      id: "r1", applies_when: {}, then: "repair from underneath",
      evidence: [], confidence: "medium",
      risk_level: "medium"
    }).success).toBe(true);
  });

  it("Playbook validates with risk_level high", () => {
    expect(PlaybookSchema.safeParse({
      id: "pb1", title: "Repair squeaking tread from below",
      steps: [{ order: 0, action: "identify movement" }],
      evidence: [], confidence: "high",
      classification: "repair_procedure",
      risk_level: "high"
    }).success).toBe(true);
  });

  it("rejects an invalid risk_level value", () => {
    expect(RuleSchema.safeParse({
      id: "r1", applies_when: {}, then: "a", evidence: [], confidence: "high",
      risk_level: "extreme"
    }).success).toBe(false);
  });
});
