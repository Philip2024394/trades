// src/lib/nex-debugger/ast-diff.ts
//
// NEX Debugger · AST-diff between baseline and candidate source snapshots.
// TypeScript compiler API only · no LLM · deterministic.

import * as ts from "typescript";
import { createHash, randomBytes } from "node:crypto";
import type { ASTDiff, ASTDiffChurnedNode, SourceSnapshot } from "./types";

function sha256Prefix(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

function makeSourceFile(path: string, content: string): ts.SourceFile {
  const scriptKind = /\.(tsx)$/.test(path) ? ts.ScriptKind.TSX
    : /\.(jsx)$/.test(path) ? ts.ScriptKind.JSX
    : /\.(ts|mts|cts)$/.test(path) ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;
  return ts.createSourceFile(path, content, ts.ScriptTarget.ES2020, true, scriptKind);
}

interface FlattenedNode {
  readonly key: string;                     // deterministic path signature
  readonly kind: string;
  readonly line_start: number;
  readonly line_end: number;
  readonly text_hash: string;
}

function flattenAST(sf: ts.SourceFile): FlattenedNode[] {
  const out: FlattenedNode[] = [];
  const walk = (node: ts.Node, keyPath: string) => {
    if (!/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(sf.fileName)) return;
    const isInteresting = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) || ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) || ts.isVariableDeclaration(node) ||
      ts.isEnumDeclaration(node) || ts.isImportDeclaration(node);
    if (isInteresting) {
      const name = (node as any).name && ts.isIdentifier((node as any).name) ? (node as any).name.text
        : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) ? node.name.text
        : "(anonymous)";
      const line_start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const line_end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      const text = node.getText(sf);
      out.push({
        key: keyPath + "/" + ts.SyntaxKind[node.kind] + ":" + name,
        kind: ts.SyntaxKind[node.kind],
        line_start,
        line_end,
        text_hash: sha256Prefix(text),
      });
    }
    node.forEachChild((c) => walk(c, keyPath + "/" + ts.SyntaxKind[node.kind]));
  };
  walk(sf, "");
  return out;
}

export function astDiff(baseline: readonly SourceSnapshot[], candidate: readonly SourceSnapshot[]): ASTDiff {
  const baselinePaths = new Set(baseline.map((s) => s.path));
  const candidatePaths = new Set(candidate.map((s) => s.path));
  const allPaths = new Set([...baselinePaths, ...candidatePaths]);

  const baselineByPath = new Map(baseline.map((s) => [s.path, s]));
  const candidateByPath = new Map(candidate.map((s) => [s.path, s]));

  const churned: ASTDiffChurnedNode[] = [];

  for (const path of allPaths) {
    const b = baselineByPath.get(path);
    const c = candidateByPath.get(path);
    if (b && !c) {
      const sf = makeSourceFile(path, b.content);
      for (const n of flattenAST(sf)) churned.push({ path, syntax_kind: n.kind, line_start: n.line_start, line_end: n.line_end, churn_class: "removed" });
      continue;
    }
    if (!b && c) {
      const sf = makeSourceFile(path, c.content);
      for (const n of flattenAST(sf)) churned.push({ path, syntax_kind: n.kind, line_start: n.line_start, line_end: n.line_end, churn_class: "added" });
      continue;
    }
    if (b && c && b.content === c.content) continue;
    if (b && c) {
      const baseNodes = flattenAST(makeSourceFile(path, b.content));
      const candNodes = flattenAST(makeSourceFile(path, c.content));
      const baseByKey = new Map(baseNodes.map((n) => [n.key, n]));
      const candByKey = new Map(candNodes.map((n) => [n.key, n]));
      const allKeys = new Set([...baseByKey.keys(), ...candByKey.keys()]);
      for (const k of allKeys) {
        const bn = baseByKey.get(k);
        const cn = candByKey.get(k);
        if (bn && !cn) churned.push({ path, syntax_kind: bn.kind, line_start: bn.line_start, line_end: bn.line_end, churn_class: "removed" });
        else if (!bn && cn) churned.push({ path, syntax_kind: cn.kind, line_start: cn.line_start, line_end: cn.line_end, churn_class: "added" });
        else if (bn && cn && bn.text_hash !== cn.text_hash) {
          churned.push({ path, syntax_kind: cn.kind, line_start: cn.line_start, line_end: cn.line_end, churn_class: "modified" });
        }
      }
    }
  }

  // Deterministic sort
  churned.sort((a, b) => a.path.localeCompare(b.path) || a.line_start - b.line_start || a.churn_class.localeCompare(b.churn_class));

  const baselineHash = sha256Prefix(baseline.map((s) => s.path + ":" + sha256Prefix(s.content)).sort().join("|"));
  const candidateHash = sha256Prefix(candidate.map((s) => s.path + ":" + sha256Prefix(s.content)).sort().join("|"));

  return {
    diff_id: "ASTDIFF-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"),
    baseline_source_hash: baselineHash,
    candidate_source_hash: candidateHash,
    churned_nodes: churned,
    evidence_id: "ASTDIFF-" + sha256Prefix(baselineHash + ":" + candidateHash),
  };
}
