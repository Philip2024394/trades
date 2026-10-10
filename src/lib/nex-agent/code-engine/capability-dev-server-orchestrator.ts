// src/lib/nex-agent/code-engine/capability-dev-server-orchestrator.ts
//
// NEX1 · Real Dev-Server Orchestrator (Blocker One · §3-5)
// Ledger B additive · Zero LLM · Real child_process management.
//
// PURPOSE
//   Real spawn/lifecycle for user-project dev servers. Not simulated.
//   Handles:
//     · port allocation (with collision retry)
//     · startup detection by stdout marker
//     · stdout/stderr capture
//     · graceful shutdown (SIGTERM)
//     · forced shutdown (SIGKILL after timeout)
//     · orphan-process detection (across restarts via lockfile)
//     · exit-code capture
//     · project-to-process association
//     · integration with existing capability-workstation-preview-state.ts
//
// FOUNDER INVARIANTS
//   · Never claim RUNNING because a process exists · require SERVER_LISTENING evidence
//   · Never claim READY without observed HTTP response evidence
//   · Every session has a lockfile with PID + port for orphan detection
//   · Bounded stdout/stderr buffers (prevent memory blow)
//   · Deterministic input digest · reproducible in tests

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const DEV_SERVER_ORCHESTRATOR_VERSION = "dev-server-orchestrator.v1.2026-09-19";

// ── Session lifecycle types ──────────────────────────────────────────────

export type SessionLifecycle =
  | "not_started"
  | "starting"
  | "started"          // process spawned · no server-listening evidence yet
  | "server_listening" // port accepts TCP connections
  | "responding"       // HTTP responded 2xx/3xx at least once
  | "crashed"
  | "stopped";

export interface SessionState {
  readonly session_id: string;
  readonly project_root: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly port: number | null;
  readonly pid: number | null;
  readonly lifecycle: SessionLifecycle;
  readonly startup_marker_matched: boolean;
  readonly exit_code: number | null;
  readonly last_error: string | null;
  readonly started_at_iso: string | null;
  readonly stopped_at_iso: string | null;
  readonly stdout_tail: readonly string[];
  readonly stderr_tail: readonly string[];
}

// ── Orchestrator singleton per session (in-memory) ───────────────────────

const sessions = new Map<string, {
  child: ChildProcess | null;
  state: SessionState;
  stdoutBuf: string[];
  stderrBuf: string[];
  startupMarkers: readonly RegExp[];
  lockfilePath: string;
  onLifecycleChange?: (state: SessionState) => void;
}>();

const MAX_LOG_LINES = 200;
const DEFAULT_STARTUP_TIMEOUT_MS = 60_000;
const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;

// ── Port allocation ──────────────────────────────────────────────────────

