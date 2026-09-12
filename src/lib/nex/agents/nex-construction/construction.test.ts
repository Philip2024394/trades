// src/lib/nex/agents/nex-construction/construction.test.ts
//
// WAVE-S-5 · Construction specialist contract tests · general + staircase-aware
// Founder BEGIN WAVE-S-5 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyConstructionRequest, detectConstructionSafetySignals, respondConstruction } from "./construction-gate";
import { CONSTRUCTION_CORPUS_V1, freezeConstructionCorpus } from "./corpus";
import { evaluateConstructionCorpus } from "./evaluator";

describe("§S5-CLASSIFY", () => {
  it("staircase_query · rise/going", () => expect(classifyConstructionRequest("what's the ideal rise and going for a staircase?")).toBe("staircase_query"));
  it("staircase_query · steps in a flight", () => expect(classifyConstructionRequest("how many steps in a flight of stairs?")).toBe("staircase_query"));
  it("staircase_query · helical stair", () => expect(classifyConstructionRequest("helical stair headroom")).toBe("staircase_query"));
  it("shared_wall_dispute · UK party wall", () => expect(classifyConstructionRequest("party wall notice needed?")).toBe("shared_wall_dispute"));
  it("shared_wall_dispute · US analog (dividing wall)", () => expect(classifyConstructionRequest("dividing wall between our properties")).toBe("shared_wall_dispute"));
  it("trade_licensing_boundary · Gas Safe UK", () => expect(classifyConstructionRequest("do I need Gas Safe registration for a boiler swap?")).toBe("trade_licensing_boundary"));
  it("trade_licensing_boundary · US master electrician", () => expect(classifyConstructionRequest("do I need a master electrician for this rewire?")).toBe("trade_licensing_boundary"));
  it("regulatory_check · UK Part L", () => expect(classifyConstructionRequest("Part L requirements for extensions")).toBe("regulatory_check"));
  it("regulatory_check · US IBC", () => expect(classifyConstructionRequest("IBC 2021 exit width requirements")).toBe("regulatory_check"));
  it("regulatory_check · AU AS/NZS", () => expect(classifyConstructionRequest("AS/NZS 3000 electrical wiring requirements")).toBe("regulatory_check"));
  it("safety_risk_assessment", () => expect(classifyConstructionRequest("risk assessment for working at height")).toBe("safety_risk_assessment"));
  it("material_quantity · UK m²", () => expect(classifyConstructionRequest("how many bricks per m² for a single-skin wall?")).toBe("material_quantity"));
  it("material_quantity · US sqft", () => expect(classifyConstructionRequest("how many bags per square feet for concrete?")).toBe("material_quantity"));
  it("structural_query", () => expect(classifyConstructionRequest("remove load bearing wall for open plan")).toBe("structural_query"));
  it("quotation_advice", () => expect(classifyConstructionRequest("give me a labor rate for framing")).toBe("quotation_advice"));
  it("unknown", () => expect(classifyConstructionRequest("hello")).toBe("unknown"));
});

describe("§S5-SAFETY", () => {
  it("asbestos flagged · pre-2000 build", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "pre-2000 build ceiling artex removal" }, "unknown");
    expect(sigs.some((s) => s.kind === "asbestos_risk")).toBe(true);
  });

  it("gas licensing flagged", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "install a new gas cooker" }, "unknown");
    expect(sigs.some((s) => s.kind === "gas_work_licensing_required")).toBe(true);
  });

  it("gas licensing description references multiple jurisdictions (general · not UK-only)", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "gas connection for a new hob" }, "unknown");
    const gasSignal = sigs.find((s) => s.kind === "gas_work_licensing_required");
    expect(gasSignal).toBeDefined();
    if (gasSignal && gasSignal.kind === "gas_work_licensing_required") {
      // Description mentions multiple jurisdictions (general specialist · not networkers-scoped)
      expect(gasSignal.description).toMatch(/UK|AU|US|ID/);
    }
  });

  it("electrical licensing flagged", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "add a new outdoor socket" }, "unknown");
    expect(sigs.some((s) => s.kind === "electrical_work_licensing_required")).toBe(true);
  });

  it("working-at-height flagged · roof solo", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "work on the roof by myself with a ladder" }, "unknown");
    expect(sigs.some((s) => s.kind === "working_at_height_risk")).toBe(true);
  });

  it("structural-load flagged · remove load bearing wall", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "remove a load bearing internal wall" }, "structural_query");
    expect(sigs.some((s) => s.kind === "structural_load_risk")).toBe(true);
  });

  it("regulatory-compliance flagged · Building Regs", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "Building Regulations for new build" }, "regulatory_check");
    expect(sigs.some((s) => s.kind === "regulatory_compliance_risk")).toBe(true);
  });

  it("shared-wall notice flagged · description mentions UK + analog frameworks", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "building against the neighbour's boundary wall" }, "shared_wall_dispute");
    const swSignal = sigs.find((s) => s.kind === "shared_wall_notice_required");
    expect(swSignal).toBeDefined();
    if (swSignal && swSignal.kind === "shared_wall_notice_required") {
      expect(swSignal.description).toContain("Party Wall");    // UK reference
      expect(swSignal.description).toMatch(/US|AU|EU/);         // analog jurisdictions
    }
  });

  it("unsupported-quantity flagged · £45 per m² guaranteed", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "guaranteed £45 per m² labour rate" }, "quotation_advice");
    expect(sigs.some((s) => s.kind === "unsupported_quantity_or_price")).toBe(true);
  });

  it("no concern · neutral method statement", () => {
    const sigs = detectConstructionSafetySignals({ request_id: "x", request_text: "method statement for installing raised access flooring" }, "safety_risk_assessment");
    expect(sigs.every((s) => s.kind === "no_construction_safety_concern")).toBe(true);
  });
});

