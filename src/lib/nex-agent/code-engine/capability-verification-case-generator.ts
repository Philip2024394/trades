// src/lib/nex-agent/code-engine/capability-verification-case-generator.ts
//
// NEX1 · Deterministic Verification-Case Generator · zero LLM.
// Founder-authorised 2026-09-17 · Specification-Driven Coding Capability.
//
// PURPOSE
//   Convert an ExpectedBehaviour[] (from capability-specification-extractor)
//   into concrete VerificationCase[] · each one carrying a real vitest test
//   block that a downstream writer can save to disk and execute.
//
// DISCIPLINE
//   · Zero LLM · zero synonym engine · zero domain-specific hard-coding.
//   · Matches subject-noun ↔ target-function via literal case-insensitive
//     substring on function name / parameter names / return-field names.
//   · Refuses cleanly when subject cannot be located · does NOT invent
//     function signatures · does NOT infer expected values not in prose.
//   · Deterministic ordering · deterministic output.
//
// GENERALIZED · NOT TEST-5-SPECIFIC
//   The generator accepts any founder-supplied target file and matches by
//   structural evidence extracted via the pre-existing inspectFileSource
//   capability. No pricing / staircase / quantity vocabulary is referenced.

import { inspectFileSource } from "./capability-source-inspection";
import type { SourceFunctionRecord } from "./capability-source-inspection";
import type { ExpectedBehaviour, ExtractSpecificationResult } from "./capability-specification-extractor";
import * as path from "node:path";

// ── Public shape ─────────────────────────────────────────────────────────

export type VerificationConfidence = "high" | "medium" | "insufficient";

export type VerificationRefusalKind =
  | "refused_source_inspection_failed"
  | "refused_no_exported_functions"
  | "refused_no_subject_match"
  | "refused_expected_value_missing"
  | "refused_arity_unknown";

export interface VerificationCase {
  readonly case_id: string;
  readonly source_behaviour: ExpectedBehaviour;
  readonly target_function_name: string;
  readonly target_function_params: readonly string[];
  readonly call_expression: string;             // e.g. computeX(0)
  readonly assertion_expression: string;        // e.g. .toBe(0)
  readonly outcome_access_path: string | null;  // e.g. ".lineTotalIdr" · null when direct
  readonly test_code_block: string;             // A complete `it(...)` block ready for vitest
  readonly confidence: VerificationConfidence;
  readonly evidence_kind: "COMPOSED";
  readonly rationale: string;
}

export interface VerificationRefusal {
  readonly case_id: string;
  readonly source_behaviour: ExpectedBehaviour;
  readonly refusal_kind: VerificationRefusalKind;
  readonly detail: string;
}

export interface GenerateVerificationCasesOk {
  readonly ok: true;
  readonly cases: readonly VerificationCase[];
  readonly refusals: readonly VerificationRefusal[];
  readonly target_source_file: string;         // repo-relative
  readonly target_function_count: number;
  readonly zero_llm: true;
  readonly evidence_kind: "COMPOSED";
  readonly stats: {
    readonly high_confidence: number;
    readonly medium_confidence: number;
    readonly refused: number;
    readonly considered: number;
  };
}

export interface GenerateVerificationCasesRefused {
  readonly ok: false;
  readonly refusal_kind: VerificationRefusalKind;
  readonly detail: string;
  readonly target_source_file: string;
}

export type GenerateVerificationCasesResult =
  | GenerateVerificationCasesOk
  | GenerateVerificationCasesRefused;

export interface GenerateVerificationCasesInput {
  readonly extraction: ExtractSpecificationResult;
  readonly target_source_file: string;         // repo-relative or absolute
  readonly repo_root: string;
  readonly import_specifier?: string;          // optional override for import path
  readonly test_file_target?: string;          // repo-relative test path (for import resolution)
}

// ── Constants ────────────────────────────────────────────────────────────

const MAX_CASES = 30;

// ── Helpers ──────────────────────────────────────────────────────────────

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, "/");
}

function toRepoRelative(p: string, repoRoot: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
  const rel = path.relative(repoRoot, abs);
  return toForwardSlash(rel);
}

/** Literal case-insensitive substring match · zero synonym engine.
 *  Returns true when needle is a substring of haystack OR haystack is a
 *  substring of needle (with a minimum length of 2 to avoid trivial matches). */
