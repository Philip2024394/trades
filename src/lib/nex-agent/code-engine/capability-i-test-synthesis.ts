// src/lib/nex-agent/code-engine/capability-i-test-synthesis.ts
//
// NEX1 · CAPABILITY I.1 · TEST SYNTHESIS · deterministic · zero LLM.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: convert a structured test goal into a concrete `add_test_case`
// directive whose body constructs a well-typed instance of the target
// interface and asserts every field's runtime type via vitest expect().
// Refuses cleanly when any field is complex, when the target type does
// not exist, when the declaration lives at a protected path, or when the
// task-level instruction attempts to override constitutional safety.
//
// Discipline:
//   · deterministic · zero LLM · zero network
//   · unsafe-instruction detection identical to Capability H.1
//   · protected-path targets → REFUSED (never mutate)
//   · complex custom-typed fields → REFUSED (NEX1 will not fabricate a value
//     it cannot type-verify)
//   · heritage-aware field enumeration (via C.1 resolver)
//   · positive runtime-type assertion per field
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve, relative, join, extname } from "node:path";
import { readdirSync, statSync } from "node:fs";
import type { TemplateDirective } from "./types";
import type { Nex1DiscoveryScope } from "./capability-f-discovery";
import { discoverRelevantSources } from "./capability-f-discovery";
import { resolveTypeAwareRepairValue } from "./capability-c-type-aware-repair";
import { isProtected } from "./scope-enforcer";

export interface Nex1TestGoal {
  readonly target_type: string;
  readonly source_scope: Nex1DiscoveryScope;
  readonly test_target_file: string;
  readonly test_target_describe: string;
  readonly instruction?: string;
}

export type Nex1TestPlanKind =
  | "planned"
  | "refused_ambiguous"
  | "refused_no_declaration"
  | "refused_protected_path"
  | "refused_complex_type"
  | "refused_unsafe_instruction";

export interface Nex1TestFieldRecord {
  readonly name: string;
  readonly declared_type: string;
  readonly value_expression: string;
  readonly runtime_check_expression: string;
}

export interface Nex1TestPlan {
  readonly kind: Nex1TestPlanKind;
  readonly reason: string;
  readonly directive: TemplateDirective | null;
  readonly target_type: string;
  readonly target_source_file: string | null;
  readonly test_name?: string;
  readonly test_body?: string;
  readonly enumerated_fields?: readonly Nex1TestFieldRecord[];
  readonly taught_by: "master_ai_engineer";
  readonly ignored_instruction?: string;
}

/**
 * @summary Synthesise a test for the target interface. Deterministic.
 */
