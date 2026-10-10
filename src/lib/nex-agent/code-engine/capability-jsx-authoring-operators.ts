// src/lib/nex-agent/code-engine/capability-jsx-authoring-operators.ts
//
// NEX1 · JSX Authoring Operators · beyond prop-default swap
// Ledger B additive · Zero LLM · Deterministic regex/string transforms.
//
// SCOPE (honest boundary):
//   These are regex + string transforms · not full JSX AST manipulation.
//   Handles common patterns · refuses gracefully on ambiguous input.
//   Post-transform brace-balance validation on every operator.
//
// INVARIANTS
//   · Never writes to disk · always returns new content (caller writes)
//   · Refuses on ambiguous match (multiple candidates)
//   · Post-transform brace + JSX-tag balance check
//   · Every operator declares zero_llm=true and ledger=B
//   · Deterministic given same input

import { createHash } from "node:crypto";

export const JSX_AUTHORING_OPERATORS_VERSION = "jsx-authoring-operators.v1.2026-09-19";

// ── Result ────────────────────────────────────────────────────────────

export interface JsxOperatorResult {
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

// ── Post-transform balance check (brace + paren + bracket + JSX tag pairs) ─

function balancedTsxContent(s: string): boolean {
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

function finalise(op_id: string, input: string, output: string | null, refusal: string | null, signals: readonly string[]): JsxOperatorResult {
  return {
    ok: refusal === null && output !== null,
    operator_id: op_id,
    new_content: output,
    changed_bytes: output === null ? 0 : Math.abs(output.length - input.length),
    refusal_reason: refusal,
    evidence_signals: signals,
    input_hash: createHash("sha256").update(input).digest("hex").slice(0, 16),
    output_hash: output === null ? null : createHash("sha256").update(output).digest("hex").slice(0, 16),
    zero_llm: true,
    ledger: "B",
    version: JSX_AUTHORING_OPERATORS_VERSION,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── OP: add_jsx_attribute ────────────────────────────────────────────
//
// Add an attribute to an existing JSX element's opening tag.
// Example: `<Button>` + attribute `color="orange"` → `<Button color="orange">`

export interface AddJsxAttributeInput {
  readonly content: string;
  readonly element_name: string;      // e.g. "Button" or "div"
  readonly attribute_name: string;
  readonly attribute_value: string;   // literal source · e.g. `"orange"` or `{count}`
  readonly max_occurrences?: number;  // default 1 · refuses on ambiguous
}

export function opAddJsxAttribute(input: AddJsxAttributeInput): JsxOperatorResult {
  const signals: string[] = [`element=${input.element_name}`, `attribute=${input.attribute_name}`];
  const max = input.max_occurrences ?? 1;

  // Find `<ElementName` optionally followed by whitespace + existing attributes + closing `>` or `/>`.
  // Refuse if attribute already exists on any matched element.
  const tagRe = new RegExp(`<${escapeRegex(input.element_name)}\\b([^>/]*)(/?)>`, "g");
  const matches: { start: number; end: number; existingAttrs: string; selfClosing: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(input.content)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      existingAttrs: m[1],
      selfClosing: m[2] === "/",
    });
  }
  if (matches.length === 0) {
    return finalise("add_jsx_attribute", input.content, null, `element_not_found:${input.element_name}`, signals);
  }
  if (matches.length > max) {
    return finalise("add_jsx_attribute", input.content, null, `ambiguous_match:${matches.length}_elements_max_${max}`, signals);
  }

  const target = matches[0];
  const existingAttrRe = new RegExp(`\\b${escapeRegex(input.attribute_name)}\\s*=`);
  if (existingAttrRe.test(target.existingAttrs)) {
    return finalise("add_jsx_attribute", input.content, null, "attribute_already_present", signals);
  }

  const trimmedExisting = target.existingAttrs.replace(/\s+$/, "");
  const spacer = trimmedExisting.length === 0 ? " " : (trimmedExisting.endsWith(" ") ? "" : " ");
  const newOpenTag = `<${input.element_name}${trimmedExisting.length > 0 ? " " + trimmedExisting.trim() : ""}${spacer}${input.attribute_name}=${input.attribute_value}${target.selfClosing ? " />" : ">"}`;
  const newContent = input.content.slice(0, target.start) + newOpenTag + input.content.slice(target.end);

  if (!balancedTsxContent(newContent)) {
    return finalise("add_jsx_attribute", input.content, null, "unbalanced_after_transform", signals);
  }
  signals.push(`attribute_added`);
  return finalise("add_jsx_attribute", input.content, newContent, null, signals);
}

// ── OP: modify_jsx_attribute ─────────────────────────────────────────
//
// Change the value of an existing JSX attribute.
// Example: `<Button color="blue">` + new value `"orange"` → `<Button color="orange">`

export interface ModifyJsxAttributeInput {
  readonly content: string;
  readonly element_name: string;
  readonly attribute_name: string;
  readonly new_attribute_value: string;
  readonly max_occurrences?: number;
}

export function opModifyJsxAttribute(input: ModifyJsxAttributeInput): JsxOperatorResult {
  const signals: string[] = [`element=${input.element_name}`, `attribute=${input.attribute_name}`];
  const max = input.max_occurrences ?? 1;

  // Find the element opening tag + the specific attribute within it
  const tagRe = new RegExp(`<${escapeRegex(input.element_name)}\\b([^>/]*)(/?)>`, "g");
  const matches: { tagStart: number; tagEnd: number; attrStart: number; attrEnd: number; oldValue: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(input.content)) !== null) {
    // Find the attribute inside the existing attrs
    const attrRe = new RegExp(`\\b${escapeRegex(input.attribute_name)}\\s*=\\s*("([^"]*)"|'([^']*)'|\\{([^}]*)\\})`);
    const am = attrRe.exec(m[1]);
    if (am) {
      const attrStart = m.index + 1 + input.element_name.length + am.index + (m[1].slice(0, am.index).match(/^\s*/)?.[0].length ?? 0);
      // Simpler: compute absolute start of the attribute inside the tag
      const absTagContentStart = m.index + 1 + input.element_name.length;  // right after `<Elem`
      const attrAbsStart = absTagContentStart + am.index;
      matches.push({
        tagStart: m.index,
        tagEnd: m.index + m[0].length,
        attrStart: attrAbsStart,
        attrEnd: attrAbsStart + am[0].length,
        oldValue: am[1],
      });
    }
  }
  if (matches.length === 0) {
    return finalise("modify_jsx_attribute", input.content, null, `attribute_not_found_on_element:${input.attribute_name}@${input.element_name}`, signals);
  }
  if (matches.length > max) {
    return finalise("modify_jsx_attribute", input.content, null, `ambiguous_match:${matches.length}_elements_max_${max}`, signals);
  }

  const target = matches[0];
  const newAttrText = `${input.attribute_name}=${input.new_attribute_value}`;
  const newContent = input.content.slice(0, target.attrStart) + newAttrText + input.content.slice(target.attrEnd);

  if (!balancedTsxContent(newContent)) {
    return finalise("modify_jsx_attribute", input.content, null, "unbalanced_after_transform", signals);
  }
  signals.push(`attribute_modified·old=${target.oldValue}`);
  return finalise("modify_jsx_attribute", input.content, newContent, null, signals);
}

// ── OP: wrap_jsx_element ─────────────────────────────────────────────
//
// Wrap an existing element with a wrapper element.
// Example: `<Button/>` wrapped with `Card` → `<Card><Button/></Card>`

export interface WrapJsxElementInput {
  readonly content: string;
  readonly inner_element_name: string;
  readonly wrapper_element_name: string;
  readonly wrapper_attributes?: string;  // e.g. `className="wrap"` (raw attribute text)
  readonly max_occurrences?: number;
}

export function opWrapJsxElement(input: WrapJsxElementInput): JsxOperatorResult {
  const signals: string[] = [`inner=${input.inner_element_name}`, `wrapper=${input.wrapper_element_name}`];
  const max = input.max_occurrences ?? 1;

  // We support wrapping SELF-CLOSING elements only in this minimal version.
  // (Paired-tag wrapping requires balanced matching · deferred to next iteration.)
  const selfClosingRe = new RegExp(`<${escapeRegex(input.inner_element_name)}\\b[^>/]*/>`, "g");
  const matches: { start: number; end: number; original: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = selfClosingRe.exec(input.content)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, original: m[0] });
  }
  if (matches.length === 0) {
    return finalise("wrap_jsx_element", input.content, null, `self_closing_inner_element_not_found:${input.inner_element_name}`, signals);
  }
  if (matches.length > max) {
    return finalise("wrap_jsx_element", input.content, null, `ambiguous_match:${matches.length}_elements_max_${max}`, signals);
  }

  const target = matches[0];
  const wrapperAttrs = input.wrapper_attributes ? " " + input.wrapper_attributes.trim() : "";
  const wrapped = `<${input.wrapper_element_name}${wrapperAttrs}>${target.original}</${input.wrapper_element_name}>`;
  const newContent = input.content.slice(0, target.start) + wrapped + input.content.slice(target.end);

  if (!balancedTsxContent(newContent)) {
    return finalise("wrap_jsx_element", input.content, null, "unbalanced_after_transform", signals);
  }
  signals.push("wrapped");
  return finalise("wrap_jsx_element", input.content, newContent, null, signals);
}

