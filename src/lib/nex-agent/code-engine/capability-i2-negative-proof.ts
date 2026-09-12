// src/lib/nex-agent/code-engine/capability-i2-negative-proof.ts
//
// NEX1 · CAPABILITY I.2 · NEGATIVE TYPE-SYSTEM PROOFS · deterministic.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: prove that a target interface's field REJECTS wrong-typed
// values at compile time — not merely that it ACCEPTS right-typed values
// (that is I.1's job). Emits a test body containing an `@ts-expect-error`
// directive above an assignment of a deliberately-wrong-typed value.
//
// The proof mechanism:
//   1. Synthesise a test file with `@ts-expect-error <rationale>` above
//      a `const _bad: Field = <wrong-typed-value>;` assignment.
//   2. Run tsc against the file.
//   3. If tsc reports 0 errors, the wrong-typed value was rejected by
//      the type system (and `@ts-expect-error` consumed the error) →
//      NEGATIVE PROOF SUCCEEDED.
//   4. If tsc reports "Unused @ts-expect-error directive", the type
//      system did NOT reject the wrong-typed value → proof FAILED.
//
// Discipline:
//   · Primitive/array field types → synthesise
//   · Union with literal members → synthesise (assign an out-of-union literal)
//   · Complex / custom / unknown → REFUSE
//   · Protected target → REFUSE
//   · Underspecified / unknown field → REFUSE

import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { TemplateDirective } from "./types";
import type { Nex1DiscoveryScope } from "./capability-f-discovery";
import { discoverRelevantSources } from "./capability-f-discovery";
import { isProtected } from "./scope-enforcer";

export interface Nex1NegativeProofGoal {
  readonly target_type: string;
  readonly target_field: string;
  readonly source_scope: Nex1DiscoveryScope;
  readonly test_target_file: string;
  readonly test_target_describe: string;
  readonly instruction?: string;
}

export type Nex1NegativeProofPlanKind =
  | "planned"
  | "refused_ambiguous"
  | "refused_no_declaration"
  | "refused_no_field"
  | "refused_complex_type"
  | "refused_protected_path"
  | "refused_unsafe_instruction";

export interface Nex1NegativeProofPlan {
  readonly kind: Nex1NegativeProofPlanKind;
  readonly directive: TemplateDirective | null;
  readonly target_type: string;
  readonly target_field: string;
  readonly target_source_file: string | null;
  readonly declared_field_type: string | null;
  readonly wrong_typed_value: string | null;
  readonly test_name: string | null;
  readonly reason: string;
  readonly taught_by: "master_ai_engineer";
}

