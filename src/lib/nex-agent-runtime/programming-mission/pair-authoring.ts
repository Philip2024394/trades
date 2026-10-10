// F-C-02 · pair-authoring · deterministic code emission for pairwise compositions.
//
// Founder-locked 2026-09-14. Takes a PairComposition produced by
// pair-matcher.ts and emits report-file bytes that (a) inline the
// reference implementations of the two selected primitives and (b)
// compose them via the template that pair-matcher.ts discovered from
// evidence.
//
// Founder rule (locked): the template that appears in the emitted code
// is supplied by PairComposition.template · never hardcoded per-mission
// in this file. This file does not contain any mission-specific target
// function name.

import { createHash } from "node:crypto";
import type { AuthoredFile, FunctionSpec, PairComposition, StyleProfile } from "./types";

// ── Style helpers (identical semantics to code-authoring.ts but kept
//    local to keep code-authoring.ts untouched under F-C-02 spec) ──────

function q(s: string, style: StyleProfile): string {
  return style.quote_style === "single" ? `'${s.replace(/'/g, "\\'")}'` : `"${s.replace(/"/g, '\\"')}"`;
}
function semi(style: StyleProfile): string {
  return style.semicolons === "no" ? "" : ";";
}
function nameFor(base: string, style: StyleProfile): string {
  if (style.naming_convention === "camelCase") {
    return base.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());
  }
  return base;
}
function literal(v: string | number | boolean, style: StyleProfile): string {
  if (typeof v === "string") return q(v, style);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function extFor(p: string): AuthoredFile["extension"] {
  if (p.endsWith(".ts")) return "ts";
  if (p.endsWith(".tsx")) return "tsx";
  if (p.endsWith(".mjs") || p.endsWith(".cjs") || p.endsWith(".js")) return "js";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".md")) return "md";
  if (p.endsWith(".css")) return "css";
  return "txt";
}

function deriveRelativeImport(fromPath: string, toPath: string): string {
  const fromParts = fromPath.split("/").slice(0, -1);
  const toParts = toPath.split("/");
  let common = 0;
  while (common < fromParts.length && common < toParts.length - 1 && fromParts[common] === toParts[common]) common++;
  const up = fromParts.length - common;
  const rest = toParts.slice(common).join("/");
  const prefix = up === 0 ? "./" : "../".repeat(up);
  const bare = prefix + rest;
  return bare.replace(/\.[^.]+$/, "");
}

// ── Primitive reference bodies (rendered as inlined JS) ────────────────
//
// One key rule: these bodies are the SAME semantics as the reference
// implementations in algorithm-matcher.ts. If those drift, this drifts
// too · caught by post-fix test execution, not by any silent fallback.
// The body strings below carry NO mission-specific string.

function renderPrimitiveBody(algorithm_kind: string, style: StyleProfile): { readonly name: string; readonly body: string } | null {
  const s = semi(style);
  if (algorithm_kind === "truncate_words") {
    return {
      name: "__ref_truncate_words",
      body: [
        `function __ref_truncate_words(text, max) {`,
        `  if (typeof text !== ${q("string", style)} || typeof max !== ${q("number", style)}) return ${q("", style)}${s}`,
        `  if (text.length === 0) return ${q("", style)}${s}`,
        `  if (max <= 0) return ${q("", style)}${s}`,
        `  const words = text.trim().split(/\\s+/).filter((w) => w.length > 0)${s}`,
        `  if (words.length <= max) return text${s}`,
        `  return words.slice(0, max).join(${q(" ", style)})${s}`,
        `}`,
      ].join("\n"),
    };
  }
  if (algorithm_kind === "text_stats") {
    return {
      name: "__ref_text_stats",
      body: [
        `function __ref_text_stats(text) {`,
        `  if (typeof text !== ${q("string", style)}) return { words: 0, chars: 0 }${s}`,
        `  if (text.length === 0) return { words: 0, chars: 0 }${s}`,
        `  return {`,
        `    words: text.trim().split(/\\s+/).filter((w) => w.length > 0).length,`,
        `    chars: text.length,`,
        `  }${s}`,
        `}`,
      ].join("\n"),
    };
  }
  if (algorithm_kind === "describe_text") {
    return {
      name: "__ref_describe_text",
      body: [
        `function __ref_describe_text(text) {`,
        `  if (typeof text !== ${q("string", style)}) return ${q("", style)}${s}`,
        `  const w = text.length === 0 ? 0 : text.trim().split(/\\s+/).filter((x) => x.length > 0).length${s}`,
        `  return ${q("Text has ", style)} + w + ${q(" words", style)}${s}`,
        `}`,
      ].join("\n"),
    };
  }
  if (algorithm_kind === "short_report") {
    return {
      name: "__ref_short_report",
      body: [
        `function __ref_short_report(subject, body) {`,
        `  if (typeof subject !== ${q("string", style)} || typeof body !== ${q("string", style)}) return ${q("", style)}${s}`,
        `  const words = body.trim().split(/\\s+/).filter((w) => w.length > 0)${s}`,
        `  const first5 = words.length <= 5 ? body : words.slice(0, 5).join(${q(" ", style)})${s}`,
        `  return ${q("Report on ", style)} + subject + ${q(": ", style)} + first5${s}`,
        `}`,
      ].join("\n"),
    };
  }
  if (algorithm_kind === "fibonacci_memoised") {
    return {
      name: "__ref_fibonacci_memoised",
      body: [
        `const __memo_fib = new Map()${s}`,
        `function __ref_fibonacci_memoised(n) {`,
        `  if (typeof n !== ${q("number", style)} || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) return 0${s}`,
        `  if (n <= 1) return n${s}`,
        `  const cached = __memo_fib.get(n)${s}`,
        `  if (cached !== undefined) return cached${s}`,
        `  const v = __ref_fibonacci_memoised(n - 1) + __ref_fibonacci_memoised(n - 2)${s}`,
        `  __memo_fib.set(n, v)${s}`,
        `  return v${s}`,
        `}`,
      ].join("\n"),
    };
  }
  return null;
}

