// src/lib/nex/ecosystem/sandbox-extractor.ts
//
// UWI · Wave 8.B · Safe archive extraction into isolated scratch dir
// Founder-authorised programme (Rule 5o.F).
//
// **NEVER install-to-inspect.** This module extracts an archive (zip)
// into a fresh isolated directory (under OS tmpdir) that is:
//   - not `node_modules`
//   - not touched by any postinstall/prepare script
//   - read-only from NEX's perspective (never executed)
//
// Uses the existing `unzipper` npm library (already in package.json
// devDeps for other repo purposes · verified no AI/cloud deps · MIT).
//
// The extracted view is then passed to Wave 8.A repository-audit
// orchestrator, which reads it read-only for licence / supply-chain
// / runtime-purity / capability inspection.

import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, sep } from "node:path";
import type { SandboxedRepositoryView } from "./sandboxed-inspection";

// ─── Safety limits ──────────────────────────────────────────────────
export interface ExtractionLimits {
  /** Absolute maximum total extracted bytes (zip-bomb guard). */
  readonly max_total_extracted_bytes: number;
  /** Absolute maximum number of files (many-file-bomb guard). */
  readonly max_file_count: number;
  /** Per-file max size (individual-file-bomb guard). */
  readonly max_single_file_bytes: number;
}

export const DEFAULT_EXTRACTION_LIMITS: ExtractionLimits = {
  max_total_extracted_bytes: 200 * 1024 * 1024, // 200 MB
  max_file_count: 20_000,
  max_single_file_bytes: 50 * 1024 * 1024,       // 50 MB
};

export class ExtractionSafetyError extends Error {
  constructor(public readonly reason: string, public readonly detail: string) {
    super(`extraction safety guard triggered · ${reason} · ${detail}`);
    this.name = "ExtractionSafetyError";
  }
}

/** Path traversal guard: reject any archive entry whose destination
 *  path escapes the sandbox root (zip-slip). Returns the safe absolute
 *  path, or throws ExtractionSafetyError if unsafe. */
function assertSafePath(sandbox_root: string, entry_path: string): string {
  // Normalize forward-slash · reject leading absolute · reject leading `..`
  const normalised = entry_path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalised.startsWith("../") || normalised.includes("/../") || normalised.endsWith("/..")) {
    throw new ExtractionSafetyError("path_traversal", `entry '${entry_path}' contains '..' segments · zip-slip attempt`);
  }
  const target = resolve(sandbox_root, normalised);
  const rel = relative(sandbox_root, target);
  if (rel.startsWith("..") || resolve(target).startsWith(resolve(sandbox_root) + sep) === false) {
    throw new ExtractionSafetyError("path_escape", `entry '${entry_path}' resolves outside sandbox root`);
  }
  return target;
}

// ─── Public extraction API ──────────────────────────────────────────
export interface ExtractedArchiveResult {
  readonly view: SandboxedRepositoryView;
  readonly file_count: number;
  readonly total_bytes: number;
  readonly extraction_ms: number;
}

/** Extract a zip buffer (from HF spaces · GitHub repository archives ·
 *  npm packages · etc.) into a fresh isolated sandbox. Never executes
 *  any content. Returns a read-only SandboxedRepositoryView for use by
 *  the Wave 8.A orchestrator. Caller MUST call `cleanupSandbox(view)`
 *  when done to remove the scratch directory. */
export async function extractZipToSandbox(
  zip_bytes: Uint8Array,
  resource_id: string,
  limits: ExtractionLimits = DEFAULT_EXTRACTION_LIMITS,
): Promise<ExtractedArchiveResult> {
  const t0 = Date.now();
  const root = await mkdtemp(join(tmpdir(), "nex-eco-sandbox-"));

  // Lazy-import unzipper to avoid loading it in tests that don't need extraction.
  const unzipper: any = await import("unzipper").catch(() => null);
  if (!unzipper) {
    await rm(root, { recursive: true, force: true });
    throw new ExtractionSafetyError("dependency_missing", "unzipper npm package unavailable · required for zip extraction");
  }

  let file_count = 0;
  let total_bytes = 0;

  try {
    const directory = await unzipper.Open.buffer(Buffer.from(zip_bytes));
    for (const entry of directory.files) {
      if (entry.type !== "File") continue;
      file_count += 1;

      if (file_count > limits.max_file_count) {
        throw new ExtractionSafetyError("too_many_files", `${file_count} > ${limits.max_file_count}`);
      }

      const safe_abs = assertSafePath(root, entry.path);
      // Ensure parent dir exists
      await mkdir(dirname(safe_abs), { recursive: true });

      const buf = await entry.buffer();
      if (buf.length > limits.max_single_file_bytes) {
        throw new ExtractionSafetyError("file_too_large", `entry '${entry.path}' is ${buf.length} bytes · max ${limits.max_single_file_bytes}`);
      }
      total_bytes += buf.length;
      if (total_bytes > limits.max_total_extracted_bytes) {
        throw new ExtractionSafetyError("total_size_exceeded", `extracted ${total_bytes} > ${limits.max_total_extracted_bytes}`);
      }

      await writeFile(safe_abs, buf);
    }
  } catch (e) {
    // Best-effort cleanup on failure
    await rm(root, { recursive: true, force: true }).catch(() => {});
    throw e;
  }

  return {
    view: {
      root,
      resource_id,
      extracted_at_iso: new Date().toISOString(),
    },
    file_count,
    total_bytes,
    extraction_ms: Date.now() - t0,
  };
}

/** Clean up a sandboxed view · always call after audit is complete. */
export async function cleanupSandbox(view: SandboxedRepositoryView): Promise<void> {
  // Only clean up if the root is under the OS tmpdir · defensive check.
  const tmp = resolve(tmpdir());
  const target = resolve(view.root);
  if (!target.startsWith(tmp + sep) && target !== tmp) {
    throw new ExtractionSafetyError("cleanup_refused", `refusing to remove '${view.root}' — not under OS tmpdir`);
  }
  await rm(view.root, { recursive: true, force: true });
}
