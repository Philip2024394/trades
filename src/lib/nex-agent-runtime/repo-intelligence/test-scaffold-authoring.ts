// §36-D-D · ROUTE-R2 · 2026-09-14 · test-scaffold-authoring
//
// Pure-function primitive that auto-generates mechanical test scaffolds from
// a TypedDataContractSpec. Refuses domain-judgment fabrication.
//
// Boundary (verbatim · unamendable):
//   "Route R2 enables NEX1 to author mechanical test scaffolds deterministically
//    from a TypedDataContractSpec; it does not permit NEX1 to invent domain-judgment
//    tests, invoke primitives, write files, or expand its authoring vocabulary."
//
// No I/O · no LLM · deterministic templates only.
// See docs/NEX1/SECTION_36_D_D_ROUTE_R2_TEST_SCAFFOLD_AMENDMENT.md.

import { createHash } from "node:crypto";
import type {
  StyleProfile,
  TypedDataContractDeclaration,
  TypedDataContractSpec,
  TDCField,
  TDCTypeExpression,
  TDCValidatorCheck,
  TDCRuntimeImport,
} from "../programming-mission/types";
import {
  APPROVED_TEST_CATEGORIES,
  LOCKED_DECLARATION_KINDS,
  TSC_MAX_IDENTIFIER_LENGTH,
  TSC_MAX_NESTING_DEPTH,
  TSC_MAX_OUTPUT_BYTES,
  TSC_PROHIBITED_SUBSTRINGS,
  type GapNote,
  type TestCategory,
  type TestScaffoldFailure,
  type TestScaffoldRefusalCode,
  type TestScaffoldRequest,
  type TestScaffoldResult,
  type TestScaffoldSuccess,
} from "./test-scaffold-types";

// ── Helpers ────────────────────────────────────────────────────────────

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isValidIdentifier(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= TSC_MAX_IDENTIFIER_LENGTH && IDENTIFIER_RE.test(s);
}

