// WO-M-02 · deterministic dependency-graph detection.
//
// Founder-locked 2026-09-14. M-02's key measurement is:
//   "Did NEX1 itself identify the dependency chain?"
//
// This is the module that produces that measurement. Given a set of
// workspace-relative source files, deterministically:
//   · parse the top-level exports (function/const/let)
//   · parse the from-clause imports
//   · build an edges list: importer → exporter
//
// P-S: no LLM · no regex guessing beyond well-formed ESM shapes.
// If a file is malformed enough that we can't detect its exports,
// the entry appears with `exports: []` · we NEVER fabricate.

import { promises as fs } from "node:fs";
import path from "node:path";

export interface FileExports {
  readonly file: string;                     // workspace-relative
  readonly exports: readonly string[];        // named exports at module scope
  readonly has_default_export: boolean;
}

export interface FileImports {
  readonly file: string;                     // workspace-relative
  readonly imports: readonly {
    readonly from: string;                   // literal from-clause (relative path or bare specifier)
    readonly symbols: readonly string[];      // named import bindings
    readonly has_default: boolean;
  }[];
}

export interface DependencyEdge {
  readonly from_file: string;                // workspace-relative
  readonly to_file: string;                  // workspace-relative (resolved)
  readonly to_specifier: string;             // original literal
  readonly imported_symbols: readonly string[];
}

export interface DependencyGraph {
  readonly files: readonly FileExports[];
  readonly imports: readonly FileImports[];
  readonly edges: readonly DependencyEdge[];  // cross-file · workspace-relative only
  readonly cross_file_edge_count: number;
}

const NAMED_EXPORT_RE = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
const DEFAULT_EXPORT_RE = /^export\s+default\b/m;
const RE_EXPORT_NAMED_RE = /^export\s+\{\s*([^}]+)\s*\}\s*(?:from\s+["'][^"']+["'])?/gm;
const IMPORT_LINE_RE = /^import\s+([^;]+?)\s+from\s+["']([^"']+)["']/gm;

function stripComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

export function parseExports(source: string, file: string): FileExports {
  const clean = stripComments(source);
  const names: string[] = [];
  let m: RegExpExecArray | null;
  NAMED_EXPORT_RE.lastIndex = 0;
  while ((m = NAMED_EXPORT_RE.exec(clean)) !== null) {
    if (m[1]) names.push(m[1]);
  }
  RE_EXPORT_NAMED_RE.lastIndex = 0;
  while ((m = RE_EXPORT_NAMED_RE.exec(clean)) !== null) {
    for (const part of m[1].split(",")) {
      const asClause = part.trim().split(/\s+as\s+/);
      const exported = (asClause[1] ?? asClause[0]).trim();
      if (exported && /^[A-Za-z_][A-Za-z0-9_]*$/.test(exported)) names.push(exported);
    }
  }
  const has_default_export = DEFAULT_EXPORT_RE.test(clean);
  return { file, exports: Object.freeze([...new Set(names)]), has_default_export };
}

export function parseImports(source: string, file: string): FileImports {
  const clean = stripComments(source);
  const importsList: { from: string; symbols: string[]; has_default: boolean }[] = [];
  let m: RegExpExecArray | null;
  IMPORT_LINE_RE.lastIndex = 0;
  while ((m = IMPORT_LINE_RE.exec(clean)) !== null) {
    const clause = m[1].trim();
    const from = m[2];
    const symbols: string[] = [];
    let has_default = false;
    // clause may be:
    //   defaultName                                → default only
    //   { a, b as bAlias, c }                      → named only
    //   defaultName, { a, b }                      → default + named
    //   * as ns                                    → namespace (we record as ns-only · no symbols)
    const braceStart = clause.indexOf("{");
    if (braceStart >= 0) {
      // named-import block present
      const namedInside = clause.slice(braceStart + 1, clause.indexOf("}", braceStart)).trim();
      for (const part of namedInside.split(",")) {
        const raw = part.trim();
        if (!raw) continue;
        const asClause = raw.split(/\s+as\s+/);
        const imported = (asClause[1] ?? asClause[0]).trim();
        if (imported && /^[A-Za-z_][A-Za-z0-9_]*$/.test(imported)) symbols.push(imported);
      }
      // anything before the { is a default binding
      const beforeBrace = clause.slice(0, braceStart).replace(/,\s*$/, "").trim();
      if (beforeBrace.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(beforeBrace)) has_default = true;
    } else if (clause.startsWith("*")) {
      // namespace · no named symbols to track
    } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(clause)) {
      has_default = true;
    }
    importsList.push({ from, symbols, has_default });
  }
  return {
    file,
    imports: Object.freeze(importsList.map((i) => Object.freeze({ ...i, symbols: Object.freeze([...i.symbols]) }))),
  };
}

/** Resolve a workspace-relative import specifier against the importer's
 *  location, restricted to the workspace. Returns null for bare
 *  specifiers (external packages) or specifiers that would escape. */
function resolveWorkspaceRelative(importer_file: string, specifier: string, workspace_files: readonly string[]): string | null {
  if (!specifier.startsWith(".")) return null;   // bare/external package
  const importerDir = path.posix.dirname(importer_file.replace(/\\/g, "/"));
  const joined = path.posix.normalize(path.posix.join(importerDir, specifier));
  if (joined.startsWith("..")) return null;
  // Match with or without extension
  for (const candidate of workspace_files) {
    const norm = candidate.replace(/\\/g, "/");
    if (norm === joined) return norm;
    for (const ext of [".mjs", ".cjs", ".js", ".ts", ".tsx"]) {
      if (norm === joined + ext) return norm;
    }
  }
  return null;
}

export async function buildDependencyGraph(input: {
  readonly workspace_root: string;
  readonly file_paths: readonly string[];
}): Promise<DependencyGraph> {
  const exportRecords: FileExports[] = [];
  const importRecords: FileImports[] = [];
  const sources = new Map<string, string>();
  for (const rel of input.file_paths) {
    const abs = path.join(input.workspace_root, rel);
    let raw = "";
    try { raw = await fs.readFile(abs, "utf8"); } catch { /* file unreadable · empty exports/imports */ }
    sources.set(rel, raw);
    exportRecords.push(parseExports(raw, rel));
    importRecords.push(parseImports(raw, rel));
  }
  const edges: DependencyEdge[] = [];
  for (const rec of importRecords) {
    for (const imp of rec.imports) {
      const resolved = resolveWorkspaceRelative(rec.file, imp.from, input.file_paths);
      if (!resolved) continue;
      edges.push({
        from_file: rec.file,
        to_file: resolved,
        to_specifier: imp.from,
        imported_symbols: imp.symbols,
      });
    }
  }
  return {
    files: Object.freeze(exportRecords),
    imports: Object.freeze(importRecords),
    edges: Object.freeze(edges),
    cross_file_edge_count: edges.length,
  };
}
