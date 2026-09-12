// WO-WORKSTATION-06 · controlled runtime executor
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// executeRuntime(spec, workspace_root):
//   spawn authorised executable → poll HTTP health → verify response →
//   terminate (SIGTERM → grace → SIGKILL if needed) → verify dead →
//   produce RuntimeReport.
//
// Every result path — happy or failure — returns a full RuntimeReport
// when the process actually spawned. No exception-based escape hatches.
// Never uses shell interpretation. Reuses the WO-05 allowed-executables
// registry and workspace-safety rules.

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveAllowedExecutable, isAllowedExecutableRef } from "./wo5-allowed-executables";
import { pollHealth } from "./wo6-health-check";
import type {
  RuntimeSpec,
  RuntimeReport,
  ExecuteRuntimeResult,
  HealthCheckOutcome,
  TerminationOutcome,
} from "./wo6-types";

const STDOUT_CAP_BYTES = 4 * 1024 * 1024;   // 4 MB — runtime tail; shorter than build
const STDERR_CAP_BYTES = 4 * 1024 * 1024;
const MAX_STARTUP_MS   = 5 * 60 * 1000;      // 5 min startup ceiling
const MAX_TERM_GRACE_MS = 30_000;            // 30 s termination grace ceiling

const HEALTH_PER_REQUEST_TIMEOUT_MS = 2_000;

// ── Public entry point ─────────────────────────────────────────────────

