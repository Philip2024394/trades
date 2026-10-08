// scripts/nex-canonical/intelligence-result.test.ts
//
// Pure unit tests for IntelligenceResult<T>.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  abstained,
  answered,
  foldIntelligenceResult,
  isAbstained,
  isAnswered,
  type AbstainedReason,
  type IntelligenceResult,
} from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §1 · Constructors
// ═════════════════════════════════════════════════════════════════════

describe("answered", () => {
  test("carries the value", () => {
    const r = answered(42);
    expect(r.kind).toBe("answered");
    if (r.kind === "answered") expect(r.value).toBe(42);
  });

  test("works with structured values", () => {
    const v = { a: 1, b: "x" };
    const r = answered(v);
    if (r.kind === "answered") expect(r.value).toEqual(v);
  });

  test("result is frozen · kind cannot be mutated", () => {
    const r = answered(42);
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as unknown as { kind: string }).kind = "abstained";
    }).toThrow();
  });
});

describe("abstained", () => {
  test("carries the reason", () => {
    const r = abstained<number>({
      code: "insufficient_data",
      message: "not enough signal",
    });
    expect(r.kind).toBe("abstained");
    if (r.kind === "abstained") {
      expect(r.reason.code).toBe("insufficient_data");
      expect(r.reason.message).toBe("not enough signal");
    }
  });

  test("optional details are preserved", () => {
    const r = abstained<number>({
      code: "x",
      message: "y",
      details: { source: "legacy", count: 3 },
    });
    if (r.kind === "abstained") {
      expect(r.reason.details).toEqual({ source: "legacy", count: 3 });
    }
  });

  test("omitting details yields a reason without a details field", () => {
    const r = abstained<number>({ code: "x", message: "y" });
    if (r.kind === "abstained") {
      expect(r.reason.details).toBeUndefined();
    }
  });

  test("result is frozen", () => {
    const r = abstained<number>({ code: "x", message: "y" });
    expect(Object.isFrozen(r)).toBe(true);
  });

  test("reason object is frozen", () => {
    const r = abstained<number>({ code: "x", message: "y" });
    if (r.kind === "abstained") {
      expect(Object.isFrozen(r.reason)).toBe(true);
      expect(() => {
        (r.reason as AbstainedReason & { code: string }).code = "z";
      }).toThrow();
    }
  });

  test("details object is frozen when supplied", () => {
    const r = abstained<number>({
      code: "x",
      message: "y",
      details: { k: 1 },
    });
    if (r.kind === "abstained" && r.reason.details) {
      expect(Object.isFrozen(r.reason.details)).toBe(true);
    }
  });

  test("mutating the original details object does NOT affect the frozen copy", () => {
    const details: Record<string, unknown> = { k: 1 };
    const r = abstained<number>({ code: "x", message: "y", details });
    details.k = 99; // mutate caller's original
    if (r.kind === "abstained" && r.reason.details) {
      expect(r.reason.details.k).toBe(1);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Predicates
// ═════════════════════════════════════════════════════════════════════

describe("isAnswered / isAbstained", () => {
  test("isAnswered returns true for answered", () => {
    expect(isAnswered(answered(1))).toBe(true);
  });

  test("isAnswered returns false for abstained", () => {
    expect(isAnswered(abstained<number>({ code: "x", message: "y" }))).toBe(
      false,
    );
  });

  test("isAbstained returns true for abstained", () => {
    expect(isAbstained(abstained<number>({ code: "x", message: "y" }))).toBe(
      true,
    );
  });

  test("isAbstained returns false for answered", () => {
    expect(isAbstained(answered(1))).toBe(false);
  });

  test("predicates are mutually exclusive", () => {
    const r1: IntelligenceResult<number> = answered(1);
    const r2: IntelligenceResult<number> = abstained({ code: "x", message: "y" });
    expect(isAnswered(r1) && isAbstained(r1)).toBe(false);
    expect(isAnswered(r2) && isAbstained(r2)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · foldIntelligenceResult
// ═════════════════════════════════════════════════════════════════════

describe("foldIntelligenceResult", () => {
  test("routes to onAnswered for an answered result", () => {
    const out = foldIntelligenceResult(answered(42), {
      onAnswered: (v) => `v=${v}`,
      onAbstained: (r) => `r=${r.code}`,
    });
    expect(out).toBe("v=42");
  });

  test("routes to onAbstained for an abstained result", () => {
    const out = foldIntelligenceResult(
      abstained<number>({ code: "none", message: "x" }),
      {
        onAnswered: (v) => `v=${v}`,
        onAbstained: (r) => `r=${r.code}`,
      },
    );
    expect(out).toBe("r=none");
  });

  test("transforms the answered type to another type", () => {
    const out = foldIntelligenceResult<number, { label: string }>(
      answered(7),
      {
        onAnswered: (v) => ({ label: `n=${v}` }),
        onAbstained: () => ({ label: "none" }),
      },
    );
    expect(out).toEqual({ label: "n=7" });
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("intelligence-result source · pure module", () => {
  const srcPath = path.join(__dirname, "intelligence-result.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE has zero imports (no pg, no fs, no net, no env, no clock, no randomness)", () => {
    expect(code).not.toMatch(/^import\s/m);
    expect(code).not.toMatch(/require\s*\(/);
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bfs\./);
    expect(code).not.toMatch(/\bnet\./);
    expect(code).not.toMatch(/\bhttp\./);
  });

  test("CODE does not reference DB / resolver / canonical-insert surfaces", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
    expect(code).not.toMatch(/@supabase/);
    expect(code).not.toMatch(/\bcanonicalInsert\b/);
    expect(code).not.toMatch(/\bexecuteWritePlan\b/);
  });
});