function fuzzySubstringMatch(needle: string, haystack: string): boolean {
  if (!needle || !haystack) return false;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (n.length < 2 || h.length < 2) return false;
  return h.includes(n) || n.includes(h);
}

/** Find function candidates matching a subject noun.
 *  Priority:
 *    1. Function whose NAME contains the subject (or vice-versa)
 *    2. Function whose PARAM NAMES contain the subject
 *    3. Any exported function (if only one exported)
 *  Returns candidates sorted by priority · deterministic. */
function findFunctionCandidates(
  functions: readonly SourceFunctionRecord[],
  subject: string,
): SourceFunctionRecord[] {
  const exported = functions.filter((f) => f.exported && f.name);
  if (exported.length === 0) return [];

  const nameMatches: SourceFunctionRecord[] = [];
  const paramMatches: SourceFunctionRecord[] = [];
  const others: SourceFunctionRecord[] = [];

  for (const fn of exported) {
    const name = fn.name ?? "";
    if (fuzzySubstringMatch(subject, name)) {
      nameMatches.push(fn);
      continue;
    }
    const hasParamMatch = fn.param_names.some((p) => fuzzySubstringMatch(subject, p));
    if (hasParamMatch) {
      paramMatches.push(fn);
      continue;
    }
    others.push(fn);
  }

  // Deterministic order · alphabetical within each bucket
  const byName = (a: SourceFunctionRecord, b: SourceFunctionRecord) =>
    (a.name ?? "").localeCompare(b.name ?? "");
  nameMatches.sort(byName);
  paramMatches.sort(byName);
  others.sort(byName);

  const result = [...nameMatches, ...paramMatches];
  // Only fall back to "others" if BOTH match-buckets are empty and there is
  // exactly one exported function · avoid ambiguous fallback.
  if (result.length === 0 && exported.length === 1) {
    result.push(...others);
  }
  return result;
}

/** Find the index of a parameter whose name matches the subject (via fuzzy).
 *  Returns -1 when no match. */
function findParamIndexBySubject(
  paramNames: readonly string[],
  subject: string,
): number {
  for (let i = 0; i < paramNames.length; i++) {
    if (fuzzySubstringMatch(subject, paramNames[i])) return i;
  }
  return -1;
}

/** Best-effort default value for a parameter · deterministic · type-neutral.
 *  Since we do not have TypeScript type info here (only param names), we use
 *  language-safe defaults that vitest can evaluate. */
function defaultValueForParam(paramName: string): string {
  const n = paramName.toLowerCase();
  // Common language-level hints (NOT domain vocabulary):
  //   Names ending in "s" or containing "array"/"list" → []
  //   Names containing "map" → new Map()
  //   Names containing "set" → new Set()
  //   Names containing "obj"/"options"/"config" → {}
  //   Names containing "flag"/"is"/"has" → true (booleans)
  //   Otherwise → 1 (numeric-safe default)
  if (/array|list|items|tiers|rows|records/.test(n)) return "[]";
  if (n.endsWith("s") && n.length > 2 && !n.endsWith("ss")) return "[]";
  if (/map$/.test(n)) return "new Map()";
  if (/set$/.test(n)) return "new Set()";
  if (/obj$|options$|config$|opts$/.test(n)) return "{}";
  if (/^is[A-Z]|^has[A-Z]|flag/.test(paramName)) return "true";
  return "1";
}

/** Format the expected value into a vitest matcher expression.
 *  Zero LLM · deterministic mapping. */
