// §36-W-1 · WAVE-W1 · 2026-09-14 · workstation-live
//
// Real git-diff endpoint. Runs `git status --porcelain=v1` + `git diff --stat`
// against the working tree · returns the actual current change set. No
// fabrication. If git is unavailable → returns { connected: false, reason }.
//
// Read-only shell-out (git status / git diff). Never writes.

import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import * as path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChangeEntry {
  readonly status: string;
  readonly path: string;
}

interface ChangesResponse {
  readonly connected: boolean;
  readonly reason?: string;
  readonly cwd: string;
  readonly changes: readonly ChangeEntry[];
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
  readonly untracked: number;
  readonly stat_summary: string | null;
  readonly captured_at: string;
}

function runGit(args: readonly string[], cwd: string): { ok: boolean; stdout: string; stderr: string; code: number } {
  const r = spawnSync("git", args as string[], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    code: r.status ?? -1,
  };
}

export async function GET(): Promise<NextResponse<ChangesResponse>> {
  const cwd = path.resolve(process.cwd());
  const now = new Date().toISOString();

  // 1. Verify we are in a git working tree.
  const rev = runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  if (!rev.ok || rev.stdout.trim() !== "true") {
    return NextResponse.json({
      connected: false,
      reason: rev.stderr.trim() || "not_a_git_worktree",
      cwd,
      changes: [],
      added: 0,
      modified: 0,
      deleted: 0,
      untracked: 0,
      stat_summary: null,
      captured_at: now,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // 2. Get porcelain status.
  const status = runGit(["status", "--porcelain=v1", "-uall"], cwd);
  if (!status.ok) {
    return NextResponse.json({
      connected: false,
      reason: status.stderr.trim() || "git_status_failed",
      cwd,
      changes: [],
      added: 0,
      modified: 0,
      deleted: 0,
      untracked: 0,
      stat_summary: null,
      captured_at: now,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // 3. Parse porcelain output.
  const changes: ChangeEntry[] = [];
  let added = 0;
  let modified = 0;
  let deleted = 0;
  let untracked = 0;
  for (const rawLine of status.stdout.split(/\r?\n/)) {
    if (rawLine.length === 0) continue;
    const code = rawLine.slice(0, 2);
    const filePath = rawLine.slice(3).trim();
    if (filePath.length === 0) continue;
    changes.push({ status: code, path: filePath });
    if (code === "??") untracked++;
    else if (code.includes("A")) added++;
    else if (code.includes("D")) deleted++;
    else if (code.includes("M") || code.includes("R") || code.includes("C") || code.includes("T")) modified++;
  }
  // Sort deterministically by path
  changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // 4. Also fetch a compact diff --stat for a size-summary.
  const stat = runGit(["diff", "--stat", "--stat-width=120"], cwd);
  const statSummary = stat.ok ? stat.stdout.trim().split(/\r?\n/).slice(-1)[0] ?? null : null;

  return NextResponse.json({
    connected: true,
    cwd,
    changes,
    added,
    modified,
    deleted,
    untracked,
    stat_summary: statSummary,
    captured_at: now,
  }, { headers: { "Cache-Control": "no-store" } });
}
