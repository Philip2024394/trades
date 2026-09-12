// src/lib/nex-agent/tools/verification.ts
//
// NEX Agent v1.2 · verification tool suite.
// Runs real shell commands with strict timeouts + bounded output + structured
// error parsing. These tools give nex2/nex3 real teeth: they can PROVE a plan
// won't break the build before founder approves.
//
// Every runner returns { ok, tool, duration_ms, data: { exit_code, stdout, stderr, findings } }
// where `findings` is a structured array parsed from the tool output — nex1 can
// consume findings to compose targeted revisions.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolResult } from "./index";

const REPO_ROOT = process.cwd();

// Bounded output · anything past this is truncated + flagged
const MAX_OUTPUT_BYTES = 200_000;

interface RunResult {
  exit_code: number | null;
  stdout: string;
  stderr: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  timed_out: boolean;
  duration_ms: number;
}

// ─── Bounded child-process runner ────────────────────────────────
function runBounded(command: string, args: string[], timeoutMs: number, cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    // Windows: npm/npx are .cmd files → need shell:true. Bounded via spawn stdout listener.
    // Large monorepo · tsc crashed at 4GB default heap. Bump Node heap so tsc/lint/vitest run to completion.
    // Preserves any user-provided NODE_OPTIONS · appends max-old-space-size if not already set.
    const priorNodeOpts = process.env.NODE_OPTIONS ?? "";
    const boostedNodeOpts = /--max-old-space-size/.test(priorNodeOpts)
      ? priorNodeOpts
      : `${priorNodeOpts} --max-old-space-size=8192`.trim();
    const child = spawn(command, args, {
      cwd: cwd ?? REPO_ROOT,
      shell: process.platform === "win32",
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: "1", NODE_OPTIONS: boostedNodeOpts },
    });
    let stdoutBuf = "";
    let stderrBuf = "";
    let stdoutTrunc = false;
    let stderrTrunc = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { child.kill("SIGKILL"); } catch { /* ignore */ } }, timeoutMs);
    child.stdout?.on("data", (d: Buffer) => {
      if (stdoutBuf.length + d.length > MAX_OUTPUT_BYTES) { stdoutTrunc = true; stdoutBuf += d.slice(0, MAX_OUTPUT_BYTES - stdoutBuf.length).toString(); try { child.kill("SIGKILL"); } catch { /* ignore */ } }
      else stdoutBuf += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (stderrBuf.length + d.length > MAX_OUTPUT_BYTES) { stderrTrunc = true; stderrBuf += d.slice(0, MAX_OUTPUT_BYTES - stderrBuf.length).toString(); try { child.kill("SIGKILL"); } catch { /* ignore */ } }
      else stderrBuf += d.toString();
    });
    child.on("error", (err) => { clearTimeout(timer); resolve({ exit_code: -1, stdout: stdoutBuf, stderr: stderrBuf + "\nSPAWN_ERROR: " + err.message, stdout_truncated: stdoutTrunc, stderr_truncated: stderrTrunc, timed_out: false, duration_ms: Date.now() - t0 }); });
    child.on("exit", (code) => { clearTimeout(timer); resolve({ exit_code: code, stdout: stdoutBuf, stderr: stderrBuf, stdout_truncated: stdoutTrunc, stderr_truncated: stderrTrunc, timed_out: timedOut, duration_ms: Date.now() - t0 }); });
  });
}

// ─── Structured findings ────────────────────────────────────────
export interface VerificationFinding {
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "info";
  rule?: string;
  message: string;
}

function parseTypeScriptErrors(stdout: string): VerificationFinding[] {
  // TS output line format: file(line,col): error TSxxxx: message
  const findings: VerificationFinding[] = [];
  const rx = /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+(TS\d+):\s+(.+)$/;
  for (const line of stdout.split(/\r?\n/).slice(0, 500)) {
    const m = rx.exec(line);
    if (m) findings.push({ file: m[1], line: Number(m[2]), column: Number(m[3]), severity: m[4] as VerificationFinding["severity"], rule: m[5], message: m[6].trim() });
  }
  return findings;
}

