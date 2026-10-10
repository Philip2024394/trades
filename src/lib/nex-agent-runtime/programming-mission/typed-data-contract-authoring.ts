// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract infrastructure.
// §36-B · ROUTE-2B · 2026-09-14 · runtime-imports infrastructure.
// §36-C · ROUTE-2C · 2026-09-14 · runtime-import literals (cross-file refusal-union at author time).
//
// Deterministic authoring primitive for `typed_data_contract` missions.
// Spec-driven (not evidence-driven): the mission specifies exact
// declarations via TypedDataContractSpec · this primitive validates
// against the locked grammar and renders byte-stable TypeScript.
//
// Boundary declaration (verbatim from §36-A amendment · unamendable):
//   "Infrastructure enables NEX1 to build C1; infrastructure does not
//    build C1 on NEX1's behalf."
//
// Route 2b extension (§36-B · unamendable):
//   "Route 2b enables NEX1 to author cross-file capability contracts;
//    it does not permit runtime imports of anything beyond
//    numeric_range_constants and literal_unions from workspace siblings."
//
// This primitive is NOT a general-purpose code generator. It rejects
// any spec that falls outside the eight-declaration-kind grammar. It
// produces only type declarations, refusal unions, numeric-range
// constants, and BOUNDED validator/serialiser functions whose bodies
// are derived solely from declared checks + declared property orders.
//
// Route 2b adds an optional `runtime_imports` field on the spec — only
// two kinds may be imported at runtime (numeric_range_constant and
// literal_union) and the specifier must be a workspace-relative sibling.
//
// See docs/NEX1/SECTION_36_A_ROUTE_2_LAB_AUTHORING_AMENDMENT.md and
// docs/NEX1/SECTION_36_B_ROUTE_2B_RUNTIME_IMPORTS_AMENDMENT.md.

import type {
  StyleProfile,
  TDCDiscriminatedVariant,
  TDCField,
  TDCRuntimeImport,
  TDCTypeExpression,
  TDCTypeOnlyImport,
  TDCValidatorCheck,
  TypedDataContractDeclaration,
  TypedDataContractSpec,
} from "./types";

// ── Refusal codes (exhaustive · structured · deterministic) ────────────

export type TypedDataContractRefusalCode =
  | "TDC_EMPTY_SPEC"
  | "TDC_TOO_MANY_DECLARATIONS"
  | "TDC_INVALID_IDENTIFIER"
  | "TDC_DUPLICATE_DECLARATION"
  | "TDC_INVALID_PATH"
  | "TDC_INVALID_EXTENSION"
  | "TDC_HEADER_TOO_LONG"
  | "TDC_INVALID_TYPE_REFERENCE"
  | "TDC_INVALID_RANGE"
  | "TDC_INVALID_LITERAL"
  | "TDC_DUPLICATE_FIELD"
  | "TDC_DUPLICATE_VARIANT"
  | "TDC_DUPLICATE_LITERAL"
  | "TDC_EMPTY_DECLARATION"
  | "TDC_VALIDATOR_MISSING_REFUSAL_UNION"
  | "TDC_VALIDATOR_UNKNOWN_REFUSAL"
  | "TDC_VALIDATOR_UNKNOWN_REFERENCE"
  | "TDC_SERIALISER_UNKNOWN_INPUT"
  | "TDC_SERIALISER_PROPERTY_MISMATCH"
  | "TDC_OUTPUT_LIMIT_EXCEEDED"
  | "TDC_PROHIBITED_STRING_CONTENT"
  // §36-B · ROUTE-2B · 2026-09-14 · runtime-imports refusal codes
  | "TDC_RUNTIME_IMPORT_INVALID_KIND"
  | "TDC_RUNTIME_IMPORT_PROTOCOL_SCHEME"
  | "TDC_RUNTIME_IMPORT_NODE_BUILTIN"
  | "TDC_RUNTIME_IMPORT_PACKAGE_SPECIFIER"
  | "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER"
  | "TDC_RUNTIME_IMPORT_COLLISION"
  // §36-C · ROUTE-2C · 2026-09-14 · runtime-import literals refusal codes
  | "TDC_RUNTIME_IMPORT_LITERALS_ON_WRONG_KIND"
  | "TDC_RUNTIME_IMPORT_LITERALS_EMPTY"
  | "TDC_RUNTIME_IMPORT_LITERALS_DUPLICATE"
  | "TDC_RUNTIME_IMPORT_LITERAL_INVALID";

export interface TypedDataContractAuthoringFailure {
  readonly ok: false;
  readonly refusal_code: TypedDataContractRefusalCode;
  readonly reason: string;
  readonly declaration_index?: number;
}

export interface TypedDataContractAuthoringSuccess {
  readonly ok: true;
  readonly content: string;
  readonly declaration_count: number;
  readonly byte_size: number;
}

export type TypedDataContractAuthoringResult =
  | TypedDataContractAuthoringSuccess
  | TypedDataContractAuthoringFailure;

// ── Output limits (locked · from §36-A §7 + safety envelope) ───────────

const MAX_DECLARATIONS_PER_SPEC = 32;
const MAX_FIELDS_PER_INTERFACE = 64;
const MAX_VARIANTS_PER_DISCRIMINATED_UNION = 16;
const MAX_LITERALS_PER_UNION = 64;
const MAX_REASONS_PER_REFUSAL_UNION = 32;
const MAX_CHECKS_PER_VALIDATOR = 128;
const MAX_ARTEFACT_BYTES = 32 * 1024; // 32 KB per §36-A §7
const MAX_HEADER_COMMENT_LENGTH = 4096;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_LITERAL_STRING_LENGTH = 256;
const MAX_NESTING_DEPTH = 8;         // hard cap on nested object types

// ── Identifier + literal validation (deliberately narrow) ──────────────

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Dangerous character classes we refuse regardless of context:
//   - ASCII control codes (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F) — but NOT
//     tab (0x09), newline (0x0A), or CR (0x0D). CR is refused elsewhere for
//     byte stability; newline is allowed only in header_comment.
//   - Zero-width chars (U+200B..U+200F) — invisible payload smuggling.
//   - Line/paragraph separators (U+2028, U+2029) — JS parsers treat these as
//     line terminators; they are a surprise vector inside comments/literals.
//   - Bidi overrides (U+202A..U+202E) — RTL/LTR spoofing.
//   - Byte order mark (U+FEFF) — invisible.
// Everything else (Latin-1 Supplement, common punctuation like middle-dot,
// en-dash, em-dash, arrows) is permitted; NEX text uses these routinely.
// The regex uses \uXXXX escape sequences only — literal invisible chars in
// source break the oxc parser.
const DANGEROUS_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028\u2029\u202A-\u202E\uFEFF]/;

