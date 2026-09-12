// src/lib/nex-agent/code-engine/consequence-reasoner.ts
//
// NEX1 · SPRINT 2.5 · CONSEQUENCE REASONING · deterministic · zero model.
//
// Given tsc diagnostic text, extract structured findings, and — for the
// specific class of TS2322 "missing properties" errors — compose remedial
// directives that instruct NEX1's AST adapter to add the missing property
// at the exact location tsc reported.
//
// This is NEX1 learning that "changing an interface has consequences on
// every caller that constructs that type." No LLM. Pure deterministic
// diagnostic parsing + AST composition.

import type { TemplateDirective } from "./types";
import { resolveTypeAwareRepairValue } from "./capability-c-type-aware-repair";

export interface TscDiagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;                        // e.g. "TS2322"
  readonly message: string;
  readonly continuation: readonly string[];    // subsequent indented lines (multi-line diagnostic)
}

/**
 * @summary Parse tsc's textual output into structured diagnostics.
 * Groups continuation lines (indented) with their primary error.
 */
export function parseTscOutput(text: string): TscDiagnostic[] {
  const rawLines = text.split(/\r?\n/);
  const diagnostics: TscDiagnostic[] = [];
  const primaryRe = /^([^\s(].*?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s*(.*)$/;
  let current: {
    file: string; line: number; column: number; code: string; message: string; continuation: string[];
  } | null = null;
  for (const raw of rawLines) {
    const m = primaryRe.exec(raw);
    if (m) {
      if (current) diagnostics.push(freeze(current));
      current = {
        file: m[1].trim(),
        line: Number(m[2]),
        column: Number(m[3]),
        code: m[4],
        message: m[5].trim(),
        continuation: [],
      };
    } else if (current && /^\s+\S/.test(raw)) {
      current.continuation.push(raw);
    } else if (current && raw.trim() === "") {
      // blank line ends the current diagnostic block
      diagnostics.push(freeze(current));
      current = null;
    }
  }
  if (current) diagnostics.push(freeze(current));
  return diagnostics;
}

function freeze(d: {
  file: string; line: number; column: number; code: string; message: string; continuation: string[];
}): TscDiagnostic {
  return {
    file: d.file, line: d.line, column: d.column,
    code: d.code, message: d.message,
    continuation: [...d.continuation],
  };
}

export interface MissingPropertyFinding {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly type_name: string;
  readonly missing_properties: readonly string[];
}

/**
 * @summary Extract missing-property findings from parsed diagnostics.
 * Matches the tsc pattern:
 *   "Type 'X' is missing the following properties from type 'Y': foo, bar"
 * emitted for TS2322 / TS2739 / TS2740.
 */
export function extractMissingPropertyFindings(diagnostics: readonly TscDiagnostic[]): MissingPropertyFinding[] {
  const findings: MissingPropertyFinding[] = [];
  // Pattern A (plural · TS2739/TS2740 · sometimes TS2322):
  //   "is missing the following properties from type 'X': foo, bar"
  const pluralRe = /is missing the following properties from type '([^']+)':\s*([^.\n]+)/;
  // Pattern B (singular · TS2741 · sometimes TS2322 nested continuation):
  //   "Property 'foo' is missing in type '...' but required in type 'Y'"
  const singularRe = /Property '([^']+)' is missing in type '[^']+' but required in type '([^']+)'/g;
  // Pattern C (TS2739 alt): "Type '...' is missing property '...' from type 'Y'"
  const alt2739Re = /Type '[^']+' is missing property '([^']+)' from type '([^']+)'/g;

  for (const d of diagnostics) {
    if (!["TS2322", "TS2739", "TS2740", "TS2741"].includes(d.code)) continue;
    const allText = [d.message, ...d.continuation].join("\n");

    // Try plural form first (returns the full property list)
    const plural = pluralRe.exec(allText);
    if (plural) {
      const props = plural[2].split(",").map((s) => s.trim()).filter(Boolean);
      if (props.length > 0) {
        findings.push({
          file: d.file, line: d.line, column: d.column,
          type_name: plural[1], missing_properties: props,
        });
        continue;
      }
    }

    // Otherwise accumulate singular-form matches (one match per missing property)
    const singularProps: string[] = [];
    let typeName: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = singularRe.exec(allText)) !== null) {
      singularProps.push(m[1]);
      typeName = m[2];
    }
    singularRe.lastIndex = 0;
    while ((m = alt2739Re.exec(allText)) !== null) {
      singularProps.push(m[1]);
      typeName = m[2];
    }
    alt2739Re.lastIndex = 0;
    if (singularProps.length > 0 && typeName) {
      findings.push({
        file: d.file, line: d.line, column: d.column,
        type_name: typeName, missing_properties: Array.from(new Set(singularProps)),
      });
    }
  }
  return findings;
}