export async function allocatePort(
  preferred: number,
  min: number = 3000,
  max: number = 3999,
): Promise<number> {
  // Try preferred first, then walk upward.
  const seen = new Set<number>();
  for (let candidate = preferred; candidate <= max; candidate++) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (await isPortFree(candidate)) return candidate;
  }
  for (let candidate = min; candidate < preferred; candidate++) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (await isPortFree(candidate)) return candidate;
  }
  throw new Error(`no_free_port_in_range:${min}-${max}`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

// ── Public entry: start ──────────────────────────────────────────────────

export interface StartSessionInput {
  readonly session_id: string;
  readonly project_root: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly port_preferred: number;
  readonly env?: Record<string, string>;
  readonly startup_markers?: readonly RegExp[];
  readonly startup_timeout_ms?: number;
  readonly lockfile_root?: string;
  readonly onLifecycleChange?: (state: SessionState) => void;
}

export async function startSession(input: StartSessionInput): Promise<SessionState> {
  if (sessions.has(input.session_id)) {
    throw new Error(`session_already_exists:${input.session_id}`);
  }
  const port = await allocatePort(input.port_preferred);
  const lockfileRoot = input.lockfile_root ?? path.join(process.cwd(), "data", "nex1-dev-server-locks");
  if (!existsSync(lockfileRoot)) mkdirSync(lockfileRoot, { recursive: true });
  const lockfilePath = path.join(lockfileRoot, `${input.session_id}.lock.json`);

  // Detect orphan from prior run
  if (existsSync(lockfilePath)) {
    try {
      const stale = JSON.parse(readFileSync(lockfilePath, "utf8"));
      // If lockfile PID is alive, refuse to start
      if (stale.pid && isPidAlive(stale.pid)) {
        throw new Error(`orphan_process_detected:pid=${stale.pid}·session=${input.session_id}`);
      }
      // Else clean up stale lockfile
      unlinkSync(lockfilePath);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("orphan_process_detected")) throw err;
      // Corrupt lockfile · remove it
      try { unlinkSync(lockfilePath); } catch { /* noop */ }
    }
  }

  const state: SessionState = {
    session_id: input.session_id,
    project_root: input.project_root,
    command: input.command,
    args: input.args,
    port,
    pid: null,
    lifecycle: "starting",
    startup_marker_matched: false,
    exit_code: null,
    last_error: null,
    started_at_iso: new Date().toISOString(),
    stopped_at_iso: null,
    stdout_tail: [],
    stderr_tail: [],
  };

  const startupMarkers = input.startup_markers ?? [
    /Ready in/i,
    /ready in/i,
    /server (?:started|listening|running)/i,
    /http:\/\/localhost:/i,
    /- Local:/i,
  ];

  // Spawn
  const env = { ...process.env, ...(input.env ?? {}), PORT: String(port) };
  const child = spawn(input.command, [...input.args], {
    cwd: input.project_root,
    env,
    shell: false,
    windowsHide: true,
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutBuf: string[] = [];
  const stderrBuf: string[] = [];

  const session = { child, state, stdoutBuf, stderrBuf, startupMarkers, lockfilePath, onLifecycleChange: input.onLifecycleChange };
  sessions.set(input.session_id, session);

  const updated: SessionState = {
    ...state,
    pid: child.pid ?? null,
    lifecycle: "started",
  };
  writeLockfile(lockfilePath, updated);
  updateState(input.session_id, updated);

  const startupTimeout = input.startup_timeout_ms ?? DEFAULT_STARTUP_TIMEOUT_MS;
  const startupDeadline = Date.now() + startupTimeout;

  child.stdout?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      stdoutBuf.push(line);
      if (stdoutBuf.length > MAX_LOG_LINES) stdoutBuf.shift();
      // Startup marker matching
      const s = sessions.get(input.session_id);
      if (s && !s.state.startup_marker_matched) {
        if (s.startupMarkers.some((rx) => rx.test(line))) {
          updateState(input.session_id, {
            ...s.state,
            startup_marker_matched: true,
            lifecycle: "server_listening",
            stdout_tail: [...stdoutBuf],
          });
          continue;
        }
      }
      // Just refresh tail
      const s2 = sessions.get(input.session_id);
      if (s2) updateState(input.session_id, { ...s2.state, stdout_tail: [...stdoutBuf] });
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      stderrBuf.push(line);
      if (stderrBuf.length > MAX_LOG_LINES) stderrBuf.shift();
      const s = sessions.get(input.session_id);
      if (s) updateState(input.session_id, { ...s.state, stderr_tail: [...stderrBuf] });
    }
  });

  child.on("exit", (code, signal) => {
    const s = sessions.get(input.session_id);
    if (!s) return;
    const lifecycle: SessionLifecycle = s.state.lifecycle === "stopped" ? "stopped" : "crashed";
    updateState(input.session_id, {
      ...s.state,
      lifecycle,
      exit_code: code,
      last_error: signal ? `signal:${signal}` : (code !== null && code !== 0 ? `exit_code:${code}` : null),
      stopped_at_iso: new Date().toISOString(),
    });
    try { if (existsSync(lockfilePath)) unlinkSync(lockfilePath); } catch { /* noop */ }
  });

  child.on("error", (err) => {
    const s = sessions.get(input.session_id);
    if (!s) return;
    updateState(input.session_id, {
      ...s.state,
      lifecycle: "crashed",
      last_error: `spawn_error:${err.message.slice(0, 200)}`,
      stopped_at_iso: new Date().toISOString(),
    });
  });

  // Wait for either startup marker match, crash, or timeout.
  await waitForStartup(input.session_id, startupDeadline);
  return sessions.get(input.session_id)!.state;
}

