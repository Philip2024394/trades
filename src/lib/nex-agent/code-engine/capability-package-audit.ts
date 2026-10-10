// src/lib/nex-agent/code-engine/capability-package-audit.ts
//
// NEX1 · Package-Audit capability (Ledger B, 2026-09-18)
//
// PURPOSE
//   Given a repository root, cross-reference every package.json in the tree
//   against every .ts/.tsx source file's imports. Emit two structural sets
//   per package:
//     · declared_but_never_imported   — dead dependency candidates
//     · imported_but_not_declared     — missing dependency risk
//
//   Zero-LLM. Deterministic. Bounded. Reads files only.
//
// USAGE
//   const result = auditWorkspacePackages({ repo_root });
//   for (const pkg of result.per_package) { ... }
//
// This capability was surfaced as needed during the external-repo task at
// docs/NEX1-EXTERNAL-REPO-TASK-2026-09-18.md · Section 4 · item 3.

import fs from "node:fs";
import path from "node:path";
import { registerAgent, recordHeartbeat } from "./capability-agent-registry";

registerAgent({
  id: "package_audit",
  name: "Package Audit · declared-vs-imported workspace cross-reference",
  cognitive_layer: "brain_recovery_specialist",
  description: "Reads every package.json in a repo, cross-references declared dependencies against actual .ts/.tsx imports, emits per-package declared_but_never_imported and imported_but_not_declared sets. Deterministic. Zero LLM.",
});

// ── Types ──────────────────────────────────────────────────────────────

export interface AuditWorkspacePackagesInput {
  readonly repo_root: string;
  /** Maximum bytes read per source file (default 512 KB). */
  readonly max_bytes_per_file?: number;
  /** Maximum source files scanned per package (default 5000). */
  readonly max_source_files_per_package?: number;
  /** Ignore imports whose top-level starts with these prefixes (default ["node:"]). */
  readonly ignore_import_prefixes?: readonly string[];
  /** Directory names skipped during traversal (default ["node_modules", ".git", "dist", "build", ".turbo", ".next"]). */
  readonly skip_dirs?: readonly string[];
}

export interface PackageAuditRecord {
  readonly package_dir: string;                  // absolute
  readonly package_dir_rel: string;              // repo-relative
  readonly package_name: string | null;          // from package.json.name
  readonly declared_top_level: readonly string[];// deduped, sorted
  readonly imported_top_level: readonly string[];// deduped, sorted
  readonly declared_but_never_imported: readonly string[];
  readonly imported_but_not_declared: readonly string[];
  readonly source_files_scanned: number;
  readonly imports_seen: number;
  readonly truncated_files: number;              // # files that hit max_bytes_per_file
  readonly notes: readonly string[];             // per-package advisories
}

export interface AuditWorkspacePackagesResult {
  readonly repo_root: string;
  readonly per_package: readonly PackageAuditRecord[];
  readonly total_packages: number;
  readonly total_source_files_scanned: number;
  readonly evidence_kind: "OBSERVED";
  readonly r11b_marker: "PACKAGE_AUDIT_STRUCTURAL_FACT";
}

// ── Public entry ──────────────────────────────────────────────────────

