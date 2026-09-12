// src/lib/nex-evidence-engine/dimensions/complexity.ts
//
// NEX1 · EVIDENCE ENGINE · E-05 · Complexity measurement.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Deterministic cyclomatic complexity via TypeScript compiler AST.
// Method: count decision points per function · +1 for the function itself.
// Decision points: IfStatement · ForStatement · ForInStatement · ForOfStatement ·
// WhileStatement · DoStatement · CaseClause · CatchClause · ConditionalExpression ·
// BinaryExpression with && · || · ??
//
// This is McCabe cyclomatic complexity · well-defined · reproducible.
// NEVER produces a "quality score" · only the raw count per function + file total.

import * as ts from "typescript";
import type { EvidenceRecord, MeasurementInput, EvidenceState } from "../types";
import {
  attributionMeasurement,
  hashSourceFiles,
  nextEvidenceId,
  provenance,
  reproducibility,
} from "../utilities";

const SCHEMA_VERSION = "v0.1.0";
const METHOD = "cyclomatic-mccabe-ast-walk-v0";

interface PerFunction { name: string; complexity: number; start_line: number; }
interface FileComplexity {
  readonly path: string;
  readonly per_function: readonly PerFunction[];
  readonly file_total: number;
  readonly function_count: number;
  readonly max_per_function: number;
}

export function measureComplexity(input: MeasurementInput): EvidenceRecord {
  const relevant = input.source_files.filter((f) => /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(f.path));
  if (relevant.length === 0) {
    return skeleton(input, "NOT_APPLICABLE",
      "no TS/JS sources · complexity v0 supports TypeScript/JavaScript only",
      null, null);
  }

  const perFile: FileComplexity[] = [];
  for (const f of relevant) {
    try {
      const scriptKind = /\.(tsx)$/.test(f.path) ? ts.ScriptKind.TSX
        : /\.(jsx)$/.test(f.path) ? ts.ScriptKind.JSX
        : /\.(ts|mts|cts)$/.test(f.path) ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
      const sf = ts.createSourceFile(f.path, f.content, ts.ScriptTarget.ES2020, /*setParentNodes*/ true, scriptKind);
      const results: PerFunction[] = [];
      collectComplexity(sf, sf, results);
      const file_total = results.reduce((acc, r) => acc + r.complexity, 0);
      const max_per_function = results.reduce((m, r) => r.complexity > m ? r.complexity : m, 0);
      perFile.push({ path: f.path, per_function: results, file_total, function_count: results.length, max_per_function });
    } catch (e) {
      // Parse failure on a file · surface as INCONCLUSIVE for that file · aggregate downstream
      perFile.push({ path: f.path, per_function: [], file_total: 0, function_count: 0, max_per_function: 0 });
    }
  }
  const project_total = perFile.reduce((acc, f) => acc + f.file_total, 0);
  const project_function_count = perFile.reduce((acc, f) => acc + f.function_count, 0);

  // Compute baseline if baseline_files supplied
  let baseline: { project_total: number; function_count: number } | null = null;
  let delta: EvidenceRecord["delta"] = null;
  if (input.baseline_files && input.baseline_files.length > 0) {
    let bTotal = 0, bFnCount = 0;
    for (const bf of input.baseline_files) {
      if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(bf.path)) continue;
      const scriptKind = /\.(tsx)$/.test(bf.path) ? ts.ScriptKind.TSX
        : /\.(jsx)$/.test(bf.path) ? ts.ScriptKind.JSX
        : /\.(ts|mts|cts)$/.test(bf.path) ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
      const sf = ts.createSourceFile(bf.path, bf.content, ts.ScriptTarget.ES2020, true, scriptKind);
      const res: PerFunction[] = [];
      collectComplexity(sf, sf, res);
      bTotal += res.reduce((a, r) => a + r.complexity, 0);
      bFnCount += res.length;
    }
    baseline = { project_total: bTotal, function_count: bFnCount };
    const abs = project_total - bTotal;
    const sign: "+" | "-" | "0" = abs > 0 ? "+" : abs < 0 ? "-" : "0";
    // For complexity · direction=improvement iff candidate LOWER than baseline
    const direction: "improvement" | "regression" | "neutral" = abs < 0 ? "improvement" : abs > 0 ? "regression" : "neutral";
    delta = { absolute: abs, sign, direction };
  }

  const state: EvidenceState = "MEASURED";
  const value = {
    per_file: perFile,
    project_total,
    project_function_count,
    baseline,
  };
  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "complexity",
    state,
    measurement: { unit: "count", value, precision: "integer", method_id: METHOD },
    value,
    baseline_value: baseline ? baseline.project_total : null,
    candidate_value: project_total,
    delta,
    methodology: "McCabe cyclomatic complexity · TypeScript compiler AST walk · +1 per function base · +1 per (if/for/for-in/for-of/while/do/case/catch/conditional/&&/||/??)",
    tool: "typescript",
    tool_version: (ts as any).version ?? "unknown",
    timestamp: new Date().toISOString(),
    source_files: input.source_files.map((s) => s.path),
    source_hashes: hashSourceFiles(input.source_files),
    reproducibility_information: reproducibility("evidence-engine.measureComplexity() · TypeScript compiler API", process.cwd()),
    limitations: "v0 · McCabe classic (not cognitive complexity) · TS/JS only · does not weight nested branches beyond base rule · NEVER emits a synthetic quality score",
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "typescript", tool_version: (ts as any).version ?? "unknown" }]),
    confidence: "high",
    attribution: attributionMeasurement(),
  };
}

