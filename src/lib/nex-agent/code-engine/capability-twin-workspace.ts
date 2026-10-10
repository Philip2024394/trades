// src/lib/nex-agent/code-engine/capability-twin-workspace.ts
//
// NEX1 · Twin Isolated Workspace · Founder Mandate §20
// Ledger B additive · Zero LLM · Deterministic filesystem snapshot.
//
// FOUNDER PRINCIPLE (§20 verbatim)
//   "Twin must never directly modify NEX1's active workspace while
//    investigating. Only a verified repair candidate may proceed to
//    promotion."
//
// SEMANTICS
//   snapshot() creates a copy of the NEX1 workspace into an isolated dir.
//   Twin modifies the isolated copy. Nothing propagates back until
//   promote() is called explicitly with the twin_workspace_id.
//
//   Promotion is a controlled, file-by-file operation that:
//     · Verifies the twin_workspace still exists
//     · For each promoted file, copies from twin_workspace → nex1_workspace
//     · Records provenance (which files came from which twin session)
//
// INVARIANTS
//   · snapshot() copies files · never symlinks or shares state
//   · Twin cannot write to nex1_workspace_root via any workspace API
//   · promote() records real file-copy operations for audit
//   · Zero LLM · deterministic

import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const TWIN_WORKSPACE_VERSION = "twin-workspace.v1.2026-09-19";

// ── Options ──────────────────────────────────────────────────────────────

export interface TwinWorkspaceOptions {
  readonly project_id: string;
  readonly nex1_workspace_root: string;
  readonly twin_workspaces_root: string;
}

// ── Snapshot ─────────────────────────────────────────────────────────────

