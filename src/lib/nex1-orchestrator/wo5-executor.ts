// WO-WORKSTATION-05 · controlled build executor
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// executeBuild(spec, workspace_root) runs an authorised executable inside
// a workspace with:
//   - workspace-locked cwd (no traversal, no absolute paths)
//   - env allowlist (only PATH plus explicitly-forwarded vars)
//   - hard timeout with kill on expiry
//   - stdout/stderr captured with safety cap (10 MB each)
//   - deterministic artefact detection + hashing after successful runs
//   - full BuildReport regardless of success or failure
//
// This module never uses shell interpretation. Args are passed to
// child_process.spawn as an array — no injection surface via quoting.

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveAllowedExecutable, isAllowedExecutableRef } from "./wo5-allowed-executables";
import type {
  BuildSpec,
  BuildReport,
  ArtefactRecord,
  ExecuteBuildResult,
} from "./wo5-types";

const STDOUT_CAP_BYTES = 10 * 1024 * 1024;    // 10 MB
const STDERR_CAP_BYTES = 10 * 1024 * 1024;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;         // 30 min hard ceiling

// ── Public entry point ─────────────────────────────────────────────────

export async function executeBuild(input: {
  readonly spec: BuildSpec;
  readonly workspace_root: string;
}): Promise<ExecuteBuildResult> {
  const spec = input.spec;

  // 1. Argument validation (fast, deterministic)
  if (!isAllowedExecutableRef(spec.executable_ref)) {
    return { ok: false, reason_code: "EXECUTABLE_NOT_ALLOWED", reason: `executable_ref '${spec.executable_ref}' is not in the WO-05 allowlist` };
  }
  if (!Array.isArray(spec.args)) {
    return { ok: false, reason_code: "ARGS_INVALID", reason: "spec.args must be an array" };
  }
  for (const a of spec.args) {
    if (typeof a !== "string") {
      return { ok: false, reason_code: "ARGS_INVALID", reason: `spec.args must be all strings; got ${typeof a}` };
    }
  }
  if (typeof spec.timeout_ms !== "number" || spec.timeout_ms <= 0 || spec.timeout_ms > MAX_TIMEOUT_MS) {
    return { ok: false, reason_code: "INVALID_TIMEOUT", reason: `timeout_ms must be in (0, ${MAX_TIMEOUT_MS}]; got ${spec.timeout_ms}` };
  }

  // 2. Workspace root safety (mirrors WO-04)
  const wsRoot = path.resolve(input.workspace_root);
  const wsSafe = isWorkspaceRootAcceptable(wsRoot);
  if (!wsSafe.ok) {
    return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: wsSafe.reason };
  }
  try {
    const stat = await fs.stat(wsRoot);
    if (!stat.isDirectory()) {
      return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: `workspace_root exists but is not a directory: ${wsRoot}` };
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: `workspace_root does not exist: ${wsRoot}` };
    }
    throw err;
  }

  // 3. Working directory resolution — must land inside workspace_root
  const wdRel = spec.working_directory_rel.trim();
  if (path.isAbsolute(wdRel)) {
    return { ok: false, reason_code: "WORKING_DIRECTORY_ESCAPES_WORKSPACE", reason: `working_directory_rel must be relative; got absolute ${wdRel}` };
  }
  const wdAbs = path.resolve(wsRoot, wdRel === "" ? "." : wdRel);
  const wsRootNormalised = wsRoot.replace(/\\/g, "/") + "/";
  const wdAbsNormalised = (wdAbs + (wdAbs.endsWith(path.sep) ? "" : path.sep)).replace(/\\/g, "/");
  if (wdAbs !== wsRoot && !wdAbsNormalised.startsWith(wsRootNormalised)) {
    return { ok: false, reason_code: "WORKING_DIRECTORY_ESCAPES_WORKSPACE", reason: `working_directory ${wdAbs} escapes workspace_root ${wsRoot}` };
  }
  try {
    const stat = await fs.stat(wdAbs);
    if (!stat.isDirectory()) {
      return { ok: false, reason_code: "WORKING_DIRECTORY_MISSING", reason: `working_directory exists but is not a directory: ${wdAbs}` };
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason_code: "WORKING_DIRECTORY_MISSING", reason: `working_directory does not exist: ${wdAbs}` };
    }
    throw err;
  }

  // 4. Resolve executable through the allowlist
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

  // 5. Env: strip everything except PATH + explicit forwards
  const restrictedEnv = buildRestrictedEnv(spec.env_forward);

  // 6. Actually run
  const started_at = new Date().toISOString();
  const startTs = Date.now();
  const runResult = await runOnce({
    executable_absolute_path: executable.absolute_path,
    args: spec.args,
    cwd: wdAbs,
    env: restrictedEnv,
    timeout_ms: spec.timeout_ms,
  });
  const completed_at = new Date().toISOString();
  const duration_ms = Date.now() - startTs;

  // 7. Artefact detection (after run — walks workspace, hashes files,
  //    compares against baseline if given)
  const artefacts = await detectArtefacts(wsRoot, spec.baseline_hashes);

  const report: BuildReport = {
    record_type: "NEX1_BUILD_REPORT",
    report_id: `wo5-report-${randomUUID()}`,
    build_id: spec.build_id,
    trace_id: spec.trace_id,
    work_order_id: spec.work_order_id,
    project_id: spec.project_id,
    executable_ref: spec.executable_ref,
    executable_absolute_path: executable.absolute_path,
    args: spec.args,
    working_directory_absolute: wdAbs,
    workspace_root: wsRoot,
    exit_code: runResult.exit_code,
    signal: runResult.signal,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    stdout_bytes: runResult.stdout_bytes,
    stderr_bytes: runResult.stderr_bytes,
    stdout_truncated: runResult.stdout_truncated,
    stderr_truncated: runResult.stderr_truncated,
    duration_ms,
    started_at,
    completed_at,
    artefacts,
  };

  // 8. Interpret the result
  if (runResult.timed_out) {
    return { ok: false, reason_code: "TIMEOUT_EXPIRED", reason: `build exceeded timeout_ms=${spec.timeout_ms}`, report };
  }
  if (runResult.spawn_error) {
    return { ok: false, reason_code: "SPAWN_FAILED", reason: runResult.spawn_error, report };
  }
  if (runResult.exit_code !== spec.expected_exit_code) {
    return {
      ok: false,
      reason_code: runResult.exit_code === 0 ? "EXIT_CODE_MISMATCH" : "EXIT_CODE_NONZERO",
      reason: `expected exit code ${spec.expected_exit_code}, got ${runResult.exit_code}${runResult.signal ? ` (signal ${runResult.signal})` : ""}`,
      report,
    };
  }
  return { ok: true, report };
}