// Prohibited substrings anywhere in string content (belt and braces vs
// grammar rules · a second line of defence against payload smuggling).
const PROHIBITED_STRING_SUBSTRINGS: readonly string[] = Object.freeze([
  "eval(",
  "Function(",
  "new Function",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "require(",
  "import(",
  "process.",
  "child_process",
  "__proto__",
  "constructor.prototype",
  "</script",
  "<script",
]);

function containsDangerous(s: string): boolean {
  return DANGEROUS_CHARS_RE.test(s);
}

function containsProhibitedSubstring(s: string): boolean {
  for (const bad of PROHIBITED_STRING_SUBSTRINGS) {
    if (s.includes(bad)) return true;
  }
  return false;
}

function isValidIdentifier(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= MAX_IDENTIFIER_LENGTH && IDENTIFIER_RE.test(s);
}

function isValidLiteralString(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (s.length > MAX_LITERAL_STRING_LENGTH) return false;
  // Literals are single-line · no whitespace formatting characters.
  if (s.includes("\n") || s.includes("\r") || s.includes("\t")) return false;
  if (containsDangerous(s)) return false;
  if (containsProhibitedSubstring(s)) return false;
  return true;
}

function isValidHeaderComment(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (s.length > MAX_HEADER_COMMENT_LENGTH) return false;
  // Header comments MAY contain newlines · but not other control chars.
  // We reject \r explicitly to force LF line endings for byte stability.
  if (s.includes("\r")) return false;
  if (containsDangerous(s)) return false;
  if (containsProhibitedSubstring(s)) return false;
  return true;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && !Number.isNaN(n);
}

// ── Path validation ────────────────────────────────────────────────────

function validateTargetPath(target_path: string): TypedDataContractAuthoringFailure | null {
  if (typeof target_path !== "string" || target_path.length === 0) {
    return { ok: false, refusal_code: "TDC_INVALID_PATH", reason: "target_path empty" };
  }
  if (target_path.includes("..")) {
    return { ok: false, refusal_code: "TDC_INVALID_PATH", reason: "target_path contains '..'" };
  }
  if (target_path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(target_path)) {
    return { ok: false, refusal_code: "TDC_INVALID_PATH", reason: "target_path must be workspace-relative (no absolute paths)" };
  }
  if (target_path.includes("\0")) {
    return { ok: false, refusal_code: "TDC_INVALID_PATH", reason: "target_path contains null byte" };
  }
  if (target_path.includes("\\")) {
    return { ok: false, refusal_code: "TDC_INVALID_PATH", reason: "target_path must use forward slashes (workspace-normalised)" };
  }
  if (!target_path.endsWith(".ts")) {
    return { ok: false, refusal_code: "TDC_INVALID_EXTENSION", reason: "typed_data_contract emits .ts files only" };
  }
  return null;
}

// ── Rendering helpers · deterministic ──────────────────────────────────

function q(s: string, style: StyleProfile): string {
  // Deterministic quote style. Escape only the chosen quote character.
  if (style.quote_style === "single") {
    return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function semi(style: StyleProfile): string {
  return style.semicolons === "no" ? "" : ";";
}

function exportPrefix(exported: boolean): string {
  return exported ? "export " : "";
}

// ── Type-expression validation + rendering ─────────────────────────────

function validateTypeExpression(
  expr: unknown,
  declaredNames: ReadonlySet<string>,
  importedNames: ReadonlySet<string>,
  depth: number,
): { ok: true } | { ok: false; refusal_code: TypedDataContractRefusalCode; reason: string } {
  if (depth > MAX_NESTING_DEPTH) {
    return { ok: false, refusal_code: "TDC_OUTPUT_LIMIT_EXCEEDED", reason: `nesting depth exceeded ${MAX_NESTING_DEPTH}` };
  }
  if (!expr || typeof expr !== "object") {
    return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: "type expression must be an object" };
  }
  const e = expr as { kind?: unknown };
  if (e.kind === "primitive") {
    const type = (expr as { type?: unknown }).type;
    if (type !== "string" && type !== "number" && type !== "boolean") {
      return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `primitive type must be string|number|boolean, got ${String(type)}` };
    }
    return { ok: true };
  }
  if (e.kind === "reference") {
    const to = (expr as { to?: unknown }).to;
    if (!isValidIdentifier(to)) return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `reference name invalid: ${String(to)}` };
    if (!declaredNames.has(to) && !importedNames.has(to)) {
      return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `reference '${to}' not declared in spec or imports` };
    }
    return { ok: true };
  }
  if (e.kind === "array") {
    const element = (expr as { element?: unknown }).element;
    return validateTypeExpression(element, declaredNames, importedNames, depth + 1);
  }
  if (e.kind === "object") {
    const fields = (expr as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: "object type missing fields array" };
    const seenNames = new Set<string>();
    for (const f of fields) {
      const check = validateField(f, declaredNames, importedNames, depth + 1);
      if (!check.ok) return check;
      const fName = (f as { name?: unknown }).name;
      if (typeof fName === "string" && seenNames.has(fName)) {
        return { ok: false, refusal_code: "TDC_DUPLICATE_FIELD", reason: `duplicate field name ${fName} in nested object` };
      }
      if (typeof fName === "string") seenNames.add(fName);
    }
    return { ok: true };
  }
  return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `unknown type expression kind: ${String(e.kind)}` };
}

function validateField(
  field: unknown,
  declaredNames: ReadonlySet<string>,
  importedNames: ReadonlySet<string>,
  depth: number,
): { ok: true } | { ok: false; refusal_code: TypedDataContractRefusalCode; reason: string } {
  if (!field || typeof field !== "object") {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: "field must be an object" };
  }
  const f = field as { name?: unknown; type?: unknown; optional?: unknown; readonly_modifier?: unknown };
  if (!isValidIdentifier(f.name)) {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `field name invalid: ${String(f.name)}` };
  }
  if (typeof f.optional !== "boolean" || typeof f.readonly_modifier !== "boolean") {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `field ${f.name} missing optional/readonly_modifier booleans` };
  }
  return validateTypeExpression(f.type, declaredNames, importedNames, depth);
}

