// src/lib/nex-agent/code-engine/capability-incremental-repo-index.ts
//
// NEX1 · Incremental Repository Index (§22-23 · speed as first-class)
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Maintain a cached, mtime/hash-invalidated model of the repository.
//   Avoid re-scanning unchanged files on every request.
//   Never allow stale cache to become false truth (§23).
//
// INVARIANTS
//   · Cache entry has file_path + mtime + size + hash + timestamp
//   · Stale entries are invalidated when mtime OR size changes
//   · Missing files are marked stale · not silently retained
//   · Zero LLM · deterministic

import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const INCREMENTAL_REPO_INDEX_VERSION = "incremental-repo-index.v1.2026-09-19";

const SKIPPED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vercel"]);
const INDEXABLE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"]);

export interface IndexedFile {
  readonly repo_relative_path: string;
  readonly mtime_ms: number;
  readonly size_bytes: number;
  readonly content_hash: string;
  readonly indexed_at_iso: string;
  readonly symbols: readonly string[];
  readonly imports_from: readonly string[];
  readonly exports: readonly string[];
}

export interface RepoIndex {
  readonly repo_root: string;
  readonly files_by_path: Record<string, IndexedFile>;
  readonly indexed_at_iso: string;
  readonly total_files_indexed: number;
  readonly cache_hit_ratio: number;
  readonly stats: {
    readonly full_rescans: number;
    readonly incremental_updates: number;
    readonly cache_hits: number;
    readonly files_invalidated: number;
  };
}

// ── Singleton index per repo_root ────────────────────────────────────────

const indexes = new Map<string, RepoIndex>();

// ── Symbol extraction (deterministic regex) ──────────────────────────────

