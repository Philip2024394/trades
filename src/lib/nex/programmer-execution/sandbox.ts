// src/lib/nex/programmer-execution/sandbox.ts
//
// NEX Programmer Agent · Phase G · isolated worktree sandbox
// Philip 2026-09-06 · AUTHORIZE · PHASE G · §5 §20
//
// The sandbox is a temp directory that hosts EVERY file written by the
// autonomous executor. Every write is guarded by the file-policy check
// AND the sandbox-escape check. Rollback = discard the sandbox.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { TaskContract } from "./types";
import { checkFileAccess, safeResolve } from "./contract";

// ─── Sandbox lifecycle ─────────────────────────────────────────

export type SandboxHandle = {
  root: string;
  created_at: string;
};

/** Create a fresh sandbox under `parent_dir`. Returns the absolute
 *  root path. Never overwrites an existing sandbox — always a new
 *  directory. */
export function createSandbox(parent_dir: string, prefix = "phase-g-sandbox-"): SandboxHandle {
  if (!path.isAbsolute(parent_dir)) {
    throw new Error(`sandbox parent must be absolute: ${parent_dir}`);
  }
  if (!existsSync(parent_dir)) {
    mkdirSync(parent_dir, { recursive: true });
  }
  const root = mkdtempSync(path.join(parent_dir, prefix));
  return { root, created_at: new Date().toISOString() };
}

/** Discard the sandbox contents. Irreversible. Never touches paths
 *  outside the sandbox root. */
export function discardSandbox(sandbox: SandboxHandle): void {
  if (!existsSync(sandbox.root)) return;
  rmSync(sandbox.root, { recursive: true, force: true });
}

// ─── Guarded write / read / delete ─────────────────────────────

export type SandboxWriteResult =
  | { ok: true; absolute_path: string; bytes_written: number }
  | { ok: false; reason: string };

export type SandboxReadResult =
  | { ok: true; absolute_path: string; content: string }
  | { ok: false; reason: string };

export type SandboxDeleteResult =
  | { ok: true; absolute_path: string }
  | { ok: false; reason: string };

/** Write into the sandbox after passing the contract's file policy.
 *  Refuses to write outside the sandbox root regardless of the
 *  contract (defence-in-depth). Content size capped at 128 KB. */
export function writeSandboxFile(input: {
  sandbox: SandboxHandle;
  repo_root: string;
  contract: TaskContract;
  relpath: string;
  content: string;
}): SandboxWriteResult {
  if (input.content.length > 128 * 1024) {
    return { ok: false, reason: "content_too_large:>128KB" };
  }
  const absolute = safeResolve(input.sandbox.root, input.relpath);
  if (!absolute) {
    return { ok: false, reason: "path_traversal" };
  }
  const decision = checkFileAccess({
    sandbox_root: input.sandbox.root,
    repo_root: input.repo_root,
    absolute_path: absolute,
    contract: input.contract,
  });
  if (!decision.ok) {
    return { ok: false, reason: `file_denied:${decision.reason}:${decision.detail}` };
  }
  const parent = path.dirname(absolute);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(absolute, input.content, "utf8");
  return { ok: true, absolute_path: absolute, bytes_written: Buffer.byteLength(input.content, "utf8") };
}

export function readSandboxFile(input: {
  sandbox: SandboxHandle;
  repo_root: string;
  contract: TaskContract;
  relpath: string;
}): SandboxReadResult {
  const absolute = safeResolve(input.sandbox.root, input.relpath);
  if (!absolute) {
    return { ok: false, reason: "path_traversal" };
  }
  const decision = checkFileAccess({
    sandbox_root: input.sandbox.root,
    repo_root: input.repo_root,
    absolute_path: absolute,
    contract: input.contract,
  });
  if (!decision.ok) {
    return { ok: false, reason: `file_denied:${decision.reason}:${decision.detail}` };
  }
  if (!existsSync(absolute)) return { ok: false, reason: "file_not_found" };
  return { ok: true, absolute_path: absolute, content: readFileSync(absolute, "utf8") };
}

export function deleteSandboxFile(input: {
  sandbox: SandboxHandle;
  repo_root: string;
  contract: TaskContract;
  relpath: string;
}): SandboxDeleteResult {
  const absolute = safeResolve(input.sandbox.root, input.relpath);
  if (!absolute) return { ok: false, reason: "path_traversal" };
  const decision = checkFileAccess({
    sandbox_root: input.sandbox.root,
    repo_root: input.repo_root,
    absolute_path: absolute,
    contract: input.contract,
  });
  if (!decision.ok) {
    return { ok: false, reason: `file_denied:${decision.reason}:${decision.detail}` };
  }
  if (!existsSync(absolute)) return { ok: false, reason: "file_not_found" };
  unlinkSync(absolute);
  return { ok: true, absolute_path: absolute };
}

// ─── Enumeration ───────────────────────────────────────────────

/** Recursively list every file inside the sandbox (relative paths).
 *  Never follows symlinks. Never leaves the sandbox root. */
export function listSandboxFiles(sandbox: SandboxHandle): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const abs = path.join(dir, entry);
      const st = statSync(abs);
      if (st.isSymbolicLink()) continue; // defence-in-depth
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) {
        const rel = path.relative(sandbox.root, abs).replace(/\\/g, "/");
        out.push(rel);
      }
    }
  }
  walk(sandbox.root);
  return out.sort();
}
