// src/lib/nex-agent/code-engine/capability-c-type-aware-repair.ts
//
// NEX1 · CAPABILITY C · TYPE-AWARE REPAIR-VALUE REASONING · deterministic · zero model.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Mechanism (not a rule table):
//   Given a repair site whose target property has a declared type in the
//   enclosing interface, select a repair value whose TypeScript type
//   SATISFIES the declared type. Type information outranks property-name
//   heuristics. For declared types outside the safely-satisfiable set,
//   REFUSE to invent a value and emit an escalation.
//
// Safely-satisfiable set:
//   primitive : number | string | boolean | null | undefined
//   array     : T[] | readonly T[] | Array<T> | ReadonlyArray<T>  →  []
//   nullable  : (primitive | array) | null | undefined            →  null / undefined
//
// Outside this set (custom names, generics, object literals, non-nullable
// unions, tuples, function types) the mechanism REFUSES. Engineering
// intelligence includes knowing when to escalate rather than guess.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import ts from "typescript";

export type Nex1TypeAwareValueKind =
  | "primitive"
  | "nullable_primitive_or_array"
  | "array"
  | "complex_refused"
  | "type_not_found";

export interface Nex1TypeAwareValueResult {
  readonly kind: Nex1TypeAwareValueKind;
  readonly value: string | null;
  readonly declared_type: string | null;
  readonly reason: string;
  readonly taught_by: "master_ai_engineer";
  readonly declared_in_path?: string;
}

export interface Nex1RepositorySource {
  readonly path: string;
  readonly content: string;
}

/**
 * @summary Resolve a repair value from the declared field type on the
 * enclosing interface. Accepts either a single file source (legacy) or a
 * repository source set (multi-file). Returns kind=complex_refused for
 * unrecognised or complex types — NEX1 must not invent a value in those
 * cases. Returns kind=type_not_found if the declaration is not found in
 * any supplied source.
 *
 * Cross-file resolution (taught_by=master_ai_engineer · 2026-09-12):
 * when the declaration is not in the caller's file, NEX1 searches the
 * supplied repository source set for the interface declaration.
 */
export function resolveTypeAwareRepairValue(
  sources: string | readonly Nex1RepositorySource[],
  propertyName: string,
  enclosingTypeText: string,
): Nex1TypeAwareValueResult {
  const sourceList: readonly Nex1RepositorySource[] = typeof sources === "string"
    ? [{ path: "__caller__", content: sources }]
    : sources;
  const found = findDeclaredFieldTypeAcrossSources(sourceList, propertyName, enclosingTypeText);
  if (found === null) {
    return {
      kind: "type_not_found",
      value: null,
      declared_type: null,
      reason: `no declaration of '${propertyName}' on type '${enclosingTypeText}' in any supplied source (${sourceList.length} searched)`,
      taught_by: "master_ai_engineer",
    };
  }
  const classified = classifyDeclaredType(found.declaredType);
  return { ...classified, declared_in_path: found.path };
}

function classifyDeclaredType(typeText: string): Nex1TypeAwareValueResult {
  const t = typeText.trim();

  // Primitives
  if (t === "number") return primitive("0", t);
  if (t === "string") return primitive('""', t);
  if (t === "boolean") return primitive("false", t);
  if (t === "null") return primitive("null", t);
  if (t === "undefined") return primitive("undefined", t);
  if (t === "bigint") return primitive("0n", t);

  // Array shapes — safe to satisfy with empty array
  if (/^(readonly\s+)?[^|&]+\[\]$/.test(t)) return array("[]", t);
  if (/^(?:Readonly)?Array<.+>$/.test(t)) return array("[]", t);
  // Tuple types [A, B] are NOT safely satisfiable with []
  if (/^\[.*\]$/.test(t)) {
    return complexRefused(t, "tuple type · NEX1 must not fabricate a tuple");
  }

  // Union
  if (/\|/.test(t)) {
    const parts = splitTopLevelUnion(t);
    const nullable = parts.filter((p) => p === "null" || p === "undefined");
    const nonNullable = parts.filter((p) => p !== "null" && p !== "undefined");
    if (nullable.length > 0) {
      // Prefer null when available · otherwise undefined
      const chosen = nullable.includes("null") ? "null" : "undefined";
      // Verify every non-nullable side is itself safely primitive/array
      const allSafe = nonNullable.every((p) => {
        const c = classifyDeclaredType(p);
        return c.kind === "primitive" || c.kind === "array";
      });
      if (allSafe) {
        return {
          kind: "nullable_primitive_or_array",
          value: chosen,
          declared_type: t,
          reason: `nullable union · safely satisfied with '${chosen}'`,
          taught_by: "master_ai_engineer",
        };
      }
    }
    return complexRefused(t, "union type with non-primitive-non-array members");
  }

  // Intersection
  if (/&/.test(t)) return complexRefused(t, "intersection type");

  // Function type
  if (/=>/.test(t)) return complexRefused(t, "function type");

  // Object literal type
  if (t.startsWith("{")) return complexRefused(t, "object-literal type · NEX1 must not fabricate an object shape");

  // Generic or custom type name (e.g. `Widget`, `Map<K,V>`, `Promise<T>`)
  return complexRefused(t, `custom or generic type '${t}' · NEX1 escalates rather than fabricating a value`);
}

