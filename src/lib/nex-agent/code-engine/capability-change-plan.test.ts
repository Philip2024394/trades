import { describe, it, expect } from "vitest";
import { buildChangePlan, CHANGE_PLAN_VERSION } from "./capability-change-plan";
import { generateChangeHypotheses } from "./capability-change-hypothesis-engine";

function stubHypothesis(over: Partial<Parameters<typeof generateChangeHypotheses>[0]> = {}) {
  const r = generateChangeHypotheses({
    specification_id: "spec_1",
    natural_language_request: "Change x",
    change_verb: "modify",
    candidate_targets: [{ file_path: "src/A.ts", symbol: "A", evidence_id: "ev1", confidence: 0.9 }],
    intended_behaviour_summary: "A modified",
    ...over,
  });
  return r.hypotheses[0];
}

describe("change plan · multi-file ordered plan (§11)", () => {
  it("builds a plan from a single-file hypothesis · complexity=trivial", () => {
    const hyp = stubHypothesis();
    const plan = buildChangePlan({ hypothesis: hyp });
    expect(plan.ordered_steps.length).toBe(1);
    expect(plan.complexity).toBe("trivial");
    expect(plan.affected_files).toEqual(["src/A.ts"]);
    expect(plan.validation_plan.some((v) => v.check_kind === "target_test")).toBe(true);
  });

  it("adds additional file targets with dependency ordering", () => {
    const hyp = stubHypothesis();
    const plan = buildChangePlan({
      hypothesis: hyp,
      additional_targets: [
        {
          file_path: "src/B.ts",
          symbol: null,
          operator: "update_import",
          rationale: "update B to import from renamed A",
          depends_on_primary: true,
        },
      ],
    });
    expect(plan.ordered_steps.length).toBe(2);
    expect(plan.ordered_steps[1].depends_on_step_ids.length).toBe(1);
    expect(plan.affected_files).toEqual(["src/A.ts", "src/B.ts"]);
  });

  it("multi-file plans include a regression check", () => {
    const hyp = stubHypothesis();
    const plan = buildChangePlan({
      hypothesis: hyp,
      additional_targets: [
        { file_path: "src/B.ts", symbol: null, operator: "update_import", rationale: "", depends_on_primary: true },
        { file_path: "src/C.ts", symbol: null, operator: "update_import", rationale: "", depends_on_primary: true },
      ],
    });
    expect(plan.validation_plan.some((v) => v.check_kind === "regression_test")).toBe(true);
    // 3 files · 3 steps · classified moderate
    expect(plan.complexity).toBe("moderate");
  });

  it("refactor hypothesis adds a semantic validation check", () => {
    const hyp = stubHypothesis({ change_verb: "refactor" });
    const plan = buildChangePlan({ hypothesis: hyp });
    expect(plan.validation_plan.some((v) => v.check_kind === "semantic")).toBe(true);
  });

  it("style/layout adds a runtime probe check", () => {
    const hyp = stubHypothesis({ change_verb: "style" });
    const plan = buildChangePlan({ hypothesis: hyp });
    expect(plan.validation_plan.some((v) => v.check_kind === "runtime_probe")).toBe(true);
  });

  it("every step has a rollback hint", () => {
    const hyp = stubHypothesis();
    const plan = buildChangePlan({ hypothesis: hyp });
    for (const step of plan.ordered_steps) {
      expect(step.rollback_hint).toBeTruthy();
    }
  });

  it("declares zero_llm=true and ledger=B", () => {
    const hyp = stubHypothesis();
    const plan = buildChangePlan({ hypothesis: hyp });
    expect(plan.zero_llm).toBe(true);
    expect(plan.ledger).toBe("B");
  });

  it("canonical version", () => {
    expect(CHANGE_PLAN_VERSION).toBe("change-plan.v1.2026-09-19");
  });

  it("complexity classification is deterministic", () => {
    // trivial: 1 step, 1 file
    const trivial = buildChangePlan({ hypothesis: stubHypothesis() });
    expect(trivial.complexity).toBe("trivial");
    // moderate: 4 steps across 3 files
    const moderate = buildChangePlan({
      hypothesis: stubHypothesis(),
      additional_targets: [
        { file_path: "src/B.ts", symbol: null, operator: "update_import", rationale: "", depends_on_primary: true },
        { file_path: "src/C.ts", symbol: null, operator: "update_import", rationale: "", depends_on_primary: true },
        { file_path: "src/D.ts", symbol: null, operator: "update_import", rationale: "", depends_on_primary: false },
      ],
    });
    expect(moderate.complexity).toBe("moderate");
  });
});
