// NEX Coding Team · Test-runner adapter
// Executes the repo's test suite (vitest by convention) for a specific scope,
// captures stdout + stderr, returns a structured result the Debugger consumes.

import { spawn } from "node:child_process";

const REPO_ROOT = process.cwd();

export interface TestRunResult {
  readonly ok: boolean;
  readonly exit_code: number | null;
  readonly duration_ms: number;
  readonly stdout_tail: string;
  readonly stderr_tail: string;
  readonly summary: string; // one-line human summary
  readonly failing_tests: readonly string[]; // parsed from output where possible
}

export interface RunVitestOptions {
  /** Vitest reporter · defaults to "default". Use "verbose" to force per-test FAIL blocks when piped (Node child_process suppresses them under "default"). */
  reporter?: "default" | "verbose" | "json";
  /** Extra environment variables · e.g. { CI: "1" } to unlock verbose failure detail. */
  env?: Record<string, string>;
}

/**
 * Run vitest against a specific path (file, directory, or glob).
 * `scope` is repo-relative. Empty scope runs the entire suite.
 */
export async function runVitest(scope: string, timeout_ms: number = 5 * 60 * 1000, options: RunVitestOptions = {}): Promise<TestRunResult> {
  return new Promise<TestRunResult>((resolve) => {
    const t0 = Date.now();
    const reporter = options.reporter ?? "default";
    const args = ["vitest", "run", `--reporter=${reporter}`];
    if (scope && scope.trim().length > 0) args.push(scope);

    const child = spawn("npx", args, {
      cwd: REPO_ROOT,
      windowsHide: true,
      shell: true, // required on Windows to resolve npx.cmd
      env: { ...process.env, ...(options.env ?? {}) },
    });

    const stdoutBuf: string[] = [];
    const stderrBuf: string[] = [];
    child.stdout.on("data", (b: Buffer) => stdoutBuf.push(b.toString("utf8")));
    child.stderr.on("data", (b: Buffer) => stderrBuf.push(b.toString("utf8")));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout_ms);

    child.on("exit", (code) => {
      clearTimeout(timer);
      const stdout = stdoutBuf.join("");
      const stderr = stderrBuf.join("");
      const failing = parseFailingTestNames(stdout);
      const summary = summariseVitestOutput(stdout, code, timedOut);
      resolve({
        ok: code === 0 && !timedOut,
        exit_code: code,
        duration_ms: Date.now() - t0,
        stdout_tail: stdout.slice(-8000),
        stderr_tail: stderr.slice(-2000),
        summary,
        failing_tests: failing,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exit_code: -1,
        duration_ms: Date.now() - t0,
        stdout_tail: stdoutBuf.join("").slice(-8000),
        stderr_tail: (stderrBuf.join("") + "\n" + String(err)).slice(-2000),
        summary: `test runner failed to spawn: ${err.message}`,
        failing_tests: [],
      });
    });
  });
}

export interface RunTscOptions {
  /** Optional path to a tsconfig.json to scope the check. When omitted, tsc runs against the repo default project. */
  project?: string;
}

/**
 * Run `tsc --noEmit` to gate on TypeScript compilation. Used by the Types Guard.
 * When `options.project` is supplied, tsc is invoked with `--project <path>` so
 * the check is scoped to that tsconfig's include list (Rung-5 requirement:
 * whole-repo tsc is noisy when there are many uncommitted changes).
 */
export async function runTsc(timeout_ms: number = 3 * 60 * 1000, options: RunTscOptions = {}): Promise<TestRunResult> {
  return new Promise<TestRunResult>((resolve) => {
    const t0 = Date.now();
    const args = ["tsc", "--noEmit"];
    if (options.project && options.project.trim().length > 0) {
      args.push("--project", options.project);
    }
    const child = spawn("npx", args, {
      cwd: REPO_ROOT,
      windowsHide: true,
      shell: true,
    });
    const stdoutBuf: string[] = [];
    const stderrBuf: string[] = [];
    child.stdout.on("data", (b: Buffer) => stdoutBuf.push(b.toString("utf8")));
    child.stderr.on("data", (b: Buffer) => stderrBuf.push(b.toString("utf8")));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout_ms);
    child.on("exit", (code) => {
      clearTimeout(timer);
      const stdout = stdoutBuf.join("");
      const stderr = stderrBuf.join("");
      const errCount = (stdout.match(/error TS\d+/g) ?? []).length;
      resolve({
        ok: code === 0 && !timedOut,
        exit_code: code,
        duration_ms: Date.now() - t0,
        stdout_tail: stdout.slice(-8000),
        stderr_tail: stderr.slice(-2000),
        summary: code === 0 ? "tsc --noEmit clean" : `tsc reported ${errCount} error(s)`,
        failing_tests: [],
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exit_code: -1,
        duration_ms: Date.now() - t0,
        stdout_tail: stdoutBuf.join("").slice(-8000),
        stderr_tail: String(err).slice(-2000),
        summary: `tsc spawn failed: ${err.message}`,
        failing_tests: [],
      });
    });
  });
}

// --- output parsers · best-effort, not schema-strict ---

function parseFailingTestNames(stdout: string): readonly string[] {
  const names: string[] = [];
  // Vitest default reporter: lines like " × test name  X ms"
  const rx = /^\s*×\s+([^\n]+?)\s*(?:\d+\s*ms)?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(stdout)) !== null) {
    if (m[1]) names.push(m[1].trim());
    if (names.length >= 50) break;
  }
  return names;
}

function summariseVitestOutput(stdout: string, code: number | null, timedOut: boolean): string {
  if (timedOut) return "TIMEOUT — test runner killed";
  // Try to extract "Test Files ... Passed ... Failed ..." summary
  const summaryMatch = stdout.match(/Test Files\s+.*/g);
  if (summaryMatch && summaryMatch.length > 0) return summaryMatch[summaryMatch.length - 1].trim();
  return code === 0 ? "vitest passed" : `vitest exit ${code}`;
}