function renderTypeExpression(expr: TDCTypeExpression, style: StyleProfile): string {
  if (expr.kind === "primitive") return expr.type;
  if (expr.kind === "reference") return expr.to;
  if (expr.kind === "array") return `readonly ${renderTypeExpression(expr.element, style)}[]`;
  // object
  const inner = expr.fields.map((f) => renderField(f, style, "  ")).join("\n");
  return `{\n${inner}\n}`;
}

function renderField(field: TDCField, style: StyleProfile, indent: string): string {
  const ro = field.readonly_modifier ? "readonly " : "";
  const opt = field.optional ? "?" : "";
  const type = renderTypeExpression(field.type, style);
  // Multi-line object types get indented; primitives stay inline.
  const typeRendered = type.includes("\n")
    ? type.split("\n").map((line, i) => (i === 0 ? line : indent + line)).join("\n")
    : type;
  return `${indent}${ro}${field.name}${opt}: ${typeRendered}${semi(style)}`;
}

// ── Declaration validators ─────────────────────────────────────────────

function validateDeclaration(
  decl: unknown,
  index: number,
  declaredNames: ReadonlySet<string>,
  importedNames: ReadonlySet<string>,
  allDecls: readonly TypedDataContractDeclaration[],
  // §36-B · Route 2b · optional sets · default to empty for backward-compat
  runtimeImportRangeNames: ReadonlySet<string> = new Set<string>(),
  runtimeImportUnionNames: ReadonlySet<string> = new Set<string>(),
  // §36-C · Route 2c · optional map · default to empty · maps runtime-imported
  // literal_union name → set of its literal members (only when supplied)
  runtimeImportUnionMembers: ReadonlyMap<string, ReadonlySet<string>> = new Map<string, ReadonlySet<string>>(),
): TypedDataContractAuthoringFailure | null {
  if (!decl || typeof decl !== "object") {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: "declaration must be an object", declaration_index: index };
  }
  const d = decl as { declaration_kind?: unknown; name?: unknown; exported?: unknown };
  if (!isValidIdentifier(d.name)) {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `declaration name invalid: ${String(d.name)}`, declaration_index: index };
  }
  if (typeof d.exported !== "boolean") {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `declaration ${d.name} missing exported boolean`, declaration_index: index };
  }

  const kind = d.declaration_kind;

  if (kind === "interface") {
    const fields = (decl as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `interface ${d.name} missing fields`, declaration_index: index };
    }
    if (fields.length === 0) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `interface ${d.name} has zero fields`, declaration_index: index };
    }
    if (fields.length > MAX_FIELDS_PER_INTERFACE) {
      return { ok: false, refusal_code: "TDC_OUTPUT_LIMIT_EXCEEDED", reason: `interface ${d.name} exceeds ${MAX_FIELDS_PER_INTERFACE} fields`, declaration_index: index };
    }
    const seenNames = new Set<string>();
    for (const f of fields) {
      const check = validateField(f, declaredNames, importedNames, 1);
      if (!check.ok) return { ...check, declaration_index: index } as TypedDataContractAuthoringFailure;
      const fName = (f as { name: string }).name;
      if (seenNames.has(fName)) return { ok: false, refusal_code: "TDC_DUPLICATE_FIELD", reason: `duplicate field ${fName} in ${d.name}`, declaration_index: index };
      seenNames.add(fName);
    }
    return null;
  }

  if (kind === "type_alias") {
    const aliased = (decl as { aliased_to?: unknown }).aliased_to;
    const check = validateTypeExpression(aliased, declaredNames, importedNames, 1);
    if (!check.ok) return { ...check, declaration_index: index } as TypedDataContractAuthoringFailure;
    return null;
  }

  if (kind === "discriminated_union") {
    const dField = (decl as { discriminator_field?: unknown }).discriminator_field;
    const variants = (decl as { variants?: unknown }).variants;
    if (!isValidIdentifier(dField)) {
      return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `discriminator_field invalid: ${String(dField)}`, declaration_index: index };
    }
    if (!Array.isArray(variants) || variants.length < 2) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `discriminated_union ${d.name} needs >= 2 variants`, declaration_index: index };
    }
    if (variants.length > MAX_VARIANTS_PER_DISCRIMINATED_UNION) {
      return { ok: false, refusal_code: "TDC_OUTPUT_LIMIT_EXCEEDED", reason: `discriminated_union ${d.name} exceeds ${MAX_VARIANTS_PER_DISCRIMINATED_UNION} variants`, declaration_index: index };
    }
    const seenTags = new Set<string>();
    for (const v of variants) {
      if (!v || typeof v !== "object") {
        return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `variant in ${d.name} must be object`, declaration_index: index };
      }
      const vv = v as { tag_value?: unknown; fields?: unknown };
      if (!isValidLiteralString(vv.tag_value)) {
        return { ok: false, refusal_code: "TDC_INVALID_LITERAL", reason: `variant tag_value invalid in ${d.name}: ${String(vv.tag_value)}`, declaration_index: index };
      }
      if (seenTags.has(vv.tag_value as string)) {
        return { ok: false, refusal_code: "TDC_DUPLICATE_VARIANT", reason: `duplicate variant tag ${vv.tag_value} in ${d.name}`, declaration_index: index };
      }
      seenTags.add(vv.tag_value as string);
      if (!Array.isArray(vv.fields)) {
        return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `variant ${vv.tag_value} missing fields array`, declaration_index: index };
      }
      const seenFields = new Set<string>();
      for (const f of vv.fields) {
        const check = validateField(f, declaredNames, importedNames, 1);
        if (!check.ok) return { ...check, declaration_index: index } as TypedDataContractAuthoringFailure;
        const fName = (f as { name: string }).name;
        if (seenFields.has(fName)) return { ok: false, refusal_code: "TDC_DUPLICATE_FIELD", reason: `duplicate field ${fName} in variant ${vv.tag_value}`, declaration_index: index };
        seenFields.add(fName);
      }
    }
    return null;
  }

  if (kind === "literal_union" || kind === "refusal_reason_union") {
    const key = kind === "literal_union" ? "literals" : "reasons";
    const items = (decl as Record<string, unknown>)[key];
    const cap = kind === "literal_union" ? MAX_LITERALS_PER_UNION : MAX_REASONS_PER_REFUSAL_UNION;
    if (!Array.isArray(items)) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `${kind} ${d.name} missing ${key}`, declaration_index: index };
    }
    if (items.length === 0) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `${kind} ${d.name} has zero ${key}`, declaration_index: index };
    }
    if (items.length > cap) {
      return { ok: false, refusal_code: "TDC_OUTPUT_LIMIT_EXCEEDED", reason: `${kind} ${d.name} exceeds ${cap} ${key}`, declaration_index: index };
    }
    const seen = new Set<string>();
    for (const it of items) {
      if (!isValidLiteralString(it)) {
        return { ok: false, refusal_code: "TDC_INVALID_LITERAL", reason: `${kind} ${d.name} literal invalid: ${String(it)}`, declaration_index: index };
      }
      if (seen.has(it as string)) {
        return { ok: false, refusal_code: "TDC_DUPLICATE_LITERAL", reason: `duplicate literal ${it} in ${d.name}`, declaration_index: index };
      }
      seen.add(it as string);
    }
    return null;
  }

  if (kind === "numeric_range_constant") {
    const min = (decl as { min?: unknown }).min;
    const max = (decl as { max?: unknown }).max;
    if (!isFiniteNumber(min) || !isFiniteNumber(max)) {
      return { ok: false, refusal_code: "TDC_INVALID_RANGE", reason: `range ${d.name} min/max must be finite numbers`, declaration_index: index };
    }
    if ((min as number) > (max as number)) {
      return { ok: false, refusal_code: "TDC_INVALID_RANGE", reason: `range ${d.name} min > max`, declaration_index: index };
    }
    return null;
  }

  if (kind === "validator_function") {
    const inputName = (decl as { input_type_name?: unknown }).input_type_name;
    const refusalUnionName = (decl as { refusal_union_name?: unknown }).refusal_union_name;
    const checks = (decl as { checks?: unknown }).checks;
    if (!isValidIdentifier(inputName)) {
      return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `validator ${d.name} invalid input_type_name`, declaration_index: index };
    }
    if (!declaredNames.has(inputName as string) && !importedNames.has(inputName as string)) {
      return { ok: false, refusal_code: "TDC_VALIDATOR_UNKNOWN_REFERENCE", reason: `validator ${d.name} input_type_name '${inputName}' not declared or imported`, declaration_index: index };
    }
    if (!isValidIdentifier(refusalUnionName)) {
      return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `validator ${d.name} invalid refusal_union_name`, declaration_index: index };
    }
    // §36-C · Route 2c · resolve refusal_union_name against:
    //   (1) local refusal_reason_union or literal_union declaration (existing) OR
    //   (2) runtime-imported literal_union with `literals` supplied (new).
    // When resolved via runtime_import, the supplied literals form the
    // author-time member vocabulary for refusal_reason_literal checks.
    const refusalDecl = allDecls.find(
      (dd) =>
        (dd.declaration_kind === "refusal_reason_union" || dd.declaration_kind === "literal_union") &&
        dd.name === refusalUnionName,
    );
    const runtimeImportedRefusalMembers = runtimeImportUnionMembers.get(refusalUnionName as string);
    if (!refusalDecl && !runtimeImportedRefusalMembers) {
      // Distinguish: runtime-imported literal_union without literals field vs. not found at all
      if (runtimeImportUnionNames.has(refusalUnionName as string)) {
        return { ok: false, refusal_code: "TDC_VALIDATOR_MISSING_REFUSAL_UNION", reason: `validator ${d.name} refusal_union_name '${refusalUnionName}' is a runtime_import but does not supply the required literals field (§36-C)`, declaration_index: index };
      }
      return { ok: false, refusal_code: "TDC_VALIDATOR_MISSING_REFUSAL_UNION", reason: `validator ${d.name} refusal_union_name '${refusalUnionName}' not found (neither local nor runtime_imports with literals)`, declaration_index: index };
    }
    const allowedReasons: ReadonlySet<string> = runtimeImportedRefusalMembers
      ? runtimeImportedRefusalMembers
      : new Set<string>(
          refusalDecl!.declaration_kind === "refusal_reason_union" ? refusalDecl!.reasons : refusalDecl!.literals,
        );
    if (!Array.isArray(checks)) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `validator ${d.name} missing checks array`, declaration_index: index };
    }
    if (checks.length === 0) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `validator ${d.name} has zero checks`, declaration_index: index };
    }
    if (checks.length > MAX_CHECKS_PER_VALIDATOR) {
      return { ok: false, refusal_code: "TDC_OUTPUT_LIMIT_EXCEEDED", reason: `validator ${d.name} exceeds ${MAX_CHECKS_PER_VALIDATOR} checks`, declaration_index: index };
    }
    for (const c of checks as readonly unknown[]) {
      if (!c || typeof c !== "object") return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `validator ${d.name} malformed check`, declaration_index: index };
      const cc = c as TDCValidatorCheck;
      if (typeof cc.field_path !== "string" || cc.field_path.length === 0) {
        return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `validator ${d.name} check missing field_path`, declaration_index: index };
      }
      // Enforce dot-notation path made of valid identifiers.
      for (const part of cc.field_path.split(".")) {
        if (!isValidIdentifier(part)) {
          return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `validator ${d.name} field_path segment invalid: ${part}`, declaration_index: index };
        }
      }
      if (cc.check_kind !== "range_within" && cc.check_kind !== "literal_union_member" && cc.check_kind !== "required_present") {
        return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `validator ${d.name} unknown check_kind: ${String(cc.check_kind)}`, declaration_index: index };
      }
      if (cc.check_kind === "range_within" || cc.check_kind === "literal_union_member") {
        if (!isValidIdentifier(cc.reference_name)) {
          return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `validator ${d.name} check missing reference_name`, declaration_index: index };
        }
        // §36-B · Route 2b · resolve reference_name against:
        //   (1) local declarations OR
        //   (2) runtime_imports of the appropriate kind.
        // Runtime import must be of the matching kind for the check.
        const target = allDecls.find((dd) => dd.name === cc.reference_name);
        const inRuntimeRange = runtimeImportRangeNames.has(cc.reference_name as string);
        const inRuntimeUnion = runtimeImportUnionNames.has(cc.reference_name as string);
        if (!target && !inRuntimeRange && !inRuntimeUnion) {
          return { ok: false, refusal_code: "TDC_VALIDATOR_UNKNOWN_REFERENCE", reason: `validator ${d.name} check reference '${cc.reference_name}' not found (neither local nor runtime_imports)`, declaration_index: index };
        }
        if (cc.check_kind === "range_within") {
          const kindOk = (target && target.declaration_kind === "numeric_range_constant") || inRuntimeRange;
          if (!kindOk) {
            return { ok: false, refusal_code: "TDC_VALIDATOR_UNKNOWN_REFERENCE", reason: `validator ${d.name} range_within reference '${cc.reference_name}' is not a numeric_range_constant (local or runtime_import)`, declaration_index: index };
          }
        }
        if (cc.check_kind === "literal_union_member") {
          const kindOk = (target && (target.declaration_kind === "literal_union" || target.declaration_kind === "refusal_reason_union")) || inRuntimeUnion;
          if (!kindOk) {
            return { ok: false, refusal_code: "TDC_VALIDATOR_UNKNOWN_REFERENCE", reason: `validator ${d.name} literal_union_member reference '${cc.reference_name}' is not a literal_union (local or runtime_import)`, declaration_index: index };
          }
        }
      }
      if (!isValidLiteralString(cc.refusal_reason_literal)) {
        return { ok: false, refusal_code: "TDC_INVALID_LITERAL", reason: `validator ${d.name} check refusal_reason_literal invalid`, declaration_index: index };
      }
      if (!allowedReasons.has(cc.refusal_reason_literal)) {
        return { ok: false, refusal_code: "TDC_VALIDATOR_UNKNOWN_REFUSAL", reason: `validator ${d.name} refusal_reason_literal '${cc.refusal_reason_literal}' not a member of ${refusalUnionName}`, declaration_index: index };
      }
    }
    return null;
  }

  if (kind === "serialiser_function") {
    const inputName = (decl as { input_type_name?: unknown }).input_type_name;
    const propOrder = (decl as { property_order?: unknown }).property_order;
    if (!isValidIdentifier(inputName)) {
      return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `serialiser ${d.name} invalid input_type_name`, declaration_index: index };
    }
    const target = allDecls.find((dd) => dd.name === inputName);
    if (!target && !importedNames.has(inputName as string)) {
      return { ok: false, refusal_code: "TDC_SERIALISER_UNKNOWN_INPUT", reason: `serialiser ${d.name} input '${inputName}' not declared/imported`, declaration_index: index };
    }
    if (!Array.isArray(propOrder) || propOrder.length === 0) {
      return { ok: false, refusal_code: "TDC_EMPTY_DECLARATION", reason: `serialiser ${d.name} missing property_order`, declaration_index: index };
    }
    const seen = new Set<string>();
    for (const p of propOrder) {
      if (!isValidIdentifier(p)) {
        return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `serialiser ${d.name} property_order entry invalid: ${String(p)}`, declaration_index: index };
      }
      if (seen.has(p as string)) {
        return { ok: false, refusal_code: "TDC_SERIALISER_PROPERTY_MISMATCH", reason: `serialiser ${d.name} duplicate property_order entry: ${p}`, declaration_index: index };
      }
      seen.add(p as string);
    }
    // If the target is a local interface, verify property_order is a subset of its top-level field names.
    if (target && target.declaration_kind === "interface") {
      const fieldNames = new Set(target.fields.map((f) => f.name));
      for (const p of propOrder as readonly string[]) {
        if (!fieldNames.has(p)) {
          return { ok: false, refusal_code: "TDC_SERIALISER_PROPERTY_MISMATCH", reason: `serialiser ${d.name} property '${p}' not a field of interface ${inputName}`, declaration_index: index };
        }
      }
    }
    return null;
  }

  return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `unknown declaration_kind: ${String(kind)}`, declaration_index: index };
}

