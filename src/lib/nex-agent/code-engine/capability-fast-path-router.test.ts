import { describe, it, expect } from "vitest";
import { classifyPath, FAST_PATH_ROUTER_VERSION } from "./capability-fast-path-router";
import { buildChangePlan } from "./capability-change-plan";
import { generateChangeHypotheses } from "./capability-change-hypothesis-engine";

function hyp(over: Partial<Parameters<typeof generateChangeHypotheses>[0]> = {}) {
  return generateChangeHypotheses({
    specification_id: "spec_1",
    natural_language_request: "Change x",
    change_verb: "modify",
    candidate_targets: [{ file_path: "src/a.ts", symbol: "a", evidence_id: "e1", confidence: 0.9 }],
    intended_behaviour_summary: "x",
    ...over,
  }).hypotheses[0];
}

describe("fast-path / deep-path router · §25", () => {
  describe("FAST_PATH criteria", () => {
    it("trivial single-file modify → FAST_PATH", () => {
      const h = hyp();
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "clean" });
      expect(d.path).toBe("FAST_PATH");
      expect(d.required_checks).toContain("target_test");
      expect(d.skipped_checks).toContain("referee");
    });
  });

  describe("DEEP_PATH triggers", () => {
    it("multi-file change → DEEP_PATH", () => {
      const h = hyp();
      const plan = buildChangePlan({
        hypothesis: h,
        additional_targets: [
          { file_path: "src/b.ts", symbol: null, operator: "update_import", rationale: "", depends_on_primary: true },
        ],
      });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "clean" });
      expect(d.path).toBe("DEEP_PATH");
      expect(d.evidence_signals).toContain("multi_file");
      expect(d.required_checks).toContain("referee");
    });

    it("refactor → DEEP_PATH with semantic check", () => {
      const h = hyp({ change_verb: "refactor" });
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "clean" });
      expect(d.path).toBe("DEEP_PATH");
      expect(d.required_checks).toContain("semantic_verification");
    });

    it("remove verb → DEEP_PATH with referee", () => {
      const h = hyp({ change_verb: "remove" });
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "clean" });
      expect(d.path).toBe("DEEP_PATH");
      expect(d.required_checks).toContain("referee");
    });

    it("recent_failures repo → DEEP_PATH", () => {
      const h = hyp();
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "recent_failures" });
      expect(d.path).toBe("DEEP_PATH");
      expect(d.evidence_signals).toContain("recent_failures_in_repo");
    });
  });

  describe("FORCED_DEEP for sensitive paths", () => {
    it("touching sensitive path → FORCED_DEEP with full validation", () => {
      const h = hyp({
        candidate_targets: [{ file_path: "src/lib/pricing.ts", symbol: "priceForTier", evidence_id: "e", confidence: 1 }],
      });
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({
        plan, hypothesis: h, repo_health: "clean",
        sensitive_paths: ["src/lib/pricing.ts", "docs/DECISIONS/"],
      });
      expect(d.path).toBe("FORCED_DEEP");
      expect(d.required_checks).toContain("semantic_verification");
      expect(d.required_checks).toContain("referee");
      expect(d.evidence_signals).toContain("sensitive_path_touched");
    });
  });

  describe("invariants", () => {
    it("always declares caller_must_decide=true", () => {
      const h = hyp();
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "clean" });
      expect(d.caller_must_decide).toBe(true);
    });
    it("FAST_PATH never skips target_test", () => {
      const h = hyp();
      const plan = buildChangePlan({ hypothesis: h });
      const d = classifyPath({ plan, hypothesis: h, repo_health: "clean" });
      expect(d.skipped_checks).not.toContain("target_test");
    });
    it("canonical version", () => {
      expect(FAST_PATH_ROUTER_VERSION).toBe("fast-path-router.v1.2026-09-19");
    });
  });
});
