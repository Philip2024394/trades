// §36-D-A · ROUTE-R1A · 2026-09-14 · repo-scan
//
// Read-only structural repo-scan primitive. Deterministic Repository Map.
// Never emits file content · only paths + sha256 + symbols + imports.
//
// Boundary (verbatim · unamendable):
//   "Route R1a enables NEX1 to look at NEX safely; it does not permit NEX1
//    to change NEX, invoke primitives, or expand its authoring vocabulary."
//
// See docs/NEX1/SECTION_36_D_A_ROUTE_R1A_REPO_SCAN_AMENDMENT.md.

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import {
  APPROVED_EXTENSIONS,
  APPROVED_READ_ROOTS,
  PROHIBITED_FILENAME_SUBSTRINGS,
  REPO_SCAN_MAX_FILES_LIMIT,
  REPO_SCAN_MAX_OUTPUT_BYTES,
  type RepoFileMetadata,
  type RepoImportEntry,
  type RepoScanFailure,
  type RepoScanRequest,
  type RepoScanResult,
  type RepoScanSuccess,
  type RepoSymbolEntry,
  type RepositoryMap,
} from "./repo-scan-types";

// ── Helpers ────────────────────────────────────────────────────────────

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isValidIdentifier(s: string): boolean {
  return typeof s === "string" && s.length > 0 && s.length <= 128 && IDENTIFIER_RE.test(s);
}

function fail(code: RepoScanFailure["refusal_code"], reason: string, offendingPath?: string): RepoScanFailure {
  return offendingPath !== undefined
    ? { ok: false, refusal_code: code, reason, offending_path: offendingPath }
    : { ok: false, refusal_code: code, reason };
}

function normaliseSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Refuse any path that contains a null byte, backslash (post-normalise
 *  would need double check), traversal segment, drive prefix, or protocol
 *  scheme. The primitive works on workspace-relative paths that use "/".
 *  We reject BEFORE normalisation so backslash-containing input is refused. */
function pathViolates(p: string): boolean {
  if (typeof p !== "string" || p.length === 0) return true;
  if (p.includes("\0")) return true;
  if (p.includes("\\")) return true;                 // require forward slash
  if (p.includes("..")) return true;                  // no traversal
  if (p.startsWith("/")) return true;                 // no absolute POSIX
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;         // no Windows drive
  if (/^[a-z]+:/.test(p)) return true;                // no protocol scheme
  return false;
}

function matchesProhibitedFilename(p: string): boolean {
  const lower = p.toLowerCase();
  for (const bad of PROHIBITED_FILENAME_SUBSTRINGS) {
    if (lower.includes(bad)) return true;
  }
  return false;
}

// ── Regex-based symbol / import extraction ─────────────────────────────
//
// Deliberately narrow (§36-D-A · MVP): regex-only · single-line matches.
// Multi-line declarations · destructured imports with defaults · dynamic
// import() · are refused / not extracted. This is a locked trade-off for
// determinism. A future wave may upgrade to TypeScript compiler API.

