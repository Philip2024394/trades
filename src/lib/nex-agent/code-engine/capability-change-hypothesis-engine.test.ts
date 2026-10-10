import { describe, it, expect } from "vitest";
import {
  generateChangeHypotheses,
  CHANGE_HYPOTHESIS_ENGINE_VERSION,
  type ChangeHypothesisInput,
  type RepoFactRef,
} from "./capability-change-hypothesis-engine";

function ref(path: string, symbol: string | null, confidence: number): RepoFactRef {
  return { file_path: path, symbol, evidence_id: `ev_${path}`, confidence };
}

function baseInput(over: Partial<ChangeHypothesisInput> = {}): ChangeHypothesisInput {
  return {
    specification_id: "spec_1",
    natural_language_request: "Change the button colour to orange",
    change_verb: "modify",
    candidate_targets: [ref("src/Button.tsx", "Button", 0.9)],
    intended_behaviour_summary: "button rendered with orange color",
    ...over,
  };
}

describe("change hypothesis engine · Phase 3", () => {
  describe("basic hypothesis generation", () => {
    it("emits a primary hypothesis for a modify request with one candidate", () => {
      const r = generateChangeHypotheses(baseInput());
      expect(r.hypotheses.length).toBe(1);
      expect(r.hypotheses[0].is_primary).toBe(true);
      expect(r.hypotheses[0].target_files).toEqual(["src/Button.tsx"]);
      expect(r.hypotheses[0].proposed_changes.length).toBe(1);
    });

    it("emits up to 3 alternative hypotheses ordered by confidence", () => {
      const r = generateChangeHypotheses(baseInput({
        candidate_targets: [
          ref("src/A.tsx", "A", 0.4),
          ref("src/B.tsx", "B", 0.9),
          ref("src/C.tsx", "C", 0.7),
          ref("src/D.tsx", "D", 0.2),
        ],
      }));
      expect(r.hypotheses.length).toBe(3);
      expect(r.hypotheses[0].target_files).toEqual(["src/B.tsx"]);
      expect(r.hypotheses[1].target_files).toEqual(["src/C.tsx"]);
      expect(r.hypotheses[2].target_files).toEqual(["src/A.tsx"]);
      expect(r.hypotheses[0].is_primary).toBe(true);
      expect(r.hypotheses[1].is_primary).toBe(false);
    });

    it("each hypothesis lists the others as alternatives", () => {
      const r = generateChangeHypotheses(baseInput({
        candidate_targets: [
          ref("src/A.tsx", "A", 0.9),
          ref("src/B.tsx", "B", 0.7),
        ],
      }));
      expect(r.hypotheses[0].alternative_hypothesis_ids).toEqual([r.hypotheses[1].hypothesis_id]);
      expect(r.hypotheses[1].alternative_hypothesis_ids).toEqual([r.hypotheses[0].hypothesis_id]);
    });
  });

  describe("refusal cases", () => {
    it("refuses when no candidate targets and verb is not 'create'", () => {
      const r = generateChangeHypotheses(baseInput({ candidate_targets: [] }));
      expect(r.hypotheses.length).toBe(0);
      expect(r.refusal_reason).toContain("no_target_evidence_for_verb");
    });

    it("refuses when all candidates are in forbidden_paths", () => {
      const r = generateChangeHypotheses(baseInput({
        forbidden_paths: ["src/Button.tsx"],
      }));
      expect(r.hypotheses.length).toBe(0);
      expect(r.refusal_reason).toBe("all_candidate_targets_forbidden");
    });
  });

  describe("verb-specific operator selection (§4)", () => {
    it("modify + symbol → modify_return", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "modify" }));
      expect(r.hypotheses[0].proposed_changes[0].operator).toBe("modify_return");
    });

    it("style/layout → modify_component_prop_default", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "style" }));
      expect(r.hypotheses[0].proposed_changes[0].operator).toBe("modify_component_prop_default");
    });

    it("connect → update_import", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "connect" }));
      expect(r.hypotheses[0].proposed_changes[0].operator).toBe("update_import");
    });

    it("add_test → create_file", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "add_test" }));
      expect(r.hypotheses[0].proposed_changes[0].operator).toBe("create_file");
    });

    it("refactor → add_export", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "refactor" }));
      expect(r.hypotheses[0].proposed_changes[0].operator).toBe("add_export");
    });
  });

  describe("create verb path (no candidates required)", () => {
    it("creates a hypothesis with inferred path when no candidates present", () => {
      const r = generateChangeHypotheses({
        specification_id: "spec_2",
        natural_language_request: "Create a SearchBar component",
        change_verb: "create",
        candidate_targets: [],
        intended_behaviour_summary: "SearchBar renders",
      });
      expect(r.hypotheses.length).toBe(1);
      expect(r.hypotheses[0].proposed_changes[0].operator).toBe("create_file");
      expect(r.hypotheses[0].target_files[0]).toContain("Component");
    });

    it("uses first candidate path when available", () => {
      const r = generateChangeHypotheses({
        specification_id: "spec_3",
        natural_language_request: "Create it here",
        change_verb: "create",
        candidate_targets: [ref("src/features/Nav.tsx", null, 0.8)],
        intended_behaviour_summary: "Nav",
      });
      expect(r.hypotheses[0].target_files).toEqual(["src/features/Nav.tsx"]);
    });
  });

  describe("risks are populated per verb", () => {
    it("modify carries regression risk", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "modify" }));
      expect(r.hypotheses[0].risks.some((r) => r.includes("break") || r.includes("callers"))).toBe(true);
    });

    it("remove carries dependent-break risk", () => {
      const r = generateChangeHypotheses(baseInput({ change_verb: "remove" }));
      expect(r.hypotheses[0].risks.some((r) => r.includes("dependent"))).toBe(true);
    });
  });

  describe("invariants", () => {
    it("every hypothesis has caller_must_decide=true", () => {
      const r = generateChangeHypotheses(baseInput());
      for (const h of r.hypotheses) expect(h.caller_must_decide).toBe(true);
    });

    it("every hypothesis has zero_llm=true and ledger=B", () => {
      const r = generateChangeHypotheses(baseInput());
      for (const h of r.hypotheses) {
        expect(h.zero_llm).toBe(true);
        expect(h.ledger).toBe("B");
      }
    });

    it("evidence_ids_consulted is populated with the source ids", () => {
      const r = generateChangeHypotheses(baseInput());
      expect(r.hypotheses[0].evidence_ids_consulted).toContain("ev_src/Button.tsx");
    });

    it("canonical version", () => {
      expect(CHANGE_HYPOTHESIS_ENGINE_VERSION).toBe("change-hypothesis-engine.v1.2026-09-19");
    });

    it("deterministic input_digest", () => {
      const a = generateChangeHypotheses(baseInput());
      const b = generateChangeHypotheses(baseInput());
      expect(a.input_digest).toBe(b.input_digest);
    });
  });
});
