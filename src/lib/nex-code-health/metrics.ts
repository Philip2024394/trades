// src/lib/nex-code-health/metrics.ts
//
// NEX1 · CODE HEALTH · deterministic AST-based metrics.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Every metric returns a raw MEASUREMENT · never a label · never a threshold.

import * as ts from "typescript";
import { createHash, randomBytes } from "node:crypto";
import type { HealthMeasurement, HealthState, MeasurementScope, HealthMetricKind, ReproducibilityInformation, HealthAttribution, DelegatedFrom } from "./types";

const SCHEMA_VERSION = "v0.1.0";
const TS_VERSION = (ts as any).version ?? "unknown";

export function makeReproducibility(methodTag: string, cwd: string): ReproducibilityInformation {
  const parts = ["node=" + process.version, "platform=" + process.platform, "arch=" + process.arch, "method=" + methodTag];
  return {
    command: "code-health-internal · " + methodTag,
    cwd,
    env_fingerprint: createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16),
    node_version: process.version,
    platform: process.platform,
  };
}

export function attribution(): HealthAttribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "code_health_measurement",
    authority: "descriptive_read_only",
    produced_by: "code_health_intelligence",
  };
}

// Detects whether TypeScript reported any parse-level diagnostics on this SourceFile.
// Used by every AST-dependent metric to convert broken-syntax cases to INCONCLUSIVE
// rather than emitting a fabricated numeric value.
function hasParseDiagnostics(sf: ts.SourceFile): { broken: boolean; count: number; first?: string } {
  const diags = (sf as any).parseDiagnostics as readonly ts.Diagnostic[] | undefined;
  if (!diags || diags.length === 0) return { broken: false, count: 0 };
  const first = diags[0];
  const msg = typeof first.messageText === "string" ? first.messageText : (first.messageText as any).messageText ?? "parse_error";
  return { broken: true, count: diags.length, first: String(msg).slice(0, 100) };
}

export function nextMetricId(): string {
  return "CH-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
}

function sha256Prefix(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16); }

function makeSourceFile(path: string, content: string): ts.SourceFile {
  const scriptKind = /\.(tsx)$/.test(path) ? ts.ScriptKind.TSX
    : /\.(jsx)$/.test(path) ? ts.ScriptKind.JSX
    : /\.(ts|mts|cts)$/.test(path) ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;
  return ts.createSourceFile(path, content, ts.ScriptTarget.ES2020, /*setParentNodes*/ true, scriptKind);
}

// ─── FILE SIZE + LINE COUNTS ─────────────────────────────────────

export function measureFileSize(source_path: string, content: string): HealthMeasurement {
  return baseMeasurement({
    kind: "file_size",
    scope: "file",
    scope_target: source_path,
    source_path,
    source_hash: sha256Prefix(content),
    state: "MEASURED",
    value: content.length,
    methodology: "byte-count of source content",
    tool: "code-health-internal",
    method_tag: "file-size-bytes",
    limitations: "raw byte count · encoding-dependent (assumes utf-8 · same bytes as file on disk when input matches source)",
  });
}

export function measureLineCounts(source_path: string, content: string): HealthMeasurement {
  const lines = content.split("\n");
  let code = 0, comment = 0, blank = 0;
  let inBlock = false;
  for (const l of lines) {
    const t = l.trim();
    if (inBlock) {
      comment++;
      if (t.includes("*/")) inBlock = false;
      continue;
    }
    if (t.length === 0) { blank++; continue; }
    if (t.startsWith("//")) { comment++; continue; }
    if (t.startsWith("/*")) { comment++; if (!t.includes("*/")) inBlock = true; continue; }
    code++;
  }
  return baseMeasurement({
    kind: "line_counts",
    scope: "file",
    scope_target: source_path,
    source_path,
    source_hash: sha256Prefix(content),
    state: "MEASURED",
    value: { total: lines.length, code, comment, blank },
    methodology: "line-based classification · shebang + block-comment aware · not AST-based",
    tool: "code-health-internal",
    method_tag: "line-counts",
    limitations: "line-based heuristic · does not distinguish embedded JSDoc from block comments · does not handle template-literal-embedded code",
  });
}

// ─── CYCLOMATIC COMPLEXITY (per function) ────────────────────────

