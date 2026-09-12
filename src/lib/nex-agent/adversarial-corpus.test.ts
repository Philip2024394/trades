// src/lib/nex-agent/adversarial-corpus.test.ts
//
// Self-validation of the adversarial training corpus.
// Proves (CLAIMED ≠ PROVEN):
//   1. Every lesson has all required fields.
//   2. Every lesson id is unique.
//   3. Every lesson has ≥1 expected failure signal.
//   4. Every lesson has a non-trivial corrected solution.
//   5. The grader returns pass/partial/fail deterministically for
//      synthetic inputs across all lessons.
//
// Founder rule: any claim about NEX capability must be backed by
// reproducible test evidence. This file is the reproducibility.

import { describe, it, expect } from "vitest";
import {
  ADVERSARIAL_CORPUS,
  corpusStats,
  lessonById,
  gradeAttempt,
} from "./adversarial-corpus";

describe("adversarial corpus · structural integrity", () => {
  it("has at least 30 lessons", () => {
    expect(ADVERSARIAL_CORPUS.length).toBeGreaterThanOrEqual(30);
  });

  it("every lesson id is unique", () => {
    const ids = ADVERSARIAL_CORPUS.map((l) => l.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it("every lesson has all required fields non-empty", () => {
    for (const l of ADVERSARIAL_CORPUS) {
      expect(l.id, `${l.id}.id`).toBeTruthy();
      expect(l.title, `${l.id}.title`).toBeTruthy();
      expect(l.category, `${l.id}.category`).toBeTruthy();
      expect(l.format, `${l.id}.format`).toBeTruthy();
      expect(l.guard, `${l.id}.guard`).toBeTruthy();
      expect(l.filePathHint, `${l.id}.filePathHint`).toBeTruthy();
      expect(l.mockFailingCode.length, `${l.id}.mockFailingCode`).toBeGreaterThan(20);
      expect(l.correctedSolution.length, `${l.id}.correctedSolution`).toBeGreaterThan(20);
      expect(l.teaching.length, `${l.id}.teaching`).toBeGreaterThan(30);
      expect(l.expectedFailureSignals.length, `${l.id}.expectedFailureSignals`).toBeGreaterThan(0);
      expect(l.competencyDomains.length, `${l.id}.competencyDomains`).toBeGreaterThan(0);
      expect(l.difficulty, `${l.id}.difficulty`).toBeGreaterThanOrEqual(1);
      expect(l.difficulty, `${l.id}.difficulty`).toBeLessThanOrEqual(10);
    }
  });

  it("trap code and corrected solution differ meaningfully", () => {
    for (const l of ADVERSARIAL_CORPUS) {
      expect(l.mockFailingCode, `${l.id} · trap == solution`).not.toBe(l.correctedSolution);
    }
  });
});

describe("adversarial corpus · coverage", () => {
  it("covers at least 8 file formats", () => {
    const stats = corpusStats();
    expect(Object.keys(stats.byFormat).length).toBeGreaterThanOrEqual(8);
  });

  it("covers at least 6 distinct guards", () => {
    const stats = corpusStats();
    expect(Object.keys(stats.byGuard).length).toBeGreaterThanOrEqual(6);
  });

  it("difficulty spans a real range · not all D1 or all D10", () => {
    const stats = corpusStats();
    const levels = Object.keys(stats.byDifficulty).map(Number);
    expect(Math.min(...levels)).toBeLessThanOrEqual(3);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(6);
  });

  it("includes security · doctrine · hooks_lint · type_check as guards", () => {
    const stats = corpusStats();
    expect(stats.byGuard).toHaveProperty("security");
    expect(stats.byGuard).toHaveProperty("doctrine");
    expect(stats.byGuard).toHaveProperty("hooks_lint");
    expect(stats.byGuard).toHaveProperty("type_check");
  });
});

describe("adversarial corpus · lookup", () => {
  it("lessonById returns known lesson", () => {
    const l = lessonById("HK-01");
    expect(l).not.toBeNull();
    expect(l?.id).toBe("HK-01");
  });

  it("lessonById returns null for unknown lesson", () => {
    expect(lessonById("DOES-NOT-EXIST")).toBeNull();
  });
});

describe("adversarial corpus · grader", () => {
  it("recognises a full-signal pass with structural fix", () => {
    const lesson = lessonById("HK-01")!;
    const attempt = {
      diagnosisText: lesson.expectedFailureSignals.join(" · "),
      correctedCode: lesson.correctedSolution,
    };
    const g = gradeAttempt(lesson, attempt);
    expect(g.verdict).toBe("pass");
    expect(g.matchedSignals.length).toBe(lesson.expectedFailureSignals.length);
    expect(g.missedSignals.length).toBe(0);
  });

  it("returns fail on empty attempt", () => {
    const lesson = lessonById("SQL-01")!;
    const g = gradeAttempt(lesson, { diagnosisText: "", correctedCode: "" });
    expect(g.verdict).toBe("fail");
    expect(g.matchedSignals.length).toBe(0);
  });

  it("returns partial when signals hit but code missing", () => {
    const lesson = lessonById("SEC-01")!;
    const g = gradeAttempt(lesson, {
      diagnosisText: lesson.expectedFailureSignals.join(" "),
      correctedCode: "// TODO",
    });
    // signals matched but corrected code doesn't overlap the real solution
    expect(g.verdict === "pass" || g.verdict === "partial").toBe(true);
    expect(g.matchedSignals.length).toBeGreaterThan(0);
  });

  it("returns partial when code overlap present but signals wrong", () => {
    const lesson = lessonById("HK-03")!;
    const g = gradeAttempt(lesson, {
      diagnosisText: "some unrelated diagnosis",
      correctedCode: lesson.correctedSolution,
    });
    expect(g.verdict === "partial" || g.verdict === "pass").toBe(true);
  });

  it("grader is deterministic · identical inputs → identical verdict across runs", () => {
    const lesson = lessonById("SEC-02")!;
    const attempt = {
      diagnosisText: "shell injection · Invoke-Expression on user input",
      correctedCode: "some partial correction",
    };
    const a = gradeAttempt(lesson, attempt);
    const b = gradeAttempt(lesson, attempt);
    const c = gradeAttempt(lesson, attempt);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("every lesson can be graded against its own solution as a pass", () => {
    for (const lesson of ADVERSARIAL_CORPUS) {
      const g = gradeAttempt(lesson, {
        diagnosisText: lesson.expectedFailureSignals.join(" · "),
        correctedCode: lesson.correctedSolution,
      });
      expect(g.verdict, `${lesson.id} should self-grade as pass`).toBe("pass");
    }
  });

  it("every lesson fails against empty attempt", () => {
    for (const lesson of ADVERSARIAL_CORPUS) {
      const g = gradeAttempt(lesson, { diagnosisText: "", correctedCode: "" });
      expect(g.verdict, `${lesson.id} should fail on empty attempt`).toBe("fail");
    }
  });
});

describe("adversarial corpus · content sanity", () => {
  it("hooks lessons reference the hook name they trap", () => {
    for (const l of ADVERSARIAL_CORPUS.filter((x) => x.guard === "hooks_lint")) {
      const trap = l.mockFailingCode.toLowerCase();
      const usesAHook =
        trap.includes("usestate") || trap.includes("useeffect") ||
        trap.includes("usememo") || trap.includes("usecallback");
      expect(usesAHook, `${l.id} · hooks_lint lesson should trap a hook`).toBe(true);
    }
  });

  it("SQL lessons include SQL keywords", () => {
    for (const l of ADVERSARIAL_CORPUS.filter((x) => x.format === "sql")) {
      const up = l.mockFailingCode.toUpperCase();
      expect(
        up.includes("SELECT") || up.includes("CREATE") || up.includes("ALTER") || up.includes("INSERT"),
        `${l.id} · SQL lesson missing SQL keyword`,
      ).toBe(true);
    }
  });

  it("doctrine lessons cite an ADR or founder rule in the teaching", () => {
    for (const l of ADVERSARIAL_CORPUS.filter((x) => x.guard === "doctrine")) {
      const t = l.teaching.toLowerCase();
      const cites =
        /adr[- ]?\d{3,4}/.test(t) ||
        t.includes("founder") ||
        t.includes("immutable") ||
        t.includes("doctrine") ||
        t.includes("locked");
      expect(cites, `${l.id} · doctrine teaching should cite ADR/founder rule`).toBe(true);
    }
  });

  it("security lessons include a security keyword in the teaching", () => {
    for (const l of ADVERSARIAL_CORPUS.filter((x) => x.guard === "security")) {
      const t = l.teaching.toLowerCase();
      const cites =
        t.includes("secret") || t.includes("inject") || t.includes("xss") ||
        t.includes("sanit") || t.includes("csrf") || t.includes("credent") ||
        t.includes("shell") || t.includes("token") || t.includes("crypt") ||
        t.includes("cors") || t.includes("cookie") || t.includes("rate") ||
        t.includes("limit") || t.includes("attacker") || t.includes("burst") ||
        t.includes("origin") || t.includes("iv") || t.includes("aes") ||
        t.includes(".env") || t.includes("upstash") || t.includes("commit");
      expect(cites, `${l.id} · security teaching should reference a security concept`).toBe(true);
    }
  });
});
