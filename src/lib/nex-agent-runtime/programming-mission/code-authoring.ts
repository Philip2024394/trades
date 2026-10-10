// WO-NEX-RUNTIME-11 · deterministic code authoring.
//
// Founder-locked 2026-09-14. This is NEX1's authoring phase — it takes
// a FunctionSpec + detected StyleProfile and composes real bytes.
//
// Founder rule (locked): "No template pretending to be programming."
//   The authoring below is NOT a fixed template with variable slots. It
//   is a deterministic composer that:
//     - selects primitives based on the FunctionSpec.algorithm_kind
//     - names identifiers using the detected naming_convention
//     - uses semicolons / quote style / export style detected from the
//       existing files (not the author's preference)
//     - derives test bodies from FunctionSpec.edge_cases
//     - fails-closed (returns an authoring error) if any spec field is
//       unrecognised — never falls back to a canned string
//
// The algorithm implementations below are hand-written by us · they are
// the primitives NEX1 composes. NEX1 chooses which primitive fits which
// spec. Adding a new algorithm_kind means adding a new primitive here.
//
// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract infrastructure.
// The `typed_data_contract` primitive dispatch (below in the multi-file
// author) delegates to typed-data-contract-authoring.ts. That primitive
// is SPEC-DRIVEN (not evidence-driven): the mission specifies exact
// declarations to render · the primitive validates against the locked
// grammar and renders deterministically. See amendment at
// docs/NEX1/SECTION_36_A_ROUTE_2_LAB_AUTHORING_AMENDMENT.md.

import type { AuthoredFile, FunctionSpec, StyleProfile } from "./types";
import { authorTypedDataContract, type TypedDataContractAuthoringFailure } from "./typed-data-contract-authoring";

export type AuthoringResult =
  | { readonly ok: true; readonly implementation: AuthoredFile; readonly test: AuthoredFile }
  | { readonly ok: false; readonly reason: string; readonly reason_code: AuthoringFailureCode };

export type AuthoringFailureCode =
  | "UNSUPPORTED_ALGORITHM"
  | "SPEC_VALIDATION_FAILED"
  | "STYLE_UNDETERMINABLE"
  | "EDGE_CASES_EMPTY";

// ── Style helpers ──────────────────────────────────────────────────────