// ── Renderers · one per declaration kind · deterministic ───────────────

function renderInterface(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "interface" }>,
  style: StyleProfile,
): string {
  const lines: string[] = [];
  lines.push(`${exportPrefix(d.exported)}interface ${d.name} {`);
  for (const f of d.fields) {
    lines.push(renderField(f, style, "  "));
  }
  lines.push(`}`);
  return lines.join("\n");
}

function renderTypeAlias(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "type_alias" }>,
  style: StyleProfile,
): string {
  return `${exportPrefix(d.exported)}type ${d.name} = ${renderTypeExpression(d.aliased_to, style)}${semi(style)}`;
}

function renderDiscriminatedUnion(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "discriminated_union" }>,
  style: StyleProfile,
): string {
  const variantTypes = d.variants.map((v: TDCDiscriminatedVariant) => {
    const inner: string[] = [];
    inner.push(`{`);
    inner.push(`  readonly ${d.discriminator_field}: ${q(v.tag_value, style)}${semi(style)}`);
    for (const f of v.fields) {
      inner.push(renderField(f, style, "  "));
    }
    inner.push(`}`);
    return inner.join("\n");
  });
  const joined = variantTypes.map((t) => t.split("\n").map((l, i) => (i === 0 ? "  | " + l : "    " + l)).join("\n")).join("\n");
  return `${exportPrefix(d.exported)}type ${d.name} =\n${joined}${semi(style)}`;
}