const SYMBOL_PATTERNS: readonly {
  readonly re: RegExp;
  readonly kind: RepoSymbolEntry["kind"];
}[] = [
  { re: /^(export\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,     kind: "function" },
  { re: /^(export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/,        kind: "class" },
  { re: /^(export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/,    kind: "interface" },
  { re: /^(export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/,     kind: "type_alias" },
  { re: /^(export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)/,        kind: "const" },
  { re: /^(export\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)/,         kind: "enum" },
  { re: /^(export\s+)?let\s+([A-Za-z_$][A-Za-z0-9_$]*)/,          kind: "variable" },
  { re: /^(export\s+)?var\s+([A-Za-z_$][A-Za-z0-9_$]*)/,          kind: "variable" },
];

// Import statement patterns · single-line only
const IMPORT_TYPE_RE = /^import\s+type\s+\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["']/;
const IMPORT_RUNTIME_RE = /^import\s+\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["']/;

function extractSymbols(fileRel: string, content: string): { entries: RepoSymbolEntry[]; error?: RepoScanFailure } {
  const entries: RepoSymbolEntry[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of SYMBOL_PATTERNS) {
      const m = line.match(pat.re);
      if (m) {
        const exported = Boolean(m[1]);
        const name = m[2];
        if (!isValidIdentifier(name)) {
          return { entries, error: fail("REPO_SCAN_INVALID_IDENTIFIER", `extracted name '${name}' invalid`, fileRel) };
        }
        entries.push({ file: fileRel, name, kind: pat.kind, exported, line: i + 1 });
        break;  // one symbol per line max
      }
    }
  }
  return { entries };
}

function extractImports(fileRel: string, content: string): { entries: RepoImportEntry[]; error?: RepoScanFailure } {
  const entries: RepoImportEntry[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    // Type-only import checked first (more specific)
    const t = line.match(IMPORT_TYPE_RE);
    if (t) {
      const symsRaw = t[1];
      const specifier = t[2];
      const syms = symsRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      for (const s of syms) {
        if (!isValidIdentifier(s)) {
          return { entries, error: fail("REPO_SCAN_INVALID_IDENTIFIER", `imported symbol '${s}' invalid`, fileRel) };
        }
      }
      entries.push({ from_file: fileRel, symbols: syms, from_specifier: specifier, is_type_only: true });
      continue;
    }
    const r = line.match(IMPORT_RUNTIME_RE);
    if (r) {
      // Skip if this is actually an `import type { ... }` line the earlier regex missed (shouldn't happen)
      if (line.match(/^import\s+type\s/)) continue;
      const symsRaw = r[1];
      const specifier = r[2];
      const syms = symsRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      for (const s of syms) {
        if (!isValidIdentifier(s)) {
          return { entries, error: fail("REPO_SCAN_INVALID_IDENTIFIER", `imported symbol '${s}' invalid`, fileRel) };
        }
      }
      entries.push({ from_file: fileRel, symbols: syms, from_specifier: specifier, is_type_only: false });
    }
  }
  return { entries };
}

// ── File-tree walker (bounded · workspace-relative) ────────────────────

function walkDirectory(
  repoRoot: string,
  rootRel: string,
  allowedExts: readonly string[],
  maxFiles: number,
  accum: string[],
): RepoScanFailure | null {
  const absRoot = path.join(repoRoot, rootRel);
  let entries: fs.Dirent[];
  try {
    if (!fs.existsSync(absRoot)) return null;  // silently skip · not an error
    const stat = fs.statSync(absRoot);
    if (!stat.isDirectory()) {
      // rootRel may point to a single file — accept if extension approved
      const ext = path.extname(rootRel);
      if (!allowedExts.includes(ext)) return null;
      if (matchesProhibitedFilename(rootRel)) return null;
      if (accum.length >= maxFiles) {
        return fail("REPO_SCAN_TOO_MANY_FILES", `scan exceeded max_files=${maxFiles}`);
      }
      accum.push(rootRel);
      return null;
    }
    entries = fs.readdirSync(absRoot, { withFileTypes: true });
  } catch {
    return null;  // permission errors etc. · silently skip
  }
  // Deterministic ordering: sort by name
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const childRel = normaliseSlashes(path.join(rootRel, entry.name));
    if (matchesProhibitedFilename(childRel)) continue;   // skip prohibited names
    if (entry.isDirectory()) {
      const err = walkDirectory(repoRoot, childRel, allowedExts, maxFiles, accum);
      if (err) return err;
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!allowedExts.includes(ext)) continue;
      if (accum.length >= maxFiles) {
        return fail("REPO_SCAN_TOO_MANY_FILES", `scan exceeded max_files=${maxFiles}`);
      }
      accum.push(childRel);
    }
  }
  return null;
}

// ── Main entry point ───────────────────────────────────────────────────

/** Perform a bounded read-only structural scan of the NEX repository.
 *  Returns a deterministic RepositoryMap · never emits file content. */
export function repoScan(input: {
  readonly request: RepoScanRequest;
  readonly repo_root: string;   // absolute · caller supplies
}): RepoScanResult {
  const { request, repo_root } = input;

  // ── Request-shape validation ──────────────────────────────────────
  if (!request || typeof request !== "object") {
    return fail("REPO_SCAN_INVALID_REQUEST", "request must be an object");
  }
  if (!Array.isArray(request.read_roots)) {
    return fail("REPO_SCAN_INVALID_REQUEST", "read_roots must be array");
  }
  if (!Array.isArray(request.extensions)) {
    return fail("REPO_SCAN_INVALID_REQUEST", "extensions must be array");
  }
  if (request.read_roots.length === 0) {
    return fail("REPO_SCAN_EMPTY_REQUEST", "read_roots must be non-empty");
  }
  if (request.extensions.length === 0) {
    return fail("REPO_SCAN_EMPTY_REQUEST", "extensions must be non-empty");
  }
  if (typeof request.max_files !== "number" || !Number.isInteger(request.max_files) || request.max_files < 1 || request.max_files > REPO_SCAN_MAX_FILES_LIMIT) {
    return fail("REPO_SCAN_INVALID_MAX_FILES", `max_files must be integer in [1, ${REPO_SCAN_MAX_FILES_LIMIT}]`);
  }
  if (typeof request.include_symbols !== "boolean" || typeof request.include_imports !== "boolean") {
    return fail("REPO_SCAN_INVALID_REQUEST", "include_symbols and include_imports must be booleans");
  }

  // ── Root approval ─────────────────────────────────────────────────
  for (const rootRaw of request.read_roots) {
    if (typeof rootRaw !== "string") return fail("REPO_SCAN_INVALID_REQUEST", "read_roots entry must be string");
    if (pathViolates(rootRaw)) return fail("REPO_SCAN_INVALID_PATH", `invalid read_root: ${rootRaw}`, rootRaw);
    if (matchesProhibitedFilename(rootRaw)) return fail("REPO_SCAN_PROHIBITED_FILE_PATTERN", `prohibited pattern: ${rootRaw}`, rootRaw);
    const normalised = normaliseSlashes(rootRaw);
    // Root must equal or start with an approved prefix
    let approved = false;
    for (const okRoot of APPROVED_READ_ROOTS) {
      if (normalised === okRoot || normalised.startsWith(okRoot)) {
        approved = true;
        break;
      }
    }
    if (!approved) return fail("REPO_SCAN_ROOT_NOT_APPROVED", `not approved: ${normalised}`, normalised);
  }

  // ── Extension approval ────────────────────────────────────────────
  for (const ext of request.extensions) {
    if (typeof ext !== "string") return fail("REPO_SCAN_INVALID_REQUEST", "extensions entry must be string");
    if (!APPROVED_EXTENSIONS.includes(ext)) {
      return fail("REPO_SCAN_EXTENSION_NOT_APPROVED", `extension not approved: ${ext}`);
    }
  }

  // ── Walk each root · collect file paths ──────────────────────────
  const collected: string[] = [];
  for (const rootRaw of request.read_roots) {
    const rootRel = normaliseSlashes(rootRaw);
    const err = walkDirectory(repo_root, rootRel, request.extensions, request.max_files, collected);
    if (err) return err;
  }

  // Deterministic ordering
  collected.sort();

  // ── Deduplicate (in case rootRoot overlap causes double-visit) ────
  const seen = new Set<string>();
  const uniqueFiles: string[] = [];
  for (const c of collected) {
    if (!seen.has(c)) {
      seen.add(c);
      uniqueFiles.push(c);
    }
  }

  if (uniqueFiles.length > request.max_files) {
    return fail("REPO_SCAN_TOO_MANY_FILES", `scan collected ${uniqueFiles.length} > max_files=${request.max_files}`);
  }

  // ── Read each file · extract metadata / symbols / imports ────────
  const fileMetadata: RepoFileMetadata[] = [];
  const symbols: RepoSymbolEntry[] = [];
  const imports: RepoImportEntry[] = [];
  for (const rel of uniqueFiles) {
    // Re-check prohibited pattern (defence in depth)
    if (matchesProhibitedFilename(rel)) {
      return fail("REPO_SCAN_PROHIBITED_FILE_PATTERN", `prohibited pattern: ${rel}`, rel);
    }
    const abs = path.join(repo_root, rel);
    let bytes: Buffer;
    try {
      bytes = fs.readFileSync(abs);
    } catch {
      continue;  // skip unreadable
    }
    const sha = createHash("sha256").update(bytes).digest("hex");
    fileMetadata.push({
      path: rel,
      extension: path.extname(rel),
      bytes: bytes.byteLength,
      sha256_hex: sha,
    });
    if (request.include_symbols || request.include_imports) {
      const content = bytes.toString("utf8");
      if (request.include_symbols) {
        const { entries, error } = extractSymbols(rel, content);
        if (error) return error;
        symbols.push(...entries);
      }
      if (request.include_imports) {
        const { entries, error } = extractImports(rel, content);
        if (error) return error;
        imports.push(...entries);
      }
    }
  }

  // ── Deterministic emission ordering ──────────────────────────────
  // fileMetadata is already sorted via uniqueFiles order.
  // symbols: file-order then line-ascending. Since we walked files in order,
  // symbols within a file are already line-ascending. Confirm by stable sort.
  symbols.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  // imports: file-order · declaration-order preserved from insertion.
  imports.sort((a, b) => (a.from_file < b.from_file ? -1 : a.from_file > b.from_file ? 1 : 0));

  // ── Build map (without scan_sha256 first) ────────────────────────
  const mapWithoutSha = {
    root_paths: request.read_roots.map(normaliseSlashes).sort(),
    file_count: fileMetadata.length,
    files: fileMetadata,
    symbols,
    imports,
  };
  const serialisedForHash = JSON.stringify(mapWithoutSha);
  const scanSha = createHash("sha256").update(serialisedForHash, "utf8").digest("hex");
  const finalMap: RepositoryMap = { ...mapWithoutSha, scan_sha256: scanSha };
  const serialisedFinal = JSON.stringify(finalMap);
  if (serialisedFinal.length > REPO_SCAN_MAX_OUTPUT_BYTES) {
    return fail("REPO_SCAN_OUTPUT_TOO_LARGE", `serialised map ${serialisedFinal.length} bytes > ${REPO_SCAN_MAX_OUTPUT_BYTES}`);
  }

  // ── Sentinel: verify no file content leaked into the emitted map ─
  // Defence in depth: file content is never inserted into map fields, but
  // we explicitly check that no field on the RepositoryMap besides
  // scan_sha256 contains multiline strings that look like source code.
  // This is a low-cost paranoid check.
  const suspicious = /\n.*\n/.test(finalMap.files.map((f) => f.path).join(""))
                     || finalMap.files.some((f) => f.path.includes("\n"))
                     || finalMap.symbols.some((s) => s.name.includes("\n"))
                     || finalMap.imports.some((i) => i.from_specifier.includes("\n"));
  if (suspicious) {
    return fail("REPO_SCAN_CONTENT_LEAK", "sentinel: newline detected in a metadata field · content leak suspected");
  }

  const result: RepoScanSuccess = { ok: true, map: finalMap };
  return result;
}