// ── Compose the target function body from the discovered template ──────

/** Emit `const a = A(text, ...extras); const b = B(text, ...extras);`
 *  and then the return line built from PairComposition.template · where
 *  each placeholder is replaced by a JS expression referring to `a`/`b`
 *  (or a field access on them). */
function renderComposedBody(
  fnName: string,
  params: readonly { name: string; type: string }[],
  composition: PairComposition,
  style: StyleProfile,
  aFn: string,
  bFn: string,
): string {
  const s = semi(style);
  const inputParam = params[0]?.name ?? "text";
  const aExtras = composition.primitive_a.extracted_args.map((v) => literal(v, style)).join(", ");
  const bExtras = composition.primitive_b.extracted_args.map((v) => literal(v, style)).join(", ");
  const aCall = aExtras ? `${aFn}(${inputParam}, ${aExtras})` : `${aFn}(${inputParam})`;
  const bCall = bExtras ? `${bFn}(${inputParam}, ${bExtras})` : `${bFn}(${inputParam})`;
  // Build the return expression: string concatenation of literal segments
  // and placeholder expressions. Use template literal for clarity.
  const template = composition.template;
  // Substitute {A} · {A.field} · {B} · {B.field} with JS expressions.
  const jsTemplateBody = template
    .replace(/\{A\.([a-zA-Z0-9_]+)\}/g, "${a.$1}")
    .replace(/\{B\.([a-zA-Z0-9_]+)\}/g, "${b.$1}")
    .replace(/\{A\}/g, "${a}")
    .replace(/\{B\}/g, "${b}");
  const exportPrefix = style.export_style === "default" ? `export default function` : `export function`;
  const lines: string[] = [];
  lines.push(`// NEX1-authored composition · algorithm_kind=pair_composition`);
  lines.push(`// Primitives A=${composition.primitive_a.algorithm_kind} · B=${composition.primitive_b.algorithm_kind}`);
  lines.push(`// Template discovered from test evidence · not hard-coded`);
  lines.push(`${exportPrefix} ${fnName}(${inputParam}) {`);
  lines.push(`  const a = ${aCall}${s}`);
  lines.push(`  const b = ${bCall}${s}`);
  lines.push(`  return \`${jsTemplateBody}\`${s}`);
  lines.push(`}`);
  return lines.join("\n");
}

// ── Test-file emission (spec-driven · derived from edge_cases) ────────