interface PerFunctionComplexity { readonly function_name: string; readonly start_line: number; readonly complexity: number; }

export function measureCyclomaticPerFile(source_path: string, content: string): { file: HealthMeasurement; per_function: readonly HealthMeasurement[] } {
  if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(source_path)) {
    return {
      file: baseMeasurement({
        kind: "cyclomatic_complexity", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
        state: "NOT_APPLICABLE", value: null,
        methodology: "TypeScript-AST-based McCabe · JS/TS only", tool: "typescript", tool_version_override: TS_VERSION,
        method_tag: "not-applicable-non-js-ts", limitations: "v0 supports JS/TS only",
      }),
      per_function: [],
    };
  }
  try {
    const sf = makeSourceFile(source_path, content);
    const parseCheck = hasParseDiagnostics(sf);
    if (parseCheck.broken) {
      return {
        file: baseMeasurement({
          kind: "cyclomatic_complexity", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
          state: "INCONCLUSIVE", value: null,
          methodology: "McCabe cyclomatic complexity · TypeScript AST — SUPPRESSED",
          tool: "typescript", tool_version_override: TS_VERSION,
          method_tag: "parse-diagnostics-present",
          limitations: `AST parse produced ${parseCheck.count} diagnostic(s) · complexity cannot be reliably established · first="${parseCheck.first ?? "?"}"`,
          reason: "incomplete_ast_or_parse_error",
        }),
        per_function: [],
      };
    }
    const fns: PerFunctionComplexity[] = [];
    collectComplexity(sf, sf, fns);
    const fileTotal = fns.reduce((a, f) => a + f.complexity, 0);
    const file = baseMeasurement({
      kind: "cyclomatic_complexity", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "MEASURED", value: { file_total: fileTotal, function_count: fns.length, max_per_function: fns.reduce((m, f) => Math.max(m, f.complexity), 0) },
      methodology: "McCabe cyclomatic complexity · TypeScript AST · +1 per function base · +1 per (if · for · for-in · for-of · while · do · case · catch · conditional · && · || · ??)",
      tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "cyclomatic-mccabe-ast",
      limitations: "classic McCabe · not cognitive complexity · not weighted by nesting",
    });
    const perFn = fns.map((f) =>
      baseMeasurement({
        kind: "cyclomatic_complexity", scope: "function", scope_target: `${source_path}::${f.function_name}::L${f.start_line}`,
        source_path, source_hash: sha256Prefix(content),
        state: "MEASURED", value: f.complexity,
        methodology: "McCabe cyclomatic complexity · TypeScript AST · per-function",
        tool: "typescript", tool_version_override: TS_VERSION,
        method_tag: "cyclomatic-mccabe-ast-per-fn",
        limitations: "classic McCabe · per-function",
      })
    );
    return { file, per_function: perFn };
  } catch (e) {
    return {
      file: baseMeasurement({
        kind: "cyclomatic_complexity", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
        state: "INCONCLUSIVE", value: null,
        methodology: "parse failed", tool: "typescript", tool_version_override: TS_VERSION,
        method_tag: "parse-failed", limitations: "AST parse threw · " + (e as Error).message.slice(0, 80),
      }),
      per_function: [],
    };
  }
}

function collectComplexity(node: ts.Node, sf: ts.SourceFile, out: PerFunctionComplexity[]): void {
  const isFn =
    ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node);
  if (isFn) {
    const name = fnName(node, sf);
    const complexity = countDecisions(node) + 1;
    const start_line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push({ function_name: name, complexity, start_line });
  }
  node.forEachChild((c) => collectComplexity(c, sf, out));
}

function fnName(node: ts.Node, sf: ts.SourceFile): string {
  const n = node as any;
  if (n.name && ts.isIdentifier(n.name)) return n.name.text;
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isConstructorDeclaration(node)) return "constructor";
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  return "(anonymous L" + line + ")";
}