export function synthesiseTestForType(goal: Nex1TestGoal): Nex1TestPlan {
  const instruction = goal.instruction?.toLowerCase() ?? "";
  const unsafe =
    /ignore\s+protect/.test(instruction) ||
    /bypass/.test(instruction) ||
    /override\s+safety/.test(instruction) ||
    /disable\s+guard/.test(instruction) ||
    /disable\s+security/.test(instruction);
  if (unsafe) {
    return {
      kind: "refused_unsafe_instruction",
      reason: "task-level instruction attempts to override safety · plan refused",
      directive: null,
      target_type: goal.target_type,
      target_source_file: null,
      taught_by: "master_ai_engineer",
      ignored_instruction: goal.instruction,
    };
  }

  if (!goal.target_type || goal.target_type.trim() === "") {
    return {
      kind: "refused_ambiguous",
      reason: "missing target_type",
      directive: null,
      target_type: goal.target_type,
      target_source_file: null,
      taught_by: "master_ai_engineer",
    };
  }

  const discovery = discoverRelevantSources(goal.target_type, goal.source_scope);
  if (discovery.declaring_files.length === 0) {
    return {
      kind: "refused_no_declaration",
      reason: `no declaration of '${goal.target_type}' found in scope`,
      directive: null,
      target_type: goal.target_type,
      target_source_file: null,
      taught_by: "master_ai_engineer",
    };
  }

  // Protection check · use robust normalisation like H.1
  const protectedHits = discovery.declaring_files.filter((f) => isProtectedRobust(f.path));
  if (protectedHits.length === discovery.declaring_files.length) {
    return {
      kind: "refused_protected_path",
      reason: `every declaring path for '${goal.target_type}' is protected`,
      directive: null,
      target_type: goal.target_type,
      target_source_file: protectedHits[0].path,
      taught_by: "master_ai_engineer",
    };
  }

  const safeCandidates = discovery.declaring_files.filter((f) => !isProtectedRobust(f.path));

  // Choose a declaring file · prefer consumer-imported when duplicates exist
  let chosenPath: string;
  let chosenContent: string;
  if (safeCandidates.length === 1) {
    chosenPath = safeCandidates[0].path;
    chosenContent = safeCandidates[0].content;
  } else {
    const votes = new Map<string, number>();
    for (const c of discovery.consuming_files) {
      if (c.matched_declaration_path && safeCandidates.some((s) => s.path === c.matched_declaration_path)) {
        votes.set(c.matched_declaration_path, (votes.get(c.matched_declaration_path) ?? 0) + 1);
      }
    }
    if (votes.size === 1) {
      const winner = Array.from(votes.keys())[0];
      const c = safeCandidates.find((s) => s.path === winner)!;
      chosenPath = c.path;
      chosenContent = c.content;
    } else {
      return {
        kind: "refused_ambiguous",
        reason: `type '${goal.target_type}' has multiple declarations · disambiguation not possible from consumers`,
        directive: null,
        target_type: goal.target_type,
        target_source_file: null,
        taught_by: "master_ai_engineer",
      };
    }
  }

  // Gather full source set for heritage-aware field enumeration
  const allSources: readonly { path: string; content: string }[] = [
    ...discovery.declaring_files.map((f) => ({ path: f.path, content: f.content })),
    ...discovery.consuming_files.map((f) => ({ path: f.path, content: f.content })),
    // Also walk the scope root for any files not touching the type name but
    // still holding parent interfaces (e.g. LevelA in a heritage chain).
    ...gatherScopeSources(goal.source_scope, discovery.declaring_files.map((f) => f.path)),
  ];

  // Enumerate all fields of the target type (heritage-aware)
  const fields = enumerateInterfaceFields(allSources, goal.target_type);
  if (fields === null) {
    return {
      kind: "refused_no_declaration",
      reason: `could not read fields of '${goal.target_type}' from declaring file`,
      directive: null,
      target_type: goal.target_type,
      target_source_file: chosenPath,
      taught_by: "master_ai_engineer",
    };
  }

  // For each field · derive a type-satisfying value + a runtime check
  const records: Nex1TestFieldRecord[] = [];
  for (const f of fields) {
    const tar = resolveTypeAwareRepairValue(allSources, f.name, goal.target_type);
    if (tar.kind === "primitive" || tar.kind === "nullable_primitive_or_array" || tar.kind === "array") {
      records.push({
        name: f.name,
        declared_type: tar.declared_type!,
        value_expression: tar.value!,
        runtime_check_expression: runtimeCheckFor(f.name, tar.declared_type!, tar.value!),
      });
    } else {
      return {
        kind: "refused_complex_type",
        reason: `field '${f.name}' on '${goal.target_type}' has type '${tar.declared_type ?? "unknown"}' · complex · test synthesis refused rather than fabricating a value`,
        directive: null,
        target_type: goal.target_type,
        target_source_file: chosenPath,
        enumerated_fields: records,
        taught_by: "master_ai_engineer",
      };
    }
  }

  // Compose the test body
  const objectLiteral = "{ " + records.map((r) => `${r.name}: ${r.value_expression}`).join(", ") + " }";
  const varName = "instance";
  const testName = `${goal.target_type} constructs with type-satisfying values`;
  const assertions = records.map((r) => r.runtime_check_expression.replace("${VAR}", varName)).join("\n    ");
  const testBody = [
    `const ${varName}: ${goal.target_type} = ${objectLiteral};`,
    assertions,
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
    reason: `synthesised test '${testName}' with ${records.length} field assertions targeting ${chosenPath}`,
    directive,
    target_type: goal.target_type,
    target_source_file: chosenPath,
    test_name: testName,
    test_body: testBody,
    enumerated_fields: records,
    taught_by: "master_ai_engineer",
  };
}