function formatMatcher(expected: string): { matcher: string; value: string } {
  const trimmed = expected.trim();
  const numLike = /^-?\d+(\.\d+)?$/.test(trimmed);
  if (numLike) return { matcher: "toBe", value: trimmed };
  if (trimmed === "true" || trimmed === "false") return { matcher: "toBe", value: trimmed };
  if (trimmed === "null") return { matcher: "toBeNull", value: "" };
  if (trimmed === "undefined") return { matcher: "toBeUndefined", value: "" };
  if (trimmed === "[]") return { matcher: "toEqual", value: "[]" };
  if (trimmed === "{}") return { matcher: "toEqual", value: "{}" };
  if (trimmed === "rejected" || trimmed === "denied" || trimmed === "refused" || trimmed === "forbidden") {
    return { matcher: "toThrow", value: "" };
  }
  // Quoted string literal · preserve as string
  if (/^["'`].*["'`]$/.test(trimmed)) {
    return { matcher: "toBe", value: trimmed };
  }
  // Bare word · treat as string literal (quote it)
  return { matcher: "toBe", value: JSON.stringify(trimmed) };
}

/** Compute an outcome-access path when the expected outcome subject appears to
 *  be a named field on a returned object. Zero LLM · substring-only. */
function inferOutcomeAccess(
  outcomeSubject: string | null,
  fn: SourceFunctionRecord,
): string | null {
  if (!outcomeSubject) return null;
  // Fix 33 · 2026-09-18 · pronoun/placeholder detection.
  // When the extractor captures a generic pronoun or placeholder like "it"
  // or "result" as the outcome subject, the assertion is on the direct
  // return value of the function, not on a named object field. Treat these
  // as bare direct-return (null access path). This is deterministic and
  // grammatically correct — "it" is a self-reference to the subject.
  const bareReturnPlaceholders: ReadonlySet<string> = new Set([
    "it",
    "result",
    "value",
    "output",
    "return",
    "returns",
  ]);
  if (bareReturnPlaceholders.has(outcomeSubject.toLowerCase())) return null;
  // If the function's name suggests the outcome IS the direct return (e.g.
  // subject "total" and function "computeTotal"), no access path.
  if (fuzzySubstringMatch(outcomeSubject, fn.name ?? "")) return null;
  // Otherwise assume it's a returned object field: `.<outcomeSubject>`
  // Deterministic conversion to camelCase-adjacent form is NOT applied ·
  // we emit the outcome subject verbatim to avoid inference.
  return `.${outcomeSubject}`;
}

/** Compute a repo-relative import specifier for a test file targeting the
 *  source file. Deterministic · handles same-directory + parent-directory. */
function computeImportSpecifier(
  targetSourceRepoRel: string,
  testFileRepoRel: string,
): string {
  const testDir = path.dirname(testFileRepoRel);
  const targetNoExt = targetSourceRepoRel.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  let rel = path.relative(testDir, targetNoExt);
  rel = toForwardSlash(rel);
  if (!rel.startsWith(".") && !rel.startsWith("/")) rel = "./" + rel;
  return rel;
}

// ── Entry point ──────────────────────────────────────────────────────────

export function generateVerificationCases(
  input: GenerateVerificationCasesInput,
): GenerateVerificationCasesResult {
  const targetRel = toRepoRelative(input.target_source_file, input.repo_root);

  const inspection = inspectFileSource({
    file_path: input.target_source_file,
    repo_root: input.repo_root,
  });

  if (inspection.kind === "refused") {
    return {
      ok: false,
      refusal_kind: "refused_source_inspection_failed",
      detail: `inspection.refused: ${inspection.refusal} · ${inspection.reason}`,
      target_source_file: targetRel,
    };
  }

  const exportedFns = inspection.functions.filter((f) => f.exported && f.name);
  if (exportedFns.length === 0) {
    return {
      ok: false,
      refusal_kind: "refused_no_exported_functions",
      detail: `target file exports no named functions`,
      target_source_file: targetRel,
    };
  }

  // Resolve the test file target · used to build the import specifier.
  // Deterministic default: sibling of target with ".spec-derived.test.ts" suffix.
  const targetBaseName = path.basename(targetRel).replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  const defaultTestFileRel = toForwardSlash(
    path.join(path.dirname(targetRel), `${targetBaseName}.spec-derived.test.ts`),
  );
  const testFileRel = input.test_file_target
    ? toRepoRelative(input.test_file_target, input.repo_root)
    : defaultTestFileRel;

  const importSpecifier =
    input.import_specifier ?? computeImportSpecifier(targetRel, testFileRel);

  const cases: VerificationCase[] = [];
  const refusals: VerificationRefusal[] = [];

  const behaviours = input.extraction.expected_behaviours;
  const considered = Math.min(behaviours.length, MAX_CASES);

  for (let i = 0; i < considered; i++) {
    const behaviour = behaviours[i];
    const caseId = `SPEC_CASE_${String(i + 1).padStart(3, "0")}`;

    // Insufficient / case-only behaviours cannot generate verifications.
    if (behaviour.assertion_form !== "explicit" || behaviour.expected_value === null) {
      refusals.push({
        case_id: caseId,
        source_behaviour: behaviour,
        refusal_kind: "refused_expected_value_missing",
        detail: `assertion_form=${behaviour.assertion_form} · expected_value=${
          behaviour.expected_value === null ? "null" : behaviour.expected_value
        }`,
      });
      continue;
    }

    if (!behaviour.subject) {
      refusals.push({
        case_id: caseId,
        source_behaviour: behaviour,
        refusal_kind: "refused_no_subject_match",
        detail: `behaviour has no subject noun`,
      });
      continue;
    }

    const candidates = findFunctionCandidates(exportedFns, behaviour.subject);
    if (candidates.length === 0) {
      refusals.push({
        case_id: caseId,
        source_behaviour: behaviour,
        refusal_kind: "refused_no_subject_match",
        detail: `no exported function in ${targetRel} matches subject "${behaviour.subject}"`,
      });
      continue;
    }

    // Fix 21 · 2026-09-17 · outcome-field disambiguation.
    // When the ExpectedBehaviour names an outcome_subject (e.g. "lineTotalIdr")
    // AND multiple candidate functions match the subject, prefer the one whose
    // return-expression text contains the outcome subject as a substring.
    // Deterministic · read-only · zero LLM · zero synonym engine.
    let fn = candidates[0];
    if (behaviour.outcome_subject && candidates.length > 1) {
      const outcome = behaviour.outcome_subject;
      const outcomeMatches = candidates.filter((c) => {
        const returnsForFn = inspection.returns.filter(
          (r) => r.enclosing_function === c.name,
        );
        return returnsForFn.some((r) => {
          const text = r.return_expression_text ?? "";
          // Word-boundary-ish check to avoid accidental partial matches:
          //   verbatim substring must be present AND either not preceded/followed
          //   by an identifier char, or at boundary.
          const idx = text.toLowerCase().indexOf(outcome.toLowerCase());
          if (idx === -1) return false;
          const before = idx === 0 ? "" : text[idx - 1];
          const after = text[idx + outcome.length] ?? "";
          const isIdChar = (c: string) => /[A-Za-z0-9_$]/.test(c);
          return !isIdChar(before) && !isIdChar(after);
        });
      });
      if (outcomeMatches.length === 1) {
        fn = outcomeMatches[0];
      } else if (outcomeMatches.length > 1) {
        // Still ambiguous · prefer candidate whose PARAMETER matches subject
        // (structural evidence beats name substring)
        const paramSubjectMatch = outcomeMatches.find((c) =>
          c.param_names.some((p) => fuzzySubstringMatch(behaviour.subject!, p)),
        );
        if (paramSubjectMatch) fn = paramSubjectMatch;
        else fn = outcomeMatches[0];
      }
      // If zero outcome matches · keep original ordering (fn = candidates[0])
    }
    if (!fn.name) {
      refusals.push({
        case_id: caseId,
        source_behaviour: behaviour,
        refusal_kind: "refused_arity_unknown",
        detail: `candidate function has no name`,
      });
      continue;
    }

    // Build call arguments · deterministic defaults, subject value in matched slot
    const paramIdx = findParamIndexBySubject(fn.param_names, behaviour.subject);
    const conditionArg = behaviour.condition_value ?? "1";
    const args = fn.param_names.map((paramName, i) => {
      if (i === paramIdx) {
        // Use the condition value literally · numeric-safe already normalized
        return conditionArg;
      }
      return defaultValueForParam(paramName);
    });

    const callExpression = `${fn.name}(${args.join(", ")})`;
    const outcomeAccess = inferOutcomeAccess(behaviour.outcome_subject, fn);
    const { matcher, value } = formatMatcher(behaviour.expected_value);

    // Assemble the accessor: `result` OR `result.<outcomeAccess>`
    const accessExpr = outcomeAccess ? `result${outcomeAccess}` : `result`;
    const assertionExpression = value === ""
      ? `.${matcher}()`
      : `.${matcher}(${value})`;

    const testTitle = `${behaviour.subject}=${conditionArg} · ${behaviour.outcome_subject ?? "result"} should ${matcher} ${value || "()"}`.replace(/"/g, "\\\"");

    const testCodeBlock =
      `  it(${JSON.stringify(testTitle)}, () => {\n` +
      `    const result = ${callExpression};\n` +
      `    expect(${accessExpr})${assertionExpression};\n` +
      `  });\n`;

    // Confidence assessment · deterministic
    let confidence: VerificationConfidence = "high";
    if (paramIdx === -1) confidence = "medium"; // subject didn't literally match a parameter · used first candidate
    if (outcomeAccess && !inspection.returns.some((r) => r.return_expression_text.includes(behaviour.outcome_subject ?? ""))) {
      // Emit medium when we couldn't confirm the outcome field appears in returns
      confidence = confidence === "high" ? "medium" : confidence;
    }

    cases.push({
      case_id: caseId,
      source_behaviour: behaviour,
      target_function_name: fn.name,
      target_function_params: fn.param_names,
      call_expression: callExpression,
      assertion_expression: assertionExpression,
      outcome_access_path: outcomeAccess,
      test_code_block: testCodeBlock,
      confidence,
      evidence_kind: "COMPOSED",
      rationale:
        `matched subject "${behaviour.subject}" → ` +
        `fn=${fn.name}(${fn.param_names.join(",")}) via ` +
        (paramIdx >= 0 ? `param#${paramIdx}` : `name-substring`) +
        `; assertion: ${accessExpr}${assertionExpression}`,
    });
  }

  const importLine = `import { ${uniqueFunctionNames(cases).join(", ")} } from ${JSON.stringify(importSpecifier)};`;

  // Assemble a full test file preview (for downstream writer).
  // Note: this is NOT written by the generator · only exposed as a field on
  // the result via composePreview() below if callers need it.

  return {
    ok: true,
    cases,
    refusals,
    target_source_file: targetRel,
    target_function_count: exportedFns.length,
    zero_llm: true,
    evidence_kind: "COMPOSED",
    stats: {
      high_confidence: cases.filter((c) => c.confidence === "high").length,
      medium_confidence: cases.filter((c) => c.confidence === "medium").length,
      refused: refusals.length,
      considered,
    },
  };
}

/** Extract unique function names from generated cases · deterministic. */
function uniqueFunctionNames(cases: readonly VerificationCase[]): string[] {
  const names = new Set<string>();
  for (const c of cases) names.add(c.target_function_name);
  return [...names].sort();
}

/** Compose the full text of a vitest test file from generated cases + import
 *  metadata. Deterministic · zero LLM · pure string composition. */
export function composeTestFileText(input: {
  readonly cases: readonly VerificationCase[];
  readonly import_specifier: string;
  readonly describe_title: string;
  readonly generated_at_iso: string;
  readonly source_marker: string;
}): string {
  if (input.cases.length === 0) {
    // Emit an empty vitest-compatible test file that skips.
    return (
      `// AUTO-GENERATED · NEX1 spec-derived verification · ${input.generated_at_iso}\n` +
      `// Source: ${input.source_marker}\n` +
      `import { describe, it, expect } from "vitest";\n\n` +
      `describe(${JSON.stringify(input.describe_title)}, () => {\n` +
      `  it.skip("no verifiable expected behaviours extracted from prose", () => {});\n` +
      `});\n`
    );
  }
  const fnNames = uniqueFunctionNames(input.cases);
  const importLine = `import { ${fnNames.join(", ")} } from ${JSON.stringify(input.import_specifier)};`;
  const header =
    `// AUTO-GENERATED · NEX1 spec-derived verification · ${input.generated_at_iso}\n` +
    `// Source: ${input.source_marker}\n` +
    `// This file is written by capability-verification-case-generator and is\n` +
    `// intended to be ephemeral · downstream loops may delete it after use.\n\n` +
    `import { describe, it, expect } from "vitest";\n` +
    `${importLine}\n\n`;
  const body =
    `describe(${JSON.stringify(input.describe_title)}, () => {\n` +
    input.cases.map((c) => c.test_code_block).join("") +
    `});\n`;
  return header + body;
}
