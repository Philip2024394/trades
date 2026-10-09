// scripts/nex-canonical/intelligence-no-bare-return.lint.test.ts
//
// NEX Truth Layer · intelligence-no-bare-return · in-test lint check.
//
// SEALED CLAIM:
//   Every function in a designated truth-layer module whose return type is
//   `IntelligenceResult<T>` must return by calling `answered()` or
//   `abstained()`. Bare `return null`, `return undefined`, `return
//   { kind: "answered", ... }` object-literal returns, or implicit `return;`
//   paths bypass the sealed Object.freeze contract and the exhaustive-fold
//   discipline.
//
// WHAT THIS FILE IS:
//   An AST-free, grep-based lint rule enforced inside the vitest suite.
//   Scans each designated truth-layer file; for every function with return
//   type annotated `IntelligenceResult<...>`, verifies the function body
//   contains at least one call to `answered(` or `abstained(` and no bare
//   object-literal returns of the discriminator shape.
//
// WHAT THIS FILE IS NOT:
//   A proper ESLint custom rule. CI enforcement via a dedicated
//   @typescript-eslint rule is deferred to a next-run authoring task; the
//   proper rule would use the TypeScript AST to catch cases this
//   grep-based check cannot (destructured returns, re-exported helpers,
//   etc.). This in-test lint is a load-bearing floor, not a ceiling.
//
// EVIDENCE BINDING:
//   See `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md` for the
//   broader doctrine · this lint is adjacent to the proofs, not one of
//   the seven.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ═════════════════════════════════════════════════════════════════════
// Designated truth-layer files · every one must satisfy the rule
// ═════════════════════════════════════════════════════════════════════

const CANON_DIR = path.join(__dirname);

const DESIGNATED_FILES = [
  "canonical-resolver.ts",
  "canonical-readback.ts",
  "execute-write-plan.ts",
  "directory-runner.ts",
  "first-live-write.ts",
];

interface FunctionSpan {
  readonly file: string;
  readonly name: string;
  readonly body: string;
}

// Extract function bodies whose return type annotation references
// `IntelligenceResult`. Grep-based · acceptable floor for the rule.
function extractIntelligenceReturningFunctions(file: string): FunctionSpan[] {
  const source = fs.readFileSync(path.join(CANON_DIR, file), "utf8");
  const spans: FunctionSpan[] = [];

  // Match `function name(...): IntelligenceResult<...>` and the ensuing
  // body up to the matching close brace. For simplicity, use a brace
  // counter starting at the first `{` after the signature.
  const sigRe =
    /(?:export\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*:\s*IntelligenceResult\s*<[^>]+>\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = sigRe.exec(source)) !== null) {
    const name = match[1];
    const bodyStart = match.index + match[0].length - 1;
    let depth = 1;
    let i = bodyStart + 1;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const body = source.slice(bodyStart, i);
    spans.push({ file, name, body });
  }
  return spans;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Every IntelligenceResult-returning function uses answered/abstained
// ═════════════════════════════════════════════════════════════════════

describe("intelligence-no-bare-return · designated truth-layer modules", () => {
  for (const file of DESIGNATED_FILES) {
    const absPath = path.join(CANON_DIR, file);

    test(`${file} exists`, () => {
      expect(fs.existsSync(absPath)).toBe(true);
    });

    test(`${file} · every IntelligenceResult<T>-returning function calls answered() or abstained()`, () => {
      const spans = extractIntelligenceReturningFunctions(file);
      // Not every truth-layer module has a top-level IntelligenceResult
      // function (some wire helpers). The invariant we assert here is: when
      // such a function exists, it MUST go through the sealed constructors.
      for (const span of spans) {
        const calls =
          /\b(?:answered|abstained)\s*\(/.exec(span.body) !== null;
        expect(
          calls,
          `function ${span.name} in ${file} must call answered() or abstained() (grep-based lint). ` +
            `If the function returns via a helper, add a direct answered()/abstained() call in the ` +
            `fallthrough branch so the invariant is locally auditable.`,
        ).toBe(true);
      }
    });

    test(`${file} · no bare object-literal returns of the discriminator shape`, () => {
      const source = fs.readFileSync(absPath, "utf8");
      // Forbid `return { kind: "answered", ...` and `return { kind: "abstained", ...`
      // · callers must go through the sealed Object.freeze constructors.
      expect(source).not.toMatch(
        /return\s+\{\s*kind\s*:\s*["']answered["']/,
      );
      expect(source).not.toMatch(
        /return\s+\{\s*kind\s*:\s*["']abstained["']/,
      );
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Lint prerequisite · intelligence-result.ts exports the constructors
// ═════════════════════════════════════════════════════════════════════

describe("intelligence-no-bare-return · constructors exist", () => {
  test("intelligence-result.ts exports answered() and abstained()", () => {
    const source = fs.readFileSync(
      path.join(CANON_DIR, "intelligence-result.ts"),
      "utf8",
    );
    expect(source).toMatch(/export\s+function\s+answered\b/);
    expect(source).toMatch(/export\s+function\s+abstained\b/);
  });

  test("intelligence-result.ts constructors Object.freeze their output", () => {
    const source = fs.readFileSync(
      path.join(CANON_DIR, "intelligence-result.ts"),
      "utf8",
    );
    // The sealed invariant: both constructors must freeze their output.
    const answeredMatch = /export\s+function\s+answered[\s\S]+?\n\}/.exec(source);
    expect(answeredMatch).not.toBeNull();
    expect(answeredMatch?.[0]).toMatch(/Object\.freeze/);
    const abstainedMatch = /export\s+function\s+abstained[\s\S]+?\n\}/.exec(source);
    expect(abstainedMatch).not.toBeNull();
    expect(abstainedMatch?.[0]).toMatch(/Object\.freeze/);
  });
});