export async function executeRuntime(input: {
  readonly spec: RuntimeSpec;
  readonly workspace_root: string;
}): Promise<ExecuteRuntimeResult> {
  const spec = input.spec;

  // 1. Argument validation
  if (!isAllowedExecutableRef(spec.executable_ref)) {
    return { ok: false, reason_code: "EXECUTABLE_NOT_ALLOWED", reason: `executable_ref '${spec.executable_ref}' not in WO-05/WO-06 allowlist` };
  }
  if (!Array.isArray(spec.args) || spec.args.some((a) => typeof a !== "string")) {
    return { ok: false, reason_code: "ARGS_INVALID", reason: "spec.args must be an array of strings" };
  }
  if (typeof spec.port !== "number" || !Number.isInteger(spec.port) || spec.port < 1024 || spec.port > 65_535) {
    return { ok: false, reason_code: "PORT_INVALID", reason: `spec.port must be an integer in [1024, 65535]; got ${spec.port}` };
  }
  if (typeof spec.health_path !== "string" || !spec.health_path.startsWith("/")) {
    return { ok: false, reason_code: "HEALTH_PATH_INVALID", reason: `spec.health_path must be a string starting with '/'; got ${JSON.stringify(spec.health_path)}` };
  }
  if (typeof spec.startup_timeout_ms !== "number" || spec.startup_timeout_ms <= 0 || spec.startup_timeout_ms > MAX_STARTUP_MS) {
    return { ok: false, reason_code: "INVALID_STARTUP_TIMEOUT", reason: `startup_timeout_ms must be in (0, ${MAX_STARTUP_MS}]` };
  }
  if (typeof spec.startup_poll_interval_ms !== "number" || spec.startup_poll_interval_ms <= 0 || spec.startup_poll_interval_ms >= spec.startup_timeout_ms) {
    return { ok: false, reason_code: "INVALID_POLL_INTERVAL", reason: `startup_poll_interval_ms must be in (0, startup_timeout_ms)` };
  }
  if (typeof spec.termination_grace_ms !== "number" || spec.termination_grace_ms <= 0 || spec.termination_grace_ms > MAX_TERM_GRACE_MS) {
    return { ok: false, reason_code: "INVALID_TERMINATION_GRACE", reason: `termination_grace_ms must be in (0, ${MAX_TERM_GRACE_MS}]` };
  }

  // 2. Workspace + working directory safety (mirrors WO-05)
  const wsRoot = path.resolve(input.workspace_root);
  const wsSafe = isWorkspaceRootAcceptable(wsRoot);
  if (!wsSafe.ok) return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: wsSafe.reason };
  try {
    const stat = await fs.stat(wsRoot);
    if (!stat.isDirectory()) return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: `workspace_root is not a directory: ${wsRoot}` };
  } catch {
    return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: `workspace_root does not exist: ${wsRoot}` };
  }

  const wdRel = spec.working_directory_rel.trim();
  if (path.isAbsolute(wdRel)) {
    return { ok: false, reason_code: "WORKING_DIRECTORY_ESCAPES_WORKSPACE", reason: `working_directory_rel must be relative; got absolute ${wdRel}` };
  }
  const wdAbs = path.resolve(wsRoot, wdRel === "" ? "." : wdRel);
  const wsRootN = wsRoot.replace(/\\/g, "/") + "/";
  const wdAbsN = (wdAbs + (wdAbs.endsWith(path.sep) ? "" : path.sep)).replace(/\\/g, "/");
  if (wdAbs !== wsRoot && !wdAbsN.startsWith(wsRootN)) {
    return { ok: false, reason_code: "WORKING_DIRECTORY_ESCAPES_WORKSPACE", reason: `working_directory ${wdAbs} escapes workspace_root ${wsRoot}` };
  }
  try {
    const stat = await fs.stat(wdAbs);
    if (!stat.isDirectory()) return { ok: false, reason_code: "WORKING_DIRECTORY_MISSING", reason: `working_directory is not a directory: ${wdAbs}` };
  } catch {
    return { ok: false, reason_code: "WORKING_DIRECTORY_MISSING", reason: `working_directory does not exist: ${wdAbs}` };
  }

  // 3. Resolve executable
  let executable: { ref: typeof spec.executable_ref; absolute_path: string };
  try {
    executable = await resolveAllowedExecutable(spec.executable_ref);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EXECUTABLE_NOT_FOUND_ON_DISK") {
      return { ok: false, reason_code: "EXECUTABLE_NOT_FOUND_ON_DISK", reason: e.message };
    }
    throw err;
  }

  // 4. Env restriction
  const env = buildRestrictedEnv(spec.env_forward);

  // 5. Spawn
  const started_at = new Date().toISOString();
  const startTs = Date.now();
  let child: ChildProcess;
  try {
    child = spawn(executable.absolute_path, [...spec.args], {
      cwd: wdAbs,
      env: env as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (err) {
    return { ok: false, reason_code: "SPAWN_FAILED", reason: (err as Error).message };
  }

  // 6. stream capture
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0, stderrBytes = 0;
  let stdoutTruncated = false, stderrTruncated = false;
  child.stdout?.on("data", (c: Buffer) => {
    stdoutBytes += c.length;
    if (!stdoutTruncated) {
      const inBuf = stdoutChunks.reduce((n, b) => n + b.length, 0);
      const remaining = STDOUT_CAP_BYTES - inBuf;
      if (c.length <= remaining) stdoutChunks.push(c);
      else { if (remaining > 0) stdoutChunks.push(c.subarray(0, remaining)); stdoutTruncated = true; }
    }
  });
  child.stderr?.on("data", (c: Buffer) => {
    stderrBytes += c.length;
    if (!stderrTruncated) {
      const inBuf = stderrChunks.reduce((n, b) => n + b.length, 0);
      const remaining = STDERR_CAP_BYTES - inBuf;
      if (c.length <= remaining) stderrChunks.push(c);
      else { if (remaining > 0) stderrChunks.push(c.subarray(0, remaining)); stderrTruncated = true; }
    }
  });

  // Track early exit
  let earlyExit: { code: number | null; signal: string | null } | null = null;
  child.on("exit", (code, signal) => {
    if (earlyExit === null) earlyExit = { code, signal: signal ?? null };
  });

  // 7. Poll health
  const pollResult = await pollHealth({
    host: "127.0.0.1",
    port: spec.port,
    path: spec.health_path,
    startup_timeout_ms: spec.startup_timeout_ms,
    poll_interval_ms: spec.startup_poll_interval_ms,
    per_request_timeout_ms: HEALTH_PER_REQUEST_TIMEOUT_MS,
    is_child_alive: () => earlyExit === null && child.exitCode === null && !child.killed,
  });

  // 8. Terminate the child (regardless of health outcome — we never leave
  //    a child alive after the executor returns)
  const termination = await terminateChild(child, spec.termination_grace_ms);

  // Wait for full close so buffered stdout/stderr flushes
  await waitForClose(child);

  const completed_at = new Date().toISOString();
  const total_lifetime_ms = Date.now() - startTs;

  const report: RuntimeReport = {
    record_type: "NEX1_RUNTIME_REPORT",
    report_id: `wo6-report-${randomUUID()}`,
    run_id: spec.run_id,
    trace_id: spec.trace_id,
    work_order_id: spec.work_order_id,
    project_id: spec.project_id,
    executable_ref: spec.executable_ref,
    executable_absolute_path: executable.absolute_path,
    args: spec.args,
    working_directory_absolute: wdAbs,
    workspace_root: wsRoot,
    port: spec.port,
    health_url: `http://127.0.0.1:${spec.port}${spec.health_path}`,
    child_pid: child.pid ?? null,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
    stdout_bytes: stdoutBytes,
    stderr_bytes: stderrBytes,
    stdout_truncated: stdoutTruncated,
    stderr_truncated: stderrTruncated,
    health: pollResult.outcome,
    termination,
    started_at,
    completed_at,
    total_lifetime_ms,
  };

  // 9. Interpret
  if (pollResult.kind === "CHILD_DEAD") {
    return { ok: false, reason_code: "PROCESS_EXITED_EARLY", reason: `child process exited before health check succeeded (exit_code=${earlyExit?.code ?? "unknown"}, signal=${earlyExit?.signal ?? "none"})`, report };
  }
  if (pollResult.kind === "TIMEOUT") {
    return { ok: false, reason_code: "HEALTH_CHECK_TIMEOUT", reason: `health endpoint never responded within ${spec.startup_timeout_ms}ms`, report };
  }
  // pollResult.kind === "READY"
  const health = report.health as HealthCheckOutcome;   // pollResult.kind === "READY" implies non-null
  if (health.response_status !== spec.expected_status) {
    return { ok: false, reason_code: "HEALTH_UNEXPECTED_STATUS", reason: `expected status ${spec.expected_status}, got ${health.response_status}`, report };
  }
  if (typeof spec.expected_body_substring === "string" && spec.expected_body_substring.length > 0) {
    if (!(health.response_body_first_1kb ?? "").includes(spec.expected_body_substring)) {
      return { ok: false, reason_code: "HEALTH_UNEXPECTED_BODY", reason: `health response body did not contain expected substring '${spec.expected_body_substring}'`, report };
    }
  }
  // Termination sanity
  if (termination.exit_code_after_termination === null && termination.signal_after_termination === null) {
    return { ok: false, reason_code: "TERMINATION_FAILED", reason: "child did not exit after termination attempt", report };
  }
  return { ok: true, report };
}

// ── Termination protocol ──────────────────────────────────────────────

async function terminateChild(child: ChildProcess, grace_ms: number): Promise<TerminationOutcome> {
  const attempted_at = new Date().toISOString();
  const start = Date.now();

  // If it's already dead, record and return
  if (child.exitCode !== null || child.signalCode !== null) {
    return {
      attempted_at,
      graceful_signal_sent: null,
      required_hard_kill: false,
      hard_kill_signal_sent: null,
      exit_code_after_termination: child.exitCode,
      signal_after_termination: child.signalCode ?? null,
      total_termination_ms: 0,
    };
  }

  // Graceful (Windows treats this as TerminateProcess, POSIX as SIGTERM)
  let gracefulSignal: string | null = null;
  try { child.kill("SIGTERM"); gracefulSignal = "SIGTERM"; } catch { /* already gone */ }

  // Wait up to grace_ms
  const graceful = await new Promise<{ code: number | null; signal: string | null } | null>((resolve) => {
    let done = false;
    const finish = (v: { code: number | null; signal: string | null } | null) => { if (!done) { done = true; resolve(v); } };
    child.once("exit", (code, sig) => finish({ code, signal: sig ?? null }));
    setTimeout(() => finish(null), grace_ms);
  });

  if (graceful) {
    return {
      attempted_at,
      graceful_signal_sent: gracefulSignal,
      required_hard_kill: false,
      hard_kill_signal_sent: null,
      exit_code_after_termination: graceful.code,
      signal_after_termination: graceful.signal,
      total_termination_ms: Date.now() - start,
    };
  }

  // Escalate to SIGKILL
  let hardSignal: string | null = null;
  try { child.kill("SIGKILL"); hardSignal = "SIGKILL"; } catch { /* already gone */ }
  const hard = await new Promise<{ code: number | null; signal: string | null } | null>((resolve) => {
    let done = false;
    const finish = (v: { code: number | null; signal: string | null } | null) => { if (!done) { done = true; resolve(v); } };
    child.once("exit", (code, sig) => finish({ code, signal: sig ?? null }));
    // Give SIGKILL a generous but bounded window
    setTimeout(() => finish(null), 3_000);
  });

  return {
    attempted_at,
    graceful_signal_sent: gracefulSignal,
    required_hard_kill: true,
    hard_kill_signal_sent: hardSignal,
    exit_code_after_termination: hard?.code ?? null,
    signal_after_termination: hard?.signal ?? null,
    total_termination_ms: Date.now() - start,
  };
}

function waitForClose(child: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    if ((child.stdout as unknown as { readableEnded?: boolean } | null)?.readableEnded && (child.stderr as unknown as { readableEnded?: boolean } | null)?.readableEnded) {
      resolve();
      return;
    }
    let outClosed = !child.stdout, errClosed = !child.stderr;
    child.stdout?.once("end", () => { outClosed = true; if (errClosed) resolve(); });
    child.stderr?.once("end", () => { errClosed = true; if (outClosed) resolve(); });
    // Safety net in case streams never emit "end"
    setTimeout(resolve, 500);
  });
}

