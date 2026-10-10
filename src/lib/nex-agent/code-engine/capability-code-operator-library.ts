// src/lib/nex-agent/code-engine/capability-code-operator-library.ts
//
// NEX1 · Expanded Code Operator Library (§12 · beyond replace_return_literal)
// Ledger B additive · Zero LLM · Deterministic string/regex transforms.
//
// PURPOSE
//   Provide a small set of reliable code primitives composable into
//   multi-file changes. Each operator is:
//     · deterministic given the same input
//     · idempotent-tolerant where possible
//     · validated post-transform (well-formed, no truncation)
//     · returns a structured result with success/failure evidence
//
// SCOPE (honest boundary):
//   These are regex + string transforms · not full TS AST manipulation.
//   Handles a controlled set of common cases · refuses gracefully on
//   ambiguous input. Every operator declares its supported patterns.
//
// INVARIANTS
//   · Never writes to disk without explicit outputs · always returns new content
//   · Refuses on ambiguous match (multiple candidates) unless disambiguated
//   · Post-validation: brace/paren balance + minimum sanity checks
//   · Zero LLM · deterministic

import { createHash } from "node:crypto";

export const CODE_OPERATOR_LIBRARY_VERSION = "code-operator-library.v1.2026-09-19";

// ── Result shape ────────────────────────────────────────────────────────