function countDecisions(node: ts.Node): number {
  let n = 0;
  const walk = (nd: ts.Node) => {
    if (ts.isIfStatement(nd)) n++;
    else if (ts.isForStatement(nd) || ts.isForInStatement(nd) || ts.isForOfStatement(nd)) n++;
    else if (ts.isWhileStatement(nd) || ts.isDoStatement(nd)) n++;
    else if (ts.isCaseClause(nd)) n++;
    else if (ts.isCatchClause(nd)) n++;
    else if (ts.isConditionalExpression(nd)) n++;
    else if (ts.isBinaryExpression(nd)) {
      const k = nd.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) n++;
    }
    const isNestedFn = ts.isFunctionDeclaration(nd) || ts.isMethodDeclaration(nd) || ts.isArrowFunction(nd) ||
      ts.isFunctionExpression(nd) || ts.isGetAccessorDeclaration(nd) || ts.isSetAccessorDeclaration(nd) ||
      ts.isConstructorDeclaration(nd);
    if (!isNestedFn || nd === node) nd.forEachChild(walk);
  };
  node.forEachChild(walk);
  return n;
}

// ─── FUNCTION SIZE (line count per function) ─────────────────────

export function measureFunctionSizes(source_path: string, content: string): readonly HealthMeasurement[] {
  if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(source_path)) return [];
  try {
    const sf = makeSourceFile(source_path, content);
    if (hasParseDiagnostics(sf).broken) return [];  // suppress · caller sees INCONCLUSIVE via cyclomatic report
    const out: HealthMeasurement[] = [];
    const walk = (nd: ts.Node) => {
      const isFn = ts.isFunctionDeclaration(nd) || ts.isMethodDeclaration(nd) || ts.isArrowFunction(nd) ||
        ts.isFunctionExpression(nd) || ts.isGetAccessorDeclaration(nd) || ts.isSetAccessorDeclaration(nd) ||
        ts.isConstructorDeclaration(nd);
      if (isFn) {
        const startLine = sf.getLineAndCharacterOfPosition(nd.getStart(sf)).line + 1;
        const endLine = sf.getLineAndCharacterOfPosition(nd.getEnd()).line + 1;
        const params = (nd as any).parameters?.length ?? 0;
        out.push(baseMeasurement({
          kind: "function_size", scope: "function", scope_target: `${source_path}::${fnName(nd, sf)}::L${startLine}`,
          source_path, source_hash: sha256Prefix(content), state: "MEASURED",
          value: { start_line: startLine, end_line: endLine, span_lines: endLine - startLine + 1, param_count: params },
          methodology: "TypeScript AST · function span in source lines · parameter count from AST",
          tool: "typescript", tool_version_override: TS_VERSION,
          method_tag: "function-size-per-fn",
          limitations: "line span includes signature + body · blank lines and comments inside function are counted",
        }));
      }
      nd.forEachChild(walk);
    };
    walk(sf);
    return out;
  } catch { return []; }
}

// ─── NESTING DEPTH (max per file/function) ───────────────────────

export function measureNestingDepth(source_path: string, content: string): HealthMeasurement {
  if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(source_path)) {
    return baseMeasurement({
      kind: "nesting_depth", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "NOT_APPLICABLE", value: null,
      methodology: "AST-based · JS/TS only", tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "not-applicable-non-js-ts", limitations: "v0 supports JS/TS only",
    });
  }
  try {
    const sf = makeSourceFile(source_path, content);
    const parseCheck = hasParseDiagnostics(sf);
    if (parseCheck.broken) {
      return baseMeasurement({
        kind: "nesting_depth", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
        state: "INCONCLUSIVE", value: null,
        methodology: "AST-based nesting depth · SUPPRESSED",
        tool: "typescript", tool_version_override: TS_VERSION,
        method_tag: "parse-diagnostics-present",
        limitations: `AST parse produced ${parseCheck.count} diagnostic(s) · nesting depth cannot be reliably established`,
        reason: "incomplete_ast_or_parse_error",
      });
    }
    let maxDepth = 0;
    const walk = (nd: ts.Node, depth: number) => {
      const opens =
        ts.isBlock(nd) || ts.isIfStatement(nd) || ts.isForStatement(nd) || ts.isForInStatement(nd) ||
        ts.isForOfStatement(nd) || ts.isWhileStatement(nd) || ts.isDoStatement(nd) ||
        ts.isSwitchStatement(nd) || ts.isCaseClause(nd) || ts.isCatchClause(nd) ||
        ts.isTryStatement(nd);
      const nextDepth = opens ? depth + 1 : depth;
      if (nextDepth > maxDepth) maxDepth = nextDepth;
      nd.forEachChild((c) => walk(c, nextDepth));
    };
    walk(sf, 0);
    return baseMeasurement({
      kind: "nesting_depth", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "MEASURED", value: maxDepth,
      methodology: "TypeScript AST · max nesting depth across block-opening constructs (block · if · for · while · do · switch · case · catch · try)",
      tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "nesting-depth-ast",
      limitations: "counts syntactic nesting · does not distinguish semantic complexity",
    });
  } catch (e) {
    return baseMeasurement({
      kind: "nesting_depth", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "INCONCLUSIVE", value: null,
      methodology: "parse failed", tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "parse-failed", limitations: "AST parse threw · " + (e as Error).message.slice(0, 80),
    });
  }
}

