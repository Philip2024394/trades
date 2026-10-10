// WO-NEX-RUNTIME-01 · REAL child-process acceptance tests.
//
// Founder-locked 2026-09-13. THE test the founder specified:
//   1. Start minimal-echo as a real OS process
//   2. Verify identity and heartbeat
//   3. Kill/restart the parent (this test process)  → agent survives
//   4. Kill Claude Code / this test process         → agent survives
//   5. Verify evidence independently
//
// This file exercises steps 1, 2, and (partially) 3+4 by spawning
// detached child daemons and killing the wrapper. A follow-up manual
// integration run confirms Claude-independence end-to-end.

import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const REPO_ROOT = process.cwd();

function pidFilePath(agent_id: string): string {
  return path.join(REPO_ROOT, "data", "nex-agent-runtime", "pids", `${agent_id}.json`);
}

function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EPERM") return true;
    return false;
  }
}

async function readPid(agent_id: string): Promise<{ pid: number; instance_id: string; startup_at: string } | null> {
  try { return JSON.parse(await fs.readFile(pidFilePath(agent_id), "utf8")); } catch { return null; }
}

async function waitForPidFile(agent_id: string, timeoutMs = 15_000): Promise<{ pid: number; instance_id: string; startup_at: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const p = await readPid(agent_id);
    if (p) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

async function killGracefully(pid: number): Promise<void> {
  try { process.kill(pid, "SIGTERM"); } catch { /* ok */ }
  // Give up to 3s to exit
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  // Force kill if still alive
  try { process.kill(pid, "SIGKILL"); } catch { /* ok */ }
}

async function cleanupAgent(agent_id: string): Promise<void> {
  const p = await readPid(agent_id);
  if (p) await killGracefully(p.pid);
  // Also clear identity + pid files
  try { await fs.unlink(pidFilePath(agent_id)); } catch { /* ok */ }
  const idDir = path.join(REPO_ROOT, "data", "nex-agent-runtime", "identities", agent_id);
  try { await fs.rm(idDir, { recursive: true, force: true }); } catch { /* ok */ }
}

describe("WO-NEX-RUNTIME-01 · REAL detached child process", () => {
  // These tests spawn a REAL Node.js child running minimal-echo. Each
  // test uses a unique agent_id so they can run in parallel safely.
  const agentsToCleanUp: string[] = [];
  afterEach(async () => {
    while (agentsToCleanUp.length) {
      const id = agentsToCleanUp.pop();
      if (id) await cleanupAgent(id);
    }
  });

  it("R-1 · CLI spawns real detached process · PID file appears · PID is alive", async () => {
    const agent_id = `real-r1-${randomUUID().slice(0, 6)}`;
    agentsToCleanUp.push(agent_id);
    const child = spawn(process.execPath, [
      "--import", "tsx",
      path.join(REPO_ROOT, "nex-runtimes/minimal-echo/daemon.mjs"),
    ], { cwd: REPO_ROOT, detached: true, stdio: "ignore",
        env: { ...process.env, NEX_HEARTBEAT_MS: "500", NEX_AGENT_ID: agent_id } });
    child.unref();

    const p = await waitForPidFile(agent_id, 15_000);
    expect(p).not.toBeNull();
    if (!p) return;
    // Windows `spawn` may return a wrapper pid distinct from the actual
    // daemon pid inside the pid file. Assert the pid IN THE FILE is alive.
    expect(isPidAlive(p.pid)).toBe(true);
    expect(p.instance_id).toMatch(/^inst-/);
  }, 30_000);

  it("R-2 · child SURVIVES parent-child handle unref (detached semantics)", async () => {
    const agent_id = `real-r2-${randomUUID().slice(0, 6)}`;
    agentsToCleanUp.push(agent_id);
    const child = spawn(process.execPath, [
      "--import", "tsx",
      path.join(REPO_ROOT, "nex-runtimes/minimal-echo/daemon.mjs"),
    ], { cwd: REPO_ROOT, detached: true, stdio: "ignore",
        env: { ...process.env, NEX_HEARTBEAT_MS: "500", NEX_AGENT_ID: agent_id } });
    child.unref();
    const p = await waitForPidFile(agent_id, 15_000);
    expect(p).not.toBeNull();
    if (!p) return;
    const startupAt = p.startup_at;
    await new Promise((r) => setTimeout(r, 2_000));
    const p2 = await readPid(agent_id);
    expect(p2).not.toBeNull();
    expect(p2?.pid).toBe(p.pid);
    expect(p2?.startup_at).toBe(startupAt);
    expect(isPidAlive(p2!.pid)).toBe(true);
  }, 30_000);

  it("R-3 · heartbeats accumulate in GB storage under agent identity · signature verifiable", async () => {
    const agent_id = `real-r3-${randomUUID().slice(0, 6)}`;
    agentsToCleanUp.push(agent_id);
    const child = spawn(process.execPath, [
      "--import", "tsx",
      path.join(REPO_ROOT, "nex-runtimes/minimal-echo/daemon.mjs"),
    ], { cwd: REPO_ROOT, detached: true, stdio: "ignore",
        env: { ...process.env, NEX_HEARTBEAT_MS: "500", NEX_AGENT_ID: agent_id } });
    child.unref();

    const p = await waitForPidFile(agent_id, 15_000);
    expect(p).not.toBeNull();
    if (!p) return;

    // Allow at least 2 heartbeats
    await new Promise((r) => setTimeout(r, 2_500));

    // Read from GB storage independently
    const { getStorage } = await import("@/lib/nex/storage/registry");
    const { AGENT_RUNTIME_HEARTBEAT_COLLECTION, AGENT_IDENTITY_COLLECTION } = await import("../types");
    const { verifyHeartbeat } = await import("../identity");
    const identities = await getStorage().query<{ agent_id: string; public_key_der_hex: string }>(AGENT_IDENTITY_COLLECTION, {
      where: { agent_id }, limit: 5,
    });
    expect(identities.length).toBeGreaterThan(0);
    const pubKey = identities[0].public_key_der_hex;

    const heartbeats = await getStorage().query<import("../types").AgentRuntimeHeartbeat>(AGENT_RUNTIME_HEARTBEAT_COLLECTION, {
      where: { agent_id, instance_id: p.instance_id }, limit: 20, order_by: "emitted_at", order_dir: "desc",
    });
    expect(heartbeats.length).toBeGreaterThanOrEqual(2);
    // Every heartbeat verifies
    for (const hb of heartbeats) {
      expect(verifyHeartbeat(pubKey, hb)).toBe(true);
      expect(hb.pid).toBe(p.pid);
      expect(hb.instance_id).toBe(p.instance_id);
      // Founder-locked doctrine: no mission → not WORKING
      expect(hb.lifecycle_state).not.toBe("WORKING");
      expect(hb.lifecycle_state).toBe("ALIVE_IDLE");
    }
  }, 30_000);

  it("R-4 · restart preserves SAME identity public key · new instance_id", async () => {
    const agent_id = `real-r4-${randomUUID().slice(0, 6)}`;
    agentsToCleanUp.push(agent_id);
    // First lifecycle
    const child1 = spawn(process.execPath, [
      "--import", "tsx",
      path.join(REPO_ROOT, "nex-runtimes/minimal-echo/daemon.mjs"),
    ], { cwd: REPO_ROOT, detached: true, stdio: "ignore",
        env: { ...process.env, NEX_HEARTBEAT_MS: "500", NEX_AGENT_ID: agent_id } });
    child1.unref();
    const p1 = await waitForPidFile(agent_id, 15_000);
    expect(p1).not.toBeNull();
    if (!p1) return;

    const { getStorage } = await import("@/lib/nex/storage/registry");
    const { AGENT_IDENTITY_COLLECTION } = await import("../types");
    const id1s = await getStorage().query<{ public_key_der_hex: string }>(AGENT_IDENTITY_COLLECTION, { where: { agent_id }, limit: 5 });
    const pubKey1 = id1s[0].public_key_der_hex;
    const inst1 = p1.instance_id;

    // Stop
    await killGracefully(p1.pid);
    // PID file should be removed on clean shutdown; if SIGKILL fell through, remove it here
    try { await fs.unlink(pidFilePath(agent_id)); } catch { /* ok */ }

    // Second lifecycle
    const child2 = spawn(process.execPath, [
      "--import", "tsx",
      path.join(REPO_ROOT, "nex-runtimes/minimal-echo/daemon.mjs"),
    ], { cwd: REPO_ROOT, detached: true, stdio: "ignore",
        env: { ...process.env, NEX_HEARTBEAT_MS: "500", NEX_AGENT_ID: agent_id } });
    child2.unref();
    const p2 = await waitForPidFile(agent_id, 15_000);
    expect(p2).not.toBeNull();
    if (!p2) return;

    const id2s = await getStorage().query<{ public_key_der_hex: string }>(AGENT_IDENTITY_COLLECTION, { where: { agent_id }, limit: 5 });
    const pubKey2 = id2s[0].public_key_der_hex;
    const inst2 = p2.instance_id;

    expect(pubKey2).toBe(pubKey1);              // SAME public key across restarts
    expect(inst2).not.toBe(inst1);              // NEW instance_id
    expect(p2.pid).not.toBe(p1.pid);            // NEW pid
  }, 45_000);
});