function renderLiteralUnion(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "literal_union" }>,
  style: StyleProfile,
): string {
  const parts = d.literals.map((l) => q(l, style));
  return `${exportPrefix(d.exported)}type ${d.name} =\n  | ${parts.join("\n  | ")}${semi(style)}`;
}

function renderRefusalReasonUnion(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "refusal_reason_union" }>,
  style: StyleProfile,
): string {
  const parts = d.reasons.map((r) => q(r, style));
  return `${exportPrefix(d.exported)}type ${d.name} =\n  | ${parts.join("\n  | ")}${semi(style)}`;
}

function renderNumericRangeConstant(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "numeric_range_constant" }>,
  style: StyleProfile,
): string {
  const s = semi(style);
  return `${exportPrefix(d.exported)}const ${d.name}: { readonly min: number; readonly max: number } = Object.freeze({ min: ${d.min}, max: ${d.max} })${s}`;
}

function renderValidatorFunction(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "validator_function" }>,
  style: StyleProfile,
): string {
  const s = semi(style);
  const lines: string[] = [];
  lines.push(`${exportPrefix(d.exported)}function ${d.name}(input: ${d.input_type_name}): { readonly ok: true } | { readonly ok: false; readonly reason: ${d.refusal_union_name} } {`);
  for (const c of d.checks) {
    const accessor = c.field_path.split(".").map((p) => `[${q(p, style)}]`).join("");
    const inputExpr = `(input as unknown as Record<string, unknown>)`;
    // Walk the path — nested access chained via `[key]`. Determined at author time.
    const walk = c.field_path.split(".");
    // We emit a helper access that gives a runtime value from `input` at the declared path.
    // For depth 1, that's `input["k"]`; for nested, chain `Record<string, unknown>` casts.
    // We choose a single readable form for clarity + determinism:
    const walkExpr = walk.reduce((acc, part, i) => {
      if (i === 0) return `(input as unknown as Record<string, unknown>)[${q(part, style)}]`;
      return `((${acc}) as Record<string, unknown>)[${q(part, style)}]`;
    }, "");
    if (c.check_kind === "required_present") {
      lines.push(`  if (${walkExpr} === undefined || ${walkExpr} === null) {`);
      lines.push(`    return { ok: false, reason: ${q(c.refusal_reason_literal, style)} }${s}`);
      lines.push(`  }`);
    } else if (c.check_kind === "range_within") {
      lines.push(`  {`);
      lines.push(`    const v = ${walkExpr}${s}`);
      lines.push(`    if (typeof v !== "number" || !Number.isFinite(v) || v < ${c.reference_name}.min || v > ${c.reference_name}.max) {`);
      lines.push(`      return { ok: false, reason: ${q(c.refusal_reason_literal, style)} }${s}`);
      lines.push(`    }`);
      lines.push(`  }`);
    } else {
      // literal_union_member
      lines.push(`  {`);
      lines.push(`    const v = ${walkExpr}${s}`);
      lines.push(`    const allowed: readonly string[] = ${c.reference_name}_MEMBERS${s}`);
      lines.push(`    if (typeof v !== "string" || !allowed.includes(v)) {`);
      lines.push(`      return { ok: false, reason: ${q(c.refusal_reason_literal, style)} }${s}`);
      lines.push(`    }`);
      lines.push(`  }`);
    }
    // accessor variable is retained but not used to avoid TS 'unused' warnings
    void accessor;
    void inputExpr;
  }
  lines.push(`  return { ok: true }${s}`);
  lines.push(`}`);
  return lines.join("\n");
}