function q(s: string, style: StyleProfile): string {
  return style.quote_style === "single" ? `'${s.replace(/'/g, "\\'")}'` : `"${s.replace(/"/g, '\\"')}"`;
}
function semi(style: StyleProfile): string {
  return style.semicolons === "no" ? "" : ";";
}
function nameFor(base: string, style: StyleProfile): string {
  if (style.naming_convention === "camelCase") {
    // Convert snake_case → camelCase deterministically
    return base.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());
  }
  return base;
}
function literal(v: string | number | boolean, style: StyleProfile): string {
  if (typeof v === "string") return q(v, style);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

// ── Deterministic sha256 helper ────────────────────────────────────────

async function sha256Hex(s: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(s).digest("hex");
}

// ── Algorithm primitive: truncate_words ────────────────────────────────
//
// Semantics NEX1 will emit (composed from primitives · not a canned string):
//   truncate_words(text: string, max: number): string
//     empty text → ""
//     max <= 0    → ""
//     word count <= max → return text (unmodified)
//     otherwise → words.slice(0, max).join(" ")
//   Word split is /\s+/ (unicode-friendly on Node).

function authorTruncateWordsImplementation(fnName: string, params: readonly { name: string; type: string }[], style: StyleProfile): string {
  const textParam = params[0]?.name ?? "text";
  const maxParam = params[1]?.name ?? "max";
  const s = semi(style);
  const exportPrefix = style.export_style === "default" ? `export default function` : `export function`;
  const lines: string[] = [];
  lines.push(`// NEX1-authored implementation · algorithm_kind=truncate_words`);
  lines.push(`// Deterministic composition · read → understand → implement (RUNTIME-11)`);
  lines.push(`/**`);
  lines.push(` * @param {${params[0]?.type ?? "string"}} ${textParam}`);
  lines.push(` * @param {${params[1]?.type ?? "number"}} ${maxParam}`);
  lines.push(` * @returns {string}`);
  lines.push(` */`);
  lines.push(`${exportPrefix} ${fnName}(${textParam}, ${maxParam}) {`);
  lines.push(`  if (${textParam}.length === 0) return ${q("", style)}${s}`);
  lines.push(`  if (${maxParam} <= 0) return ${q("", style)}${s}`);
  lines.push(`  const words = ${textParam}.trim().split(/\\s+/).filter((w) => w.length > 0)${s}`);
  lines.push(`  if (words.length <= ${maxParam}) return ${textParam}${s}`);
  lines.push(`  return words.slice(0, ${maxParam}).join(${q(" ", style)})${s}`);
  lines.push(`}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Algorithm primitive · short_report ─────────────────────────────
//
// M-02 · composes with truncate_words. Emits a function
//   make_short_report(subject, body)
// that returns `Report on ${subject}: ${truncate_words(body, 5)}`.
// The IMPORT line for truncate_words comes from spec.imports_needed ·
// authored deterministically from what the spec declares. If word_utils's
// export drifts away from the imported symbol, the build fails.

function authorShortReportImplementation(fnName: string, params: readonly { name: string; type: string }[], style: StyleProfile, imports: readonly { symbol: string; from_specifier: string }[]): string {
  const subjParam = params[0]?.name ?? "subject";
  const bodyParam = params[1]?.name ?? "body";
  const s = semi(style);
  const exportPrefix = style.export_style === "default" ? `export default function` : `export function`;

  // Emit imports first · one per entry · preserves detected style
  const importLines = imports.map((i) =>
    `import { ${i.symbol} } from ${q(i.from_specifier, style)}${s}`
  );

  // Find the truncate function's symbol name from imports · defaults to "truncate_words"
  const truncateFn = imports.find((i) => /truncate|chop|shorten/.test(i.symbol))?.symbol ?? "truncate_words";

  const lines: string[] = [];
  lines.push(`// NEX1-authored implementation · algorithm_kind=short_report`);
  lines.push(`// Deterministic composition · consumes ${truncateFn} from dependency`);
  for (const importLine of importLines) lines.push(importLine);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * @param {${params[0]?.type ?? "string"}} ${subjParam}`);
  lines.push(` * @param {${params[1]?.type ?? "string"}} ${bodyParam}`);
  lines.push(` * @returns {string}`);
  lines.push(` */`);
  lines.push(`${exportPrefix} ${fnName}(${subjParam}, ${bodyParam}) {`);
  // Use template literal with the SAME quote style as strings elsewhere · pick backticks always for template literals
  lines.push(`  return \`Report on \${${subjParam}}: \${${truncateFn}(${bodyParam}, 5)}\`${s}`);
  lines.push(`}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Algorithm primitive · text_stats ────────────────────────────────
//
// M-03 · API/interface primitive. Produces a function that returns a
// structured object · not a scalar. The interface contract:
//   text_stats(text) → { words: number, chars: number }
//
// Deterministic composition — no LLM · no template magic. NEX1 selects
// this primitive when its spec.algorithm_kind === "text_stats" and the
// authoring composes primitives per detected style.

function authorTextStatsImplementation(fnName: string, params: readonly { name: string; type: string }[], style: StyleProfile): string {
  const textParam = params[0]?.name ?? "text";
  const s = semi(style);
  const exportPrefix = style.export_style === "default" ? `export default function` : `export function`;
  const lines: string[] = [];
  lines.push(`// NEX1-authored implementation · algorithm_kind=text_stats`);
  lines.push(`// Returns structured statistics · scalar-to-object interface pattern`);
  lines.push(`/**`);
  lines.push(` * @param {${params[0]?.type ?? "string"}} ${textParam}`);
  lines.push(` * @returns {{ words: number, chars: number }}`);
  lines.push(` */`);
  lines.push(`${exportPrefix} ${fnName}(${textParam}) {`);
  lines.push(`  if (${textParam}.length === 0) return { words: 0, chars: 0 }${s}`);
  lines.push(`  const words = ${textParam}.trim().split(/\\s+/).filter((w) => w.length > 0).length${s}`);
  lines.push(`  const chars = ${textParam}.length${s}`);
  lines.push(`  return { words, chars }${s}`);
  lines.push(`}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Algorithm primitive · describe_text ─────────────────────────────
//
// M-03 · consumes a `text_stats`-shaped API. The authoring composes:
//   1. Import declaration (from spec.imports_needed)
//   2. Field-access on the object return · uses .words
//
// This composes with text_stats via the destructuring pattern. Note:
// this authoring does NOT invent the consumer adaptation — it emits
// the destructuring because the algorithm's primitive composition
// says "call the imported stats function and use .words". A different
// consumer algorithm could instead call `[object Object]`-style and
// fail at runtime · that would be a valuable-failure data point.

function authorDescribeTextImplementation(fnName: string, params: readonly { name: string; type: string }[], style: StyleProfile, imports: readonly { symbol: string; from_specifier: string }[]): string {
  const textParam = params[0]?.name ?? "text";
  const s = semi(style);
  const exportPrefix = style.export_style === "default" ? `export default function` : `export function`;

  const importLines = imports.map((i) =>
    `import { ${i.symbol} } from ${q(i.from_specifier, style)}${s}`
  );

  // Find the stats function symbol · defaults to "text_stats"
  const statsFn = imports.find((i) => /stat|count|metric/.test(i.symbol))?.symbol ?? "text_stats";

  const lines: string[] = [];
  lines.push(`// NEX1-authored implementation · algorithm_kind=describe_text`);
  lines.push(`// Consumes ${statsFn} → { words, chars } and reports the words field`);
  for (const importLine of importLines) lines.push(importLine);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * @param {${params[0]?.type ?? "string"}} ${textParam}`);
  lines.push(` * @returns {string}`);
  lines.push(` */`);
  lines.push(`${exportPrefix} ${fnName}(${textParam}) {`);
  lines.push(`  const { words } = ${statsFn}(${textParam})${s}`);
  lines.push(`  return \`Text has \${words} words\`${s}`);
  lines.push(`}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Algorithm primitive · fibonacci_memoised ──────────────────────────
//
// M-F-03 · recursive Fibonacci with memoisation. Bounded primitive:
// - signature (n: number) → number
// - non-negative integers only
// - closure-scoped memo cache (module-level Map)
// - deterministic composition · no runtime side effects
//
// Founder-locked: this is a specific bounded pattern. It does NOT mean
// "NEX1 understands recursion" · it means NEX1 has one memoised-recursion
// primitive in its library. Adding another recursive algorithm later
// would require another specific primitive.

function authorFibonacciMemoisedImplementation(fnName: string, params: readonly { name: string; type: string }[], style: StyleProfile): string {
  const nParam = params[0]?.name ?? "n";
  const s = semi(style);
  const exportPrefix = style.export_style === "default" ? `export default function` : `export function`;
  const lines: string[] = [];
  lines.push(`// NEX1-authored implementation · algorithm_kind=fibonacci_memoised`);
  lines.push(`// Recursive with module-level memoisation cache`);
  lines.push(`/**`);
  lines.push(` * @param {${params[0]?.type ?? "number"}} ${nParam}`);
  lines.push(` * @returns {number}`);
  lines.push(` */`);
  lines.push(`const __memo_${fnName} = new Map()${s}`);
  lines.push(`${exportPrefix} ${fnName}(${nParam}) {`);
  lines.push(`  if (${nParam} <= 1) return ${nParam}${s}`);
  lines.push(`  const cached = __memo_${fnName}.get(${nParam})${s}`);
  lines.push(`  if (cached !== undefined) return cached${s}`);
  lines.push(`  const v = ${fnName}(${nParam} - 1) + ${fnName}(${nParam} - 2)${s}`);
  lines.push(`  __memo_${fnName}.set(${nParam}, v)${s}`);
  lines.push(`  return v${s}`);
  lines.push(`}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Test authoring: derives cases directly from FunctionSpec.edge_cases ─

function authorTruncateWordsTests(fnName: string, implPathRelToTest: string, spec: FunctionSpec, style: StyleProfile): string {
  const s = semi(style);
  const lines: string[] = [];
  lines.push(`// NEX1-authored tests · derived from FunctionSpec.edge_cases`);
  lines.push(`// Self-executing under \`node <this-file>\` · exit 0 on pass · non-zero on fail`);
  lines.push(`import { strict as assert } from ${q("node:assert", style)}${s}`);
  lines.push(`import { ${fnName} } from ${q(implPathRelToTest + ".mjs", style)}${s}`);
  lines.push(``);
  lines.push(`let passed = 0${s}`);
  lines.push(`let failed = 0${s}`);
  for (const c of spec.edge_cases) {
    const argsRendered = c.input.map((v) => literal(v, style)).join(", ");
    const expectedRendered = literal(c.expect, style);
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
  lines.push(`console.log(${q("RUNTIME-11 " + fnName + " tests · ", style)} + passed + ${q(" passed · ", style)} + failed + ${q(" failed", style)})${s}`);
  lines.push(`if (failed > 0) process.exit(1)${s}`);
  lines.push(`process.exit(0)${s}`);
  lines.push(``);
  return lines.join("\n");
}

// ── Multi-file authoring · M-02 ───────────────────────────────────────

export interface MultiFileSpec {
  readonly path: string;                  // workspace-relative
  readonly kind: "implementation" | "test";
  readonly function_spec: FunctionSpec;
  /** For test files: which implementation file to import from (workspace-relative).
   *  For implementation files: unused. */
  readonly test_imports_from_path?: string;
}

export type MultiFileAuthoringResult =
  | { readonly ok: true; readonly files: readonly AuthoredFile[] }
  | { readonly ok: false; readonly reason: string; readonly reason_code: AuthoringFailureCode; readonly failed_path?: string };

const extFor = (p: string): AuthoredFile["extension"] => {
  if (p.endsWith(".ts")) return "ts";
  if (p.endsWith(".tsx")) return "tsx";
  if (p.endsWith(".mjs") || p.endsWith(".cjs") || p.endsWith(".js")) return "js";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".md")) return "md";
  if (p.endsWith(".css")) return "css";
  return "txt";
};

async function toAuthoredFile(path: string, content: string, kind: "implementation" | "test", spec: FunctionSpec, style: StyleProfile): Promise<AuthoredFile> {
  const hash = await sha256Hex(content);
  return {
    path,
    content,
    content_bytes: Buffer.byteLength(content, "utf8"),
    content_sha256_hex: hash,
    extension: extFor(path),
    authored_from_spec: spec,
    authored_using_style: style,
  };
}

/** M-02 · author N files with cross-file dependency support.
 *  Each file is authored using its `function_spec.algorithm_kind`.
 *  Consistency between files is achieved by having each spec declare
 *  its own imports_needed · if the imports drift from what other files
 *  actually export, the build will catch it (the whole point of the
 *  ripple-effect test). */
export async function authorMultiFileProgrammingChange(input: {
  readonly files: readonly MultiFileSpec[];
  readonly style: StyleProfile;
}): Promise<MultiFileAuthoringResult> {
  if (input.files.length === 0) return { ok: false, reason: "no files supplied", reason_code: "SPEC_VALIDATION_FAILED" };
  if (input.style.naming_convention === "unknown") {
    return { ok: false, reason: "style.naming_convention could not be detected · refusing to guess", reason_code: "STYLE_UNDETERMINABLE" };
  }
  const authored: AuthoredFile[] = [];
  for (const f of input.files) {
    const spec = f.function_spec;
    if (spec.function_name.length === 0) return { ok: false, reason: "function_name empty", reason_code: "SPEC_VALIDATION_FAILED", failed_path: f.path };
    // Phase 2A · loosened validator (founder-authorised 2026-09-14).
    // parameters=[] is now permitted (constructors take no explicit args).
    // The specific algorithm primitive is responsible for validating its
    // own parameter shape once selected.
    // edge_cases=[] on test files is now permitted (higher-order tests
    // reference symbolic callbacks that the literal parser cannot match).
    // The matcher will simply find no direct evidence and refuse honestly.

    const fnName = nameFor(spec.function_name, input.style);
    let content: string;
    if (f.kind === "implementation") {
      if (spec.algorithm_kind === "truncate_words") {
        content = authorTruncateWordsImplementation(fnName, spec.parameters, input.style);
      } else if (spec.algorithm_kind === "short_report") {
        const imports = spec.imports_needed ?? [];
        content = authorShortReportImplementation(fnName, spec.parameters, input.style, imports);
      } else if (spec.algorithm_kind === "text_stats") {
        content = authorTextStatsImplementation(fnName, spec.parameters, input.style);
      } else if (spec.algorithm_kind === "describe_text") {
        const imports = spec.imports_needed ?? [];
        content = authorDescribeTextImplementation(fnName, spec.parameters, input.style, imports);
      } else if (spec.algorithm_kind === "fibonacci_memoised") {
        content = authorFibonacciMemoisedImplementation(fnName, spec.parameters, input.style);
      } else if (spec.algorithm_kind === "typed_data_contract") {
        // §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract infrastructure.
        // Spec-driven authoring · delegates to typed-data-contract-authoring.ts
        // which validates the spec against the locked grammar and renders
        // deterministic TypeScript bytes. Refusal reasons are structured
        // and propagate to the caller as SPEC_VALIDATION_FAILED with the
        // structured refusal code in the reason string.
        if (!spec.typed_data_contract_spec) {
          return { ok: false, reason: "typed_data_contract requires typed_data_contract_spec", reason_code: "SPEC_VALIDATION_FAILED", failed_path: f.path };
        }
        const tdcResult = authorTypedDataContract({
          spec: spec.typed_data_contract_spec,
          style: input.style,
          target_path: f.path,
        });
        if (!tdcResult.ok) {
          const failure: TypedDataContractAuthoringFailure = tdcResult;
          return { ok: false, reason: `${failure.refusal_code}: ${failure.reason}`, reason_code: "SPEC_VALIDATION_FAILED", failed_path: f.path };
        }
        content = tdcResult.content;
      } else {
        return { ok: false, reason: `algorithm_kind ${spec.algorithm_kind} not supported`, reason_code: "UNSUPPORTED_ALGORITHM", failed_path: f.path };
      }
    } else {
      // test file
      const implPath = f.test_imports_from_path;
      if (!implPath) return { ok: false, reason: "test file spec missing test_imports_from_path", reason_code: "SPEC_VALIDATION_FAILED", failed_path: f.path };
      const importRel = deriveRelativeImport(f.path, implPath) + (implPath.endsWith(".mjs") ? ".mjs" : implPath.endsWith(".ts") ? ".ts" : ".mjs");
      content = authorTruncateWordsTests(fnName, deriveRelativeImport(f.path, implPath), spec, input.style);
    }
    authored.push(await toAuthoredFile(f.path, content, f.kind, spec, input.style));
  }
  return { ok: true, files: Object.freeze(authored) };
}

// ── Single-file author entry point (M-01 · unchanged) ─────────────────

export async function authorProgrammingChange(input: {
  readonly spec: FunctionSpec;
  readonly style: StyleProfile;
  readonly implementation_path: string;   // relative to workspace_root
  readonly test_path: string;             // relative to workspace_root
}): Promise<AuthoringResult> {
  const { spec, style } = input;

  // Validate the spec is well-formed
  // Phase 2A · founder-authorised 2026-09-14 framework loosening.
  // parameters=[] permitted (constructors) · edge_cases=[] permitted
  // (HOF tests reference symbolic callbacks parser cannot literalise).
  // Individual algorithm primitives are responsible for validating
  // their own required shape once selected.
  if (spec.function_name.length === 0) return { ok: false, reason: "function_name is empty", reason_code: "SPEC_VALIDATION_FAILED" };
  // Legacy truncate_words path still needs 2 params + non-empty edge_cases
  // to author correctly. Enforce ONLY for that specific algorithm_kind,
  // not for the general spec.
  if (spec.algorithm_kind === "truncate_words") {
    if (spec.parameters.length < 2) return { ok: false, reason: "truncate_words needs (text, max)", reason_code: "SPEC_VALIDATION_FAILED" };
    if (spec.edge_cases.length === 0) return { ok: false, reason: "truncate_words edge_cases empty", reason_code: "EDGE_CASES_EMPTY" };
  }
  if (style.naming_convention === "unknown") return { ok: false, reason: "style.naming_convention could not be detected · refusing to guess", reason_code: "STYLE_UNDETERMINABLE" };

  // Compose the identifier NEX1 will export · applies detected style
  const fnName = nameFor(spec.function_name, style);

  let implementationSource: string;
  let testSource: string;
  if (spec.algorithm_kind === "truncate_words") {
    implementationSource = authorTruncateWordsImplementation(fnName, spec.parameters, style);
    // Import path in the test: strip the `.ts` and add relative prefix.
    // If test is `src/utils/text.test.ts` and impl is `src/utils/truncate_words.ts`,
    // relative import is `./truncate_words`.
    const importPath = deriveRelativeImport(input.test_path, input.implementation_path);
    testSource = authorTruncateWordsTests(fnName, importPath, spec, style);
  } else {
    return { ok: false, reason: `algorithm_kind ${spec.algorithm_kind} not supported`, reason_code: "UNSUPPORTED_ALGORITHM" };
  }

  const [implHash, testHash] = await Promise.all([sha256Hex(implementationSource), sha256Hex(testSource)]);

  const implementation: AuthoredFile = {
    path: input.implementation_path,
    content: implementationSource,
    content_bytes: Buffer.byteLength(implementationSource, "utf8"),
    content_sha256_hex: implHash,
    extension: extFor(input.implementation_path),
    authored_from_spec: spec,
    authored_using_style: style,
  };
  const test: AuthoredFile = {
    path: input.test_path,
    content: testSource,
    content_bytes: Buffer.byteLength(testSource, "utf8"),
    content_sha256_hex: testHash,
    extension: extFor(input.test_path),
    authored_from_spec: spec,
    authored_using_style: style,
  };
  return { ok: true, implementation, test };
}

/** Derive `./sibling` or `../foo/bar` style import from one workspace-
 *  relative path to another. Deterministic. */
function deriveRelativeImport(fromRel: string, toRel: string): string {
  const fromParts = fromRel.replace(/\\/g, "/").split("/");
  const toParts = toRel.replace(/\\/g, "/").split("/");
  fromParts.pop();   // drop the file segment
  const toName = (toParts.pop() ?? "").replace(/\.(tsx?|mjs|cjs|js)$/, "");
  // Common prefix
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const up = fromParts.length - i;
  const down = toParts.slice(i);
  const prefix = up === 0 ? "./" : "../".repeat(up);
  const dir = down.length === 0 ? "" : down.join("/") + "/";
  return `${prefix}${dir}${toName}`;
}