const RE_EXPORT_FN = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
const RE_EXPORT_CONST = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
const RE_EXPORT_CLASS = /export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
const RE_EXPORT_TYPE = /export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/g;
const RE_IMPORT_FROM = /^\s*import\s+(?:[^"'\n]+?\s+from\s+)?["']([^"'\n]+)["']/gm;

function extractSymbols(content: string): {
  readonly symbols: string[];
  readonly imports_from: string[];
  readonly exports: string[];
} {
  const exports: string[] = [];
  const symbols: string[] = [];
  let m: RegExpExecArray | null;
  RE_EXPORT_FN.lastIndex = 0;
  while ((m = RE_EXPORT_FN.exec(content)) !== null) { exports.push(m[1]); symbols.push(m[1]); }
  RE_EXPORT_CONST.lastIndex = 0;
  while ((m = RE_EXPORT_CONST.exec(content)) !== null) { exports.push(m[1]); symbols.push(m[1]); }
  RE_EXPORT_CLASS.lastIndex = 0;
  while ((m = RE_EXPORT_CLASS.exec(content)) !== null) { exports.push(m[1]); symbols.push(m[1]); }
  RE_EXPORT_TYPE.lastIndex = 0;
  while ((m = RE_EXPORT_TYPE.exec(content)) !== null) { exports.push(m[1]); symbols.push(m[1]); }
  const imports_from: string[] = [];
  RE_IMPORT_FROM.lastIndex = 0;
  while ((m = RE_IMPORT_FROM.exec(content)) !== null) { imports_from.push(m[1]); }
  return {
    symbols: [...new Set(symbols)].sort(),
    imports_from: [...new Set(imports_from)].sort(),
    exports: [...new Set(exports)].sort(),
  };
}

// ── Index build/update ───────────────────────────────────────────────────

export interface BuildIndexInput {
  readonly repo_root: string;
  readonly allowed_root_prefixes?: readonly string[];
  readonly max_files?: number;
  readonly force_full_rescan?: boolean;
}

export function buildOrUpdateIndex(input: BuildIndexInput): RepoIndex {
  const repo_root = path.resolve(input.repo_root);
  const allowed = input.allowed_root_prefixes ?? ["src"];
  const max_files = input.max_files ?? 2000;

  const existing = indexes.get(repo_root);
  const stats = existing?.stats
    ? { ...existing.stats }
    : { full_rescans: 0, incremental_updates: 0, cache_hits: 0, files_invalidated: 0 };

  if (input.force_full_rescan || !existing) {
    stats.full_rescans += 1;
  } else {
    stats.incremental_updates += 1;
  }

  // Walk repo
  const discovered = new Set<string>();
  const files_by_path: Record<string, IndexedFile> = existing?.files_by_path ? { ...existing.files_by_path } : {};

  function walk(absDir: string): void {
    if (discovered.size >= max_files) return;
    let entries: string[];
    try { entries = readdirSync(absDir).sort(); } catch { return; }
    for (const entry of entries) {
      if (discovered.size >= max_files) return;
      if (SKIPPED_DIRS.has(entry)) continue;
      const abs = path.join(absDir, entry);
      let stat;
      try { stat = statSync(abs); } catch { continue; }
      if (stat.isDirectory()) {
        walk(abs);
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (!INDEXABLE_EXT.has(ext)) continue;
        const rel = path.relative(repo_root, abs).replace(/\\/g, "/");
        discovered.add(rel);
        const existingEntry = files_by_path[rel];
        const mtime_ms = Math.floor(stat.mtimeMs);
        const size_bytes = stat.size;
        // Cache hit: same mtime + size · reuse existing
        if (!input.force_full_rescan && existingEntry
          && existingEntry.mtime_ms === mtime_ms
          && existingEntry.size_bytes === size_bytes) {
          stats.cache_hits += 1;
          continue;
        }
        // Miss: read + reindex
        try {
          const content = readFileSync(abs, "utf8");
          const { symbols, imports_from, exports } = extractSymbols(content);
          files_by_path[rel] = {
            repo_relative_path: rel,
            mtime_ms,
            size_bytes,
            content_hash: createHash("sha256").update(content).digest("hex").slice(0, 16),
            indexed_at_iso: new Date().toISOString(),
            symbols,
            imports_from,
            exports,
          };
          if (existingEntry) stats.files_invalidated += 1;
        } catch {
          // Cannot read · leave stale entry marked but do not fabricate
        }
      }
    }
  }

  for (const prefix of allowed) {
    const abs = path.join(repo_root, prefix);
    if (existsSync(abs)) walk(abs);
  }

  // Remove entries whose files no longer exist (or are outside allowed roots)
  for (const p of Object.keys(files_by_path)) {
    if (!discovered.has(p)) {
      delete files_by_path[p];
      stats.files_invalidated += 1;
    }
  }

  const total = Object.keys(files_by_path).length;
  const totalOps = stats.cache_hits + stats.files_invalidated;
  const cache_hit_ratio = totalOps > 0 ? stats.cache_hits / totalOps : 0;

  const index: RepoIndex = {
    repo_root,
    files_by_path,
    indexed_at_iso: new Date().toISOString(),
    total_files_indexed: total,
    cache_hit_ratio,
    stats,
  };
  indexes.set(repo_root, index);
  return index;
}

/** Invalidate a single file so next update re-reads it. */
export function invalidateFile(repo_root: string, repo_relative_path: string): void {
  const existing = indexes.get(path.resolve(repo_root));
  if (!existing) return;
  const rel = repo_relative_path.replace(/\\/g, "/");
  if (existing.files_by_path[rel]) {
    const copy = { ...existing.files_by_path };
    delete copy[rel];
    indexes.set(existing.repo_root, {
      ...existing,
      files_by_path: copy,
      stats: { ...existing.stats, files_invalidated: existing.stats.files_invalidated + 1 },
    });
  }
}

export function getIndex(repo_root: string): RepoIndex | null {
  return indexes.get(path.resolve(repo_root)) ?? null;
}

export function resetIndex(repo_root: string): void {
  indexes.delete(path.resolve(repo_root));
}

export function _resetAllIndexesForTests(): void {
  indexes.clear();
}

// ── Lookups ──────────────────────────────────────────────────────────────

export function findFileBySymbol(repo_root: string, symbol: string): readonly string[] {
  const idx = getIndex(repo_root);
  if (!idx) return [];
  return Object.values(idx.files_by_path)
    .filter((f) => f.symbols.includes(symbol))
    .map((f) => f.repo_relative_path)
    .sort();
}

export function findFilesByImport(repo_root: string, import_path: string): readonly string[] {
  const idx = getIndex(repo_root);
  if (!idx) return [];
  return Object.values(idx.files_by_path)
    .filter((f) => f.imports_from.includes(import_path))
    .map((f) => f.repo_relative_path)
    .sort();
}