// ── Shared helpers ─────────────────────────────────────────────────────

function buildRestrictedEnv(forward: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof process.env.PATH === "string") out.PATH = process.env.PATH;
  if (typeof process.env.SYSTEMROOT === "string") out.SYSTEMROOT = process.env.SYSTEMROOT;
  if (typeof process.env.TEMP === "string") out.TEMP = process.env.TEMP;
  if (typeof process.env.TMP === "string") out.TMP = process.env.TMP;
  for (const [k, v] of Object.entries(forward)) {
    if (typeof k === "string" && typeof v === "string") out[k] = v;
  }
  return out;
}

function isWorkspaceRootAcceptable(resolved: string): { ok: true } | { ok: false; reason: string } {
  const sanctioned = path.resolve(process.cwd(), "data", "nex-agent-workspaces");
  const nR = resolved.replace(/\\/g, "/");
  const nS = sanctioned.replace(/\\/g, "/");
  if (nR === nS || nR.startsWith(nS + "/")) return { ok: true };
  const tmpdir = (process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? "/tmp").replace(/\\/g, "/");
  if (nR.startsWith(tmpdir + "/") || nR === tmpdir) return { ok: true };
  if (nR.includes("/wo6-test-workspace-") || nR.includes("/wo5-test-workspace-") || nR.includes("/wo4-test-workspace-") || nR.includes("/wo3-test-workspace-")) return { ok: true };
  return { ok: false, reason: `workspace_root ${resolved} is not under sanctioned directory ${sanctioned}` };
}

export { STDOUT_CAP_BYTES, STDERR_CAP_BYTES, MAX_STARTUP_MS, MAX_TERM_GRACE_MS };