function renderSerialiserFunction(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "serialiser_function" }>,
  style: StyleProfile,
): string {
  const s = semi(style);
  const lines: string[] = [];
  lines.push(`${exportPrefix(d.exported)}function ${d.name}(input: ${d.input_type_name}): string {`);
  lines.push(`  const src = input as unknown as Record<string, unknown>${s}`);
  lines.push(`  const parts: string[] = []${s}`);
  for (const p of d.property_order) {
    lines.push(`  if (Object.prototype.hasOwnProperty.call(src, ${q(p, style)})) {`);
    lines.push(`    parts.push(JSON.stringify(${q(p, style)}) + ${q(":", style)} + JSON.stringify(src[${q(p, style)}]))${s}`);
    lines.push(`  }`);
  }
  lines.push(`  return ${q("{", style)} + parts.join(${q(",", style)}) + ${q("}", style)}${s}`);
  lines.push(`}`);
  return lines.join("\n");
}

// The literal_union check needs `<name>_MEMBERS` — emit it alongside a literal_union.
function renderLiteralUnionMembers(
  d: Extract<TypedDataContractDeclaration, { declaration_kind: "literal_union" | "refusal_reason_union" }>,
  style: StyleProfile,
): string {
  const s = semi(style);
  const items = d.declaration_kind === "literal_union" ? d.literals : d.reasons;
  const rendered = items.map((l) => q(l, style)).join(", ");
  return `${exportPrefix(d.exported)}const ${d.name}_MEMBERS: readonly ${d.name}[] = Object.freeze([${rendered}])${s}`;
}

function renderDeclaration(d: TypedDataContractDeclaration, style: StyleProfile): string {
  if (d.declaration_kind === "interface") return renderInterface(d, style);
  if (d.declaration_kind === "type_alias") return renderTypeAlias(d, style);
  if (d.declaration_kind === "discriminated_union") return renderDiscriminatedUnion(d, style);
  if (d.declaration_kind === "literal_union") return renderLiteralUnion(d, style) + "\n\n" + renderLiteralUnionMembers(d, style);
  if (d.declaration_kind === "refusal_reason_union") return renderRefusalReasonUnion(d, style) + "\n\n" + renderLiteralUnionMembers(d, style);
  if (d.declaration_kind === "numeric_range_constant") return renderNumericRangeConstant(d, style);
  if (d.declaration_kind === "validator_function") return renderValidatorFunction(d, style);
  if (d.declaration_kind === "serialiser_function") return renderSerialiserFunction(d, style);
  // Exhaustive · TypeScript will error if a case is missed.
  const _exhaustive: never = d;
  void _exhaustive;
  return "";
}

// ── Type-only import rendering ─────────────────────────────────────────

function renderTypeOnlyImport(imp: TDCTypeOnlyImport, style: StyleProfile): string {
  const s = semi(style);
  return `import type { ${imp.symbol} } from ${q(imp.from_specifier, style)}${s}`;
}

function validateTypeOnlyImport(imp: unknown): TypedDataContractAuthoringFailure | null {
  if (!imp || typeof imp !== "object") {
    return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: "type_only_import must be object" };
  }
  const i = imp as { symbol?: unknown; from_specifier?: unknown };
  if (!isValidIdentifier(i.symbol)) {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `type_only_import symbol invalid: ${String(i.symbol)}` };
  }
  if (typeof i.from_specifier !== "string" || i.from_specifier.length === 0) {
    return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `type_only_import from_specifier empty` };
  }
  // Restrict to relative or absolute-package specifiers · no URL/protocol · no
  // dot-dot path traversal in specifiers · no Node built-ins (Node built-in
  // check must precede the general protocol-scheme check because `node:` also
  // matches `<scheme>:` — order matters for the returned refusal code).
  if (i.from_specifier.includes("..")) {
    return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `type_only_import from_specifier contains '..'` };
  }
  if (i.from_specifier.startsWith("node:")) {
    return { ok: false, refusal_code: "TDC_PROHIBITED_STRING_CONTENT", reason: `type_only_import from Node built-in prohibited` };
  }
  if (/^[a-z]+:/.test(i.from_specifier)) {
    return { ok: false, refusal_code: "TDC_INVALID_TYPE_REFERENCE", reason: `type_only_import from_specifier uses protocol scheme` };
  }
  return null;
}

// ── §36-B · ROUTE-2B · Runtime-import validation + rendering ───────────

