// src/lib/nex/agents/nex-vision/vision.test.ts
//
// WAVE-S-1 · Vision specialist contract tests
// Founder BEGIN WAVE-S-1 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyRequestKind, assessConfidenceBand, detectSafetySignals, respondVision } from "./vision-gate";
import { VISION_CORPUS_V1, freezeVisionCorpus } from "./corpus";
import { evaluateVisionCorpus, evaluateVisionCase } from "./evaluator";

// ═══════════════════════════════════════════════════════════════════
// § CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

describe("§S1-CLASSIFY · request kind detection", () => {
  it("understanding", () => expect(classifyRequestKind("what is in this image?")).toBe("understanding"));
  it("ocr", () => expect(classifyRequestKind("extract text from this image")).toBe("ocr"));
  it("classification", () => expect(classifyRequestKind("categorize this image")).toBe("classification"));
  it("safety_check", () => expect(classifyRequestKind("is this image safe?")).toBe("safety_check"));
  it("modification", () => expect(classifyRequestKind("change the material from oak to walnut")).toBe("modification"));
  it("generation", () => expect(classifyRequestKind("generate a banner version")).toBe("generation"));
  it("provenance", () => expect(classifyRequestKind("where did this image come from?")).toBe("provenance"));
  it("unknown", () => expect(classifyRequestKind("hi")).toBe("unknown"));
});

// ═══════════════════════════════════════════════════════════════════
// § CONFIDENCE BAND
// ═══════════════════════════════════════════════════════════════════

describe("§S1-CONFIDENCE · ADR-0028 <85% flags human", () => {
  it("no image → unknown", () => expect(assessConfidenceBand("understanding", false, false)).toBe("unknown"));
  it("understanding with image → flag_human (needs real model)", () => expect(assessConfidenceBand("understanding", true, true)).toBe("flag_human"));
  it("safety_check with known manifest → good", () => expect(assessConfidenceBand("safety_check", true, true)).toBe("good"));
  it("provenance with known manifest → good", () => expect(assessConfidenceBand("provenance", true, true)).toBe("good"));
});

// ═══════════════════════════════════════════════════════════════════
// § SAFETY SIGNALS
// ═══════════════════════════════════════════════════════════════════

describe("§S1-SAFETY · ADR-0028 rules 11/13/14", () => {
  it("modification with 'redesign' triggers geometry_violation_risk (Rule 13)", () => {
    const sigs = detectSafetySignals(
      { request_id: "x", request_text: "redesign this staircase with a different layout", image_reference: "x" },
      "modification",
    );
    expect(sigs.some((s) => s.kind === "geometry_violation_risk")).toBe(true);
  });

  it("simple material swap does NOT trigger geometry violation", () => {
    const sigs = detectSafetySignals(
      { request_id: "x", request_text: "change material to walnut", image_reference: "x", image_metadata: { known_manifest_entry: true } },
      "modification",
    );
    expect(sigs.some((s) => s.kind === "geometry_violation_risk")).toBe(false);
  });

  it("image without manifest entry triggers provenance_missing (Rule 14)", () => {
    const sigs = detectSafetySignals(
      { request_id: "x", request_text: "identify", image_reference: "/tmp/x.jpg", image_metadata: { known_manifest_entry: false } },
      "understanding",
    );
    expect(sigs.some((s) => s.kind === "provenance_missing")).toBe(true);
  });

  it("generation without image_type triggers generation_beyond_permission (Rule 11)", () => {
    const sigs = detectSafetySignals(
      { request_id: "x", request_text: "generate a banner", image_reference: "x", image_metadata: { known_manifest_entry: true } },
      "generation",
    );
    expect(sigs.some((s) => s.kind === "generation_beyond_permission")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § END-TO-END RESPONSE
// ═══════════════════════════════════════════════════════════════════

describe("§S1-RESPOND · deterministic response composition", () => {
  it("understanding request always defers to Phase 4", () => {
    const r = respondVision({ request_id: "r", request_text: "what is in this image?", image_reference: "x", image_metadata: { known_manifest_entry: true } });
    expect(r.deferred_to_phase_4).toBe(true);
    expect(r.requires_human_review).toBe(true);
  });

  it("safety_check on known manifest is answerable in Phase 3", () => {
    const r = respondVision({ request_id: "r", request_text: "is this safe?", image_reference: "x", image_metadata: { known_manifest_entry: true, image_type: "hero_image", collection: "marketing" } });
    expect(r.deferred_to_phase_4).toBe(false);
    expect(r.confidence_band).toBe("good");
  });

  it("advisory text always non-empty · never fabricates", () => {
    const r = respondVision({ request_id: "r", request_text: "hi" });
    expect(r.advisory_text.length).toBeGreaterThan(0);
    expect(r.advisory_text.includes("[FABRICATED]")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § CORPUS + EVALUATOR
// ═══════════════════════════════════════════════════════════════════

describe("§S1-CORPUS · frozen · deterministic · evaluator", () => {
  it("VISION_CORPUS_V1 has 8 cases + content_hash", () => {
    expect(VISION_CORPUS_V1.cases.length).toBe(8);
    expect(VISION_CORPUS_V1.content_hash).toMatch(/^[a-f0-9]{24}$/);
  });

  it("corpus is frozen (immutable)", () => {
    expect(Object.isFrozen(VISION_CORPUS_V1)).toBe(true);
    expect(Object.isFrozen(VISION_CORPUS_V1.cases)).toBe(true);
  });

  it("freeze is deterministic · same hash across freezes", () => {
    const a = freezeVisionCorpus();
    const b = freezeVisionCorpus();
    expect(a.content_hash).toBe(b.content_hash);
  });

  it("all 8 cases pass evaluator", () => {
    const r = evaluateVisionCorpus(VISION_CORPUS_V1);
    expect(r.total).toBe(8);
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(0);
  });

  it("evaluateVisionCase reports check-by-check details", () => {
    const c = VISION_CORPUS_V1.cases[0];
    const r = evaluateVisionCase(c);
    expect(r.checks.length).toBeGreaterThan(0);
    expect(r.actual).toBeDefined();
  });
});
