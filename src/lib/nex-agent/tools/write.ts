// src/lib/nex-agent/tools/write.ts
//
// NEX Agent v1.2 · SAFE write · restricted to isolated worktrees.
//
// The ONLY write path nex1 has. It refuses:
//   · any absolute path
//   · any path that escapes the caller's declared allowedRoot
//   · any path containing NUL bytes
//   · any path that ends up outside data/nex-agent-workspaces/task-{id8}/ (double-check)
//
// Even if a bug in the orchestrator passes a bad path, this guard stops writes to `src/`.
// The founder's main working tree is fundamentally unreachable from this tool.

import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, relative, dirname, sep, isAbsolute } from "node:path";
import type { ToolResult } from "./index";

const REPO_ROOT = process.cwd();
const WORKTREE_BASE = resolve(REPO_ROOT, "data", "nex-agent-workspaces");

export interface WriteFileArgs {
  path: string;        // relative to allowedRoot
  content: string;
  allowedRoot: string; // absolute path · MUST be inside data/nex-agent-workspaces/
}

export function writeFileSafe(args: WriteFileArgs): ToolResult<{ absolute_path: string; bytes_written: number }> {
  const t0 = Date.now();
  const { path: relPath, content, allowedRoot } = args;

  // 1. Basic input validation
  if (typeof relPath !== "string" || relPath.length === 0) return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "path_empty" };
  if (relPath.includes("\0")) return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "path_null_byte" };
  if (typeof content !== "string") return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "content_not_string" };
  if (content.length > 5_000_000) return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "content_too_large" };

  // 2. Absolute paths always rejected — force relative to allowedRoot
  if (isAbsolute(relPath)) return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "absolute_path_forbidden" };

  // 3. allowedRoot must itself be inside data/nex-agent-workspaces
  const rootRel = relative(WORKTREE_BASE, resolve(allowedRoot));
  if (!allowedRoot || rootRel.startsWith("..") || isAbsolute(rootRel) || rootRel.startsWith(sep)) {
    return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "allowed_root_outside_worktree_base", data: undefined };
  }

  // 4. Resolve target · confirm it stays inside allowedRoot
  const absTarget = resolve(allowedRoot, relPath);
  const insideAllowed = relative(resolve(allowedRoot), absTarget);
  if (insideAllowed.startsWith("..") || isAbsolute(insideAllowed) || insideAllowed.startsWith(sep)) {
    return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "path_escapes_allowed_root" };
  }
  // 5. Belt-and-braces: absTarget must ALSO be inside data/nex-agent-workspaces
  const insideBase = relative(WORKTREE_BASE, absTarget);
  if (insideBase.startsWith("..") || isAbsolute(insideBase) || insideBase.startsWith(sep)) {
    return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: "path_escapes_worktree_base" };
  }

  // 6. Refuse to overwrite protected paths even inside worktree (rules · db/migrations · docs/DECISIONS)
  const targetRelBase = insideBase.replace(/\\/g, "/");
  const parts = targetRelBase.split("/");
  // parts[0] = task-XXX · parts[1..] = the actual relative path inside the worktree
  const withinWorktree = parts.slice(1).join("/");
  const forbiddenPrefixes = ["rules/", "db/migrations/", "supabase/migrations/", "docs/DECISIONS/"];
  for (const p of forbiddenPrefixes) {
    if (withinWorktree.startsWith(p)) {
      return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: `protected_path_${p.replace(/\//g, "_")}` };
    }
  }

  // 7. Ensure parent dir exists · then write
  try {
    const parent = dirname(absTarget);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(absTarget, content, { encoding: "utf8" });
    const st = statSync(absTarget);
    return { ok: true, tool: "write_file_safe", duration_ms: Date.now() - t0, data: { absolute_path: absTarget, bytes_written: st.size } };
  } catch (err) {
    return { ok: false, tool: "write_file_safe", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) };
  }
}