export interface TwinSnapshotResult {
  readonly twin_workspace_id: string;
  readonly twin_workspace_root: string;
  readonly source_root: string;
  readonly files_copied: number;
  readonly bytes_copied: number;
  readonly created_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

const SKIPPED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vercel"]);

export function snapshotWorkspace(opts: TwinWorkspaceOptions): TwinSnapshotResult {
  if (!existsSync(opts.nex1_workspace_root)) {
    throw new Error(`nex1_workspace_root_does_not_exist:${opts.nex1_workspace_root}`);
  }
  const twin_workspace_id = `twin_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const twin_workspace_root = path.join(opts.twin_workspaces_root, opts.project_id, twin_workspace_id);
  if (!existsSync(twin_workspace_root)) mkdirSync(twin_workspace_root, { recursive: true });

  let files_copied = 0;
  let bytes_copied = 0;

  function walkCopy(fromDir: string, toDir: string): void {
    if (!existsSync(toDir)) mkdirSync(toDir, { recursive: true });
    for (const entry of readdirSync(fromDir)) {
      if (SKIPPED_DIRS.has(entry)) continue;
      const fromPath = path.join(fromDir, entry);
      const toPath = path.join(toDir, entry);
      let s;
      try { s = statSync(fromPath); } catch { continue; }
      if (s.isDirectory()) {
        walkCopy(fromPath, toPath);
      } else if (s.isFile()) {
        copyFileSync(fromPath, toPath);
        files_copied += 1;
        bytes_copied += s.size;
      }
    }
  }
  walkCopy(opts.nex1_workspace_root, twin_workspace_root);

  // Manifest recording the snapshot
  const manifest = {
    twin_workspace_id,
    source_root: opts.nex1_workspace_root,
    files_copied,
    bytes_copied,
    created_at_iso: new Date().toISOString(),
    version: TWIN_WORKSPACE_VERSION,
  };
  writeFileSync(path.join(twin_workspace_root, ".nex1-twin-manifest.json"), JSON.stringify(manifest, null, 2));

  return {
    twin_workspace_id,
    twin_workspace_root,
    source_root: opts.nex1_workspace_root,
    files_copied,
    bytes_copied,
    created_at_iso: manifest.created_at_iso,
    zero_llm: true,
    ledger: "B",
    version: TWIN_WORKSPACE_VERSION,
  };
}

// ── Promote (verified repair candidates → NEX1 workspace) ────────────────

export interface PromoteInput {
  readonly twin_workspace_root: string;
  readonly nex1_workspace_root: string;
  readonly files_to_promote: readonly string[];  // relative paths
  readonly promoted_by_agent: string;
  readonly promotion_reason: string;
}

export interface PromoteResult {
  readonly ok: boolean;
  readonly files_promoted: readonly string[];
  readonly files_refused: readonly { readonly path: string; readonly reason: string }[];
  readonly promotion_manifest_path: string;
  readonly promoted_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function promoteFilesFromTwinWorkspace(input: PromoteInput): PromoteResult {
  const promoted: string[] = [];
  const refused: { path: string; reason: string }[] = [];

  if (!existsSync(input.twin_workspace_root)) {
    return {
      ok: false,
      files_promoted: [],
      files_refused: input.files_to_promote.map((p) => ({ path: p, reason: "twin_workspace_missing" })),
      promotion_manifest_path: "",
      promoted_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    };
  }
  if (!existsSync(input.nex1_workspace_root)) {
    return {
      ok: false,
      files_promoted: [],
      files_refused: input.files_to_promote.map((p) => ({ path: p, reason: "nex1_workspace_missing" })),
      promotion_manifest_path: "",
      promoted_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    };
  }

  for (const rel of input.files_to_promote) {
    const twinPath = path.join(input.twin_workspace_root, rel);
    const nex1Path = path.join(input.nex1_workspace_root, rel);
    if (!existsSync(twinPath)) {
      refused.push({ path: rel, reason: "not_in_twin_workspace" });
      continue;
    }
    try {
      const dir = path.dirname(nex1Path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      copyFileSync(twinPath, nex1Path);
      promoted.push(rel);
    } catch (err) {
      refused.push({ path: rel, reason: `copy_failed:${err instanceof Error ? err.message.slice(0, 100) : String(err)}` });
    }
  }

  const promoted_at_iso = new Date().toISOString();
  const manifest = {
    twin_workspace_root: input.twin_workspace_root,
    nex1_workspace_root: input.nex1_workspace_root,
    files_promoted: promoted,
    files_refused: refused,
    promoted_by_agent: input.promoted_by_agent,
    promotion_reason: input.promotion_reason,
    promoted_at_iso,
    manifest_hash: createHash("sha256").update(promoted.sort().join("|")).digest("hex").slice(0, 16),
  };
  const promotion_manifest_path = path.join(input.twin_workspace_root, `.nex1-promotion-${Date.now()}.json`);
  writeFileSync(promotion_manifest_path, JSON.stringify(manifest, null, 2));

  return {
    ok: refused.length === 0,
    files_promoted: promoted,
    files_refused: refused,
    promotion_manifest_path,
    promoted_at_iso,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Twin isolation invariant checker ─────────────────────────────────────
//
// A file in NEX1 workspace should not change during Twin investigation
// UNLESS explicitly promoted. This helper computes a content digest so tests
// or the runtime can verify no leak occurred.

export function digestFile(abs_path: string): { readonly digest: string | null; readonly size: number | null } {
  if (!existsSync(abs_path)) return { digest: null, size: null };
  try {
    const buf = readFileSync(abs_path);
    return { digest: createHash("sha256").update(buf).digest("hex").slice(0, 16), size: buf.length };
  } catch {
    return { digest: null, size: null };
  }
}

export function digestWorkspace(workspace_root: string): { readonly file_digests: Record<string, string>; readonly total_files: number } {
  const out: Record<string, string> = {};
  function walk(dir: string, base: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (SKIPPED_DIRS.has(entry)) continue;
      const full = path.join(dir, entry);
      let s;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) walk(full, path.join(base, entry));
      else if (s.isFile()) {
        const rel = path.join(base, entry).replace(/\\/g, "/");
        const { digest } = digestFile(full);
        if (digest) out[rel] = digest;
      }
    }
  }
  walk(workspace_root, "");
  return { file_digests: out, total_files: Object.keys(out).length };
}