/** Validate a from_specifier for runtime_imports. Deterministic refusal
 *  for every violation. Order matters: Node-built-in check must precede
 *  general protocol-scheme check (both match `node:` but the intent is
 *  a specific refusal code). Package-specifier check comes AFTER protocol
 *  check so we don't mis-identify `http:` as a package. */
function validateRuntimeImportSpecifier(spec: string): TypedDataContractAuthoringFailure | null {
  if (typeof spec !== "string" || spec.length === 0) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier empty" };
  }
  if (spec.includes("\0")) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier contains null byte" };
  }
  if (spec.includes("\\")) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier must use forward slashes" };
  }
  if (spec.includes("..")) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier contains '..'" };
  }
  if (spec.includes("?") || spec.includes("#")) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier contains query/fragment" };
  }
  if (spec.startsWith("/") || /^[A-Za-z]:[\\/]/.test(spec)) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier absolute path prohibited" };
  }
  if (spec.startsWith("node:")) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_NODE_BUILTIN", reason: "runtime_import from Node built-in prohibited" };
  }
  if (/^[a-z]+:/.test(spec)) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_PROTOCOL_SCHEME", reason: "runtime_import from_specifier uses protocol scheme" };
  }
  if (!spec.startsWith("./")) {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_PACKAGE_SPECIFIER", reason: "runtime_import from_specifier must be workspace-relative (start with './')" };
  }
  if (containsProhibitedSubstring(spec) || containsDangerous(spec)) {
    return { ok: false, refusal_code: "TDC_PROHIBITED_STRING_CONTENT", reason: "runtime_import from_specifier contains prohibited content" };
  }
  return null;
}

/** Validate a single runtime_import entry.
 *  §36-C · Route 2c · optional `literals` field is validated when present:
 *    - only allowed on kind === "literal_union" (refused otherwise)
 *    - must be a non-empty array of valid literal strings (isValidLiteralString)
 *    - no duplicates
 *  When absent, existing Route 2b behaviour is preserved. */
function validateRuntimeImport(imp: unknown): TypedDataContractAuthoringFailure | null {
  if (!imp || typeof imp !== "object") {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_KIND", reason: "runtime_import must be object" };
  }
  const i = imp as { kind?: unknown; name?: unknown; from_specifier?: unknown; literals?: unknown };
  if (i.kind !== "numeric_range_constant" && i.kind !== "literal_union") {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_KIND", reason: `runtime_import kind must be 'numeric_range_constant' or 'literal_union' · got ${String(i.kind)}` };
  }
  if (!isValidIdentifier(i.name)) {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `runtime_import name invalid: ${String(i.name)}` };
  }
  if (typeof i.from_specifier !== "string") {
    return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_INVALID_SPECIFIER", reason: "runtime_import from_specifier missing" };
  }
  const specFail = validateRuntimeImportSpecifier(i.from_specifier);
  if (specFail) return specFail;
  // §36-C · Route 2c · validate optional literals field
  if (i.literals !== undefined) {
    if (i.kind !== "literal_union") {
      return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_LITERALS_ON_WRONG_KIND", reason: `runtime_import literals only allowed with kind === "literal_union" · got kind === "${String(i.kind)}"` };
    }
    if (!Array.isArray(i.literals)) {
      return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_LITERALS_EMPTY", reason: "runtime_import literals must be an array" };
    }
    if (i.literals.length === 0) {
      return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_LITERALS_EMPTY", reason: "runtime_import literals must be non-empty when supplied" };
    }
    const seen = new Set<string>();
    for (const lit of i.literals) {
      if (!isValidLiteralString(lit)) {
        return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_LITERAL_INVALID", reason: `runtime_import literal invalid: ${String(lit)}` };
      }
      if (seen.has(lit as string)) {
        return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_LITERALS_DUPLICATE", reason: `runtime_import literals duplicate: ${lit}` };
      }
      seen.add(lit as string);
    }
  }
  return null;
}

function renderRuntimeImport(imp: TDCRuntimeImport, style: StyleProfile): string {
  const s = semi(style);
  if (imp.kind === "numeric_range_constant") {
    return `import { ${imp.name} } from ${q(imp.from_specifier, style)}${s}`;
  }
  // literal_union: emit both Type and Type_MEMBERS
  return `import { ${imp.name}, ${imp.name}_MEMBERS } from ${q(imp.from_specifier, style)}${s}`;
}

// ── Main entry point ───────────────────────────────────────────────────