function renderTestFile(fnName: string, implImportRel: string, spec: FunctionSpec, style: StyleProfile): string {
  const s = semi(style);
  const lines: string[] = [];
  lines.push(`// NEX1-authored tests · derived from FunctionSpec.edge_cases`);
  lines.push(`// Self-executing under \`node <this-file>\` · exit 0 on pass · non-zero on fail`);
  lines.push(`import { strict as assert } from ${q("node:assert", style)}${s}`);
  lines.push(`import { ${fnName} } from ${q(implImportRel + ".mjs", style)}${s}`);
  lines.push(``);
  lines.push(`let passed = 0${s}`);
  lines.push(`let failed = 0${s}`);
  for (const c of spec.edge_cases) {
    const argsRendered = c.input.map((v) => literal(v as string | number | boolean, style)).join(", ");
    const expectedRendered = literal(c.expect as string | number | boolean, style);
    lines.push(`try {`);
    lines.push(`  assert.equal(${fnName}(${argsRendered}), ${expectedRendered})${s}`);
    lines.push(`  passed++${s}`);
    lines.push(`  console.log(${q("PASS · " + c.when, style)})${s}`);
    lines.push(`} catch (e) {`);
    lines.push(`  failed++${s}`);
    lines.push(`  console.error(${q("FAIL · " + c.when + " · ", style)} + (e && e.message ? e.message : e))${s}`);
    lines.push(`}`);
  }
  lines.push(``);
  lines.push(`console.log(${q("F-C-02 " + fnName + " tests · ", style)} + passed + ${q(" passed · ", style)} + failed + ${q(" failed", style)})${s}`);
  lines.push(`if (failed > 0) process.exit(1)${s}`);
  lines.push(`process.exit(0)${s}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Public entry point ─────────────────────────────────────────────────

export interface PairAuthoringInput {
  readonly impl_path: string;
  readonly test_path: string;
  readonly impl_spec: FunctionSpec;
  readonly test_spec: FunctionSpec;
  readonly composition: PairComposition;
  readonly style: StyleProfile;
}

export type PairAuthoringResult =
  | {
      readonly ok: true;
      readonly implementation: AuthoredFile;
      readonly test: AuthoredFile;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly reason_code: "UNSUPPORTED_ALGORITHM" | "SPEC_VALIDATION_FAILED" | "STYLE_UNDETERMINABLE";
      readonly failed_path?: string;
    };

export async function authorPairwiseComposition(input: PairAuthoringInput): Promise<PairAuthoringResult> {
  if (input.style.naming_convention === "unknown") {
    return { ok: false, reason: "style.naming_convention could not be detected · refusing to guess", reason_code: "STYLE_UNDETERMINABLE" };
  }
  if (input.impl_spec.function_name.length === 0) {
    return { ok: false, reason: "impl function_name empty", reason_code: "SPEC_VALIDATION_FAILED", failed_path: input.impl_path };
  }

  const primA = renderPrimitiveBody(input.composition.primitive_a.algorithm_kind, input.style);
  const primB = renderPrimitiveBody(input.composition.primitive_b.algorithm_kind, input.style);
  if (!primA) {
    return { ok: false, reason: `no renderer for primitive_a=${input.composition.primitive_a.algorithm_kind}`, reason_code: "UNSUPPORTED_ALGORITHM", failed_path: input.impl_path };
  }
  if (!primB) {
    return { ok: false, reason: `no renderer for primitive_b=${input.composition.primitive_b.algorithm_kind}`, reason_code: "UNSUPPORTED_ALGORITHM", failed_path: input.impl_path };
  }

  const fnName = nameFor(input.impl_spec.function_name, input.style);

  // If A and B are the same primitive kind, share a single body definition
  const bodies: string[] = [];
  const primNames = new Set<string>();
  if (!primNames.has(primA.name)) { bodies.push(primA.body); primNames.add(primA.name); }
  if (!primNames.has(primB.name)) { bodies.push(primB.body); primNames.add(primB.name); }

  const composed = renderComposedBody(fnName, input.impl_spec.parameters, input.composition, input.style, primA.name, primB.name);

  const implContent = [
    `// NEX1-authored pair composition · deterministic P-S · no LLM`,
    `// A=${input.composition.primitive_a.algorithm_kind}  args=${JSON.stringify(input.composition.primitive_a.extracted_args)}`,
    `// B=${input.composition.primitive_b.algorithm_kind}  args=${JSON.stringify(input.composition.primitive_b.extracted_args)}`,
    `// Discovered template: ${input.composition.template}`,
    ``,
    ...bodies,
    ``,
    composed,
    ``,
  ].join("\n");

  const implPathRelToTest = deriveRelativeImport(input.test_path, input.impl_path);
  const testContent = renderTestFile(fnName, implPathRelToTest, input.test_spec, input.style);

  const implFile: AuthoredFile = {
    path: input.impl_path,
    content: implContent,
    content_bytes: Buffer.byteLength(implContent, "utf8"),
    content_sha256_hex: sha256Hex(implContent),
    extension: extFor(input.impl_path),
    authored_from_spec: input.impl_spec,
    authored_using_style: input.style,
  };
  const testFile: AuthoredFile = {
    path: input.test_path,
    content: testContent,
    content_bytes: Buffer.byteLength(testContent, "utf8"),
    content_sha256_hex: sha256Hex(testContent),
    extension: extFor(input.test_path),
    authored_from_spec: input.test_spec,
    authored_using_style: input.style,
  };
  return { ok: true, implementation: implFile, test: testFile };
}