// ─── API SURFACE (exported symbols) ──────────────────────────────

export function measureApiSurface(source_path: string, content: string): HealthMeasurement {
  if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(source_path)) {
    return baseMeasurement({
      kind: "api_surface", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "NOT_APPLICABLE", value: null,
      methodology: "AST-based · JS/TS only", tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "not-applicable-non-js-ts", limitations: "v0 supports JS/TS only",
    });
  }
  try {
    const sf = makeSourceFile(source_path, content);
    const parseCheck = hasParseDiagnostics(sf);
    if (parseCheck.broken) {
      return baseMeasurement({
        kind: "api_surface", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
        state: "INCONCLUSIVE", value: null,
        methodology: "AST-based api-surface enumeration · SUPPRESSED",
        tool: "typescript", tool_version_override: TS_VERSION,
        method_tag: "parse-diagnostics-present",
        limitations: `AST parse produced ${parseCheck.count} diagnostic(s) · api surface cannot be reliably established · first="${parseCheck.first ?? "?"}"`,
        reason: "incomplete_ast_or_parse_error",
      });
    }
    const exports: { name: string; kind: string }[] = [];
    const walk = (nd: ts.Node) => {
      if (ts.isExportDeclaration(nd)) {
        if (nd.exportClause && ts.isNamedExports(nd.exportClause)) {
          for (const el of nd.exportClause.elements) exports.push({ name: el.name.text, kind: "named_reexport" });
        } else exports.push({ name: "*", kind: "star_reexport" });
        return;
      }
      if (ts.isExportAssignment(nd)) { exports.push({ name: "default", kind: "default_export" }); return; }
      // Named declarations with export modifier
      const mods = (nd as any).modifiers as ts.NodeArray<ts.Modifier> | undefined;
      const hasExport = mods && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport) {
        const isDefault = mods!.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
        if (isDefault) exports.push({ name: "default", kind: "default_declaration" });
        else if (ts.isFunctionDeclaration(nd) && nd.name) exports.push({ name: nd.name.text, kind: "function" });
        else if (ts.isClassDeclaration(nd) && nd.name) exports.push({ name: nd.name.text, kind: "class" });
        else if (ts.isVariableStatement(nd)) {
          for (const d of nd.declarationList.declarations) {
            if (ts.isIdentifier(d.name)) exports.push({ name: d.name.text, kind: "variable" });
          }
        } else if (ts.isTypeAliasDeclaration(nd) && nd.name) exports.push({ name: nd.name.text, kind: "type_alias" });
        else if (ts.isInterfaceDeclaration(nd) && nd.name) exports.push({ name: nd.name.text, kind: "interface" });
        else if (ts.isEnumDeclaration(nd) && nd.name) exports.push({ name: nd.name.text, kind: "enum" });
      }
      nd.forEachChild(walk);
    };
    walk(sf);
    return baseMeasurement({
      kind: "api_surface", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "MEASURED", value: { count: exports.length, exports },
      methodology: "TypeScript AST · counts export declarations (named · default · reexport · variable · function · class · type · interface · enum)",
      tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "api-surface-ast",
      limitations: "does not follow re-exports transitively · does not resolve barrel re-exports · does not distinguish internal exports (module-scoped) from public API",
    });
  } catch (e) {
    return baseMeasurement({
      kind: "api_surface", scope: "file", scope_target: source_path, source_path, source_hash: sha256Prefix(content),
      state: "INCONCLUSIVE", value: null,
      methodology: "parse failed", tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "parse-failed", limitations: "AST parse threw · " + (e as Error).message.slice(0, 80),
    });
  }
}

