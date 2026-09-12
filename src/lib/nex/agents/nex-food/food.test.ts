// src/lib/nex/agents/nex-food/food.test.ts
//
// WAVE-S-4 · Food specialist contract tests
// Founder BEGIN WAVE-S-4 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyFoodRequest, detectFoodSafetySignals, respondFood } from "./food-gate";
import { FOOD_CORPUS_V1, freezeFoodCorpus } from "./corpus";
import { evaluateFoodCorpus } from "./evaluator";

describe("§S4-CLASSIFY", () => {
  it("recipe_help", () => expect(classifyFoodRequest("give me a beef stew recipe")).toBe("recipe_help"));
  it("food_safety", () => expect(classifyFoodRequest("is this raw chicken safe to eat?")).toBe("food_safety"));
  it("dietary_restriction · vegan", () => expect(classifyFoodRequest("vegan dinner ideas")).toBe("dietary_restriction"));
  it("dietary_restriction · gluten-free", () => expect(classifyFoodRequest("gluten-free pasta")).toBe("dietary_restriction"));
  it("allergen_check", () => expect(classifyFoodRequest("does this dish contain any allergen?")).toBe("allergen_check"));
  it("temperature_guidance", () => expect(classifyFoodRequest("what internal temperature for pork?")).toBe("temperature_guidance"));
  it("storage_shelf_life", () => expect(classifyFoodRequest("how long does cooked rice last in the fridge?")).toBe("storage_shelf_life"));
  it("cultural_practice · halal ramadan", () => expect(classifyFoodRequest("halal meal for ramadan")).toBe("cultural_practice"));
  it("hygiene_practice", () => expect(classifyFoodRequest("best practice for hand wash before cooking")).toBe("hygiene_practice"));
  it("medical-boundary short-circuits to unknown", () => expect(classifyFoodRequest("prescription meal plan for diabetes")).toBe("unknown"));
  it("unknown", () => expect(classifyFoodRequest("hi")).toBe("unknown"));
});

describe("§S4-SAFETY", () => {
  it("allergen present · peanut", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "dessert with peanut butter" }, "recipe_help");
    expect(sigs.some((s) => s.kind === "allergen_present")).toBe(true);
  });

  it("raw/undercooked risk · undercooked chicken", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "is undercooked chicken safe if marinated?" }, "food_safety");
    expect(sigs.some((s) => s.kind === "raw_undercooked_risk")).toBe(true);
  });

  it("medical dietary boundary · prescription meal plan", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "prescription meal plan for diabetes" }, "unknown");
    expect(sigs.some((s) => s.kind === "medical_dietary_boundary")).toBe(true);
  });

  it("unsupported health claim · cures cancer", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "superfood that cures cancer" }, "unknown");
    expect(sigs.some((s) => s.kind === "unsupported_health_claim")).toBe(true);
  });

  it("cross-contamination · same board raw + salad", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "same board for raw chicken then salad" }, "food_safety");
    expect(sigs.some((s) => s.kind === "cross_contamination_risk")).toBe(true);
  });

  it("temperature out of range · leave chicken out several hours", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "leave chicken out for several hours" }, "temperature_guidance");
    expect(sigs.some((s) => s.kind === "temperature_out_of_range")).toBe(true);
  });

  it("cultural religious awareness · halal ramadan", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "halal meal for ramadan" }, "cultural_practice");
    expect(sigs.some((s) => s.kind === "cultural_religious_awareness")).toBe(true);
  });

  it("no concern · neutral recipe", () => {
    const sigs = detectFoodSafetySignals({ request_id: "x", request_text: "simple beef stew recipe" }, "recipe_help");
    expect(sigs.every((s) => s.kind === "no_food_safety_concern")).toBe(true);
  });
});

describe("§S4-RESPOND", () => {
  it("neutral recipe defers to Phase 4 · no human review", () => {
    const r = respondFood({ request_id: "x", request_text: "simple beef stew recipe" });
    expect(r.detected_kind).toBe("recipe_help");
    expect(r.requires_human_review).toBe(false);
    expect(r.deferred_to_phase_4).toBe(true);
    expect(r.advisory_text.length).toBeGreaterThan(0);
  });

  it("medical-boundary triggers human review · does not defer", () => {
    const r = respondFood({ request_id: "x", request_text: "prescription meal plan for diabetes" });
    expect(r.detected_kind).toBe("unknown");
    expect(r.requires_human_review).toBe(true);
    expect(r.deferred_to_phase_4).toBe(false);
    expect(r.advisory_text).toContain("dietitian");
  });

  it("advisory never diagnoses or prescribes", () => {
    const r = respondFood({ request_id: "x", request_text: "prescription meal plan for diabetes" });
    expect(r.advisory_text).not.toMatch(/\bI diagnose\b/i);
    expect(r.advisory_text).not.toMatch(/\bprescribe\b/i);
    expect(r.advisory_text).not.toMatch(/\byou have (diabetes|cancer)\b/i);
  });

  it("advisory never asserts miracle-cure claims (health-claim flag surfaced as 'not supported')", () => {
    const r = respondFood({ request_id: "x", request_text: "superfood that cures cancer" });
    expect(r.advisory_text).toContain("not supported");
  });
});

describe("§S4-CORPUS", () => {
  it("corpus is frozen + hash stable across re-invocations", () => {
    const a = freezeFoodCorpus();
    const b = freezeFoodCorpus();
    expect(a.content_hash).toBe(b.content_hash);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("corpus V1 has all 12 cases", () => {
    expect(FOOD_CORPUS_V1.cases.length).toBe(12);
  });

  it("corpus V1 evaluates 100% pass under deterministic gate", () => {
    const run = evaluateFoodCorpus(FOOD_CORPUS_V1);
    if (run.failed > 0) {
      const failedCases = run.results.filter((r) => !r.passed).map((r) => ({
        case_id: r.case_id,
        failed_checks: r.checks.filter((c) => !c.ok).map((c) => `${c.check}(${c.detail ?? "n/a"})`),
      }));
      console.error("FAILED CASES:", JSON.stringify(failedCases, null, 2));
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(FOOD_CORPUS_V1.cases.length);
  });
});