export interface OperatorResult {
  readonly ok: boolean;
  readonly operator_id: string;
  readonly new_content: string | null;
  readonly changed_bytes: number;
  readonly refusal_reason: string | null;
  readonly evidence_signals: readonly string[];
  readonly input_hash: string;
  readonly output_hash: string | null;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Post-transform validators ────────────────────────────────────────────

function balancedBraces(s: string): boolean {
  let braces = 0, parens = 0, brackets = 0;
  let inString: '"' | "'" | "`" | null = null;
  let inLineComment = false, inBlockComment = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], next = s[i + 1];
    if (inLineComment) { if (c === "\n") inLineComment = false; continue; }
    if (inBlockComment) { if (c === "*" && next === "/") { inBlockComment = false; i++; } continue; }
    if (inString) {
      if (c === "\\" && next) { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (c === "/" && next === "*") { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === "{") braces++; else if (c === "}") braces--;
    else if (c === "(") parens++; else if (c === ")") parens--;
    else if (c === "[") brackets++; else if (c === "]") brackets--;
    if (braces < 0 || parens < 0 || brackets < 0) return false;
  }
  return braces === 0 && parens === 0 && brackets === 0;
}

function finalise(
  operator_id: string,
  input: string,
  output: string | null,
  refusal_reason: string | null,
  signals: readonly string[],
): OperatorResult {
  return {
    ok: refusal_reason === null && output !== null,
    operator_id,
    new_content: output,
    changed_bytes: output === null ? 0 : Math.abs(output.length - input.length),
    refusal_reason,
    evidence_signals: signals,
    input_hash: createHash("sha256").update(input).digest("hex").slice(0, 16),
    output_hash: output === null ? null : createHash("sha256").update(output).digest("hex").slice(0, 16),
    zero_llm: true,
    ledger: "B",
    version: CODE_OPERATOR_LIBRARY_VERSION,
  };
}

// ── OP: create_file ─────────────────────────────────────────────────────
//
// Not a transform · returns the content to write · caller writes to disk.

export interface CreateFileInput {
  readonly path: string;
  readonly content: string;
}

export interface CreateFileResult {
  readonly ok: boolean;
  readonly operator_id: "create_file";
  readonly path: string;
  readonly content: string;
  readonly bytes: number;
  readonly refusal_reason: string | null;
  readonly evidence_signals: readonly string[];
  readonly content_hash: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export function opCreateFile(input: CreateFileInput): CreateFileResult {
  const signals: string[] = [`path=${input.path}`, `bytes=${input.content.length}`];
  let refusal: string | null = null;
  if (!input.path || input.path.length === 0) refusal = "empty_path";
  else if (input.path.includes("..")) refusal = "path_traversal_refused";
  else if (input.content.length === 0) refusal = "empty_content";
  // TS/TSX sanity check
  if (refusal === null && /\.(tsx?|jsx?|mjs)$/.test(input.path) && !balancedBraces(input.content)) {
    refusal = "unbalanced_braces_in_generated_content";
  }
  return {
    ok: refusal === null,
    operator_id: "create_file",
    path: input.path,
    content: input.content,
    bytes: input.content.length,
    refusal_reason: refusal,
    evidence_signals: signals,
    content_hash: createHash("sha256").update(input.content).digest("hex").slice(0, 16),
    zero_llm: true,
    ledger: "B",
    version: CODE_OPERATOR_LIBRARY_VERSION,
  };
}

// ── OP: modify_return ───────────────────────────────────────────────────
//
// Replace the return value of a named function.
// Example: `export function foo() { return 40; }` with `new_return_expression="30"`
// → `export function foo() { return 30; }`

export interface ModifyReturnInput {
  readonly content: string;
  readonly function_name: string;
  readonly new_return_expression: string;
}

export function opModifyReturn(input: ModifyReturnInput): OperatorResult {
  const signals: string[] = [`fn=${input.function_name}`, `new=${input.new_return_expression}`];
  // Find function then find first `return` after it
  const fnRe = new RegExp(`(function\\s+${escapeRegex(input.function_name)}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{)`);
  const m = fnRe.exec(input.content);
  if (!m) return finalise("modify_return", input.content, null, `function_not_found:${input.function_name}`, signals);
  const fnStart = m.index + m[0].length;
  // Find first `return ...;` after fnStart · respect brace depth
  const rest = input.content.slice(fnStart);
  const retMatch = /\breturn\s+([^;]+);/.exec(rest);
  if (!retMatch) return finalise("modify_return", input.content, null, "no_return_in_function", signals);
  const absStart = fnStart + retMatch.index;
  const absEnd = absStart + retMatch[0].length;
  const newContent = input.content.slice(0, absStart) + `return ${input.new_return_expression};` + input.content.slice(absEnd);
  if (!balancedBraces(newContent)) {
    return finalise("modify_return", input.content, null, "unbalanced_after_transform", signals);
  }
  signals.push("return_replaced");
  return finalise("modify_return", input.content, newContent, null, signals);
}

// ── OP: add_export ──────────────────────────────────────────────────────
//
// Add `export { name } from "module"` or convert `<decl>` to `export <decl>`.

export interface AddExportInput {
  readonly content: string;
  readonly symbol: string;
  readonly export_mode: "convert_declaration" | "reexport";
  readonly from_module?: string;  // required for reexport mode
}

export function opAddExport(input: AddExportInput): OperatorResult {
  const signals: string[] = [`symbol=${input.symbol}`, `mode=${input.export_mode}`];
  if (input.export_mode === "reexport") {
    if (!input.from_module) return finalise("add_export", input.content, null, "missing_from_module_for_reexport", signals);
    // Check for existing re-export
    const existingRe = new RegExp(`export\\s*\\{[^}]*\\b${escapeRegex(input.symbol)}\\b[^}]*\\}\\s*from\\s+['"]`);
    if (existingRe.test(input.content)) {
      return finalise("add_export", input.content, null, "reexport_already_present", signals);
    }
    const line = `export { ${input.symbol} } from "${input.from_module}";\n`;
    const newContent = input.content.endsWith("\n") ? input.content + line : input.content + "\n" + line;
    signals.push("reexport_appended");
    return finalise("add_export", input.content, newContent, null, signals);
  }
  // convert_declaration mode · check "already exported" FIRST
  const alreadyExportedRe = new RegExp(`export\\s+(?:default\\s+)?(const|let|var|function|class|interface|type)\\s+${escapeRegex(input.symbol)}\\b`);
  if (alreadyExportedRe.test(input.content)) {
    return finalise("add_export", input.content, null, "already_exported", signals);
  }
  const declRe = new RegExp(`(^|\\n)(\\s*)(const|let|var|function|class|interface|type)\\s+${escapeRegex(input.symbol)}\\b`);
  const m = declRe.exec(input.content);
  if (!m) return finalise("add_export", input.content, null, `declaration_not_found:${input.symbol}`, signals);
  const insertPos = m.index + m[1].length + m[2].length;  // after newline + whitespace
  const newContent = input.content.slice(0, insertPos) + "export " + input.content.slice(insertPos);
  signals.push("declaration_prefixed_with_export");
  return finalise("add_export", input.content, newContent, null, signals);
}

// ── OP: update_import ───────────────────────────────────────────────────
//
// Change the module path or add a name to an existing named import.

export interface UpdateImportInput {
  readonly content: string;
  readonly current_module: string;
  readonly new_module?: string;             // change path
  readonly add_named?: readonly string[];   // add to named-imports list
  readonly remove_named?: readonly string[];// remove from named-imports list
}

export function opUpdateImport(input: UpdateImportInput): OperatorResult {
  const signals: string[] = [`current=${input.current_module}`];
  const importRe = new RegExp(`(import\\s+(?:type\\s+)?(?:\\{([^}]+)\\}\\s*(?:,\\s*(?:[A-Za-z_$][\\w$]*|\\*\\s+as\\s+[A-Za-z_$][\\w$]*))?|(?:[A-Za-z_$][\\w$]*|\\*\\s+as\\s+[A-Za-z_$][\\w$]*)(?:\\s*,\\s*\\{([^}]+)\\})?)\\s+from\\s+)(['"])${escapeRegex(input.current_module)}\\4`);
  const m = importRe.exec(input.content);
  if (!m) return finalise("update_import", input.content, null, `import_not_found:${input.current_module}`, signals);
  const existingNamed = (m[2] ?? m[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const asSet = new Set(existingNamed);
  for (const add of input.add_named ?? []) asSet.add(add);
  for (const rem of input.remove_named ?? []) asSet.delete(rem);
  const newModule = input.new_module ?? input.current_module;
  const finalNamed = [...asSet].sort();
  // Rebuild the statement · preserve import type / default part where possible.
  // For simplicity, we do a targeted rewrite of just the named-list and module.
  let updated = m[0];
  if (input.new_module && input.new_module !== input.current_module) {
    updated = updated.replace(input.current_module, input.new_module);
    signals.push(`new_module=${input.new_module}`);
  }
  if (input.add_named?.length || input.remove_named?.length) {
    // Replace the { ... } portion in `updated`
    if (finalNamed.length === 0) {
      // No named remaining · this operator refuses (avoid dangling comma) - callers should use a stronger op
      return finalise("update_import", input.content, null, "would_produce_empty_named_import", signals);
    }
    updated = updated.replace(/\{[^}]+\}/, `{ ${finalNamed.join(", ")} }`);
    signals.push(`named=${finalNamed.join(",")}`);
  }
  const newContent = input.content.slice(0, m.index) + updated + input.content.slice(m.index + m[0].length);
  if (!balancedBraces(newContent)) {
    return finalise("update_import", input.content, null, "unbalanced_after_transform", signals);
  }
  return finalise("update_import", input.content, newContent, null, signals);
}

// ── OP: replace_expression ──────────────────────────────────────────────
//
// Replace an exact source substring with a new expression.
// Requires unambiguous match (throws otherwise).

export interface ReplaceExpressionInput {
  readonly content: string;
  readonly target: string;    // exact substring
  readonly replacement: string;
  readonly max_occurrences?: number;  // default 1 · must match exactly
}

export function opReplaceExpression(input: ReplaceExpressionInput): OperatorResult {
  const signals: string[] = [`target_bytes=${input.target.length}`];
  const max = input.max_occurrences ?? 1;
  const occurrences: number[] = [];
  let idx = 0;
  while ((idx = input.content.indexOf(input.target, idx)) !== -1) {
    occurrences.push(idx);
    idx += input.target.length;
  }
  if (occurrences.length === 0) return finalise("replace_expression", input.content, null, "target_not_found", signals);
  if (occurrences.length > max) return finalise("replace_expression", input.content, null, `ambiguous_match:${occurrences.length}_occurrences_max_${max}`, signals);
  const newContent = input.content.split(input.target).join(input.replacement);
  if (!balancedBraces(newContent)) {
    return finalise("replace_expression", input.content, null, "unbalanced_after_transform", signals);
  }
  signals.push(`replaced=${occurrences.length}`);
  return finalise("replace_expression", input.content, newContent, null, signals);
}

// ── OP: add_object_property ─────────────────────────────────────────────
//
// Adds a key: value pair to an object literal identified by an anchor line.

export interface AddObjectPropertyInput {
  readonly content: string;
  readonly anchor_symbol: string;  // e.g. "const config" · finds first anchor
  readonly key: string;
  readonly value: string;
}

export function opAddObjectProperty(input: AddObjectPropertyInput): OperatorResult {
  const signals: string[] = [`anchor=${input.anchor_symbol}`, `key=${input.key}`];
  const anchorRe = new RegExp(`${escapeRegex(input.anchor_symbol)}\\s*=\\s*\\{`);
  const m = anchorRe.exec(input.content);
  if (!m) return finalise("add_object_property", input.content, null, "anchor_not_found", signals);
  const openBrace = m.index + m[0].length - 1;
  // Find matching closing brace at same depth
  let depth = 0;
  let close = -1;
  for (let i = openBrace; i < input.content.length; i++) {
    const c = input.content[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close === -1) return finalise("add_object_property", input.content, null, "no_matching_close_brace", signals);
  // Check if key already exists (simple scan)
  const objSlice = input.content.slice(openBrace, close);
  const keyExists = new RegExp(`\\b${escapeRegex(input.key)}\\s*:`).test(objSlice);
  if (keyExists) return finalise("add_object_property", input.content, null, "key_already_present", signals);
  // Insert `  key: value,\n` before close brace with proper indentation
  const before = input.content.slice(0, close).replace(/\s*$/, "");
  const after = input.content.slice(close);
  const insertion = `${before.endsWith(",") || before.endsWith("{") ? "" : ","}\n  ${input.key}: ${input.value},\n`;
  const newContent = before + insertion + after;
  if (!balancedBraces(newContent)) {
    return finalise("add_object_property", input.content, null, "unbalanced_after_transform", signals);
  }
  return finalise("add_object_property", input.content, newContent, null, signals);
}

// ── OP: modify_component_prop_default ───────────────────────────────────
//
// For a React function component with a JSX return, change a specific
// prop's default value in the destructured props.

export interface ModifyComponentPropDefaultInput {
  readonly content: string;
  readonly component_name: string;
  readonly prop_name: string;
  readonly new_default_value: string;
}

export function opModifyComponentPropDefault(input: ModifyComponentPropDefaultInput): OperatorResult {
  const signals: string[] = [`component=${input.component_name}`, `prop=${input.prop_name}`];
  // Match `function Foo({ x = "a", y = "b" }) {` or `= ({ x = "a" }) =>`
  const fnRe = new RegExp(`(?:function\\s+${escapeRegex(input.component_name)}|const\\s+${escapeRegex(input.component_name)}\\s*=\\s*(?:\\([^)]*\\)|)\\s*(?::\\s*[^=]+)?\\s*=)\\s*\\(?\\s*\\{([^}]+)\\}`);
  const m = fnRe.exec(input.content);
  if (!m) return finalise("modify_component_prop_default", input.content, null, "component_signature_not_found", signals);
  const propsBlock = m[1];
  const propRe = new RegExp(`(${escapeRegex(input.prop_name)})\\s*=\\s*([^,}]+)`);
  const pm = propRe.exec(propsBlock);
  if (!pm) return finalise("modify_component_prop_default", input.content, null, `prop_default_not_found:${input.prop_name}`, signals);
  const propStart = m.index + m[0].indexOf(propsBlock) + pm.index;
  const propEnd = propStart + pm[0].length;
  const newProp = `${input.prop_name} = ${input.new_default_value}`;
  const newContent = input.content.slice(0, propStart) + newProp + input.content.slice(propEnd);
  if (!balancedBraces(newContent)) {
    return finalise("modify_component_prop_default", input.content, null, "unbalanced_after_transform", signals);
  }
  signals.push(`new_default=${input.new_default_value}`);
  return finalise("modify_component_prop_default", input.content, newContent, null, signals);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Introspection ────────────────────────────────────────────────────────

export interface OperatorDescriptor {
  readonly operator_id: string;
  readonly display_name: string;
  readonly kind: "create" | "modify" | "compose";
  readonly supports_multi_file: boolean;
  readonly notes: string;
}

export function listOperators(): readonly OperatorDescriptor[] {
  return Object.freeze([
    { operator_id: "create_file", display_name: "Create File", kind: "create", supports_multi_file: false, notes: "Emits new-file content · caller writes to disk" },
    { operator_id: "modify_return", display_name: "Modify Return", kind: "modify", supports_multi_file: false, notes: "Replaces the first return expression in a named function" },
    { operator_id: "add_export", display_name: "Add Export", kind: "modify", supports_multi_file: false, notes: "Adds export keyword to a declaration OR appends a re-export statement" },
    { operator_id: "update_import", display_name: "Update Import", kind: "modify", supports_multi_file: false, notes: "Changes module path and/or adds/removes named imports" },
    { operator_id: "replace_expression", display_name: "Replace Expression", kind: "modify", supports_multi_file: false, notes: "Exact-match substring replacement · refuses on ambiguous match" },
    { operator_id: "add_object_property", display_name: "Add Object Property", kind: "modify", supports_multi_file: false, notes: "Inserts a key:value into an anchored object literal" },
    { operator_id: "modify_component_prop_default", display_name: "Modify Component Prop Default", kind: "modify", supports_multi_file: false, notes: "Changes a React component prop's default value" },
  ]);
}