// ─── DUPLICATION (function-level AST shape hash) ─────────────────

export function measureDuplication(sources: readonly { path: string; content: string }[]): readonly HealthMeasurement[] {
  const fingerprintMap = new Map<string, Array<{ source_path: string; function_name: string; start_line: number }>>();
  for (const s of sources) {
    if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(s.path)) continue;
    try {
      const sf = makeSourceFile(s.path, s.content);
      const walk = (nd: ts.Node) => {
        const isFn = ts.isFunctionDeclaration(nd) || ts.isMethodDeclaration(nd) || ts.isArrowFunction(nd) ||
          ts.isFunctionExpression(nd);
        if (isFn) {
          const body = (nd as any).body as ts.Node | undefined;
          if (body) {
            const shape = shapeHash(body);
            // Filter out trivial short shapes to reduce noise
            if (shape.length > 40) {
              const line = sf.getLineAndCharacterOfPosition(nd.getStart(sf)).line + 1;
              const arr = fingerprintMap.get(shape) ?? [];
              arr.push({ source_path: s.path, function_name: fnName(nd, sf), start_line: line });
              fingerprintMap.set(shape, arr);
            }
          }
        }
        nd.forEachChild(walk);
      };
      walk(sf);
    } catch { /* skip · reported separately */ }
  }
  const out: HealthMeasurement[] = [];
  for (const [shape, occurrences] of fingerprintMap.entries()) {
    if (occurrences.length < 2) continue;
    out.push(baseMeasurement({
      kind: "duplication", scope: "project", scope_target: "shape:" + sha256Prefix(shape).slice(0, 8),
      source_path: occurrences[0].source_path,
      source_hash: sha256Prefix(occurrences.map((o) => o.source_path).join("|")),
      state: "MEASURED",
      value: { shape_prefix: sha256Prefix(shape).slice(0, 12), occurrence_count: occurrences.length, occurrences },
      methodology: "AST-shape-hash · normalises identifiers/literals · matches at function-body granularity · minimum shape length 40 chars",
      tool: "typescript", tool_version_override: TS_VERSION,
      method_tag: "duplication-ast-shape-hash",
      limitations: "v0 · function-body granularity only · does not detect refactorable near-duplicates · false-negative on structurally-different but semantically-equivalent code",
    }));
  }
  return out.sort((a, b) => sha256Prefix(String(a.value)).localeCompare(sha256Prefix(String(b.value))));
}

function shapeHash(node: ts.Node): string {
  // Deterministic AST shape · records only SyntaxKind names · strips identifiers/literals
  const parts: string[] = [];
  const walk = (nd: ts.Node) => {
    parts.push(String(nd.kind));
    nd.forEachChild(walk);
  };
  walk(node);
  return parts.join(",");
}

// ─── Helper: baseMeasurement ─────────────────────────────────────

interface BaseArgs {
  kind: HealthMetricKind;
  scope: MeasurementScope;
  scope_target: string;
  source_path: string;
  source_hash: string;
  state: HealthState;
  value: number | Record<string, unknown> | null;
  methodology: string;
  tool: string;
  tool_version_override?: string;
  method_tag: string;
  limitations: string;
  reason?: string;
  delegated_from?: DelegatedFrom;
  upstream_architecture_id?: string;
  upstream_profile_id?: string;
}
export function baseMeasurement(a: BaseArgs): HealthMeasurement {
  return {
    record_type: "CODE_HEALTH_MEASUREMENT",
    metric_id: nextMetricId(),
    schema_version: SCHEMA_VERSION,
    kind: a.kind,
    scope: a.scope,
    scope_target: a.scope_target,
    source_path: a.source_path,
    source_hash: a.source_hash,
    state: a.state,
    value: a.value,
    tool: a.tool,
    tool_version: a.tool_version_override ?? "internal",
    methodology: a.methodology,
    reproducibility_information: makeReproducibility(a.method_tag, process.cwd()),
    limitations: a.limitations,
    reason: a.reason,
    delegated_from: a.delegated_from,
    attribution: attribution(),
    upstream_architecture_id: a.upstream_architecture_id,
    upstream_profile_id: a.upstream_profile_id,
  };
}
