// src/lib/nex/ecosystem/sandboxed-inspection.ts
//
// UWI · Wave 8.A · Sandboxed-inspection primitive
// Founder-authorised programme (Rule 5o.F).
//
// **NEVER install-to-inspect.** Rule 5o.F: "Do NOT install an
// interesting repository into the main NEX environment merely to
// investigate it. Use isolated research/build environments."
//
// This module provides:
//   - `SandboxedRepositoryView` — a read-only view of a repository's
//     files that were extracted (via Wave 8.B pipeline later) into a
//     scratch directory. Wave 8.A only defines the type + reader
//     primitive; the extraction pipeline itself is Wave 8.B scope.
//   - `readMetadataFile` · `readCodeSample` · `enumerateFiles` —
//     bounded, read-only inspection helpers that never execute code
//     from the repository.
//
// Deterministic · pure filesystem I/O · no execution of untrusted code.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, sep } from "node:path";

export interface SandboxedRepositoryView {
  /** Absolute path to the extracted-archive root (never node_modules). */
  readonly root: string;
  /** Ecosystem-scoped resource id (for provenance). */
  readonly resource_id: string;
  /** When the extraction happened. */
  readonly extracted_at_iso: string;
}

export interface InspectionLimits {
  readonly max_file_bytes: number;
  readonly max_total_files_enumerated: number;
  readonly excluded_paths: ReadonlyArray<string>;
}

export const DEFAULT_INSPECTION_LIMITS: InspectionLimits = {
  max_file_bytes: 1 * 1024 * 1024,   // 1 MB per file
  max_total_files_enumerated: 5000,
  excluded_paths: ["node_modules", ".git", "dist", "build", ".next", ".cache", "coverage"],
};

/** Read a specific file (bounded). Returns null if not present or too large. */
export async function readMetadataFile(
  view: SandboxedRepositoryView,
  relative_path: string,
  limits: InspectionLimits = DEFAULT_INSPECTION_LIMITS,
): Promise<string | null> {
  const abs = join(view.root, relative_path);
  try {
    const s = await stat(abs);
    if (!s.isFile()) return null;
    if (s.size > limits.max_file_bytes) return null;
    return await readFile(abs, "utf8");
  } catch {
    return null;
  }
}

/** Read + JSON.parse a metadata file (e.g. package.json). Returns null on any failure. */
export async function readJsonMetadata<T = unknown>(
  view: SandboxedRepositoryView,
  relative_path: string,
): Promise<T | null> {
  const text = await readMetadataFile(view, relative_path);
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

/** Enumerate files in the sandbox (bounded), excluding known noisy paths. */
export async function enumerateFiles(
  view: SandboxedRepositoryView,
  limits: InspectionLimits = DEFAULT_INSPECTION_LIMITS,
): Promise<ReadonlyArray<string>> {
  const out: string[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    if (out.length >= limits.max_total_files_enumerated) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (limits.excluded_paths.includes(e.name)) continue;
      if (e.name.startsWith(".")) continue;
      const abs = join(dir, e.name);
      const relpath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(abs, relpath);
        if (out.length >= limits.max_total_files_enumerated) return;
      } else if (e.isFile()) {
        out.push(relpath);
      }
    }
  }
  await walk(view.root, "");
  return out;
}

/** Read a bounded code sample by concatenating first-N-bytes of source files. */
export async function readCodeSample(
  view: SandboxedRepositoryView,
  file_paths: ReadonlyArray<string>,
  max_total_bytes: number = 256 * 1024,   // 256 KB
): Promise<string> {
  let total = 0;
  const chunks: string[] = [];
  for (const rel of file_paths) {
    if (total >= max_total_bytes) break;
    const text = await readMetadataFile(view, rel, { ...DEFAULT_INSPECTION_LIMITS, max_file_bytes: max_total_bytes - total });
    if (!text) continue;
    chunks.push(`// ─── ${rel} ─────────────────────────\n${text}\n`);
    total += text.length;
  }
  return chunks.join("\n");
}

/** Filter file list to code files by extension. Deterministic. */
export function filterCodeFiles(files: ReadonlyArray<string>): ReadonlyArray<string> {
  const CODE_EXT = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".rs", ".go", ".java", ".rb", ".php"];
  return files.filter(f => CODE_EXT.some(ext => f.endsWith(ext)));
}