export function authorTypedDataContract(input: {
  readonly spec: TypedDataContractSpec;
  readonly style: StyleProfile;
  readonly target_path: string;
}): TypedDataContractAuthoringResult {
  const { spec, style, target_path } = input;

  // Path validation
  const pathFail = validateTargetPath(target_path);
  if (pathFail) return pathFail;

  // Style-derived choices — defaults if unknown (deterministic fallbacks).
  const effectiveStyle: StyleProfile = {
    ...style,
    quote_style: style.quote_style === "unknown" ? "double" : style.quote_style,
    semicolons: style.semicolons === "unknown" ? "yes" : style.semicolons,
    export_style: style.export_style === "unknown" ? "named" : style.export_style,
  };

  // Spec shape
  if (!spec || typeof spec !== "object") {
    return { ok: false, refusal_code: "TDC_EMPTY_SPEC", reason: "spec must be an object" };
  }
  if (typeof spec.contract_name !== "string" || spec.contract_name.length === 0) {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: "contract_name empty" };
  }
  if (!isValidLiteralString(spec.contract_name)) {
    return { ok: false, refusal_code: "TDC_PROHIBITED_STRING_CONTENT", reason: "contract_name contains prohibited content" };
  }
  if (typeof spec.header_comment !== "string") {
    return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: "header_comment must be a string" };
  }
  if (spec.header_comment.length > MAX_HEADER_COMMENT_LENGTH) {
    return { ok: false, refusal_code: "TDC_HEADER_TOO_LONG", reason: `header_comment exceeds ${MAX_HEADER_COMMENT_LENGTH} chars` };
  }
  if (!isValidHeaderComment(spec.header_comment)) {
    return { ok: false, refusal_code: "TDC_PROHIBITED_STRING_CONTENT", reason: "header_comment contains prohibited content" };
  }
  if (!Array.isArray(spec.declarations)) {
    return { ok: false, refusal_code: "TDC_EMPTY_SPEC", reason: "declarations must be array" };
  }
  if (spec.declarations.length === 0) {
    return { ok: false, refusal_code: "TDC_EMPTY_SPEC", reason: "declarations is empty" };
  }
  if (spec.declarations.length > MAX_DECLARATIONS_PER_SPEC) {
    return { ok: false, refusal_code: "TDC_TOO_MANY_DECLARATIONS", reason: `declarations exceeds ${MAX_DECLARATIONS_PER_SPEC}` };
  }
  if (!Array.isArray(spec.type_only_imports)) {
    return { ok: false, refusal_code: "TDC_EMPTY_SPEC", reason: "type_only_imports must be array (may be empty)" };
  }

  // Collect declared + imported names
  const declaredNames = new Set<string>();
  for (const d of spec.declarations) {
    if (!d || typeof d !== "object") {
      return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: "declaration must be object" };
    }
    const name = (d as { name?: unknown }).name;
    if (!isValidIdentifier(name)) {
      return { ok: false, refusal_code: "TDC_INVALID_IDENTIFIER", reason: `declaration name invalid: ${String(name)}` };
    }
    if (declaredNames.has(name as string)) {
      return { ok: false, refusal_code: "TDC_DUPLICATE_DECLARATION", reason: `duplicate declaration name: ${name}` };
    }
    declaredNames.add(name as string);
  }

  const importedNames = new Set<string>();
  for (const imp of spec.type_only_imports) {
    const impFail = validateTypeOnlyImport(imp);
    if (impFail) return impFail;
    if (importedNames.has(imp.symbol)) {
      return { ok: false, refusal_code: "TDC_DUPLICATE_DECLARATION", reason: `duplicate imported symbol: ${imp.symbol}` };
    }
    if (declaredNames.has(imp.symbol)) {
      return { ok: false, refusal_code: "TDC_DUPLICATE_DECLARATION", reason: `imported symbol '${imp.symbol}' collides with local declaration` };
    }
    importedNames.add(imp.symbol);
  }

  // §36-B · Route 2b · validate + register runtime_imports. Two kinds:
  //   numeric_range_constant → adds `<name>` to a bounded set
  //   literal_union          → adds `<name>` AND `<name>_MEMBERS` to a bounded set
  // These names participate in collision checks against declaredNames and
  // type_only_imports (importedNames). They are also accepted as valid
  // references in validator range_within / literal_union_member checks.
  const runtimeImports: readonly TDCRuntimeImport[] = Array.isArray(spec.runtime_imports) ? spec.runtime_imports : [];
  if (spec.runtime_imports !== undefined && !Array.isArray(spec.runtime_imports)) {
    return { ok: false, refusal_code: "TDC_EMPTY_SPEC", reason: "runtime_imports must be array (may be empty or absent)" };
  }
  const runtimeImportNames = new Set<string>();      // primary names (e.g. HEAD_TRANSFORM_PITCH_BOUNDS)
  const runtimeImportRangeNames = new Set<string>();  // subset · numeric_range_constant kind
  const runtimeImportUnionNames = new Set<string>();  // subset · literal_union kind
  // §36-C · Route 2c · map from runtime-imported literal_union name → set of its
  // declared member literals (only populated when the runtime_import supplies
  // the optional `literals` field). Used to resolve validator refusal_union_name
  // and to validate each check's refusal_reason_literal against the union.
  const runtimeImportUnionMembers = new Map<string, ReadonlySet<string>>();
  for (const imp of runtimeImports) {
    const impFail = validateRuntimeImport(imp);
    if (impFail) return impFail;
    const emittedSymbols = imp.kind === "literal_union" ? [imp.name, `${imp.name}_MEMBERS`] : [imp.name];
    for (const sym of emittedSymbols) {
      if (declaredNames.has(sym)) {
        return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_COLLISION", reason: `runtime_import symbol '${sym}' collides with local declaration` };
      }
      if (importedNames.has(sym)) {
        return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_COLLISION", reason: `runtime_import symbol '${sym}' collides with type_only_imports` };
      }
      if (runtimeImportNames.has(sym)) {
        return { ok: false, refusal_code: "TDC_RUNTIME_IMPORT_COLLISION", reason: `duplicate runtime_import symbol: ${sym}` };
      }
      runtimeImportNames.add(sym);
    }
    if (imp.kind === "numeric_range_constant") {
      runtimeImportRangeNames.add(imp.name);
    } else {
      runtimeImportUnionNames.add(imp.name);
      if (Array.isArray(imp.literals) && imp.literals.length > 0) {
        runtimeImportUnionMembers.set(imp.name, new Set<string>(imp.literals));
      }
    }
  }

  // Validate each declaration
  for (let i = 0; i < spec.declarations.length; i++) {
    const fail = validateDeclaration(spec.declarations[i], i, declaredNames, importedNames, spec.declarations, runtimeImportRangeNames, runtimeImportUnionNames, runtimeImportUnionMembers);
    if (fail) return fail;
  }

  // Render
  const lines: string[] = [];

  // File header (deterministic)
  lines.push("// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.");
  lines.push(`// Contract: ${spec.contract_name}`);
  lines.push("// Deterministic byte-stable output. Do not edit by hand.");
  if (spec.header_comment.length > 0) {
    lines.push("//");
    for (const l of spec.header_comment.split("\n")) {
      lines.push(`// ${l}`);
    }
  }
  lines.push("");

  // Imports (type-only first · then §36-B runtime imports · deterministic)
  const hasAnyImport = spec.type_only_imports.length > 0 || runtimeImports.length > 0;
  if (spec.type_only_imports.length > 0) {
    for (const imp of spec.type_only_imports) {
      lines.push(renderTypeOnlyImport(imp, effectiveStyle));
    }
  }
  if (runtimeImports.length > 0) {
    for (const imp of runtimeImports) {
      lines.push(renderRuntimeImport(imp, effectiveStyle));
    }
  }
  if (hasAnyImport) {
    lines.push("");
  }

  // Declarations (in spec order · one blank line between each)
  const rendered: string[] = [];
  for (const d of spec.declarations) {
    rendered.push(renderDeclaration(d, effectiveStyle));
  }
  lines.push(rendered.join("\n\n"));
  lines.push("");

  const content = lines.join("\n");
  const byteSize = Buffer.byteLength(content, "utf8");
  if (byteSize > MAX_ARTEFACT_BYTES) {
    return { ok: false, refusal_code: "TDC_OUTPUT_LIMIT_EXCEEDED", reason: `rendered content ${byteSize} bytes exceeds ${MAX_ARTEFACT_BYTES}` };
  }

  return { ok: true, content, declaration_count: spec.declarations.length, byte_size: byteSize };
}