function fail(code: TestScaffoldRefusalCode, reason: string, offendingField?: string): TestScaffoldFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function pathViolates(p: string): boolean {
  if (typeof p !== "string" || p.length === 0) return true;
  if (p.includes("\0")) return true;
  if (p.includes("\\")) return true;
  if (p.includes("..")) return true;
  if (p.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  if (/^[a-z]+:/.test(p)) return true;
  return false;
}

function containsProhibitedSubstring(s: string): boolean {
  for (const bad of TSC_PROHIBITED_SUBSTRINGS) {
    if (s.includes(bad)) return true;
  }
  return false;
}

/** Quote a string per StyleProfile. Matches Route 2 style. */
function q(s: string, style: StyleProfile): string {
  if (style.quote_style === "single") {
    return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function semi(style: StyleProfile): string {
  return style.semicolons === "no" ? "" : ";";
}

// ── Ambiguity detection (AMB-1..AMB-10 · founder-locked hard gate) ─────

/** Detects the 10 ambiguity triggers from R2 plan §10. Returns a
 *  TestScaffoldFailure if any is present, null if the spec is unambiguous. */
function detectAmbiguity(
  spec: TypedDataContractSpec,
): TestScaffoldFailure | null {
  // Build maps of known names
  const declaredNames = new Set<string>();
  const nameToKind = new Map<string, TypedDataContractDeclaration["declaration_kind"]>();
  for (const d of spec.declarations) {
    if (declaredNames.has(d.name)) {
      return fail("TSC_AMBIGUOUS_SPEC", `AMB-7: duplicate declaration name '${d.name}'`, `spec.declarations['${d.name}']`);
    }
    declaredNames.add(d.name);
    nameToKind.set(d.name, d.declaration_kind);
  }
  const typeOnlyImportSyms = new Set(spec.type_only_imports.map((i) => i.symbol));
  const runtimeImports: readonly TDCRuntimeImport[] = Array.isArray(spec.runtime_imports) ? spec.runtime_imports : [];
  const runtimeRangeNames = new Set(runtimeImports.filter((r) => r.kind === "numeric_range_constant").map((r) => r.name));
  const runtimeUnionNames = new Set(runtimeImports.filter((r) => r.kind === "literal_union").map((r) => r.name));
  const runtimeUnionWithLiterals = new Set(
    runtimeImports.filter((r) => r.kind === "literal_union" && Array.isArray(r.literals) && r.literals.length > 0).map((r) => r.name),
  );

  // AMB-8 + AMB-3: check interface field type expressions for unresolved references + nesting depth
  function checkTypeExpr(expr: TDCTypeExpression, depth: number, refPath: string): TestScaffoldFailure | null {
    if (depth > TSC_MAX_NESTING_DEPTH) {
      return fail("TSC_AMBIGUOUS_SPEC", `AMB-3: nesting depth exceeds ${TSC_MAX_NESTING_DEPTH} at ${refPath}`, refPath);
    }
    if (expr.kind === "primitive") return null;
    if (expr.kind === "reference") {
      if (!declaredNames.has(expr.to) && !typeOnlyImportSyms.has(expr.to)) {
        return fail("TSC_AMBIGUOUS_SPEC", `AMB-8: reference '${expr.to}' at ${refPath} not declared or type-imported`, refPath);
      }
      return null;
    }
    if (expr.kind === "array") return checkTypeExpr(expr.element, depth + 1, `${refPath}[]`);
    if (expr.kind === "object") {
      for (const f of expr.fields) {
        const r = checkTypeExpr(f.type, depth + 1, `${refPath}.${f.name}`);
        if (r) return r;
      }
      return null;
    }
    return null;
  }

  for (const d of spec.declarations) {
    if (d.declaration_kind === "interface") {
      for (const f of d.fields) {
        const r = checkTypeExpr(f.type, 1, `${d.name}.${f.name}`);
        if (r) return r;
      }
    }
    if (d.declaration_kind === "type_alias") {
      const r = checkTypeExpr(d.aliased_to, 1, `${d.name}`);
      if (r) return r;
    }
    if (d.declaration_kind === "discriminated_union") {
      for (const v of d.variants) {
        for (const f of v.fields) {
          const r = checkTypeExpr(f.type, 1, `${d.name}.${v.tag_value}.${f.name}`);
          if (r) return r;
        }
      }
    }

    // AMB-1: validator input_type_name resolvable
    if (d.declaration_kind === "validator_function") {
      const inputName = d.input_type_name;
      if (!declaredNames.has(inputName) && !typeOnlyImportSyms.has(inputName)) {
        return fail("TSC_AMBIGUOUS_SPEC", `AMB-1: validator '${d.name}' input_type_name '${inputName}' does not resolve`, `${d.name}.input_type_name`);
      }
      // AMB-2: refusal_union_name resolvable (locally or via runtime_import with literals)
      const localRefusal = spec.declarations.find(
        (dd) => dd.name === d.refusal_union_name && (dd.declaration_kind === "refusal_reason_union" || dd.declaration_kind === "literal_union"),
      );
      const isRuntimeRefusal = runtimeUnionWithLiterals.has(d.refusal_union_name);
      if (!localRefusal && !isRuntimeRefusal) {
        return fail("TSC_AMBIGUOUS_SPEC", `AMB-2: validator '${d.name}' refusal_union_name '${d.refusal_union_name}' does not resolve (no local declaration and no runtime_import with literals)`, `${d.name}.refusal_union_name`);
      }
      // AMB-5 + AMB-6: check reference_name resolves for range_within and literal_union_member
      for (let i = 0; i < d.checks.length; i++) {
        const c = d.checks[i];
        if (c.check_kind === "range_within") {
          const rname = c.reference_name;
          if (!rname) {
            return fail("TSC_AMBIGUOUS_SPEC", `AMB-5: validator '${d.name}' check[${i}] range_within missing reference_name`, `${d.name}.checks[${i}].reference_name`);
          }
          const localRange = spec.declarations.find((dd) => dd.name === rname && dd.declaration_kind === "numeric_range_constant");
          if (!localRange && !runtimeRangeNames.has(rname)) {
            return fail("TSC_AMBIGUOUS_SPEC", `AMB-5: validator '${d.name}' check[${i}] reference_name '${rname}' does not resolve to a numeric_range_constant`, `${d.name}.checks[${i}].reference_name`);
          }
        }
        if (c.check_kind === "literal_union_member") {
          const rname = c.reference_name;
          if (!rname) {
            return fail("TSC_AMBIGUOUS_SPEC", `AMB-6: validator '${d.name}' check[${i}] literal_union_member missing reference_name`, `${d.name}.checks[${i}].reference_name`);
          }
          const localUnion = spec.declarations.find((dd) => dd.name === rname && (dd.declaration_kind === "literal_union" || dd.declaration_kind === "refusal_reason_union"));
          if (!localUnion && !runtimeUnionNames.has(rname)) {
            return fail("TSC_AMBIGUOUS_SPEC", `AMB-6: validator '${d.name}' check[${i}] reference_name '${rname}' does not resolve to a literal_union`, `${d.name}.checks[${i}].reference_name`);
          }
        }
        // AMB-9: field_path segment matches some interface field (best-effort · segment must be valid identifier)
        for (const seg of c.field_path.split(".")) {
          if (!isValidIdentifier(seg)) {
            return fail("TSC_AMBIGUOUS_SPEC", `AMB-9: validator '${d.name}' check[${i}] field_path segment '${seg}' invalid`, `${d.name}.checks[${i}].field_path`);
          }
        }
      }
    }

    // AMB-4: serialiser input_type_name resolvable
    if (d.declaration_kind === "serialiser_function") {
      const inputName = d.input_type_name;
      if (!declaredNames.has(inputName) && !typeOnlyImportSyms.has(inputName)) {
        return fail("TSC_AMBIGUOUS_SPEC", `AMB-4: serialiser '${d.name}' input_type_name '${inputName}' does not resolve`, `${d.name}.input_type_name`);
      }
    }
  }

  return null;
}

// ── Deterministic sample-value builder (for interface_shape category) ──

function sampleForPrimitive(type: "string" | "number" | "boolean", style: StyleProfile): string {
  if (type === "string") return q("", style);
  if (type === "number") return "0";
  return "false";
}

function sampleForType(
  expr: TDCTypeExpression,
  spec: TypedDataContractSpec,
  style: StyleProfile,
  depth: number,
): string {
  if (depth > TSC_MAX_NESTING_DEPTH) return "null as never";
  if (expr.kind === "primitive") return sampleForPrimitive(expr.type, style);
  if (expr.kind === "array") return "[]";
  if (expr.kind === "reference") {
    const target = spec.declarations.find((d) => d.name === expr.to);
    if (target) {
      if (target.declaration_kind === "interface") {
        return sampleForInterface(target, spec, style, depth + 1);
      }
      if (target.declaration_kind === "literal_union") {
        return q(target.literals[0], style);
      }
      if (target.declaration_kind === "refusal_reason_union") {
        return q(target.reasons[0], style);
      }
      if (target.declaration_kind === "type_alias") {
        return sampleForType(target.aliased_to, spec, style, depth + 1);
      }
      if (target.declaration_kind === "numeric_range_constant") {
        return `${target.min}`;
      }
    }
    // Type-only-imported reference · unknown shape · use type assertion
    return `({} as ${expr.to})`;
  }
  if (expr.kind === "object") {
    const parts = expr.fields.map((f) => `${f.name}: ${sampleForType(f.type, spec, style, depth + 1)}`);
    return `{ ${parts.join(", ")} }`;
  }
  return "null as never";
}

function sampleForInterface(
  decl: Extract<TypedDataContractDeclaration, { declaration_kind: "interface" }>,
  spec: TypedDataContractSpec,
  style: StyleProfile,
  depth: number,
): string {
  const parts = decl.fields.map((f: TDCField) => `${f.name}: ${sampleForType(f.type, spec, style, depth + 1)}`);
  return `{ ${parts.join(", ")} }`;
}

// ── Invalid-sample builder for validator refusal tests ─────────────────

function invalidSampleForCheck(
  check: TDCValidatorCheck,
  spec: TypedDataContractSpec,
  style: StyleProfile,
): { assign: string; delete_?: boolean } {
  if (check.check_kind === "range_within" && check.reference_name) {
    const local = spec.declarations.find(
      (d) => d.name === check.reference_name && d.declaration_kind === "numeric_range_constant",
    );
    if (local && local.declaration_kind === "numeric_range_constant") {
      return { assign: `${local.max + 1}` };
    }
    // Runtime-imported · fallback to a large out-of-range constant
    return { assign: "999999" };
  }
  if (check.check_kind === "literal_union_member") {
    // Non-member string
    return { assign: q(`__unknown_${check.reference_name}__`, style) };
  }
  if (check.check_kind === "required_present") {
    return { assign: "undefined", delete_: true };
  }
  return { assign: "undefined" };
}

// ── Request validation ─────────────────────────────────────────────────

function validateRequest(request: TestScaffoldRequest): TestScaffoldFailure | null {
  if (!request || typeof request !== "object") return fail("TSC_INVALID_REQUEST", "request must be an object");
  if (!request.spec || typeof request.spec !== "object") return fail("TSC_INVALID_SPEC", "spec required");
  if (typeof request.target_test_file_path !== "string") return fail("TSC_INVALID_TARGET_PATH", "target_test_file_path required");
  if (pathViolates(request.target_test_file_path)) {
    return fail("TSC_INVALID_TARGET_PATH", `target_test_file_path invalid: ${request.target_test_file_path}`, request.target_test_file_path);
  }
  if (!request.target_test_file_path.endsWith(".test.ts") && !request.target_test_file_path.endsWith(".test.tsx")) {
    return fail("TSC_INVALID_TARGET_PATH", "target_test_file_path must end with .test.ts or .test.tsx", request.target_test_file_path);
  }
  if (typeof request.source_module_specifier !== "string") {
    return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier required");
  }
  const spec = request.source_module_specifier;
  if (typeof spec !== "string" || spec.length === 0) return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier empty");
  if (spec.includes("\0") || spec.includes("\\")) return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier has invalid characters");
  if (spec.startsWith("/") || /^[A-Za-z]:[\\/]/.test(spec)) return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier absolute path");
  if (spec.startsWith("node:")) return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier is Node built-in");
  if (/^[a-z]+:/.test(spec)) return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier uses protocol scheme");
  if (!spec.startsWith("./") && !spec.startsWith("../")) {
    return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier must start with './' or '../'");
  }
  // Allow single leading '../' (test file under __tests__/ referencing sibling source module).
  // After stripping the leading prefix, no additional '..' path segment is permitted.
  const afterPrefix = spec.startsWith("../") ? spec.slice(3) : spec.slice(2);
  if (afterPrefix.split("/").some((seg) => seg === "..")) {
    return fail("TSC_INVALID_SOURCE_SPECIFIER", "source_module_specifier contains additional '..' segment beyond leading prefix");
  }
  if (containsProhibitedSubstring(spec)) return fail("TSC_PROHIBITED_STRING_CONTENT", "source_module_specifier contains prohibited content");
  if (!Array.isArray(request.test_categories) || request.test_categories.length === 0) {
    return fail("TSC_UNKNOWN_TEST_CATEGORY", "test_categories must be non-empty array");
  }
  for (const cat of request.test_categories) {
    if (!APPROVED_TEST_CATEGORIES.includes(cat)) {
      return fail("TSC_UNKNOWN_TEST_CATEGORY", `unknown category: ${String(cat)}`);
    }
  }
  if (typeof request.domain_judgment_placeholders !== "boolean") {
    return fail("TSC_INVALID_REQUEST", "domain_judgment_placeholders must be boolean");
  }
  if (!request.style || typeof request.style !== "object") return fail("TSC_INVALID_STYLE", "style required");

  // Structural spec check (light · deep check handled by typed_data_contract downstream)
  if (typeof request.spec.contract_name !== "string" || request.spec.contract_name.length === 0) {
    return fail("TSC_INVALID_SPEC", "spec.contract_name empty");
  }
  if (!Array.isArray(request.spec.type_only_imports)) return fail("TSC_INVALID_SPEC", "spec.type_only_imports must be array");
  if (!Array.isArray(request.spec.declarations) || request.spec.declarations.length === 0) {
    return fail("TSC_INVALID_SPEC", "spec.declarations must be non-empty");
  }
  for (const d of request.spec.declarations) {
    if (!d || typeof d !== "object" || typeof d.declaration_kind !== "string") {
      return fail("TSC_INVALID_SPEC", "declaration must be object with declaration_kind");
    }
    if (!LOCKED_DECLARATION_KINDS.includes(d.declaration_kind)) {
      return fail("TSC_UNSUPPORTED_DECLARATION_KIND", `declaration_kind '${d.declaration_kind}' not in locked grammar`);
    }
    if (!isValidIdentifier(d.name)) {
      return fail("TSC_INVALID_IDENTIFIER", `declaration name invalid: ${String(d.name)}`);
    }
  }
  return null;
}

// ── Template renderers · one per test category ─────────────────────────

interface RenderContext {
  readonly spec: TypedDataContractSpec;
  readonly style: StyleProfile;
  readonly source_specifier: string;
  readonly test_categories: readonly TestCategory[];
  readonly domain_judgment_placeholders: boolean;
  readonly imports_to_add: Set<string>;  // symbols that need to be imported from source_module
  readonly imports_to_add_types: Set<string>;
}

function renderRangeBoundsTests(
  ctx: RenderContext,
  idx: number,
  name: string,
  min: number,
  max: number,
): string[] {
  ctx.imports_to_add.add(name);
  const s = semi(ctx.style);
  return [
    `  it(${q(`R-${idx}-${name}-min · ${name} min = ${min}`, ctx.style)}, () => {`,
    `    expect(${name}.min).toBe(${min})${s}`,
    `  })${s}`,
    `  it(${q(`R-${idx}-${name}-max · ${name} max = ${max}`, ctx.style)}, () => {`,
    `    expect(${name}.max).toBe(${max})${s}`,
    `  })${s}`,
    `  it(${q(`R-${idx}-${name}-frozen · ${name} is frozen`, ctx.style)}, () => {`,
    `    expect(Object.isFrozen(${name})).toBe(true)${s}`,
    `  })${s}`,
  ];
}

function renderUnionIntegrityTests(
  ctx: RenderContext,
  idx: number,
  name: string,
  literals: readonly string[],
): string[] {
  const membersName = `${name}_MEMBERS`;
  ctx.imports_to_add.add(membersName);
  ctx.imports_to_add_types.add(name);
  const s = semi(ctx.style);
  const literalsList = literals.map((l) => q(l, ctx.style)).join(", ");
  return [
    `  it(${q(`U-${idx}-${name}-length · ${membersName} length = ${literals.length}`, ctx.style)}, () => {`,
    `    expect(${membersName}.length).toBe(${literals.length})${s}`,
    `  })${s}`,
    `  it(${q(`U-${idx}-${name}-frozen · ${membersName} is frozen`, ctx.style)}, () => {`,
    `    expect(Object.isFrozen(${membersName})).toBe(true)${s}`,
    `  })${s}`,
    `  it(${q(`U-${idx}-${name}-contains · every declared literal present`, ctx.style)}, () => {`,
    `    for (const lit of [${literalsList}]) expect(${membersName}).toContain(lit)${s}`,
    `  })${s}`,
  ];
}

function renderInterfaceShapeTests(
  ctx: RenderContext,
  idx: number,
  decl: Extract<TypedDataContractDeclaration, { declaration_kind: "interface" }>,
): string[] {
  ctx.imports_to_add_types.add(decl.name);
  const s = semi(ctx.style);
  const sample = sampleForInterface(decl, ctx.spec, ctx.style, 1);
  const firstField = decl.fields[0];
  const firstFieldSample = sampleForType(firstField.type, ctx.spec, ctx.style, 1);
  return [
    `  it(${q(`I-${idx}-${decl.name}-shape · ${decl.name} shape is inhabitable with deterministic sample`, ctx.style)}, () => {`,
    `    const sample: ${decl.name} = ${sample}${s}`,
    `    expect(sample.${firstField.name}).toEqual(${firstFieldSample})${s}`,
    `  })${s}`,
  ];
}

function renderRefusalTriggerabilityTests(
  ctx: RenderContext,
  idx: number,
  validator: Extract<TypedDataContractDeclaration, { declaration_kind: "validator_function" }>,
): string[] {
  ctx.imports_to_add.add(validator.name);
  ctx.imports_to_add_types.add(validator.input_type_name);
  const s = semi(ctx.style);
  const inputName = validator.input_type_name;
  const inputDecl = ctx.spec.declarations.find(
    (d) => d.name === inputName && d.declaration_kind === "interface",
  );
  // Deterministic valid fixture builder
  let validFixture = "{}";
  if (inputDecl && inputDecl.declaration_kind === "interface") {
    validFixture = sampleForInterface(inputDecl, ctx.spec, ctx.style, 1);
  }
  const lines: string[] = [];
  // Emit fixture helper once
  lines.push(`  function validFixture_${validator.name}(): ${inputName} {`);
  lines.push(`    return ${validFixture} as ${inputName}${s}`);
  lines.push(`  }`);
  lines.push(``);
  lines.push(`  function withPath_${validator.name}(fs: ${inputName}, p: string, v: unknown): ${inputName} {`);
  lines.push(`    const clone = JSON.parse(JSON.stringify(fs))${s}`);
  lines.push(`    const parts = p.split(${q(".", ctx.style)})${s}`);
  lines.push(`    let cursor: Record<string, unknown> = clone as Record<string, unknown>${s}`);
  lines.push(`    for (let i = 0; i < parts.length - 1; i++) {`);
  lines.push(`      cursor = cursor[parts[i]] as Record<string, unknown>${s}`);
  lines.push(`    }`);
  lines.push(`    cursor[parts[parts.length - 1]] = v${s}`);
  lines.push(`    return clone as ${inputName}${s}`);
  lines.push(`  }`);
  lines.push(``);
  lines.push(`  function withDelete_${validator.name}(fs: ${inputName}, p: string): ${inputName} {`);
  lines.push(`    const clone = JSON.parse(JSON.stringify(fs))${s}`);
  lines.push(`    const parts = p.split(${q(".", ctx.style)})${s}`);
  lines.push(`    let cursor: Record<string, unknown> = clone as Record<string, unknown>${s}`);
  lines.push(`    for (let i = 0; i < parts.length - 1; i++) {`);
  lines.push(`      cursor = cursor[parts[i]] as Record<string, unknown>${s}`);
  lines.push(`    }`);
  lines.push(`    delete cursor[parts[parts.length - 1]]${s}`);
  lines.push(`    return clone as ${inputName}${s}`);
  lines.push(`  }`);
  lines.push(``);
  for (let checkIdx = 0; checkIdx < validator.checks.length; checkIdx++) {
    const check = validator.checks[checkIdx];
    const testId = `V-${idx}-${checkIdx}-${check.refusal_reason_literal}`;
    const invalid = invalidSampleForCheck(check, ctx.spec, ctx.style);
    lines.push(`  it(${q(`${testId} · ${validator.name} emits ${check.refusal_reason_literal} when ${check.field_path} triggers ${check.check_kind}`, ctx.style)}, () => {`);
    if (invalid.delete_) {
      lines.push(`    const bad = withDelete_${validator.name}(validFixture_${validator.name}(), ${q(check.field_path, ctx.style)})${s}`);
    } else {
      lines.push(`    const bad = withPath_${validator.name}(validFixture_${validator.name}(), ${q(check.field_path, ctx.style)}, ${invalid.assign})${s}`);
    }
    lines.push(`    const r = ${validator.name}(bad)${s}`);
    lines.push(`    expect(r.ok).toBe(false)${s}`);
    lines.push(`    if (r.ok) throw new Error(${q("unreachable", ctx.style)})${s}`);
    lines.push(`    expect(r.reason).toBe(${q(check.refusal_reason_literal, ctx.style)})${s}`);
    lines.push(`  })${s}`);
  }
  return lines;
}

function renderSerialiserDeterminismTests(
  ctx: RenderContext,
  idx: number,
  serialiser: Extract<TypedDataContractDeclaration, { declaration_kind: "serialiser_function" }>,
): string[] {
  ctx.imports_to_add.add(serialiser.name);
  ctx.imports_to_add_types.add(serialiser.input_type_name);
  const s = semi(ctx.style);
  const inputName = serialiser.input_type_name;
  const inputDecl = ctx.spec.declarations.find(
    (d) => d.name === inputName && d.declaration_kind === "interface",
  );
  let fixture = "{}";
  if (inputDecl && inputDecl.declaration_kind === "interface") {
    fixture = sampleForInterface(inputDecl, ctx.spec, ctx.style, 1);
  }
  const lines: string[] = [];
  lines.push(`  function fixture_${serialiser.name}(): ${inputName} {`);
  lines.push(`    return ${fixture} as ${inputName}${s}`);
  lines.push(`  }`);
  lines.push(``);
  lines.push(`  it(${q(`S-${idx}-${serialiser.name}-byte-stable · same input twice produces byte-identical output`, ctx.style)}, () => {`);
  lines.push(`    const a = ${serialiser.name}(fixture_${serialiser.name}())${s}`);
  lines.push(`    const b = ${serialiser.name}(fixture_${serialiser.name}())${s}`);
  lines.push(`    expect(a).toBe(b)${s}`);
  lines.push(`  })${s}`);
  lines.push(`  it(${q(`S-${idx}-${serialiser.name}-round-trip · JSON.parse(serialise(x)) structurally equals x`, ctx.style)}, () => {`);
  lines.push(`    const original = fixture_${serialiser.name}()${s}`);
  lines.push(`    expect(JSON.parse(${serialiser.name}(original))).toEqual(original)${s}`);
  lines.push(`  })${s}`);
  const propOrderList = serialiser.property_order.map((p) => q(p, ctx.style)).join(", ");
  lines.push(`  it(${q(`S-${idx}-${serialiser.name}-property-order · locked property order preserved`, ctx.style)}, () => {`);
  lines.push(`    const out = ${serialiser.name}(fixture_${serialiser.name}())${s}`);
  lines.push(`    const expectedOrder = [${propOrderList}]${s}`);
  lines.push(`    let previousIdx = -1${s}`);
  lines.push(`    for (const prop of expectedOrder) {`);
  lines.push(`      const idxProp = out.indexOf(prop)${s}`);
  lines.push(`      expect(idxProp).toBeGreaterThan(previousIdx)${s}`);
  lines.push(`      previousIdx = idxProp${s}`);
  lines.push(`    }`);
  lines.push(`  })${s}`);
  return lines;
}

function renderContaminationGuardTests(ctx: RenderContext): string[] {
  const s = semi(ctx.style);
  const specFile = ctx.source_specifier.startsWith("./") ? ctx.source_specifier.slice(2) : ctx.source_specifier;
  return [
    `  it(${q(`C-source-clean · source file contains no forbidden substrings`, ctx.style)}, () => {`,
    `    const nfs = require(${q("node:fs", ctx.style)}) as typeof import("node:fs")${s}`,
    `    const npath = require(${q("node:path", ctx.style)}) as typeof import("node:path")${s}`,
    `    const content = nfs.readFileSync(npath.join(__dirname, ${q("..", ctx.style)}, ${q(`${specFile}.ts`, ctx.style)}), ${q("utf8", ctx.style)})${s}`,
    `    for (const bad of [${q("eval(", ctx.style)}, ${q("Function(", ctx.style)}, ${q("require(", ctx.style)}, ${q("process.", ctx.style)}, ${q("child_process", ctx.style)}, ${q("<script", ctx.style)}]) {`,
    `      expect(content).not.toContain(bad)${s}`,
    `    }`,
    `  })${s}`,
  ];
}

// ── Main entry point ───────────────────────────────────────────────────

export function authorTestScaffold(request: TestScaffoldRequest): TestScaffoldResult {
  // 1. Request validation
  const requestFail = validateRequest(request);
  if (requestFail) return requestFail;

  // Style defaults
  const style: StyleProfile = {
    ...request.style,
    quote_style: request.style.quote_style === "unknown" ? "double" : request.style.quote_style,
    semicolons: request.style.semicolons === "unknown" ? "yes" : request.style.semicolons,
    export_style: request.style.export_style === "unknown" ? "named" : request.style.export_style,
  };

  // 2. Ambiguity detection (AMB-1..AMB-10 · hard gate)
  const ambiguity = detectAmbiguity(request.spec);
  if (ambiguity) return ambiguity;

  // 3. Emit tests per category
  const ctx: RenderContext = {
    spec: request.spec,
    style,
    source_specifier: request.source_module_specifier,
    test_categories: request.test_categories,
    domain_judgment_placeholders: request.domain_judgment_placeholders,
    imports_to_add: new Set<string>(),
    imports_to_add_types: new Set<string>(),
  };

  const bodyLines: string[] = [];
  const gapNotes: GapNote[] = [];
  let testCount = 0;
  let placeholderCount = 0;

  // Deterministic iteration order: declaration order in spec
  // For each declaration · emit tests for each applicable category
  for (let i = 0; i < request.spec.declarations.length; i++) {
    const decl = request.spec.declarations[i];
    // range_bounds · numeric_range_constant
    if (decl.declaration_kind === "numeric_range_constant" && request.test_categories.includes("range_bounds")) {
      const lines = renderRangeBoundsTests(ctx, i, decl.name, decl.min, decl.max);
      bodyLines.push(...lines);
      bodyLines.push(``);
      testCount += 3;
    }
    // union_integrity · literal_union + refusal_reason_union
    if ((decl.declaration_kind === "literal_union" || decl.declaration_kind === "refusal_reason_union") && request.test_categories.includes("union_integrity")) {
      const literals = decl.declaration_kind === "literal_union" ? decl.literals : decl.reasons;
      const lines = renderUnionIntegrityTests(ctx, i, decl.name, literals);
      bodyLines.push(...lines);
      bodyLines.push(``);
      testCount += 3;
    }
    // interface_shape · interface
    if (decl.declaration_kind === "interface" && request.test_categories.includes("interface_shape")) {
      const lines = renderInterfaceShapeTests(ctx, i, decl);
      bodyLines.push(...lines);
      bodyLines.push(``);
      testCount += 1;
    }
    // refusal_triggerability · validator_function
    if (decl.declaration_kind === "validator_function" && request.test_categories.includes("refusal_triggerability")) {
      const lines = renderRefusalTriggerabilityTests(ctx, i, decl);
      bodyLines.push(...lines);
      bodyLines.push(``);
      testCount += decl.checks.length;
    }
    // serialiser_determinism · serialiser_function
    if (decl.declaration_kind === "serialiser_function" && request.test_categories.includes("serialiser_determinism")) {
      const lines = renderSerialiserDeterminismTests(ctx, i, decl);
      bodyLines.push(...lines);
      bodyLines.push(``);
      testCount += 3;
    }

    // Emit gap_notes for domain-judgment categories (deterministic)
    if (decl.declaration_kind === "validator_function") {
      gapNotes.push({
        kind: "domain_judgment_required",
        declaration_ref: decl.name,
        description: `Validator '${decl.name}' has mechanical refusal-triggerability tests but semantic/domain-judgment tests (e.g., "does the correct band/reason apply to the correct business input?") must still be authored by MAI/human.`,
      });
      if (request.domain_judgment_placeholders) {
        bodyLines.push(`  it.todo(${q(`V-${i}-domain-judgment · ${decl.name} semantic acceptance tests (MAI supplies)`, style)})${semi(style)}`);
        bodyLines.push(``);
        placeholderCount += 1;
      }
    }
    if (decl.declaration_kind === "interface") {
      gapNotes.push({
        kind: "semantic_check_needed",
        declaration_ref: decl.name,
        description: `Interface '${decl.name}' has mechanical shape test but semantic tests (e.g., "do these field combinations mean what the product expects?") must still be authored by MAI/human.`,
      });
    }
  }

  // contamination_guard · once per source file
  if (request.test_categories.includes("contamination_guard")) {
    const lines = renderContaminationGuardTests(ctx);
    bodyLines.push(...lines);
    bodyLines.push(``);
    testCount += 1;
  }

  // 4. Assemble imports
  const importLines: string[] = [];
  const s = semi(style);
  if (ctx.imports_to_add_types.size > 0) {
    const typeSyms = [...ctx.imports_to_add_types].sort().join(", ");
    importLines.push(`import type { ${typeSyms} } from ${q(request.source_module_specifier, style)}${s}`);
  }
  if (ctx.imports_to_add.size > 0) {
    const runtimeSyms = [...ctx.imports_to_add].sort().join(", ");
    importLines.push(`import { ${runtimeSyms} } from ${q(request.source_module_specifier, style)}${s}`);
  }

  // 5. Assemble file content
  const header: string[] = [
    `// §36-D-D · ROUTE-R2 · 2026-09-14 · test-scaffold-authored file.`,
    `// Contract: ${request.spec.contract_name}`,
    `// Deterministic mechanical tests. Do not edit — regenerate.`,
    `// Domain-judgment tests remain the responsibility of MAI/human.`,
  ];
  const preamble: string[] = [
    ``,
    `import { describe, expect, it } from ${q("vitest", style)}${s}`,
    ...importLines,
    ``,
    `describe(${q(`§36-D-D · ${request.spec.contract_name} · mechanical scaffold`, style)}, () => {`,
  ];
  const footer: string[] = [
    `})${s}`,
    ``,
  ];
  const content = [...header, ...preamble, ...bodyLines, ...footer].join("\n");

  // 6. Bounded output check
  const byteSize = Buffer.byteLength(content, "utf8");
  if (byteSize > TSC_MAX_OUTPUT_BYTES) {
    return fail("TSC_OUTPUT_TOO_LARGE", `content ${byteSize} bytes > ${TSC_MAX_OUTPUT_BYTES}`);
  }

  // 7. Compute scaffold_sha256
  const sha = createHash("sha256").update(content, "utf8").digest("hex");

  const result: TestScaffoldSuccess = {
    ok: true,
    content,
    test_count_authored: testCount,
    test_count_todo_placeholders: placeholderCount,
    gap_notes: gapNotes,
    scaffold_sha256: sha,
  };
  return result;
}
