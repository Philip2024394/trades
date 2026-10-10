import { describe, it, expect } from "vitest";
import {
  generateFreshEvalCorpus,
  runFreshEvaluation,
  FRESH_UNSEEN_EVAL_VERSION,
} from "./capability-fresh-unseen-evaluation";

describe("fresh unseen evaluation · generalisation probe (§49-51)", () => {
  describe("corpus properties", () => {
    it("emits at least 15 fresh tasks", () => {
      const c = generateFreshEvalCorpus();
      expect(c.length).toBeGreaterThanOrEqual(15);
    });

    it("covers all operator categories", () => {
      const c = generateFreshEvalCorpus();
      const cats = new Set(c.map((t) => t.category));
      // Should cover both regular operators and JSX operators
      expect(cats.has("modify_return")).toBe(true);
      expect(cats.has("add_export")).toBe(true);
      expect(cats.has("update_import")).toBe(true);
      expect(cats.has("replace_expression")).toBe(true);
      expect(cats.has("add_object_property")).toBe(true);
      expect(cats.has("modify_component_prop_default")).toBe(true);
      expect(cats.has("create_file")).toBe(true);
      expect(cats.has("add_jsx_attribute")).toBe(true);
      expect(cats.has("modify_jsx_attribute")).toBe(true);
      expect(cats.has("create_react_component")).toBe(true);
    });

    it("includes both should_apply and should_refuse tasks", () => {
      const c = generateFreshEvalCorpus();
      const apply = c.filter((t) => t.expected_outcome === "operator_should_apply").length;
      const refuse = c.filter((t) => t.expected_outcome === "operator_should_refuse").length;
      expect(apply).toBeGreaterThan(0);
      expect(refuse).toBeGreaterThan(0);
    });

    it("all task_ids are unique", () => {
      const c = generateFreshEvalCorpus();
      const ids = new Set(c.map((t) => t.task_id));
      expect(ids.size).toBe(c.length);
    });
  });

  describe("real evaluation run", () => {
    it("produces a report with pass/fail counts", () => {
      const report = runFreshEvaluation();
      expect(report.total_tasks).toBeGreaterThan(0);
      expect(report.results.length).toBe(report.total_tasks);
      expect(report.passed + report.failed + report.unknown).toBe(report.total_tasks);
      expect(report.pass_rate).toBeGreaterThanOrEqual(0);
      expect(report.pass_rate).toBeLessThanOrEqual(1);
    });

    it("achieves at least 80% pass rate on the fresh corpus (evidence-only · no tuning)", () => {
      const report = runFreshEvaluation();
      // If this fails · report the actual failures
      if (report.pass_rate < 0.8) {
        const failed = report.results.filter((r) => r.result === "FAIL");
        // eslint-disable-next-line no-console
        console.log("Failed tasks:", JSON.stringify(failed, null, 2));
      }
      expect(report.pass_rate).toBeGreaterThanOrEqual(0.8);
    });

    it("per_category breakdown is populated", () => {
      const report = runFreshEvaluation();
      const cats = Object.keys(report.per_category);
      expect(cats.length).toBeGreaterThan(0);
      for (const c of cats) {
        expect(report.per_category[c].total).toBeGreaterThan(0);
      }
    });
  });

  describe("determinism (§57 fresh conversation campaign requirements)", () => {
    it("running twice produces same results (no random ordering · deterministic evaluation)", () => {
      const a = runFreshEvaluation();
      const b = runFreshEvaluation();
      // corpus_digest is stable · results deterministic
      expect(a.corpus_digest).toBe(b.corpus_digest);
      expect(a.total_tasks).toBe(b.total_tasks);
      expect(a.passed).toBe(b.passed);
      expect(a.failed).toBe(b.failed);
    });
  });

  describe("invariants", () => {
    it("declares zero_llm=true, ledger=B", () => {
      const report = runFreshEvaluation();
      expect(report.zero_llm).toBe(true);
      expect(report.ledger).toBe("B");
    });

    it("canonical version", () => {
      expect(FRESH_UNSEEN_EVAL_VERSION).toBe("fresh-unseen-evaluation.v1.2026-09-19");
    });
  });
});