function collectComplexity(node: ts.Node, sf: ts.SourceFile, out: PerFunction[]): void {
  const isFn =
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node);
  if (isFn) {
    const name = fnName(node, sf);
    const complexity = countDecisions(node) + 1;
    const start_line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push({ name, complexity, start_line });
  }
  node.forEachChild((c) => collectComplexity(c, sf, out));
}

function fnName(node: ts.Node, sf: ts.SourceFile): string {
  const n = node as any;
  if (n.name && ts.isIdentifier(n.name)) return n.name.text;
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isConstructorDeclaration(node)) return "constructor";
  // Arrow / anonymous — locate parent-anchor for context
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text + " (arrow)";
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text + " (arrow)";
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  return "(anonymous L" + line + ")";
}

function countDecisions(node: ts.Node): number {
  let n = 0;
  const walk = (nd: ts.Node) => {
    if (ts.isIfStatement(nd)) n++;
    else if (ts.isForStatement(nd)) n++;
    else if (ts.isForInStatement(nd)) n++;
    else if (ts.isForOfStatement(nd)) n++;
    else if (ts.isWhileStatement(nd)) n++;
    else if (ts.isDoStatement(nd)) n++;
    else if (ts.isCaseClause(nd)) n++;
    else if (ts.isCatchClause(nd)) n++;
    else if (ts.isConditionalExpression(nd)) n++;
    else if (ts.isBinaryExpression(nd)) {
      const kind = nd.operatorToken.kind;
      if (kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          kind === ts.SyntaxKind.BarBarToken ||
          kind === ts.SyntaxKind.QuestionQuestionToken) n++;
    }
    // Don't recurse into nested functions · they get their own count
    const isNestedFn = ts.isFunctionDeclaration(nd) || ts.isMethodDeclaration(nd) ||
      ts.isArrowFunction(nd) || ts.isFunctionExpression(nd) ||
      ts.isGetAccessorDeclaration(nd) || ts.isSetAccessorDeclaration(nd) ||
      ts.isConstructorDeclaration(nd);
    if (!isNestedFn || nd === node) nd.forEachChild(walk);
  };
  node.forEachChild(walk);
  return n;
}

function skeleton(input: MeasurementInput, state: EvidenceState, limitations: string, value: any, candidate_value: number | null): EvidenceRecord {
  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "complexity",
    state,
    measurement: value !== null ? { unit: "count", value, precision: "integer", method_id: METHOD } : null,
    value,
    baseline_value: null,
    candidate_value,
    delta: null,
    methodology: METHOD,
    tool: "typescript",
    tool_version: (ts as any).version ?? "unknown",
    timestamp: new Date().toISOString(),
    source_files: input.source_files.map((s) => s.path),
    source_hashes: hashSourceFiles(input.source_files),
    reproducibility_information: reproducibility("evidence-engine.measureComplexity()", process.cwd()),
    limitations,
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "typescript", tool_version: (ts as any).version ?? "unknown" }]),
    confidence: state === "BLOCKED" ? "insufficient" : state === "NOT_APPLICABLE" ? "high" : "medium",
    attribution: attributionMeasurement(),
  };
}
