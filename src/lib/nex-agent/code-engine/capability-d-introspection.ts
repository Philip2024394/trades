// src/lib/nex-agent/code-engine/capability-d-introspection.ts
//
// NEX1 · CAPABILITY D · INTROSPECTIVE DIAGNOSIS · deterministic · zero model.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: When NEX1's consequence-reasoning loop applies a repair but tsc
// still emits an error at the same location, this module produces a
// structured GAP DESCRIPTOR: what changed between "before repair" and
// "after repair", what information was absent from the repair composer, and
// what mechanism NEX1 would need to acquire to close such ripples
// autonomously in future.
//
// This is NOT a repair. It is diagnosis + proposal. Its output is intended
// to be consumed either by a future Capability C mechanism (type-aware
// value picker) or by supervisors during ladder review.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism. See the
// adapter-removal conformance test.

import ts from "typescript";
import type { TscDiagnostic } from "./consequence-reasoner";

export interface AttemptedRepair {
  readonly property_name: string;
  readonly property_value: string;
}

export type Nex1GapKind =
  | "type_mismatch_after_repair"
  | "unrecognized_error_class"
  | "location_ambiguous"
  | "no_gap_detected";

export interface Nex1GapDescriptor {
  readonly gap_kind: Nex1GapKind;
  readonly before_state: string;
  readonly after_state: string;
  readonly attempted_repair: AttemptedRepair | null;
  readonly expected_type: string | null;
  readonly actual_type: string | null;
  readonly declared_field_type: string | null;
  readonly missing_information: readonly string[];
  readonly proposed_mechanism: string;
  readonly confidence: number;
  readonly raw_diagnostic_code: string;
  readonly raw_diagnostic_message: string;
  readonly taught_by: "master_ai_engineer";
}

export interface Nex1IntrospectionSource {
  readonly path: string;
  readonly content: string;
}

/**
 * @summary Analyze a post-repair tsc diagnostic and emit a structured gap
 * descriptor. Deterministic. No LLM. No network.
 *
 * Cross-file (taught_by=master_ai_engineer · 2026-09-12): accepts either
 * a single file source (legacy) or a repository source set. When the
 * interface declaration is not in the diagnostic's file, NEX1 searches
 * the supplied source set for it — same discipline as Capability C.
 */
export function extractGapDescriptor(
  postRepairDiagnostic: TscDiagnostic,
  attemptedRepairs: readonly AttemptedRepair[],
  sources: string | readonly Nex1IntrospectionSource[],
): Nex1GapDescriptor {
  const sourceList: readonly Nex1IntrospectionSource[] = typeof sources === "string"
    ? [{ path: "__caller__", content: sources }]
    : sources;
  const msg = postRepairDiagnostic.message;
  const cont = postRepairDiagnostic.continuation.join("\n");
  const allText = msg + "\n" + cont;
  const code = postRepairDiagnostic.code;

  // Case 1 · TS2322 with "Type '{...}' is not assignable to type 'Y'" pattern.
  // If the actual-type text contains one of our repair properties, this is a
  // type-mismatch-after-repair gap.
  const notAssignableRe = /Type '(.+?)' is not assignable to type '(.+?)'/;
  const naMatch = notAssignableRe.exec(allText);
  if (code === "TS2322" && naMatch) {
    const actualTypeText = naMatch[1];
    const expectedTypeText = naMatch[2];

    let matchingRepair: AttemptedRepair | null = null;
    for (const r of attemptedRepairs) {
      if (new RegExp(`\\b${escapeRegex(r.property_name)}\\s*:`).test(actualTypeText)) {
        matchingRepair = r;
        break;
      }
    }

    if (matchingRepair) {
      const declaredType = findDeclaredFieldTypeAcrossSources(sourceList, matchingRepair.property_name, expectedTypeText);
      return {
        gap_kind: "type_mismatch_after_repair",
        before_state: `interface required '${matchingRepair.property_name}' · missing from object literal`,
        after_state: `object literal now contains '${matchingRepair.property_name}: ${matchingRepair.property_value}' · tsc rejects the resulting shape as not assignable to '${expectedTypeText}'`,
        attempted_repair: matchingRepair,
        expected_type: expectedTypeText,
        actual_type: actualTypeText,
        declared_field_type: declaredType,
        missing_information: [
          "declared_field_type_from_interface_ast",
          "type_compatibility_check_before_value_selection",
        ],
        proposed_mechanism:
          "Consult the target interface AST for the declared type of the property being repaired, " +
          "then select a repair value whose type satisfies the declared type. Replace name-based " +
          "default-value heuristics with type-aware value selection derived from the field type.",
        confidence: 0.92,
        raw_diagnostic_code: code,
        raw_diagnostic_message: msg,
        taught_by: "master_ai_engineer",
      };
    }
  }

  // Case 2 · unrecognized diagnostic class (reasoner has no rule)
  return {
    gap_kind: "unrecognized_error_class",
    before_state: "unknown (no matching prior repair)",
    after_state: "unrepaired diagnostic present at scoped path",
    attempted_repair: attemptedRepairs[0] ?? null,
    expected_type: null,
    actual_type: null,
    declared_field_type: null,
    missing_information: [`extractor_for_${code}`],
    proposed_mechanism:
      `Extend the reasoner's diagnostic rule table to recognize ${code}. Author a new ` +
      `pattern extractor that parses the message form and identifies actionable structure ` +
      `(property name · type name · repair site).`,
    confidence: 0.7,
    raw_diagnostic_code: code,
    raw_diagnostic_message: msg,
    taught_by: "master_ai_engineer",
  };
}

/**
 * @summary Walk each supplied source's AST to find the declared type of
 * a field. Returns the first match found. Cross-file + heritage-aware
 * discipline mirrors Capability C's resolver (taught_by=master_ai_engineer).
 */
const MAX_HERITAGE_DEPTH = 8;

function findDeclaredFieldTypeAcrossSources(
  sources: readonly Nex1IntrospectionSource[],
  propertyName: string,
  enclosingTypeText: string,
): string | null {
  return findWithHeritage(sources, propertyName, enclosingTypeText, new Set<string>(), 0);
}

function findWithHeritage(
  sources: readonly Nex1IntrospectionSource[],
  propertyName: string,
  typeText: string,
  visited: Set<string>,
  depth: number,
): string | null {
  if (depth > MAX_HERITAGE_DEPTH) return null;
  const cleanName = cleanTypeName(typeText);
  if (visited.has(cleanName)) return null;
  visited.add(cleanName);
  for (const src of sources) {
    const hit = findOnInterface(src.content, propertyName, cleanName);
    if (hit.foundDeclaration) {
      if (hit.declaredType !== null) return hit.declaredType;
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
  const sf = ts.createSourceFile("__intro.ts", fileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { value: InterfaceScanResult } = {
    value: { foundDeclaration: false, declaredType: null, extendsNames: [] },
  };
  const readType = (members: readonly ts.TypeElement[]): string | null => {
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
      const declaredType = readType(node.members);
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
      const declaredType = readType(node.type.members);
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
