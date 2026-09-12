// src/lib/nex/agents/nex-healthcare/healthcare.test.ts
//
// WAVE-S-6 · Healthcare specialist contract tests
// Founder BEGIN WAVE-S-6 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyHealthcareRequest, detectHealthcareSafetySignals, respondHealthcare } from "./healthcare-gate";
import { HEALTHCARE_CORPUS_V1, freezeHealthcareCorpus } from "./corpus";
import { evaluateHealthcareCorpus } from "./evaluator";

describe("§S6-CLASSIFY", () => {
  it("emergency · chest pain radiating", () => expect(classifyHealthcareRequest("crushing chest pain radiating to my arm")).toBe("emergency_query"));
  it("emergency · not breathing", () => expect(classifyHealthcareRequest("someone cannot breathe")).toBe("emergency_query"));
  it("mental crisis · end my life", () => expect(classifyHealthcareRequest("I want to end my life")).toBe("mental_health_query"));
  it("mental non-crisis · anxiety therapy", () => expect(classifyHealthcareRequest("what therapy options exist for anxiety")).toBe("mental_health_query"));
  it("prescription request", () => expect(classifyHealthcareRequest("please prescribe me antibiotics")).toBe("prescription_request"));
  it("medication interaction", () => expect(classifyHealthcareRequest("safe to take ibuprofen with my blood pressure medication?")).toBe("medication_interaction"));
  it("pediatric", () => expect(classifyHealthcareRequest("my toddler has a fever of 39C")).toBe("pediatric_query"));
  it("pregnancy", () => expect(classifyHealthcareRequest("second trimester of pregnancy and folate")).toBe("pregnancy_query"));
  it("medication question", () => expect(classifyHealthcareRequest("paracetamol dose for adult")).toBe("medication_question"));
  it("symptom query", () => expect(classifyHealthcareRequest("persistent headache and nausea for three days what could it be")).toBe("symptom_query"));
  it("wellness lifestyle", () => expect(classifyHealthcareRequest("good sleep hygiene habits for adult")).toBe("wellness_lifestyle"));
  it("public health info", () => expect(classifyHealthcareRequest("flu jab programme this year")).toBe("public_health_info"));
  it("unknown", () => expect(classifyHealthcareRequest("hello")).toBe("unknown"));
});

describe("§S6-SAFETY", () => {
  it("emergency routes with 999 for UK", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "crushing chest pain in the UK", jurisdiction: "UK" }, "emergency_query");
    const em = sigs.find((s) => s.kind === "emergency_route");
    expect(em).toBeDefined();
    if (em && em.kind === "emergency_route") expect(em.regime_hint).toContain("999");
  });

  it("emergency routes with 911 for US", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "someone is not breathing", jurisdiction: "US" }, "emergency_query");
    const em = sigs.find((s) => s.kind === "emergency_route");
    expect(em).toBeDefined();
    if (em && em.kind === "emergency_route") expect(em.regime_hint).toContain("911");
  });

  it("mental crisis routes with 988 for US", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "I want to kill myself", jurisdiction: "US" }, "mental_health_query");
    const mc = sigs.find((s) => s.kind === "mental_health_crisis_route");
    expect(mc).toBeDefined();
    if (mc && mc.kind === "mental_health_crisis_route") expect(mc.regime_hint).toContain("988");
  });

  it("mental crisis routes with Samaritans 116 123 for UK", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "I want to end my life", jurisdiction: "UK" }, "mental_health_query");
    const mc = sigs.find((s) => s.kind === "mental_health_crisis_route");
    expect(mc).toBeDefined();
    if (mc && mc.kind === "mental_health_crisis_route") expect(mc.regime_hint).toContain("116 123");
  });

  it("symptom query triggers medical diagnosis boundary", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "persistent headache and nausea" }, "symptom_query");
    expect(sigs.some((s) => s.kind === "medical_diagnosis_boundary")).toBe(true);
  });

  it("prescription request triggers prescription boundary", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "prescribe me antibiotics" }, "prescription_request");
    expect(sigs.some((s) => s.kind === "medical_prescription_boundary")).toBe(true);
  });

  it("medication interaction triggers pharmacist referral", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "ibuprofen with blood pressure medication" }, "medication_interaction");
    expect(sigs.some((s) => s.kind === "medication_interaction_pharmacist_referral")).toBe(true);
  });

  it("pregnancy triggers pregnancy medical boundary", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "second trimester of pregnancy" }, "pregnancy_query");
    expect(sigs.some((s) => s.kind === "pregnancy_medical_boundary")).toBe(true);
  });

  it("pediatric triggers pediatric medical boundary", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "toddler has a fever" }, "pediatric_query");
    expect(sigs.some((s) => s.kind === "pediatric_medical_boundary")).toBe(true);
  });

  it("unsupported cure claim triggers unsupported_medical_claim", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "superfood that cures cancer" }, "unknown");
    expect(sigs.some((s) => s.kind === "unsupported_medical_claim")).toBe(true);
  });

  it("wellness lifestyle has no safety concern", () => {
    const sigs = detectHealthcareSafetySignals({ request_id: "x", request_text: "sleep hygiene habits" }, "wellness_lifestyle");
    expect(sigs.every((s) => s.kind === "no_healthcare_safety_concern")).toBe(true);
  });
});

