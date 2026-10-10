// src/lib/nex/continuous-loop/runtime-purity-contract.ts
//
// UWI · Wave 7 · M30 · Runtime-loop purity contract
// Founder-authorised programme.
//
// Automated CI-style check that no runtime path reaches Claude /
// Firecrawl / external LLM. Scans TypeScript source for `import`
// statements referencing any BLOCKED_RUNTIME_IMPORTS package and
// flags any file that (a) sits OUTSIDE the RUNTIME_PURITY_ALLOWLISTED_PATHS
// AND (b) imports a blocked module.
//
// Deterministic · pure file-system scan · no network · no LLM.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  BLOCKED_RUNTIME_IMPORTS,
  RUNTIME_PURITY_ALLOWLISTED_PATHS,
  type PurityContractReport,
  type PurityViolation,
} from "./types";

/** Normalise a path to forward-slash form for allowlist matching. */
function toForward(p: string): string {
  return p.split(sep).join("/");
}

/** Return true if `file` is under one of the allowlisted prefixes. */
function isAllowlisted(file_forward: string): boolean {
  return RUNTIME_PURITY_ALLOWLISTED_PATHS.some(prefix => {
    const p = prefix.replace(/\\/g, "/");
    return file_forward.startsWith(p);
  });
}

/** Extract every `import ... from "<pkg>"` module specifier from source text. */
function extractImportSpecifiers(source: string): Array<{ specifier: string; line: number }> {
  const out: Array<{ specifier: string; line: number }> = [];
  const lines = source.split(/\r?\n/);
  const patterns = [
    /import\s+[^"']*?from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,             // bare import (side-effect)
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,   // dynamic import
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,  // legacy require
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      p.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.exec(lines[i])) !== null) {
        out.push({ specifier: m[1], line: i + 1 });
      }
    }
  }
  return out;
}

/** True if `specifier` matches any BLOCKED_RUNTIME_IMPORTS entry (prefix match). */
function matchesBlocked(specifier: string): string | null {
  for (const blocked of BLOCKED_RUNTIME_IMPORTS) {
    if (specifier === blocked) return blocked;
    if (blocked.endsWith("/") && specifier.startsWith(blocked)) return blocked;
    if (!blocked.endsWith("/") && specifier.startsWith(blocked + "/")) return blocked;
  }
  return null;
}

/** Recursively enumerate .ts / .tsx / .mts / .cts files under `root`. */
async function walkTypeScriptFiles(root: string, out: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const p = join(root, e.name);
    if (e.isDirectory()) {
      await walkTypeScriptFiles(p, out);
    } else if (e.isFile() && /\.(?:m?ts|cts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

export interface PurityScanOptions {
  /** Repo root to scan; defaults to process.cwd(). */
  readonly repo_root?: string;
  /** Subdirectories under repo root to scan; defaults to ["src"]. */
  readonly scan_dirs?: ReadonlyArray<string>;
  /** Additional file-path suffixes to exclude (e.g. test files). */
  readonly exclude_suffixes?: ReadonlyArray<string>;
}

/** Run the purity contract against the source tree. Returns a
 *  deterministic report. Pure w.r.t. filesystem read. */
export async function runPurityContract(opts: PurityScanOptions = {}): Promise<PurityContractReport> {
  const repo_root = opts.repo_root ?? process.cwd();
  const scan_dirs = opts.scan_dirs ?? ["src"];
  const exclude_suffixes = opts.exclude_suffixes ?? [
    ".test.ts", ".test.tsx", ".test.mts",
    ".spec.ts", ".spec.tsx",
  ];

  const all_files: string[] = [];
  for (const d of scan_dirs) {
    await walkTypeScriptFiles(join(repo_root, d), all_files);
  }

  const violations: PurityViolation[] = [];
  let scanned = 0;

  for (const abs of all_files) {
    const rel = toForward(relative(repo_root, abs));
    if (exclude_suffixes.some(sfx => rel.endsWith(sfx))) continue;
    scanned += 1;
    if (isAllowlisted(rel)) continue;

    let text: string;
    try { text = await readFile(abs, "utf8"); } catch { continue; }
    const specs = extractImportSpecifiers(text);
    for (const s of specs) {
      const blocked = matchesBlocked(s.specifier);
      if (blocked) {
        violations.push({
          file: rel,
          line: s.line,
          imported: s.specifier,
          reason: `imports blocked substrate '${blocked}' from non-allowlisted file · runtime path must not reach external LLM/AI/Firecrawl`,
        });
      }
    }
  }

  return {
    checked_at_iso: new Date().toISOString(),
    files_scanned: scanned,
    violations,
    is_pure: violations.length === 0,
  };
}

/** Assert-style helper · throws if the purity contract fails. */
export async function assertRuntimePurity(opts?: PurityScanOptions): Promise<void> {
  const report = await runPurityContract(opts);
  if (!report.is_pure) {
    const summary = report.violations.slice(0, 10)
      .map(v => `  ${v.file}:${v.line} imports '${v.imported}'`)
      .join("\n");
    const more = report.violations.length > 10 ? `\n  ... and ${report.violations.length - 10} more` : "";
    throw new RuntimePurityViolationError(report.violations.length, summary + more);
  }
}

export class RuntimePurityViolationError extends Error {
  constructor(public readonly violation_count: number, public readonly summary: string) {
    super(`Runtime-loop purity contract failed · ${violation_count} violations detected:\n${summary}`);
    this.name = "RuntimePurityViolationError";
  }
}
