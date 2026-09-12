// src/lib/nex-project-architecture/import-scanner.ts
//
// NEX1 · Project Architecture · deterministic import extraction.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Regex-based v0 · every extraction is deterministic. Comments stripped
// with a simple lexer (block + line comment awareness).

export interface ExtractedImport {
  readonly specifier: string;
  readonly edge_type: "import" | "require" | "dynamic_import" | "reexport";
  readonly line: number;
}

/**
 * @summary Deterministic strip of // and /* ... *​/ comments to reduce false
 * positives on commented-out imports. Not a full JS lexer · v0 is regex-safe.
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  let inString: '"' | "'" | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (inLineComment) {
      if (c === "\n") { inLineComment = false; out += "\n"; }
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && c2 === "/") { inBlockComment = false; i += 2; continue; }
      if (c === "\n") out += "\n";
      i++;
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\" && c2) { out += c2; i += 2; continue; }
      if (c === inString) inString = null;
      i++;
      continue;
    }
    if (c === "/" && c2 === "/") { inLineComment = true; i += 2; continue; }
    if (c === "/" && c2 === "*") { inBlockComment = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") { inString = c as any; out += c; i++; continue; }
    out += c;
    i++;
  }
  return out;
}

const RE_IMPORT_FROM  = /^\s*(?:import\s+[\s\S]*?\bfrom\s+|export\s+[\s\S]*?\bfrom\s+)['"`]([^'"`]+)['"`]/gm;
const RE_IMPORT_SIDE  = /^\s*import\s+['"`]([^'"`]+)['"`]/gm;
const RE_REQUIRE      = /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const RE_DYNAMIC      = /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

/**
 * @summary Extract JavaScript/TypeScript imports deterministically. Returns
 * imports sorted by (line, specifier) for reproducibility.
 */
export function extractJsTsImports(source: string): readonly ExtractedImport[] {
  const stripped = stripComments(source);
  const out: ExtractedImport[] = [];
  const seen = new Set<string>();
  const add = (spec: string, edge_type: ExtractedImport["edge_type"], line: number) => {
    const key = edge_type + "|" + spec + "|" + line;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ specifier: spec, edge_type, line });
  };
  const collect = (re: RegExp, edge_type: ExtractedImport["edge_type"]) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      const spec = m[1];
      const upTo = stripped.slice(0, m.index);
      const line = (upTo.match(/\n/g)?.length ?? 0) + 1;
      add(spec, edge_type, line);
    }
  };
  collect(RE_IMPORT_FROM, "import");
  collect(RE_IMPORT_SIDE, "import");
  collect(RE_REQUIRE, "require");
  collect(RE_DYNAMIC, "dynamic_import");
  // Sort deterministically
  out.sort((a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier));
  return out;
}

const RE_PY_FROM   = /^\s*from\s+([a-zA-Z_][\w.]*)\s+import\s+/gm;
const RE_PY_IMPORT = /^\s*import\s+([a-zA-Z_][\w.]*)/gm;

export function extractPythonImports(source: string): readonly ExtractedImport[] {
  const out: ExtractedImport[] = [];
  const collect = (re: RegExp) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const spec = m[1];
      const upTo = source.slice(0, m.index);
      const line = (upTo.match(/\n/g)?.length ?? 0) + 1;
      out.push({ specifier: spec, edge_type: "import", line });
    }
  };
  collect(RE_PY_FROM);
  collect(RE_PY_IMPORT);
  out.sort((a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier));
  return out;
}