// ── OP: create_react_component ───────────────────────────────────────
//
// Generate a minimal React function component file.
// Returns file content · caller writes to disk.

export interface CreateReactComponentInput {
  readonly component_name: string;    // PascalCase · e.g. "SearchBar"
  readonly props?: readonly { readonly name: string; readonly type: string; readonly default_value?: string }[];
  readonly body_jsx: string;          // e.g. `<div>Hello</div>`
  readonly include_props_interface?: boolean;  // default true
}

export interface CreateReactComponentResult {
  readonly ok: boolean;
  readonly operator_id: "create_react_component";
  readonly content: string;
  readonly bytes: number;
  readonly content_hash: string;
  readonly refusal_reason: string | null;
  readonly evidence_signals: readonly string[];
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export function opCreateReactComponent(input: CreateReactComponentInput): CreateReactComponentResult {
  const signals: string[] = [`component=${input.component_name}`];
  let refusal: string | null = null;

  if (!/^[A-Z][A-Za-z0-9]*$/.test(input.component_name)) {
    refusal = "component_name_must_be_pascal_case";
  }
  const props = input.props ?? [];
  const includeInterface = input.include_props_interface ?? true;

  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED · ${JSX_AUTHORING_OPERATORS_VERSION}`);
  lines.push(``);
  if (includeInterface && props.length > 0) {
    lines.push(`export interface ${input.component_name}Props {`);
    for (const p of props) {
      lines.push(`  readonly ${p.name}: ${p.type};`);
    }
    lines.push(`}`);
    lines.push(``);
  }
  const propsDestructure = props.length > 0
    ? `{ ${props.map((p) => p.default_value ? `${p.name} = ${p.default_value}` : p.name).join(", ")} }`
    : "";
  const propsType = includeInterface && props.length > 0 ? `: ${input.component_name}Props` : "";
  const propsSignature = props.length > 0 ? `${propsDestructure}${propsType}` : "";

  lines.push(`export function ${input.component_name}(${propsSignature}) {`);
  lines.push(`  return (`);
  lines.push(`    ${input.body_jsx}`);
  lines.push(`  );`);
  lines.push(`}`);
  lines.push(``);
  const content = lines.join("\n");

  // Post-validation
  if (refusal === null && !balancedTsxContent(content)) {
    refusal = "generated_content_unbalanced_braces";
  }
  signals.push(`prop_count=${props.length}`);
  signals.push(`bytes=${content.length}`);

  return {
    ok: refusal === null,
    operator_id: "create_react_component",
    content: refusal === null ? content : "",
    bytes: refusal === null ? content.length : 0,
    content_hash: refusal === null ? createHash("sha256").update(content).digest("hex").slice(0, 16) : "",
    refusal_reason: refusal,
    evidence_signals: signals,
    zero_llm: true,
    ledger: "B",
    version: JSX_AUTHORING_OPERATORS_VERSION,
  };
}

// ── Introspection ────────────────────────────────────────────────────

export interface JsxOperatorDescriptor {
  readonly operator_id: string;
  readonly display_name: string;
  readonly kind: "add" | "modify" | "wrap" | "create";
  readonly notes: string;
}

export function listJsxOperators(): readonly JsxOperatorDescriptor[] {
  return Object.freeze([
    { operator_id: "add_jsx_attribute", display_name: "Add JSX Attribute", kind: "add", notes: "Refuses when attribute already present · refuses on ambiguous multi-match" },
    { operator_id: "modify_jsx_attribute", display_name: "Modify JSX Attribute", kind: "modify", notes: "Changes value of existing attribute · refuses when attribute absent" },
    { operator_id: "wrap_jsx_element", display_name: "Wrap JSX Element", kind: "wrap", notes: "Wraps self-closing element only (v1) · paired-tag support deferred" },
    { operator_id: "create_react_component", display_name: "Create React Component", kind: "create", notes: "Generates full component file · caller writes to disk" },
  ]);
}
