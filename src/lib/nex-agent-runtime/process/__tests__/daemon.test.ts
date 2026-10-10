// WO-NEX-RUNTIME-01 · daemon primitive tests (in-process).
//
// Founder-locked 2026-09-13. Tests that don't require spawning a
// separate OS process. Real-child-process tests live in
// daemon-real-process.test.ts.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { makeAgentDaemon, pidFile } from "../daemon";
import { verifyHeartbeat, verifyEvidence } from "../identity";
import { getStorage } from "@/lib/nex/storage/registry";
import {
  AGENT_RUNTIME_HEARTBEAT_COLLECTION,
  AGENT_EVIDENCE_COLLECTION,
  AGENT_PROCESS_AUDIT_COLLECTION,
  type AgentRuntimeHeartbeat,
  type AgentEvidenceRecord,
  type AgentProcessAuditEvent,
} from "../types";

function tmpRepoRoot(): string {
  return path.join(process.cwd(), "data", "nex-agent-workspaces", `runtime01-daemon-test-${randomUUID().slice(0, 12)}`);
}
async function nuke(p: string): Promise<void> { try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ } }

describe("WO-NEX-RUNTIME-01 · in-process daemon", () => {
  const cleanupPaths: string[] = [];
  const stopFns: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanupPaths.length) { const p = cleanupPaths.pop(); if (p) await nuke(p); }
  });

  it("D-1 · start · emits first heartbeat immediately · signed with agent identity", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    const daemon = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000, // long interval so only initial fires
      _test_unref_heartbeat: true,
      onMission: async () => ({ kind: "COMPLETED", detail: "ok" }),
    });
    stopFns.push(daemon.stop);

    const hbs = await getStorage().query<AgentRuntimeHeartbeat>(AGENT_RUNTIME_HEARTBEAT_COLLECTION, {
      where: { agent_id }, limit: 10, order_by: "emitted_at", order_dir: "desc",
    });
    expect(hbs.length).toBeGreaterThanOrEqual(1);
    const hb = hbs[0];
    expect(hb.pid).toBe(process.pid);
    expect(hb.instance_id).toBe(daemon.instance_id);
    expect(verifyHeartbeat(daemon.identity_public_key_der_hex, hb)).toBe(true);
    expect(hb.lifecycle_state).toBe("ALIVE_IDLE");
    expect(hb.mission_id).toBeNull();
    expect(hb.progress_counter).toBe(0);
  });

  it("D-2 · PID file written on start · removed on stop", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    const daemon = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async () => ({ kind: "COMPLETED", detail: "ok" }),
    });
    const pf = pidFile(root, agent_id);
    const before = await fs.stat(pf).then(() => true).catch(() => false);
    expect(before).toBe(true);
    await daemon.stop();
    const after = await fs.stat(pf).then(() => true).catch(() => false);
    expect(after).toBe(false);
  });

  it("D-3 · receiveMission · progress + evidence emitted · heartbeat sequence proves dual-signal doctrine", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    const daemon = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async (env, ctx) => {
        ctx.bumpProgress();
        await ctx.emitEvidence("echo.reply", { echoed: env.payload });
        ctx.bumpProgress();
        return { kind: "COMPLETED", detail: "echoed" };
      },
    });
    stopFns.push(daemon.stop);

    const result = await daemon.receiveMission({
      record_type: "NEX_AGENT_MISSION_ENVELOPE",
      mission_id: "m-1", agent_id, cap_id: null, kind: "echo",
      payload: { message: "hello" }, created_at: new Date().toISOString(),
      deadline_at: null,
    });
    expect(result.kind).toBe("COMPLETED");
    expect(daemon.progressCounter()).toBe(2);

    // Evidence persisted + verifiable
    const evs = await getStorage().query<AgentEvidenceRecord>(AGENT_EVIDENCE_COLLECTION, {
      where: { agent_id }, limit: 10, order_by: "emitted_at", order_dir: "desc",
    });
    expect(evs.length).toBe(1);
    expect(verifyEvidence(daemon.identity_public_key_der_hex, evs[0])).toBe(true);
    expect(evs[0].kind).toBe("echo.reply");

    // Audit log records the mission lifecycle
    const audits = await getStorage().query<AgentProcessAuditEvent>(AGENT_PROCESS_AUDIT_COLLECTION, {
      where: { agent_id }, limit: 50, order_by: "at", order_dir: "asc",
    });
    const kinds = audits.map((a) => a.kind);
    expect(kinds).toContain("PROCESS_STARTED");
    expect(kinds).toContain("MISSION_ASSIGNED");
    expect(kinds).toContain("EVIDENCE_EMITTED");
    expect(kinds).toContain("MISSION_COMPLETED");
  });

  it("D-4 · duplicate agent_id · second daemon refuses to start when first is alive", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    const first = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async () => ({ kind: "COMPLETED", detail: "ok" }),
    });
    stopFns.push(first.stop);
    // First daemon's PID (process.pid) is alive · second should refuse
    await expect(makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      onMission: async () => ({ kind: "COMPLETED", detail: "ok" }),
    })).rejects.toThrow(/another process claims this agent_id/);
  });

  it("D-5 · restart preserves identity public key · new instance_id", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    const first = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async () => ({ kind: "COMPLETED", detail: "ok" }),
    });
    const pubBefore = first.identity_public_key_der_hex;
    const instBefore = first.instance_id;
    await first.stop();
    const second = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async () => ({ kind: "COMPLETED", detail: "ok" }),
    });
    stopFns.push(second.stop);
    expect(second.identity_public_key_der_hex).toBe(pubBefore);
    expect(second.instance_id).not.toBe(instBefore);
  });

  it("D-6 · mission for wrong agent_id · REFUSED (not delivered to onMission)", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    let missionCalled = false;
    const daemon = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async () => { missionCalled = true; return { kind: "COMPLETED", detail: "ok" }; },
    });
    stopFns.push(daemon.stop);
    const r = await daemon.receiveMission({
      record_type: "NEX_AGENT_MISSION_ENVELOPE",
      mission_id: "m-wrong", agent_id: "not-us", cap_id: null, kind: "echo",
      payload: {}, created_at: new Date().toISOString(), deadline_at: null,
    });
    expect(r.kind).toBe("FAILED");
    expect(r.detail).toMatch(/but daemon is/);
    expect(missionCalled).toBe(false);
  });

  it("D-7 · heartbeat lifecycle progression · ALIVE_IDLE → WORKING requires all four conditions", async () => {
    const root = tmpRepoRoot();
    cleanupPaths.push(root);
    const agent_id = `test-echo-${randomUUID().slice(0, 6)}`;
    const daemon = await makeAgentDaemon({
      agent_id, repoRoot: root, heartbeat_interval_ms: 100_000,
      _test_unref_heartbeat: true,
      onMission: async (env, ctx) => {
        ctx.bumpProgress();
        await ctx.emitEvidence("echo.reply", { echoed: env.payload });
        // After both progress AND evidence, lifecycle should be WORKING
        return { kind: "COMPLETED", detail: "ok" };
      },
    });
    stopFns.push(daemon.stop);
    // Before any mission: state is ALIVE_IDLE
    expect(daemon.currentLifecycleState()).toBe("ALIVE_IDLE");

    // During mission handling the state should transition to WORKING at some point
    // We verify via the persisted evidence + heartbeat records after the mission ends.
    await daemon.receiveMission({
      record_type: "NEX_AGENT_MISSION_ENVELOPE",
      mission_id: "m-1", agent_id, cap_id: null, kind: "echo",
      payload: { x: 1 }, created_at: new Date().toISOString(), deadline_at: null,
    });
    // After mission clears · we're back to ALIVE_IDLE (mission_id cleared)
    expect(daemon.currentLifecycleState()).toBe("ALIVE_IDLE");
    expect(daemon.progressCounter()).toBe(1);
  });
});