/**
 * @summary Compose an add_property_to_object_at_position directive.
 *
 * Capability C wiring (taught_by=master_ai_engineer · 2026-09-12): when
 * `fileSource` is supplied, NEX1 consults the declared type of the property
 * on the enclosing interface and selects a repair value that satisfies that
 * declared type. Type information outranks property-name heuristics. When
 * the declared type is complex/custom/refused, this composer returns
 * `{ ok: false, escalate }` so the loop records an honest escalation
 * rather than fabricating a value.
 *
 * Backwards-compatible: when `fileSource` is omitted, falls back to the
 * legacy name-heuristic composer (still returns a directive).
 */
export type ComposeRepairResult =
  | { readonly ok: true; readonly directive: Extract<TemplateDirective, { kind: "add_property_to_object_at_position" }>; readonly source: "type_aware" | "name_heuristic"; readonly rationale: string }
  | { readonly ok: false; readonly escalate: true; readonly declared_type: string | null; readonly reason: string };

export function composeRepairDirective(
  finding: MissingPropertyFinding,
  propertyName: string,
): Extract<TemplateDirective, { kind: "add_property_to_object_at_position" }> {
  // Legacy path — no fileSource supplied · fall back to name heuristic.
  return {
    kind: "add_property_to_object_at_position",
    target_path: normaliseRepoPath(finding.file),
    line: finding.line,
    column: finding.column,
    property_name: propertyName,
    property_value: defaultValueForProperty(propertyName),
  };
}

/**
 * @summary Type-aware composer (Capability C · taught_by=master_ai_engineer).
 * Consults the declared type of the field via AST and returns either a
 * satisfying repair directive or an honest escalation.
 *
 * Cross-file (taught_by=master_ai_engineer · 2026-09-12): accepts either
 * a single file source (legacy) or a repository source set. When the
 * interface declaration is not in the caller file, NEX1 searches the
 * supplied source set for it.
 */
export function composeRepairDirectiveTypeAware(
  finding: MissingPropertyFinding,
  propertyName: string,
  sources: string | readonly { path: string; content: string }[],
): ComposeRepairResult {
  const typeResult = resolveTypeAwareRepairValue(sources, propertyName, finding.type_name);
  if (typeResult.kind === "primitive" || typeResult.kind === "array" || typeResult.kind === "nullable_primitive_or_array") {
    return {
      ok: true,
      source: "type_aware",
      rationale: typeResult.reason + (typeResult.declared_in_path ? ` · declared in ${typeResult.declared_in_path}` : ""),
      directive: {
        kind: "add_property_to_object_at_position",
        target_path: normaliseRepoPath(finding.file),
        line: finding.line,
        column: finding.column,
        property_name: propertyName,
        property_value: typeResult.value!,
      },
    };
  }
  // complex_refused or type_not_found · NEX1 escalates rather than guessing
  return {
    ok: false,
    escalate: true,
    declared_type: typeResult.declared_type,
    reason: typeResult.reason,
  };
}

function defaultValueForProperty(name: string): string {
  // Deterministic name-heuristic rule table · legacy pre-Capability-C behaviour.
  const lower = name.toLowerCase();
  if (lower === "resolved_at" || lower.endsWith("_at")) return "null";
  if (lower.includes("hash") || lower.includes("id") || lower.includes("name") || lower.includes("prompt")) return '""';
  if (lower.includes("count") || lower.includes("size") || lower.includes("lines") || lower.includes("ms")) return "0";
  if (lower.includes("deterministic") || lower.includes("ok") || lower.includes("enabled")) return "false";
  return "null";
}

function normaliseRepoPath(p: string): string {
  return p.replace(/\\/g, "/");
}