function parseEslintOutput(stdout: string): VerificationFinding[] {
  // Two typical formats:
  //  1. `file.ts\n  10:5  error  message  rule-name` (default eslint stylish)
  //  2. `<file>:<line>:<col>: <severity> <message> (<rule>)` (compact)
  const findings: VerificationFinding[] = [];
  const lines = stdout.split(/\r?\n/).slice(0, 800);
  let currentFile: string | undefined;
  const stylishHeader = /^(\S.+\.(?:ts|tsx|mjs|js|jsx))$/;
  const stylishRow = /^\s+(\d+):(\d+)\s+(error|warning|info)\s+(.+?)(?:\s{2,}([\w\-\/@]+))?$/;
  for (const l of lines) {
    const h = stylishHeader.exec(l);
    if (h) { currentFile = h[1]; continue; }
    const r = stylishRow.exec(l);
    if (r && currentFile) {
      findings.push({ file: currentFile, line: Number(r[1]), column: Number(r[2]), severity: r[3] as VerificationFinding["severity"], message: r[4].trim(), rule: r[5]?.trim() });
    }
  }
  return findings;
}

function parseVitestOutput(stdout: string, stderr: string): { findings: VerificationFinding[]; summary: { passed?: number; failed?: number; skipped?: number; total?: number } } {
  const findings: VerificationFinding[] = [];
  const combined = stdout + "\n" + stderr;
  // Vitest reports `FAIL <path>` and `Test Files  X passed | Y failed` etc.
  const failRx = /^FAIL\s+(.+)$/gm;
  const failMatches = Array.from(combined.matchAll(failRx));
  for (const m of failMatches) findings.push({ file: m[1].trim(), severity: "error", rule: "vitest_test_failed", message: "test file failed" });
  // Parse summary
  const passRx = /Test Files\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed/;
  const testRx = /Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?/;
  const pf = passRx.exec(combined);
  const tf = testRx.exec(combined);
  const summary: { passed?: number; failed?: number; skipped?: number; total?: number } = {};
  if (tf) {
    summary.failed = tf[1] ? Number(tf[1]) : 0;
    summary.passed = Number(tf[2]);
    summary.skipped = tf[3] ? Number(tf[3]) : 0;
    summary.total = (summary.passed ?? 0) + (summary.failed ?? 0) + (summary.skipped ?? 0);
  }
  return { findings, summary };
}

// ─── run_typecheck ──────────────────────────────────────────────
export async function runTypecheck(opts: { scope?: string; timeoutMs?: number; cwd?: string } = {}): Promise<ToolResult<{ exit_code: number | null; error_count: number; warning_count: number; findings: VerificationFinding[]; stdout_tail: string; stderr_tail: string; timed_out: boolean; cwd?: string }>> {
  const t0 = Date.now();
  const timeoutMs = Math.min(opts.timeoutMs ?? 120_000, 600_000);
  const args = opts.scope ? ["tsc", "--noEmit", "--pretty", "false", opts.scope] : ["tsc", "--noEmit", "--pretty", "false"];
  const r = await runBounded("npx", args, timeoutMs, opts.cwd);
  const findings = parseTypeScriptErrors(r.stdout);
  const error_count = findings.filter(f => f.severity === "error").length;
  const warning_count = findings.filter(f => f.severity === "warning").length;
  const ok = r.exit_code === 0 && error_count === 0 && !r.timed_out;
  return {
    ok, tool: "run_typecheck", duration_ms: Date.now() - t0,
    reason: r.timed_out ? "timed_out" : (r.exit_code !== 0 ? `exit_${r.exit_code}` : undefined),
    data: { exit_code: r.exit_code, error_count, warning_count, findings: findings.slice(0, 80), stdout_tail: r.stdout.slice(-4000), stderr_tail: r.stderr.slice(-2000), timed_out: r.timed_out, cwd: opts.cwd },
  };
}

// ─── run_lint ────────────────────────────────────────────────────
export async function runLint(opts: { scope?: string; timeoutMs?: number; cwd?: string } = {}): Promise<ToolResult<{ exit_code: number | null; error_count: number; warning_count: number; findings: VerificationFinding[]; stdout_tail: string; stderr_tail: string; timed_out: boolean; cwd?: string }>> {
  const t0 = Date.now();
  const timeoutMs = Math.min(opts.timeoutMs ?? 90_000, 600_000);
  // Prefer `next lint` if the config supports it (this repo does)
  const args = opts.scope ? ["next", "lint", "--dir", opts.scope, "--no-cache"] : ["next", "lint", "--no-cache"];
  const r = await runBounded("npx", args, timeoutMs, opts.cwd);
  const findings = parseEslintOutput(r.stdout);
  const error_count = findings.filter(f => f.severity === "error").length;
  const warning_count = findings.filter(f => f.severity === "warning").length;
  const ok = r.exit_code === 0 && error_count === 0 && !r.timed_out;
  return {
    ok, tool: "run_lint", duration_ms: Date.now() - t0,
    reason: r.timed_out ? "timed_out" : (r.exit_code !== 0 && error_count === 0 ? `exit_${r.exit_code}` : undefined),
    data: { exit_code: r.exit_code, error_count, warning_count, findings: findings.slice(0, 120), stdout_tail: r.stdout.slice(-4000), stderr_tail: r.stderr.slice(-2000), timed_out: r.timed_out, cwd: opts.cwd },
  };
}

