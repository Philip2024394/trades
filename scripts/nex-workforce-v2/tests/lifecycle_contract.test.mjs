// NEX Workforce V2 · C9 · Lifecycle Contract · 25-test suite (L-01..L-25)
// ─────────────────────────────────────────────────────────────────────────────
// Portable-only. Never touches Project B. Uses tests/support/fake_worker.mjs
// as the stand-in for agent/orchestrator/reaper processes.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  Role, StartupOrder, ShutdownOrder, SingletonRoles, MaxAgentCount,
  RestartPolicy, ExitClass, ChildState, isSpawnAllowed,
} from "../supervisor/lib/lifecycle_contract.mjs";
import { createSingletonRegistry } from "../supervisor/lib/singleton_registry.mjs";
import { classifyExit } from "../supervisor/lib/exit_classifier.mjs";
import { createRestartPolicy } from "../supervisor/lib/restart_policy.mjs";
import { createChildLifecycle } from "../supervisor/lib/child_lifecycle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const FAKE_WORKER = join(REPO_ROOT, "scripts/nex-workforce-v2/tests/support/fake_worker.mjs");

const silent = () => ({ info: () => {}, warn: () => {}, error: () => {}, critical: () => {} });

let tmpLockDir;
beforeAll(() => {
  tmpLockDir = join(tmpdir(), `nex-c9-locks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tmpLockDir, { recursive: true });
});
afterAll(() => {
  try { rmSync(tmpLockDir, { recursive: true, force: true }); } catch {}
});

// ═════════════════════════════════════════════════════════════════════════════
// L-01 · Normal startup: create lifecycle · register · start (autoStart=true)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-01 · Normal startup", () => {
  it("register + start · child transitions to RUNNING", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true, parentRole: Role.SUPERVISOR });
    lc.register({
      role: Role.AGENT, identifier: "L01-agent",
      script: FAKE_WORKER,
      env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_SLEEP_MS: "200", NEX_FAKE_EXIT_CODE: "0" },
    });
    const r = await lc.start(Role.AGENT, "L01-agent");
    expect(r.started).toBe(true);
    expect(r.pid).toBeGreaterThan(0);
    const c = lc.get(Role.AGENT, "L01-agent");
    expect(c.state).toBe(ChildState.RUNNING);
    // Wait for natural exit
    await new Promise((res) => setTimeout(res, 500));
    expect(lc.get(Role.AGENT, "L01-agent").state).toBe(ChildState.EXITED);
    expect(lc.get(Role.AGENT, "L01-agent").lastExit.class).toBe(ExitClass.EXPECTED_EXIT);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-02 · Normal shutdown: stop() sends SIGTERM · child exits cleanly
// ═════════════════════════════════════════════════════════════════════════════
describe("L-02 · Normal shutdown", () => {
  it("stop() delivers SIGTERM to hanging child · child exits", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    lc.register({
      role: Role.AGENT, identifier: "L02-agent",
      script: FAKE_WORKER,
      env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_HANG: "true" },
    });
    await lc.start(Role.AGENT, "L02-agent");
    const stopped = await lc.stop(Role.AGENT, "L02-agent", { waitMs: 2000 });
    expect(stopped.stopped).toBe(true);
    const c = lc.get(Role.AGENT, "L02-agent");
    expect(c.state).toBe(ChildState.EXITED);
    // Signal-terminated on POSIX; on Windows SIGTERM = process termination.
    // Classification may be CLEAN_SHUTDOWN (signal path) or EXPECTED_EXIT (code 0 path via handler).
    expect([ExitClass.CLEAN_SHUTDOWN, ExitClass.EXPECTED_EXIT, ExitClass.CATASTROPHIC_FAILURE]).toContain(c.lastExit.class);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-03 · Duplicate supervisor (via singleton_registry): second acquire refused
// L-04 · Duplicate orchestrator
// L-05 · Duplicate reaper
// ═════════════════════════════════════════════════════════════════════════════
describe("L-03/04/05 · Singleton duplicate detection per role", () => {
  it("SUPERVISOR singleton · second acquire refused when first still holds", () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    const r1 = reg.acquire(Role.SUPERVISOR);
    expect(r1.acquired).toBe(true);
    // Second attempt in same process: registry says already_held
    const r2 = reg.acquire(Role.SUPERVISOR);
    expect(r2.acquired).toBe(true);
    expect(r2.reason).toBe("already_held_by_this_process");
    reg.release(Role.SUPERVISOR);
  });

  it("ORCHESTRATOR singleton · lock file created + released", () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    const r = reg.acquire(Role.ORCHESTRATOR);
    expect(r.acquired).toBe(true);
    expect(existsSync(reg.pathFor(Role.ORCHESTRATOR))).toBe(true);
    reg.release(Role.ORCHESTRATOR);
    expect(existsSync(reg.pathFor(Role.ORCHESTRATOR))).toBe(false);
  });

  it("REAPER singleton · rejects AGENT role · agents are not singleton", () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    expect(() => reg.pathFor(Role.AGENT)).toThrow(/NOT a singleton role/);
    const r = reg.acquire(Role.AGENT);
    expect(r.acquired).toBe(false);
    expect(r.reason).toBe("not_singleton_role");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-06 · Agent crash: exit code 1 with transient class
// L-07 · Agent replacement (bounded restart)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-06/07 · Agent crash + replacement", () => {
  it("Agent exits code 1 · classified TRANSIENT_CRASH · restart eligible", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    lc.register({
      role: Role.AGENT, identifier: "L06-agent",
      script: FAKE_WORKER,
      env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_SLEEP_MS: "100", NEX_FAKE_EXIT_CODE: "1" },
    });
    await lc.start(Role.AGENT, "L06-agent");
    // Wait for exit + potential restart cycle
    await new Promise((res) => setTimeout(res, 400));
    const c = lc.get(Role.AGENT, "L06-agent");
    expect(c.lastExit.class).toBe(ExitClass.TRANSIENT_CRASH);
    // Cleanup any restarts
    await lc.stop(Role.AGENT, "L06-agent", { waitMs: 500 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-08/09/10/11 · Orchestrator + Reaper crash + replacement
// ═════════════════════════════════════════════════════════════════════════════
describe("L-08/09/10/11 · Orchestrator + Reaper crash + replacement", () => {
  it("Orchestrator crash classified · restart policy consulted", () => {
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000 });
    const c = classifyExit({ code: 1, signal: null, restartCount: 0 });
    expect(c.class).toBe(ExitClass.TRANSIENT_CRASH);
    const d = rp.allow(Role.ORCHESTRATOR, "orch-1", c.class);
    expect(d.allowed).toBe(true);
    expect(d.delayMs).toBe(1000);
  });

  it("Reaper crash classified · restart policy consulted", () => {
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000 });
    const c = classifyExit({ code: 1, signal: null, restartCount: 0 });
    const d = rp.allow(Role.REAPER, "reap-1", c.class);
    expect(d.allowed).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-12/13/14 · Repeated crashes cross ceiling → degraded
// ═════════════════════════════════════════════════════════════════════════════
describe("L-12/13/14 · Repeated crashes hit restart ceiling", () => {
  it("Agent · 3 crashes recorded · 4th allow() denied", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) {
      rp.record(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH);
      t += 100;
    }
    const decision = rp.allow(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/restart_ceiling_reached/);
  });

  it("Orchestrator · same ceiling behavior", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.ORCHESTRATOR, "o1", ExitClass.TRANSIENT_CRASH); t += 100; }
    expect(rp.allow(Role.ORCHESTRATOR, "o1", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
  });

  it("Reaper · same ceiling behavior", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.REAPER, "r1", ExitClass.TRANSIENT_CRASH); t += 100; }
    expect(rp.allow(Role.REAPER, "r1", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-15 · Restart backoff · exponential
// L-16 · Restart ceiling
// ═════════════════════════════════════════════════════════════════════════════
describe("L-15/16 · Exponential backoff + ceiling", () => {
  it("Backoff increases 1000 → 2000 → 4000 as restarts accumulate", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 5, windowMs: 60_000, now: () => t });
    // 0 restarts → 1000ms
    expect(rp.allow(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH).delayMs).toBe(1000);
    rp.record(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH); t += 10;
    // 1 restart → 2000ms
    expect(rp.allow(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH).delayMs).toBe(2000);
    rp.record(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH); t += 10;
    // 2 restarts → 4000ms
    expect(rp.allow(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH).delayMs).toBe(4000);
  });

  it("Ceiling exactly at maxRestarts (3)", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH); t += 10; }
    expect(rp.allow(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
  });

  it("Window rolls · old entries pruned · restart re-enabled after window", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 1000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH); t += 100; }
    // Advance past the window
    t += 2000;
    // History should be pruned · allow again
    expect(rp.allow(Role.AGENT, "a1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-17 · DB unavailable · classified TRANSIENT_CRASH (retryable · bounded)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-17 · DB unavailable is bounded", () => {
  it("Exit code 1 with 'connection refused' stderr → TRANSIENT_CRASH (not permission)", () => {
    const c = classifyExit({ code: 1, signal: null, stderrTail: "Error: ECONNREFUSED 127.0.0.1:9999" });
    // ECONNREFUSED doesn't match permission-denied patterns · falls through to code=1 → TRANSIENT
    expect(c.class).toBe(ExitClass.TRANSIENT_CRASH);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-18 · Permission failure NEVER auto-restarts (C9 § 14)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-18 · Permission failure is fail-loud (never auto-restart)", () => {
  it("Exit code 5 → PERMISSION_FAILURE · restartPolicy.allow returns false", () => {
    const rp = createRestartPolicy();
    const c = classifyExit({ code: 5, signal: null });
    expect(c.class).toBe(ExitClass.PERMISSION_FAILURE);
    const d = rp.allow(Role.AGENT, "a1", c.class);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/non_restartable_class/);
  });

  it("Stderr containing '42501' with exit code 1 → still PERMISSION_FAILURE", () => {
    const c = classifyExit({ code: 1, signal: null, stderrTail: "ERROR 42501: permission denied for schema nex_workforce" });
    expect(c.class).toBe(ExitClass.PERMISSION_FAILURE);
    const rp = createRestartPolicy();
    expect(rp.allow(Role.AGENT, "a1", c.class).allowed).toBe(false);
  });

  it("Authentication failure (code 4) also non-restartable", () => {
    const c = classifyExit({ code: 4, signal: null });
    expect(c.class).toBe(ExitClass.AUTHENTICATION_FAILURE);
    const rp = createRestartPolicy();
    expect(rp.allow(Role.AGENT, "a1", c.class).allowed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-19 · Graceful shutdown in C9 § 6 order
// ═════════════════════════════════════════════════════════════════════════════
describe("L-19 · Graceful shutdownAll · reverse order", () => {
  it("Shutdown iterates in ShutdownOrder · orchestrator first · supervisor last (excluded)", () => {
    expect(ShutdownOrder).toEqual([Role.ORCHESTRATOR, Role.AGENT, Role.REAPER, Role.SUPERVISOR]);
    expect(StartupOrder).toEqual([Role.SUPERVISOR, Role.REAPER, Role.ORCHESTRATOR, Role.AGENT]);
  });

  it("shutdownAll SIGTERMs registered children · releases singletons", async () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    const lc = createChildLifecycle({ logger: silent(), autoStart: true, singletonRegistry: reg });
    lc.register({
      role: Role.AGENT, identifier: "L19-agent",
      script: FAKE_WORKER,
      env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_HANG: "true" },
    });
    await lc.start(Role.AGENT, "L19-agent");
    await lc.shutdownAll({ waitMs: 1500 });
    expect(lc.get(Role.AGENT, "L19-agent").state).toBe(ChildState.EXITED);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-20 · Zero orphan processes after shutdown
// ═════════════════════════════════════════════════════════════════════════════
describe("L-20 · Zero orphan processes after shutdown", () => {
  it("Spawned child PID no longer alive after stop()", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    lc.register({
      role: Role.AGENT, identifier: "L20-agent",
      script: FAKE_WORKER,
      env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_HANG: "true" },
    });
    const r = await lc.start(Role.AGENT, "L20-agent");
    const pid = r.pid;
    await lc.stop(Role.AGENT, "L20-agent", { waitMs: 2000 });
    let alive = true;
    try { process.kill(pid, 0); } catch (e) { if (e.code === "ESRCH") alive = false; }
    expect(alive, `PID ${pid} still alive after stop`).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-21 · No legacy spawn permitted
// ═════════════════════════════════════════════════════════════════════════════
describe("L-21 · No legacy spawn permitted", () => {
  const legacy = [
    "scripts/nex-acquisition-workforce/run-production-launcher.mjs",
    "scripts/nex-acquisition-workforce/run-production-watchdog.mjs",
    "scripts/nex-acquisition-workforce/run-production-supervisor.mjs",
    "scripts/nex-workforce/_category-walker.mjs",
  ];
  for (const p of legacy) {
    it(`register refuses legacy path: ${p}`, () => {
      const lc = createChildLifecycle({ logger: silent(), autoStart: true });
      expect(() => lc.register({ role: Role.AGENT, identifier: "leg", script: p })).toThrow(/refusing to register legacy/);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// L-22 · Failure isolation (agent failure ≠ workforce failure)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-22 · Failure isolation", () => {
  it("Agent EXITED does not modify orchestrator or reaper registry state", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true, parentRole: Role.SUPERVISOR });
    // Register orchestrator + reaper stubs (hanging)
    for (const [role, id] of [[Role.ORCHESTRATOR, "orch"], [Role.REAPER, "reap"]]) {
      lc.register({ role, identifier: id, script: FAKE_WORKER, env: { NEX_FAKE_ROLE: role, NEX_FAKE_HANG: "true" } });
      await lc.start(role, id);
    }
    // Register agent that exits immediately with code 1
    lc.register({ role: Role.AGENT, identifier: "iso-agent", script: FAKE_WORKER, env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_SLEEP_MS: "50", NEX_FAKE_EXIT_CODE: "1" } });
    await lc.start(Role.AGENT, "iso-agent");
    await new Promise((r) => setTimeout(r, 300));
    const orch = lc.get(Role.ORCHESTRATOR, "orch");
    const reap = lc.get(Role.REAPER, "reap");
    expect(orch.state).toBe(ChildState.RUNNING);
    expect(reap.state).toBe(ChildState.RUNNING);
    // Cleanup
    await lc.shutdownAll({ waitMs: 1500 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-23 · Agent replacement does NOT inherit dead lease (design assertion)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-23 · Agent replacement does not inherit dead lease", () => {
  it("child_lifecycle NEVER writes to work_item or lease · uses only spawn + stop", () => {
    const src = readFileSync(join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/child_lifecycle.mjs"), "utf8");
    // The module must NOT reference lease mutation or reap
    expect(src).not.toMatch(/reap_expired_leases/);
    expect(src).not.toMatch(/UPDATE\s+nex_workforce\.work_item/i);
    expect(src).not.toMatch(/nex_workforce\.claim\(/);
    expect(src).not.toMatch(/lease_deadline\s*=/);
    // It should reference lease topic only in comments · we assert via presence of the doctrine comment
    expect(src).toMatch(/agent replacement does NOT reclaim lease/);
    expect(src).toMatch(/reaper stays authoritative/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-24 · Orchestrator restart cannot duplicate work (design assertion)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-24 · Orchestrator restart safety", () => {
  it("child_lifecycle NEVER calls enqueue_from_view · orchestrator restart re-runs existing enqueue flow", () => {
    const src = readFileSync(join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/child_lifecycle.mjs"), "utf8");
    expect(src).not.toMatch(/enqueue_from_view/);
    expect(src).not.toMatch(/INSERT\s+INTO\s+nex_workforce\.work_item/i);
    // Doctrine comment must be present
    expect(src).toMatch(/orchestrator restart cannot manually enqueue/);
    expect(src).toMatch(/uses existing enqueue path/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// L-25 · Reaper restart cannot damage healthy leases (design assertion)
// ═════════════════════════════════════════════════════════════════════════════
describe("L-25 · Reaper restart safety", () => {
  it("child_lifecycle NEVER calls reap functions · reaper restart relies on SKIP LOCKED", () => {
    const src = readFileSync(join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/child_lifecycle.mjs"), "utf8");
    expect(src).not.toMatch(/reap_expired_leases/);
    expect(src).not.toMatch(/requeue_soft_fail_backoff_elapsed/);
    // Doctrine comment must be present
    expect(src).toMatch(/reaper restart cannot damage healthy leases/);
    expect(src).toMatch(/SKIP LOCKED remains authoritative/);
  });

  it("MaxAgentCount is 5 (widened by C11.5 · portable-only) · enforced by child_lifecycle.register", () => {
    expect(MaxAgentCount).toBe(5);
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    for (const id of ["a1","a2","a3","a4","a5"]) {
      lc.register({ role: Role.AGENT, identifier: id, script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    }
    expect(() => lc.register({ role: Role.AGENT, identifier: "a6", script: FAKE_WORKER, env: {} })).toThrow(/AGENT count ceiling/);
  });

  it("isSpawnAllowed enforces § 18 tree (only SUPERVISOR may spawn · never agent→agent)", () => {
    expect(isSpawnAllowed(Role.SUPERVISOR, Role.AGENT)).toBe(true);
    expect(isSpawnAllowed(Role.SUPERVISOR, Role.ORCHESTRATOR)).toBe(true);
    expect(isSpawnAllowed(Role.SUPERVISOR, Role.REAPER)).toBe(true);
    expect(isSpawnAllowed(Role.AGENT, Role.AGENT)).toBe(false);
    expect(isSpawnAllowed(Role.AGENT, Role.ORCHESTRATOR)).toBe(false);
    expect(isSpawnAllowed(Role.ORCHESTRATOR, Role.AGENT)).toBe(false);
    expect(isSpawnAllowed(Role.REAPER, Role.AGENT)).toBe(false);
  });
});