describe("§S6-RESPOND · strict discipline", () => {
  it("emergency advisory contains route number + never diagnoses", () => {
    const r = respondHealthcare({ request_id: "x", request_text: "crushing chest pain", jurisdiction: "UK" });
    expect(r.advisory_text).toContain("999");
    expect(r.advisory_text).not.toMatch(/\byou (?:definitely )?have (?:heart attack|stroke)\b/i);
  });

  it("mental-crisis advisory contains crisis route + supportive language", () => {
    const r = respondHealthcare({ request_id: "x", request_text: "want to end my life", jurisdiction: "US" });
    expect(r.advisory_text).toContain("988");
    expect(r.advisory_text).toContain("not alone");
  });

  it("symptom advisory never diagnoses", () => {
    const r = respondHealthcare({ request_id: "x", request_text: "I have persistent headache and nausea" });
    expect(r.advisory_text).not.toMatch(/\byou (?:definitely )?have (?:migraine|meningitis)\b/i);
    expect(r.advisory_text).toMatch(/consult|clinician|GP|nurse/i);
  });

  it("prescription advisory never prescribes", () => {
    const r = respondHealthcare({ request_id: "x", request_text: "prescribe me amoxicillin 500mg" });
    expect(r.advisory_text).not.toMatch(/\btake \d+\s?mg\b/i);
    expect(r.advisory_text).not.toMatch(/\bI (?:prescribe|recommend you take) \d+\s?mg\b/i);
  });

  it("cure-claim advisory surfaces 'not supported' not the claim as fact", () => {
    const r = respondHealthcare({ request_id: "x", request_text: "superfood that cures cancer" });
    expect(r.advisory_text).toContain("not supported");
  });
});

describe("§S6-CORPUS", () => {
  it("corpus is frozen + hash stable across re-invocations", () => {
    const a = freezeHealthcareCorpus();
    const b = freezeHealthcareCorpus();
    expect(a.content_hash).toBe(b.content_hash);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("corpus V1 has 12 cases", () => {
    expect(HEALTHCARE_CORPUS_V1.cases.length).toBe(12);
  });

  it("corpus V1 evaluates 100% pass under deterministic gate", () => {
    const run = evaluateHealthcareCorpus(HEALTHCARE_CORPUS_V1);
    if (run.failed > 0) {
      const failedCases = run.results.filter((r) => !r.passed).map((r) => ({
        case_id: r.case_id,
        failed_checks: r.checks.filter((c) => !c.ok).map((c) => `${c.check}(${c.detail ?? "n/a"})`),
      }));
      console.error("FAILED CASES:", JSON.stringify(failedCases, null, 2));
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(HEALTHCARE_CORPUS_V1.cases.length);
  });
});