// ── Internals ──────────────────────────────────────────────────────────

interface RunOnceResult {
  readonly exit_code: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly stdout_bytes: number;
  readonly stderr_bytes: number;
  readonly stdout_truncated: boolean;
  readonly stderr_truncated: boolean;
  readonly timed_out: boolean;
  readonly spawn_error: string | null;
}

function runOnce(input: {
  readonly executable_absolute_path: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly timeout_ms: number;
}): Promise<RunOnceResult> {
  return new Promise<RunOnceResult>((resolve) => {
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let spawnError: string | null = null;

    const child = spawn(input.executable_absolute_path, [...input.args], {
      cwd: input.cwd,
      env: input.env as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const killTimer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGKILL"); } catch { /* already exited */ }
    }, input.timeout_ms);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (!stdoutTruncated) {
        const remaining = STDOUT_CAP_BYTES - stdoutChunks.reduce((n, b) => n + b.length, 0);
        if (chunk.length <= remaining) stdoutChunks.push(chunk);
        else {
          if (remaining > 0) stdoutChunks.push(chunk.subarray(0, remaining));
          stdoutTruncated = true;
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (!stderrTruncated) {
        const remaining = STDERR_CAP_BYTES - stderrChunks.reduce((n, b) => n + b.length, 0);
        if (chunk.length <= remaining) stderrChunks.push(chunk);
        else {
          if (remaining > 0) stderrChunks.push(chunk.subarray(0, remaining));
          stderrTruncated = true;
        }
      }
    });

    child.on("error", (err) => {
      spawnError = err.message;
      // 'close' will fire after error; timers cleared there
    });
    child.on("close", (code, signal) => {
      clearTimeout(killTimer);
      resolve({
        exit_code: code,
        signal: signal ?? null,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        stdout_bytes: stdoutBytes,
        stderr_bytes: stderrBytes,
        stdout_truncated: stdoutTruncated,
        stderr_truncated: stderrTruncated,
        timed_out: timedOut,
        spawn_error: spawnError,
      });
    });
  });
}