describe("§S5-RESPOND", () => {
  it("staircase query defers to Phase 4 AND references dedicated staircase modules", () => {
    const r = respondConstruction({ request_id: "x", request_text: "ideal rise and going for a domestic staircase" });
    expect(r.detected_kind).toBe("staircase_query");
    expect(r.deferred_to_phase_4).toBe(true);
    expect(r.advisory_text).toContain("staircase-advisor");
    expect(r.advisory_text).toContain("staircase-geometry");
  });

  it("gas cooker triggers human review · does not defer", () => {
    const r = respondConstruction({ request_id: "x", request_text: "install a new gas cooker" });
    expect(r.requires_human_review).toBe(true);
    expect(r.deferred_to_phase_4).toBe(false);
    expect(r.advisory_text).toContain("gas");
  });

  it("advisory does not encourage unlicensed DIY gas/electrical work", () => {
    const r = respondConstruction({ request_id: "x", request_text: "install a new gas boiler DIY without a Gas Safe engineer" });
    expect(r.advisory_text).not.toMatch(/\bjust diy the gas\b/i);
    expect(r.advisory_text).not.toMatch(/\bno need for a (?:licensed|registered) (?:gas|electrician)\b/i);
  });

  it("advisory does not fabricate specific quantities/prices", () => {
    const r = respondConstruction({ request_id: "x", request_text: "how many bricks per m²?" });
    expect(r.advisory_text).not.toMatch(/exactly \d+ bricks/i);
    expect(r.advisory_text).not.toMatch(/guaranteed \d+ m[²2]/i);
  });

  it("jurisdiction context (US-CA) appears in gas licensing description when provided", () => {
    const r = respondConstruction({ request_id: "x", request_text: "install a new gas cooker", jurisdiction: "US-CA" });
    const gasSignal = r.safety_signals.find((s) => s.kind === "gas_work_licensing_required");
    expect(gasSignal).toBeDefined();
    if (gasSignal && gasSignal.kind === "gas_work_licensing_required") {
      expect(gasSignal.description).toContain("US-CA");
    }
  });
});

describe("§S5-CORPUS", () => {
  it("corpus is frozen + hash stable across re-invocations", () => {
    const a = freezeConstructionCorpus();
    const b = freezeConstructionCorpus();
    expect(a.content_hash).toBe(b.content_hash);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("corpus V1 has 12 cases", () => {
    expect(CONSTRUCTION_CORPUS_V1.cases.length).toBe(12);
  });

  it("corpus V1 evaluates 100% pass under deterministic gate", () => {
    const run = evaluateConstructionCorpus(CONSTRUCTION_CORPUS_V1);
    if (run.failed > 0) {
      const failedCases = run.results.filter((r) => !r.passed).map((r) => ({
        case_id: r.case_id,
        failed_checks: r.checks.filter((c) => !c.ok).map((c) => `${c.check}(${c.detail ?? "n/a"})`),
      }));
      console.error("FAILED CASES:", JSON.stringify(failedCases, null, 2));
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(CONSTRUCTION_CORPUS_V1.cases.length);
  });
});