export function synthesiseNegativeProof(goal: Nex1NegativeProofGoal): Nex1NegativeProofPlan {
  const instr = goal.instruction?.toLowerCase() ?? "";
  if (/ignore\s+protect/.test(instr) || /bypass/.test(instr) || /override\s+safety/.test(instr)) {
    return refuse("refused_unsafe_instruction", goal, "instruction attempts to override safety", null);
  }
  if (!goal.target_type || !goal.target_field) {
    return refuse("refused_ambiguous", goal, "missing target_type or target_field", null);
  }

  const discovery = discoverRelevantSources(goal.target_type, goal.source_scope);
  if (discovery.declaring_files.length === 0) {
    return refuse("refused_no_declaration", goal, `no declaration of '${goal.target_type}' in scope`, null);
  }
  const safe = discovery.declaring_files.filter((f) => !isProtectedRobust(f.path));
  if (safe.length === 0) {
    return refuse("refused_protected_path", goal, `every declaring path for '${goal.target_type}' is protected`, null);
  }
  const chosen = safe[0];

  const declaredType = extractFieldType(chosen.content, goal.target_type, goal.target_field);
  if (declaredType === null) {
    return refuse("refused_no_field", goal, `field '${goal.target_field}' not found on '${goal.target_type}' in ${chosen.path}`, null);
  }

  const wrong = generateWrongTypedValue(declaredType);
  if (wrong === null) {
    return refuse(
      "refused_complex_type",
      goal,
      `field '${goal.target_field}' has declared type '${declaredType}' · complex/unknown · negative proof refused`,
      declaredType,
    );
  }

  const testName = `${goal.target_type}.${goal.target_field}: TypeScript rejects wrong-typed values`;
  const varName = `_bad_${goal.target_field}`;
  const testBody = [
    `// @ts-expect-error ${goal.target_type}.${goal.target_field} is declared as ${declaredType}; the following value must be rejected at compile time.`,
    `const ${varName}: ${goal.target_type}["${goal.target_field}"] = ${wrong};`,
    `expect(typeof ${varName}).toBeDefined();`,
  ].join("\n    ");

  const directive: TemplateDirective = {
    kind: "add_test_case",
    target_path: goal.test_target_file,
    target_describe: goal.test_target_describe,
    test_name: testName,
    test_body: testBody,
  };

  return {
    kind: "planned",
    directive,
    target_type: goal.target_type,
    target_field: goal.target_field,
    target_source_file: chosen.path,
    declared_field_type: declaredType,
    wrong_typed_value: wrong,
    test_name: testName,
    reason: `negative proof synthesised · @ts-expect-error asserts wrong-typed value '${wrong}' rejected against '${declaredType}'`,
    taught_by: "master_ai_engineer",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractFieldType(fileSource: string, typeName: string, fieldName: string): string | null {
  const sf = ts.createSourceFile("__t.ts", fileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { hit: string | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
      for (const m of node.members) {
        if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name) && m.name.text === fieldName && m.type) {
          box.hit = m.type.getText(sf);
          return;
        }
      }
    }
    if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName && ts.isTypeLiteralNode(node.type)) {
      for (const m of node.type.members) {
        if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name) && m.name.text === fieldName && m.type) {
          box.hit = m.type.getText(sf);
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.hit;
}

function generateWrongTypedValue(declaredType: string): string | null {
  const t = declaredType.trim();
  if (t === "number") return '"not-a-number"';
  if (t === "string") return "12345";
  if (t === "boolean") return '"not-a-boolean"';
  if (t === "bigint") return '"not-a-bigint"';
  if (t === "null") return "42";
  if (t === "undefined") return "42";
  // Simple arrays · assign a scalar
  if (/^(readonly\s+)?[^|&]+\[\]$/.test(t)) return "42";
  if (/^(?:Readonly)?Array<.+>$/.test(t)) return "42";
  // Tuple types (untested first pass) · refuse
  if (/^\[.*\]$/.test(t)) return null;
  // Union with literal members · pick a string clearly outside the union
  if (/\|/.test(t)) {
    const parts = t.split("|").map((s) => s.trim());
    // Only handle pure literal-union case (all quoted strings or all numbers)
    const allStringLits = parts.every((p) => /^"[^"]*"$/.test(p) || /^'[^']*'$/.test(p));
    if (allStringLits) return '"__intentionally-invalid-union-member__"';
    const allNumLits = parts.every((p) => /^-?\d+(\.\d+)?$/.test(p));
    if (allNumLits) return "999999999";
    return null;
  }
  // Function type · custom name · object literal → refuse
  return null;
}

function isProtectedRobust(fullPath: string): boolean {
  const norm = fullPath.replace(/\\/g, "/");
  if (isProtected(norm)) return true;
  try {
    const rel = relative(process.cwd(), fullPath).replace(/\\/g, "/");
    if (isProtected(rel)) return true;
  } catch { /* ignore */ }
  return false;
}

function refuse(
  kind: Nex1NegativeProofPlanKind,
  goal: Nex1NegativeProofGoal,
  reason: string,
  declaredType: string | null,
): Nex1NegativeProofPlan {
  return {
    kind,
    directive: null,
    target_type: goal.target_type,
    target_field: goal.target_field,
    target_source_file: null,
    declared_field_type: declaredType,
    wrong_typed_value: null,
    test_name: null,
    reason,
    taught_by: "master_ai_engineer",
  };
}