function primitive(value: string, t: string): Nex1TypeAwareValueResult {
  return {
    kind: "primitive",
    value,
    declared_type: t,
    reason: `primitive type '${t}' · repair value '${value}' satisfies it`,
    taught_by: "master_ai_engineer",
  };
}

function array(value: string, t: string): Nex1TypeAwareValueResult {
  return {
    kind: "array",
    value,
    declared_type: t,
    reason: `array type '${t}' · empty array satisfies the required shape`,
    taught_by: "master_ai_engineer",
  };
}

function complexRefused(t: string, reason: string): Nex1TypeAwareValueResult {
  return {
    kind: "complex_refused",
    value: null,
    declared_type: t,
    reason,
    taught_by: "master_ai_engineer",
  };
}

/**
 * @summary Split a union type text at top-level `|` (respecting nested
 * generics, arrays, and parentheses).
 */
function splitTopLevelUnion(t: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "(" || c === "[" || c === "<" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === ">" || c === "}") depth--;
    if (c === "|" && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

/**
 * @summary Search the supplied repository source set for the declaration
 * of `propertyName` on the type named by `enclosingTypeText`. Returns the
 * first match found (with the declaring path) or null if no source
 * declares it.
 *
 * Cross-file (taught_by=master_ai_engineer · 2026-09-12): the interface
 * or type alias may live in a different file from the caller.
 *
 * Heritage-aware (taught_by=master_ai_engineer · 2026-09-12): when an
 * interface `X` is found but does not declare the target property
 * directly, follow X's `extends` heritage clauses to parent interfaces
 * transitively. Bounded recursion (MAX_HERITAGE_DEPTH) + cycle guard
 * (visited set) ensure fail-safe termination on cyclic or malformed
 * heritage chains.
 */
const MAX_HERITAGE_DEPTH = 8;

function findDeclaredFieldTypeAcrossSources(
  sources: readonly Nex1RepositorySource[],
  propertyName: string,
  enclosingTypeText: string,
): { declaredType: string; path: string } | null {
  return findWithHeritage(sources, propertyName, enclosingTypeText, new Set<string>(), 0);
}

function findWithHeritage(
  sources: readonly Nex1RepositorySource[],
  propertyName: string,
  typeText: string,
  visited: Set<string>,
  depth: number,
): { declaredType: string; path: string } | null {
  if (depth > MAX_HERITAGE_DEPTH) return null;
  const cleanName = cleanTypeName(typeText);
  if (visited.has(cleanName)) return null;
  visited.add(cleanName);
  for (const src of sources) {
    const hit = findOnInterface(src.content, propertyName, cleanName);
    if (hit.foundDeclaration) {
      if (hit.declaredType !== null) {
        return { declaredType: hit.declaredType, path: src.path };
      }
      // Interface exists here but property is not directly declared ·
      // walk each parent name up the extends chain.
      for (const parent of hit.extendsNames) {
        const up = findWithHeritage(sources, propertyName, parent, visited, depth + 1);
        if (up !== null) return up;
      }
    }
  }
  return null;
}

interface InterfaceScanResult {
  readonly foundDeclaration: boolean;
  readonly declaredType: string | null;
  readonly extendsNames: readonly string[];
}

function findOnInterface(fileSource: string, propertyName: string, typeName: string): InterfaceScanResult {
  const sf = ts.createSourceFile("__c.ts", fileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { value: InterfaceScanResult } = {
    value: { foundDeclaration: false, declaredType: null, extendsNames: [] },
  };
  const readTypeFromMembers = (members: readonly ts.TypeElement[]): string | null => {
    for (const member of members) {
      if (
        ts.isPropertySignature(member) &&
        member.name &&
        ts.isIdentifier(member.name) &&
        member.name.text === propertyName &&
        member.type
      ) {
        return member.type.getText(sf);
      }
    }
    return null;
  };
  const visit = (node: ts.Node) => {
    if (box.value.foundDeclaration) return;
    if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
      const declaredType = readTypeFromMembers(node.members);
      const extendsNames: string[] = [];
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const t of clause.types) {
              const parentName = extractSimpleTypeName(t.expression);
              if (parentName) extendsNames.push(parentName);
            }
          }
        }
      }
      box.value = { foundDeclaration: true, declaredType, extendsNames };
      return;
    }
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === typeName &&
      ts.isTypeLiteralNode(node.type)
    ) {
      const declaredType = readTypeFromMembers(node.type.members);
      box.value = { foundDeclaration: true, declaredType, extendsNames: [] };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.value;
}

function extractSimpleTypeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

function cleanTypeName(t: string): string {
  return t
    .replace(/\[\]/g, "")
    .replace(/readonly\s+/g, "")
    .replace(/\s*\|\s*undefined\s*$/, "")
    .replace(/\s*\|\s*null\s*$/, "")
    .trim();
}