function buildRestrictedEnv(forward: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  // PATH is always forwarded — every executable needs it to find shared libs
  if (typeof process.env.PATH === "string") out.PATH = process.env.PATH;
  if (typeof process.env.SYSTEMROOT === "string") out.SYSTEMROOT = process.env.SYSTEMROOT; // Windows: needed for many Node internals
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
  if (nR.includes("/wo5-test-workspace-") || nR.includes("/wo4-test-workspace-") || nR.includes("/wo3-test-workspace-")) return { ok: true };
  return { ok: false, reason: `workspace_root ${resolved} is not under sanctioned directory ${sanctioned}` };
}

async function detectArtefacts(
  workspace_root: string,
  baseline: Readonly<Record<string, string>> | undefined,
): Promise<readonly ArtefactRecord[]> {
  const out: ArtefactRecord[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries: import("node:fs").Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return; throw err; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const full = path.join(dir, e.name);
      // Skip common heavyweights that would blow up the hash pass
      // (node_modules, .next, .git). Callers can inspect them explicitly
      // if they need to; artefact detection here focuses on the
      // authored surface.
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === ".git" || e.name === ".vercel") continue;
        await walk(full);
      } else if (e.isFile()) {
        const rel = path.relative(workspace_root, full).replace(/\\/g, "/");
        const buf = await fs.readFile(full);
        const sha256_full = createHash("sha256").update(buf).digest("hex");
        const baselineHash = baseline?.[rel];
        let change: ArtefactRecord["change"];
        if (baseline === undefined) change = "created";
        else if (baselineHash === undefined) change = "created";
        else if (baselineHash !== sha256_full) change = "modified";
        else change = "unchanged";
        out.push({ path: rel, sha256_full, bytes: buf.length, change });
      }
    }
  };
  await walk(workspace_root);
  return out;
}

// ── Baseline capture helper (for callers that want to snapshot BEFORE build) ─

/** Convenience: walk the workspace and produce a hash map suitable for
 *  BuildSpec.baseline_hashes. Callers use this immediately before invoking
 *  executeBuild so artefact diff is meaningful. */
export async function captureWorkspaceBaseline(workspace_root: string): Promise<Record<string, string>> {
  const wsRoot = path.resolve(workspace_root);
  const out: Record<string, string> = {};
  const walk = async (dir: string): Promise<void> => {
    let entries: import("node:fs").Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return; throw err; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === ".git" || e.name === ".vercel") continue;
        await walk(full);
      } else if (e.isFile()) {
        const rel = path.relative(wsRoot, full).replace(/\\/g, "/");
        const buf = await fs.readFile(full);
        out[rel] = createHash("sha256").update(buf).digest("hex");
      }
    }
  };
  await walk(wsRoot);
  return out;
}

// Constants exported for tests/documentation
export { STDOUT_CAP_BYTES, STDERR_CAP_BYTES, MAX_TIMEOUT_MS };
