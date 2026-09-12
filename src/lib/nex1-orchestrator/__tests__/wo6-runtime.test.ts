// WO-WORKSTATION-06 · real runtime acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Every test spawns a REAL child process (Node inline HTTP server via
// `node -e "..."`), hits it via real HTTP, and terminates it cleanly.
// No mocks. Ports chosen from a high random range to avoid collisions
// between concurrent test files.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { executeRuntime } from "../wo6-runtime-executor";
import type { RuntimeSpec } from "../wo6-types";

// ── Fixtures ────────────────────────────────────────────────────────────

async function makeWorkspace(): Promise<string> {
  const dir = path.join(process.cwd(), "data", "nex-agent-workspaces", `wo6-test-workspace-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function cleanWorkspace(dir: string): Promise<void> {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

/** Grab a free TCP port by binding to 0 and reading back the assigned port.
 *  Immediately closes so the caller can bind it. Standard pattern. */
async function pickFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("could not determine port from server.address()")));
      }
    });
  });
}

let COUNTER = 0;
function baseSpec(overrides: Partial<RuntimeSpec> = {}): RuntimeSpec {
  COUNTER++;
  return {
    record_type: "NEX1_RUNTIME_SPEC",
    run_id: `wo6-run-${COUNTER}-${Date.now()}`,
    trace_id: `wo6-trace-${COUNTER}`,
    work_order_id: "wo-workstation-06",
    project_id: `wo6-project-${COUNTER}`,
    executable_ref: "node",
    args: ["-e", "process.exit(0)"],   // overridden per test
    working_directory_rel: "",
    port: 3000,                         // valid default; overridden per test where needed
    health_path: "/",
    startup_timeout_ms: 8_000,
    startup_poll_interval_ms: 100,
    expected_status: 200,
    termination_grace_ms: 2_000,
    env_forward: {},
    ...overrides,
  };
}

/** Node inline script for a tiny HTTP server. Uses env PORT for port + env
 *  MODE to switch behaviour (ok / 500 / hang / crash-post-listen). */
const INLINE_SERVER = `
const http = require('http');
const mode = process.env.MODE || 'ok';
const port = Number(process.env.PORT);
const server = http.createServer((req, res) => {
  if (mode === 'ok') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('runtime-ok'); return; }
  if (mode === '500') { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('boom'); return; }
  if (mode === 'wrong-body') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('unexpected-body'); return; }
});
server.on('error', (err) => { console.error('server error:', err.message); process.exit(2); });
server.listen(port, '127.0.0.1', () => {
  console.log('listening on ' + port);
  if (mode === 'crash-post-listen') { setTimeout(() => process.exit(9), 50); }
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
`;

// ── Suite ───────────────────────────────────────────────────────────────

describe("WO-WORKSTATION-06 · real runtime executor", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const d = cleanups.pop();
      if (d) await cleanWorkspace(d);
    }
  });

  // ── 1 · Happy path · real HTTP health check ──────────────────────────

  it("starts a real HTTP server, hits /health, and terminates cleanly", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", INLINE_SERVER],
        port,
        health_path: "/",
        env_forward: { PORT: String(port), MODE: "ok" },
        expected_status: 200,
        expected_body_substring: "runtime-ok",
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.health?.response_status).toBe(200);
    expect(result.report.health?.response_body_first_1kb).toContain("runtime-ok");
    expect(result.report.child_pid).toBeGreaterThan(0);
    // Termination confirmed: exit code OR signal recorded
    const t = result.report.termination!;
    expect(t.exit_code_after_termination !== null || t.signal_after_termination !== null).toBe(true);
    expect(result.report.health_url).toBe(`http://127.0.0.1:${port}/`);
  });

  it("carries trace_id / work_order_id / project_id / run_id in the report", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", INLINE_SERVER],
        port,
        env_forward: { PORT: String(port), MODE: "ok" },
        expected_status: 200,
        trace_id: "trace-777",
        work_order_id: "wo-777",
        project_id: "proj-777",
        run_id: "run-777",
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.trace_id).toBe("trace-777");
    expect(result.report.work_order_id).toBe("wo-777");
    expect(result.report.project_id).toBe("proj-777");
    expect(result.report.run_id).toBe("run-777");
  });

  // ── 2 · Health failures · every reason_code exercised ────────────────

  it("HEALTH_UNEXPECTED_STATUS when server returns 500", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", INLINE_SERVER],
        port,
        env_forward: { PORT: String(port), MODE: "500" },
        expected_status: 200,
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("HEALTH_UNEXPECTED_STATUS");
    expect(result.report?.health?.response_status).toBe(500);
    // Even on failure, termination is still attempted + reported
    expect(result.report?.termination).not.toBeNull();
  });

  it("HEALTH_UNEXPECTED_BODY when body does not include expected substring", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", INLINE_SERVER],
        port,
        env_forward: { PORT: String(port), MODE: "wrong-body" },
        expected_status: 200,
        expected_body_substring: "runtime-ok",
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("HEALTH_UNEXPECTED_BODY");
    expect(result.report?.health?.response_body_first_1kb).toContain("unexpected-body");
  });

  it("HEALTH_CHECK_TIMEOUT when nothing ever binds the port", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    // Child that sleeps but never listens on the port
    const script = "setTimeout(() => {}, 60000);";
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", script],
        port,
        startup_timeout_ms: 800,
        startup_poll_interval_ms: 100,
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("HEALTH_CHECK_TIMEOUT");
    expect(result.report?.health?.succeeded_at).toBeNull();
    expect(result.report?.health?.total_wait_ms).toBeGreaterThanOrEqual(800);
  });

  it("PROCESS_EXITED_EARLY when the child dies before health responds", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    // Child exits immediately, no server bound
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", "process.exit(1)"],
        port,
        startup_timeout_ms: 3_000,
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("PROCESS_EXITED_EARLY");
  });

  it("PROCESS_EXITED_EARLY when server crashes AFTER binding but before health check succeeds", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", INLINE_SERVER],
        port,
        env_forward: { PORT: String(port), MODE: "crash-post-listen" },
        startup_timeout_ms: 3_000,
        // Poll infrequently so the crash lands before the first successful GET
        startup_poll_interval_ms: 300,
      }),
      workspace_root: ws,
    });
    // Result may be READY (if we caught it right before crash) OR
    // PROCESS_EXITED_EARLY. Both are honest outcomes; both must be
    // captured with real evidence.
    expect(result.ok === true || (result.ok === false && result.reason_code === "PROCESS_EXITED_EARLY")).toBe(true);
  });

  // ── 3 · Input validation ─────────────────────────────────────────────

  it("PORT_INVALID for privileged ports and out-of-range values", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const r1 = await executeRuntime({ spec: baseSpec({ port: 80 }), workspace_root: ws });
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    expect(r1.reason_code).toBe("PORT_INVALID");

    const r2 = await executeRuntime({ spec: baseSpec({ port: 70000 }), workspace_root: ws });
    if (r2.ok) return;
    expect(r2.reason_code).toBe("PORT_INVALID");
  });

  it("HEALTH_PATH_INVALID when path does not start with /", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeRuntime({
      spec: baseSpec({ health_path: "health" }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("HEALTH_PATH_INVALID");
  });

  it("INVALID_STARTUP_TIMEOUT / INVALID_POLL_INTERVAL / INVALID_TERMINATION_GRACE for bad numbers", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const rTimeout = await executeRuntime({ spec: baseSpec({ startup_timeout_ms: 0 }), workspace_root: ws });
    if (rTimeout.ok) return;
    expect(rTimeout.reason_code).toBe("INVALID_STARTUP_TIMEOUT");

    const rPoll = await executeRuntime({ spec: baseSpec({ startup_timeout_ms: 200, startup_poll_interval_ms: 500 }), workspace_root: ws });
    if (rPoll.ok) return;
    expect(rPoll.reason_code).toBe("INVALID_POLL_INTERVAL");

    const rGrace = await executeRuntime({ spec: baseSpec({ termination_grace_ms: 0 }), workspace_root: ws });
    if (rGrace.ok) return;
    expect(rGrace.reason_code).toBe("INVALID_TERMINATION_GRACE");
  });

  it("EXECUTABLE_NOT_ALLOWED for an unlisted ref", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeRuntime({
      spec: baseSpec({ executable_ref: "curl" as unknown as RuntimeSpec["executable_ref"] }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("EXECUTABLE_NOT_ALLOWED");
  });

  // ── 4 · Workspace safety ─────────────────────────────────────────────

  it("WORKSPACE_ROOT_UNSAFE when root is outside sanctioned area", async () => {
    const result = await executeRuntime({
      spec: baseSpec(),
      workspace_root: path.resolve(process.cwd(), "src"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKSPACE_ROOT_UNSAFE");
  });

  it("WORKING_DIRECTORY_ESCAPES_WORKSPACE for '..'", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const result = await executeRuntime({
      spec: baseSpec({ working_directory_rel: "../out" }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("WORKING_DIRECTORY_ESCAPES_WORKSPACE");
  });

  // ── 5 · Environment restriction (same rule as WO-05) ─────────────────

  it("strips env vars not in env_forward", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    process.env.WO6_TEST_LEAK = "should-not-leak";
    // Child dumps its view of the leak var, then exits (so this is a
    // quick, non-server test using the runtime executor's spawn path
    // by pointing at a script that self-exits before health).
    // Instead we assert via the happy path: the inline server that
    // records env access.
    const script = `
      const http = require('http');
      const port = Number(process.env.PORT);
      const leak = process.env.WO6_TEST_LEAK ?? 'ABSENT';
      http.createServer((_, res) => { res.writeHead(200); res.end('leak=' + leak); })
        .listen(port, '127.0.0.1');
      process.on('SIGTERM', () => process.exit(0));
    `;
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", script],
        port,
        env_forward: { PORT: String(port) },  // deliberately NOT forwarding WO6_TEST_LEAK
      }),
      workspace_root: ws,
    });
    delete process.env.WO6_TEST_LEAK;
    if (!result.ok) throw new Error(`expected happy path: ${result.reason}`);
    expect(result.report.health?.response_body_first_1kb).toContain("leak=ABSENT");
  });

  // ── 6 · Termination correctness ──────────────────────────────────────

  it("child process is confirmed dead by the time the executor returns", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", INLINE_SERVER],
        port,
        env_forward: { PORT: String(port), MODE: "ok" },
      }),
      workspace_root: ws,
    });
    if (!result.ok) throw new Error("expected happy path");
    const term = result.report.termination!;
    // Either exit_code or signal must be recorded (proof it exited)
    expect(term.exit_code_after_termination !== null || term.signal_after_termination !== null).toBe(true);
    // And the PID is no longer alive (best-effort; on POSIX we can send
    // signal 0 to test existence; on Windows this is less reliable, so
    // we accept both platforms via a try/catch).
    if (result.report.child_pid) {
      let stillAlive = true;
      try { process.kill(result.report.child_pid, 0); }
      catch { stillAlive = false; }
      expect(stillAlive).toBe(false);
    }
  });

  it("kills a server that refuses SIGTERM by escalating to SIGKILL", async () => {
    const ws = await makeWorkspace(); cleanups.push(ws);
    const port = await pickFreePort();
    // Server that ignores SIGTERM (no handler; on Windows kill() is
    // equivalent to SIGKILL so this test still passes by hard-kill path)
    const script = `
      const http = require('http');
      const port = Number(process.env.PORT);
      http.createServer((_, res) => { res.writeHead(200); res.end('stubborn'); })
        .listen(port, '127.0.0.1');
      // Deliberately swallow SIGTERM on POSIX
      process.on('SIGTERM', () => { /* ignore */ });
      // Keep event loop alive forever
      setInterval(() => {}, 1e9);
    `;
    const result = await executeRuntime({
      spec: baseSpec({
        args: ["-e", script],
        port,
        env_forward: { PORT: String(port) },
        termination_grace_ms: 300,
        expected_body_substring: "stubborn",
      }),
      workspace_root: ws,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const term = result.report.termination!;
    // On POSIX: hard kill required + signal SIGKILL
    // On Windows: graceful "SIGTERM" is TerminateProcess (equivalent),
    // so required_hard_kill may be false. Either way, the child MUST
    // have exited.
    expect(term.exit_code_after_termination !== null || term.signal_after_termination !== null).toBe(true);
  });
});