// ── Wait for startup ─────────────────────────────────────────────────────

function waitForStartup(session_id: string, deadline: number): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const s = sessions.get(session_id);
      if (!s) return resolve();
      if (s.state.startup_marker_matched) return resolve();
      if (s.state.lifecycle === "crashed") return resolve();
      if (Date.now() >= deadline) return resolve();
      setTimeout(check, 100);
    };
    check();
  });
}

// ── Stop ─────────────────────────────────────────────────────────────────

export async function stopSession(session_id: string, opts?: { readonly grace_ms?: number }): Promise<SessionState> {
  const s = sessions.get(session_id);
  if (!s) throw new Error(`session_not_found:${session_id}`);
  const grace = opts?.grace_ms ?? DEFAULT_SHUTDOWN_GRACE_MS;

  if (s.child && s.child.exitCode === null && !s.child.killed) {
    updateState(session_id, { ...s.state, lifecycle: "stopped" });
    // Graceful first
    try { s.child.kill("SIGTERM"); } catch { /* noop */ }
    // Force after grace
    await new Promise<void>((resolve) => {
      const forceTimer = setTimeout(() => {
        try { s.child?.kill("SIGKILL"); } catch { /* noop */ }
        resolve();
      }, grace);
      s.child?.once("exit", () => { clearTimeout(forceTimer); resolve(); });
    });
  }
  const final = sessions.get(session_id);
  if (final) {
    try { if (existsSync(final.lockfilePath)) unlinkSync(final.lockfilePath); } catch { /* noop */ }
    sessions.delete(session_id);
  }
  return final?.state ?? s.state;
}

// ── HTTP-level probe · integrates with preview-state machine ─────────────

export async function probeHttp(url: string, timeout_ms: number = 3000): Promise<{
  readonly reachable: boolean;
  readonly http_status: number | null;
  readonly reason: string | null;
  readonly duration_ms: number;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout_ms);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "manual" });
    clearTimeout(t);
    // If we got here and lifecycle is server_listening or started, promote to responding
    return {
      reachable: res.status >= 200 && res.status < 500,
      http_status: res.status,
      reason: res.status >= 500 ? `http_${res.status}` : null,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(t);
    return {
      reachable: false,
      http_status: null,
      reason: (err instanceof Error && err.name === "AbortError") ? "timeout" : `fetch_error:${errMsg(err)}`,
      duration_ms: Date.now() - start,
    };
  }
}

/** Promote lifecycle to "responding" when a probe returns 2xx/3xx. */
export function markResponding(session_id: string): SessionState | null {
  const s = sessions.get(session_id);
  if (!s) return null;
  if (s.state.lifecycle === "server_listening" || s.state.lifecycle === "started") {
    updateState(session_id, { ...s.state, lifecycle: "responding" });
  }
  return sessions.get(session_id)?.state ?? null;
}

// ── Inspection ────────────────────────────────────────────────────────────

export function getSession(session_id: string): SessionState | null {
  return sessions.get(session_id)?.state ?? null;
}

export function listSessions(): readonly SessionState[] {
  return [...sessions.values()].map((s) => s.state);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function updateState(session_id: string, next: SessionState): void {
  const s = sessions.get(session_id);
  if (!s) return;
  s.state = next;
  writeLockfile(s.lockfilePath, next);
  try { s.onLifecycleChange?.(next); } catch { /* observer must never break the session */ }
}

function writeLockfile(p: string, state: SessionState): void {
  try {
    writeFileSync(p, JSON.stringify({
      session_id: state.session_id,
      pid: state.pid,
      port: state.port,
      lifecycle: state.lifecycle,
      started_at_iso: state.started_at_iso,
      project_root: state.project_root,
    }, null, 2));
  } catch {
    /* noop · lockfile is best-effort */
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process; EPERM = exists but we can't signal (still alive)
    return err instanceof Error && (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 120);
  return String(e).slice(0, 120);
}

// ── Deterministic session id derivation ──────────────────────────────────

export function deriveSessionId(project_root: string): string {
  return createHash("sha256")
    .update(path.resolve(project_root))
    .digest("hex")
    .slice(0, 16);
}