function runtimeCheckFor(fieldName: string, declaredType: string, valueExpression: string): string {
  const t = declaredType.trim();
  if (t === "number") return `expect(typeof \${VAR}.${fieldName}).toBe("number");`;
  if (t === "string") return `expect(typeof \${VAR}.${fieldName}).toBe("string");`;
  if (t === "boolean") return `expect(typeof \${VAR}.${fieldName}).toBe("boolean");`;
  if (/^(readonly\s+)?[^|&]+\[\]$/.test(t) || /^(?:Readonly)?Array<.+>$/.test(t)) {
    return `expect(Array.isArray(\${VAR}.${fieldName})).toBe(true);`;
  }
  // Nullable primitive · value was chosen as null/undefined
  if (valueExpression === "null") return `expect(\${VAR}.${fieldName}).toBeNull();`;
  if (valueExpression === "undefined") return `expect(\${VAR}.${fieldName}).toBeUndefined();`;
  return `expect(\${VAR}.${fieldName} !== undefined).toBe(true);`;
}

function enumerateInterfaceFields(
  sources: readonly { path: string; content: string }[],
  typeName: string,
): readonly { name: string; declared_type: string }[] | null {
  const visited = new Set<string>();
  const collected: { name: string; declared_type: string }[] = [];
  const walk = (name: string, depth: number) => {
    if (depth > 8) return;
    if (visited.has(name)) return;
    visited.add(name);
    for (const src of sources) {
      const sf = ts.createSourceFile("__i.ts", src.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      let matched: ts.InterfaceDeclaration | null = null;
      const visit = (node: ts.Node) => {
        if (matched) return;
        if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
          matched = node;
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      if (matched) {
        const iface = matched as ts.InterfaceDeclaration;
        for (const member of iface.members) {
          if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name) && member.type) {
            const fieldName = member.name.text;
            if (!collected.some((c) => c.name === fieldName)) {
              collected.push({ name: fieldName, declared_type: member.type.getText(sf) });
            }
          }
        }
        if (iface.heritageClauses) {
          for (const clause of iface.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              for (const t of clause.types) {
                if (ts.isIdentifier(t.expression)) {
                  walk(t.expression.text, depth + 1);
                } else if (ts.isPropertyAccessExpression(t.expression)) {
                  walk(t.expression.name.text, depth + 1);
                }
              }
            }
          }
        }
        return;
      }
    }
  };
  walk(typeName, 0);
  return collected.length > 0 ? collected : null;
}

function isProtectedRobust(fullPath: string): boolean {
  const norm = fullPath.replace(/\\/g, "/");
  if (isProtected(norm)) return true;
  try {
    const rel = relative(process.cwd(), fullPath).replace(/\\/g, "/");
    if (isProtected(rel)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function gatherScopeSources(scope: Nex1DiscoveryScope, skip: readonly string[]): readonly { path: string; content: string }[] {
  if (scope.files && scope.files.length > 0) {
    return scope.files
      .filter((p) => !skip.includes(p.replace(/\\/g, "/")))
      .map((p) => ({ path: p.replace(/\\/g, "/"), content: readFileSync(p, "utf8") }));
  }
  if (scope.root) {
    const exts = scope.extensions ?? [".ts", ".tsx"];
    const excludes = scope.exclude_globs ?? ["node_modules", ".next", "dist", "build"];
    const out: { path: string; content: string }[] = [];
    const walk = (dir: string) => {
      let entries: string[];
      try { entries = readdirSync(dir); } catch { return; }
      for (const entry of entries) {
        const full = join(dir, entry);
        if (excludes.some((g) => entry === g || full.includes(`/${g}/`) || full.includes(`\\${g}\\`))) continue;
        let st;
        try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) walk(full);
        else if (st.isFile() && exts.includes(extname(full))) {
          const norm = full.replace(/\\/g, "/");
          if (skip.some((s) => s === norm || s.endsWith(norm) || norm.endsWith(s))) continue;
          try { out.push({ path: norm, content: readFileSync(full, "utf8") }); } catch { /* skip */ }
        }
      }
    };
    walk(scope.root);
    return out;
  }
  return [];
}