// ─── run_tests ───────────────────────────────────────────────────
export async function runTests(opts: { pattern?: string; timeoutMs?: number; cwd?: string } = {}): Promise<ToolResult<{ exit_code: number | null; summary: { passed?: number; failed?: number; skipped?: number; total?: number }; findings: VerificationFinding[]; stdout_tail: string; stderr_tail: string; timed_out: boolean; cwd?: string }>> {
  const t0 = Date.now();
  const timeoutMs = Math.min(opts.timeoutMs ?? 180_000, 600_000);
  const args = opts.pattern ? ["vitest", "run", "--reporter", "default", "--no-color", opts.pattern] : ["vitest", "run", "--reporter", "default", "--no-color"];
  const r = await runBounded("npx", args, timeoutMs, opts.cwd);
  const { findings, summary } = parseVitestOutput(r.stdout, r.stderr);
  const ok = r.exit_code === 0 && !r.timed_out && (summary.failed ?? 0) === 0;
  return {
    ok, tool: "run_tests", duration_ms: Date.now() - t0,
    reason: r.timed_out ? "timed_out" : (r.exit_code !== 0 ? `exit_${r.exit_code}` : undefined),
    data: { exit_code: r.exit_code, summary, findings: findings.slice(0, 60), stdout_tail: r.stdout.slice(-6000), stderr_tail: r.stderr.slice(-2000), timed_out: r.timed_out, cwd: opts.cwd },
  };
}

// ─── git_worktree scaffold (create · list · delete) ─────────────
export async function gitWorktreeList(): Promise<ToolResult<{ worktrees: Array<{ path: string; branch: string; head: string }> }>> {
  const t0 = Date.now();
  const r = await runBounded("git", ["worktree", "list", "--porcelain"], 8_000);
  const worktrees: Array<{ path: string; branch: string; head: string }> = [];
  let cur: { path?: string; branch?: string; head?: string } = {};
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice("worktree ".length) }; }
    else if (line.startsWith("HEAD ")) { cur.head = line.slice("HEAD ".length); }
    else if (line.startsWith("branch ")) { cur.branch = line.slice("branch ".length); }
    else if (line === "" && cur.path) { worktrees.push({ path: cur.path, branch: cur.branch ?? "-", head: cur.head ?? "-" }); cur = {}; }
  }
  if (cur.path) worktrees.push({ path: cur.path, branch: cur.branch ?? "-", head: cur.head ?? "-" });
  return { ok: r.exit_code === 0, tool: "git_worktree_list", duration_ms: Date.now() - t0, data: { worktrees } };
}

export async function gitWorktreeCreate(taskId: string, opts: { baseBranch?: string } = {}): Promise<ToolResult<{ path: string; branch: string }>> {
  const t0 = Date.now();
  const base = opts.baseBranch ?? "main";
  const branch = `nex-agent/task-${taskId.slice(0, 8)}`;
  const path = join(REPO_ROOT, "data", "nex-agent-workspaces", `task-${taskId.slice(0, 8)}`);
  if (existsSync(path)) {
    return { ok: false, tool: "git_worktree_create", duration_ms: Date.now() - t0, reason: "worktree_already_exists", data: { path, branch } };
  }
  // Bumped to 3 minutes · full working-tree checkout for a large repo can take 60-120s on Windows.
  const r = await runBounded("git", ["worktree", "add", "-b", branch, path, base], 180_000);
  return {
    ok: r.exit_code === 0,
    tool: "git_worktree_create",
    duration_ms: Date.now() - t0,
    reason: r.exit_code === 0 ? undefined : (r.stderr.slice(0, 200) || `exit_${r.exit_code}`),
    data: { path, branch },
  };
}

export async function gitWorktreeDelete(taskId: string): Promise<ToolResult<{ path: string }>> {
  const t0 = Date.now();
  const path = join(REPO_ROOT, "data", "nex-agent-workspaces", `task-${taskId.slice(0, 8)}`);
  const r = await runBounded("git", ["worktree", "remove", "--force", path], 10_000);
  return {
    ok: r.exit_code === 0,
    tool: "git_worktree_delete",
    duration_ms: Date.now() - t0,
    reason: r.exit_code === 0 ? undefined : (r.stderr.slice(0, 200) || `exit_${r.exit_code}`),
    data: { path },
  };
}