export function auditWorkspacePackages(input: AuditWorkspacePackagesInput): AuditWorkspacePackagesResult {
  const repoRoot = path.resolve(input.repo_root);
  const maxBytesPerFile = clamp(input.max_bytes_per_file ?? 512 * 1024, 1024, 4 * 1024 * 1024);
  const maxFilesPerPackage = clamp(input.max_source_files_per_package ?? 5000, 1, 50_000);
  const ignorePrefixes = input.ignore_import_prefixes ?? ["node:"];
  const skipDirs = new Set(input.skip_dirs ?? ["node_modules", ".git", "dist", "build", ".turbo", ".next", "coverage", ".venv", "__pycache__"]);

  // 1. Discover every package.json.
  const packageJsonPaths = walkForPackageJson(repoRoot, skipDirs);

  // 2. For each package.json, scan its "owned" source files (files under the
  //    package.json's directory but not under any nested package.json).
  const perPackage: PackageAuditRecord[] = [];
  const ownedRootByDir = new Map<string, string>(); // sourceFile → owning package dir
  // Sort by depth desc so nested packages register first and claim their files.
  const sortedPkgs = [...packageJsonPaths].sort((a, b) => b.split(/[\\\/]/).length - a.split(/[\\\/]/).length);
  const claimedDirs = new Set<string>();

  const packageDirs = sortedPkgs.map((p) => path.dirname(p));
  packageDirs.sort((a, b) => b.split(/[\\\/]/).length - a.split(/[\\\/]/).length);

  for (const pkgDir of packageDirs) {
    // A file "belongs" to a package if the closest ancestor package.json is this one.
    // We enforce that by walking pkgDir and skipping subdirs that are themselves package roots.
    const owned = walkOwnedSourceFiles(pkgDir, packageDirs, skipDirs, maxFilesPerPackage);
    for (const f of owned) ownedRootByDir.set(f, pkgDir);
  }

  let totalScanned = 0;
  for (const pkgDir of packageDirs.slice().reverse()) {
    const pkgJson = path.join(pkgDir, "package.json");
    const parsed = readPackageJson(pkgJson);
    const declared = collectDeclaredDeps(parsed);

    const owned = [...ownedRootByDir.entries()].filter(([, d]) => d === pkgDir).map(([f]) => f);
    let importsSeen = 0;
    let truncatedFiles = 0;
    const importedTopLevel = new Set<string>();

    for (const file of owned) {
      const { imports, truncated } = extractTopLevelImports(file, maxBytesPerFile);
      if (truncated) truncatedFiles++;
      importsSeen += imports.length;
      for (const imp of imports) {
        if (ignorePrefixes.some((p) => imp.startsWith(p))) continue;
        if (imp.startsWith(".") || imp.startsWith("/")) continue; // relative or absolute path — not a package
        importedTopLevel.add(topLevelName(imp));
      }
    }
    totalScanned += owned.length;

    const declaredSet = new Set(declared);
    const importedList = [...importedTopLevel].sort();
    const declaredList = [...declaredSet].sort();

    const declared_but_never_imported = declaredList.filter((d) => !importedTopLevel.has(d));
    const imported_but_not_declared = importedList.filter((i) => !declaredSet.has(i));

    const notes: string[] = [];
    if (owned.length === 0) notes.push("no source files owned by this package · declared-vs-imported comparison is trivial");
    if (declared.length === 0) notes.push("package.json declares no dependencies");
    if (declared_but_never_imported.length > 10) notes.push("high dead-dependency count (" + declared_but_never_imported.length + ") · consider a cleanup review");
    if (imported_but_not_declared.length > 0) notes.push("missing declarations · " + imported_but_not_declared.length + " packages imported but not in package.json");

    perPackage.push({
      package_dir: pkgDir,
      package_dir_rel: path.relative(repoRoot, pkgDir).replace(/\\/g, "/") || ".",
      package_name: parsed?.name ?? null,
      declared_top_level: declaredList,
      imported_top_level: importedList,
      declared_but_never_imported,
      imported_but_not_declared,
      source_files_scanned: owned.length,
      imports_seen: importsSeen,
      truncated_files: truncatedFiles,
      notes,
    });
  }

  const result: AuditWorkspacePackagesResult = {
    repo_root: repoRoot,
    per_package: perPackage.sort((a, b) => a.package_dir_rel.localeCompare(b.package_dir_rel)),
    total_packages: perPackage.length,
    total_source_files_scanned: totalScanned,
    evidence_kind: "OBSERVED",
    r11b_marker: "PACKAGE_AUDIT_STRUCTURAL_FACT",
  };
  recordHeartbeat({
    agent_id: "package_audit",
    event_type: "audit_workspace",
    event_data: { total_packages: perPackage.length, total_files: totalScanned },
  });
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────

function walkForPackageJson(root: string, skipDirs: Set<string>): readonly string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        walk(path.join(dir, e.name));
      } else if (e.isFile() && e.name === "package.json") {
        out.push(path.join(dir, e.name));
      }
    }
  }
  walk(root);
  return out;
}

function walkOwnedSourceFiles(pkgDir: string, allPackageDirs: readonly string[], skipDirs: Set<string>, maxFiles: number): readonly string[] {
  const nestedRoots = new Set(allPackageDirs.filter((d) => d !== pkgDir && d.startsWith(pkgDir + path.sep)));
  const out: string[] = [];
  function walk(dir: string) {
    if (out.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        if (nestedRoots.has(full)) continue; // nested package · not owned by pkgDir
        walk(full);
      } else if (e.isFile() && /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(e.name)) {
        // Skip declaration files · they aren't "code" for import purposes
        if (e.name.endsWith(".d.ts")) continue;
        out.push(full);
        if (out.length >= maxFiles) return;
      }
    }
  }
  walk(pkgDir);
  return out;
}

function readPackageJson(p: string): { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> } | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return null; }
}

function collectDeclaredDeps(pkg: ReturnType<typeof readPackageJson>): readonly string[] {
  if (!pkg) return [];
  const s = new Set<string>();
  for (const which of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const d = pkg[which];
    if (d) for (const k of Object.keys(d)) s.add(k);
  }
  return [...s].sort();
}

/**
 * Extract top-level module specifiers from `import ... from "X"` and
 * `require("X")` and dynamic `import("X")`. Regex-based (no TypeScript
 * dependency at this layer) so it stays cheap. Bounded by max_bytes.
 */
function extractTopLevelImports(file: string, maxBytes: number): { imports: readonly string[]; truncated: boolean } {
  let stat: fs.Stats;
  try { stat = fs.statSync(file); } catch { return { imports: [], truncated: false }; }
  const truncated = stat.size > maxBytes;
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(Math.min(maxBytes, stat.size));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const text = buf.toString("utf8");
  const specs = new Set<string>();
  // Strip line comments and block comments so we don't count imports inside comments
  const stripped = text
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  // `import ... from "X"` and `import "X"`
  const staticRe = /(?:\bimport\b(?:[\s\S]{0,200}?)from\s*|\bimport\s*|\bexport\s+[\s\S]{0,200}?\bfrom\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = staticRe.exec(stripped)) !== null) specs.add(m[1]);
  // `require("X")`
  const reqRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(stripped)) !== null) specs.add(m[1]);
  // dynamic `import("X")`
  const dynRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(stripped)) !== null) specs.add(m[1]);
  return { imports: [...specs], truncated };
}

function topLevelName(specifier: string): string {
  // "@scope/pkg/sub" → "@scope/pkg" ; "pkg/sub" → "pkg"
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const PACKAGE_AUDIT_VERSION = "package-audit.v1";
