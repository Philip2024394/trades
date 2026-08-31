// outer-recovery.test.ts · OUTER-layer failure-injection tests.
//
// Layer A (worker self-healing) already covered by supervisor.test.ts.
// THIS file proves Layer B: even when the supervisor PROCESS itself
// dies, hangs, or the state file corrupts, the outer watchdog +
// registry recovery keep the workforce alive.
//
// Failure modes covered here:
//   · supervisor crash → watchdog restarts it
//   · supervisor alive but no progress → watchdog kills + restarts
//   · state file corrupt → registry loads empty, continues
//   · interrupted write (tmp file exists) → cleaned up
//   · state restart preserves checkpoints
//   · startup sweep releases stale leases
//   · queue starvation → supervisor tick regenerates
//   · watchdog restart budget prevents infinite crash loop

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorkforceRegistry } from "./registry";
import { supervisorTick } from "./supervisor";
import { runOuterWatchdog } from "./outer-watchdog";
import type { KnowledgeWalker } from "../walkers/types";
import type { WalkerSpec } from "../walkers/taxonomy";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { EventEmitter } from "node:events";
import path from "node:path";
import { tmpdir } from "node:os";

// ─── Helpers ──────────────────────────────────────────────────────

function mockClock(startMs: number) {
  let t = startMs;
  return {
    now: () => new Date(t),
    advance: (ms: number) => { t += ms; },
  };
}

function tmpFile(prefix: string): string {
  return path.join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const GOOD_CHUNK = {
  externalId: "gc", domain: "landmark" as const,
  topic: "test.landmark", region: "Central Java",
  content: "A test record long enough to pass validation on the pipeline side.",
  keywords: ["kw1", "kw2"], observedAt: "2026-08-30",
  source: "test", confidence: 0.9,
};

function goodWalker(id = "test.walker"): KnowledgeWalker {
  return {
    id, domain: "landmark", defaultStability: "stable",
    description: "test", refreshCadenceDays: 30,
    async acquire() { return [GOOD_CHUNK]; },
  };
}

function activeSpec(id: string): WalkerSpec {
  return { id, branch: "destinations", purpose: "test", status: "active", priority: 1, sources: [] };
}

// ─── STATE PERSISTENCE + RECOVERY ─────────────────────────────────

describe("state persistence · atomic write recovery", () => {
  it("interrupted write leaves a stale .tmp file · cleaned up on next load", () => {
    const stateFile = tmpFile("workforce");
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile + ".tmp", "{corrupt half-write");

    // Load registry · should not blow up · tmp file should be gone.
    const r = new WorkforceRegistry({ stateFile });
    expect(existsSync(stateFile + ".tmp")).toBe(false);
    expect(r.getSnapshot().workers).toEqual([]);

    // cleanup
    if (existsSync(stateFile)) rmSync(stateFile);
  });

  it("corrupt state file → registry loads empty snapshot (never crashes)", () => {
    const stateFile = tmpFile("workforce-corrupt");
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, "not json at all {{{{{{");

    const r = new WorkforceRegistry({ stateFile });
    const snap = r.getSnapshot();
    expect(snap.workers).toEqual([]);
    expect(snap.jobs).toEqual([]);
    expect(snap.leases).toEqual([]);

    if (existsSync(stateFile)) rmSync(stateFile);
  });

  it("state written by registry survives process restart with checkpoints preserved", () => {
    const stateFile = tmpFile("workforce-persist");

    // Process 1 · write state.
    const r1 = new WorkforceRegistry({ stateFile });
    r1.registerWorker({ id: "w1", walkerId: "walker.test" });
    r1.enqueueJob({ id: "j1", walkerId: "walker.test", priority: 1, scheduledFor: "2026-08-30T00:00:00Z", sourceKey: "walker.test" });
    r1.updateJob("j1", { checkpoint: { last: "record-42" } });

    // Process 2 · fresh registry reads the same file.
    const r2 = new WorkforceRegistry({ stateFile });
    const snap = r2.getSnapshot();
    expect(snap.workers.length).toBe(1);
    expect(snap.jobs.length).toBe(1);
    expect(snap.jobs[0].checkpoint).toEqual({ last: "record-42" });

    if (existsSync(stateFile)) rmSync(stateFile);
  });

  it("startup sweep · stale leases released, workers marked DEAD for restart", () => {
    const stateFile = tmpFile("workforce-stale");
    const clock1 = mockClock(Date.parse("2026-08-30T00:00:00Z"));

    // Process 1 · claim a job then die without releasing.
    const r1 = new WorkforceRegistry({ stateFile, now: clock1.now });
    r1.registerWorker({ id: "dead-w", walkerId: "walker.test" });
    r1.enqueueJob({ id: "stuck", walkerId: "walker.test", priority: 1, scheduledFor: clock1.now().toISOString(), sourceKey: "walker.test" });
    r1.claimNextJob("dead-w", { leaseTtlMs: 1000 });

    // Simulate process restart much later · lease is now stale.
    const clock2 = mockClock(Date.parse("2026-08-30T01:00:00Z"));
    const r2 = new WorkforceRegistry({ stateFile, now: clock2.now });
    const snap = r2.getSnapshot();
    expect(snap.leases).toEqual([]);
    const w = snap.workers.find((x) => x.id === "dead-w");
    expect(w?.state).toBe("DEAD");
    expect(w?.currentJobId).toBeNull();

    if (existsSync(stateFile)) rmSync(stateFile);
  });
});

// ─── QUEUE REGENERATION ──────────────────────────────────────────

describe("queue regeneration · empty queue is not permanent", () => {
  it("supervisor tick with taxonomySpecs enqueues jobs for active walkers when queue is empty", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.regen");
    const spec = activeSpec("walker.regen");

    // Empty queue at start.
    expect(registry.getSnapshot().jobs).toHaveLength(0);

    const report = await supervisorTick({
      registry,
      walkers: new Map([[walker.id, walker]]),
      taxonomySpecs: [spec],
      now: clock.now,
    });

    // Queue is no longer empty · workforce has work to do.
    expect(report.regenerated.length).toBeGreaterThan(0);
    expect(registry.getSnapshot().jobs.length).toBeGreaterThan(0);
  });

  it("regeneration does NOT re-enqueue jobs already in dead-letter", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.priorityc");
    const spec: WalkerSpec = { ...activeSpec("walker.priorityc"), priority: 3 }; // one-per-spec (not sharded)

    // Manually seed dead-letter with the job id the planner would produce.
    registry.moveToDeadLetter({
      jobId: "job:walker.priorityc",
      walkerId: "walker.priorityc",
      failedAt: clock.now().toISOString(),
      attempts: 5, reason: "test",
      errorHistory: [{ at: clock.now().toISOString(), reason: "test" }],
    });

    const report = await supervisorTick({
      registry,
      walkers: new Map([[walker.id, walker]]),
      taxonomySpecs: [spec],
      now: clock.now,
    });

    expect(report.regenerated).not.toContain("job:walker.priorityc");
  });
});

// ─── SUPERVISOR HEARTBEAT ────────────────────────────────────────

describe("supervisor heartbeat · watchdog signal", () => {
  it("every tick stamps supervisorHeartbeat.lastTickAt", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("w.hb");

    await supervisorTick({
      registry,
      walkers: new Map([[walker.id, walker]]),
      taxonomySpecs: [activeSpec("w.hb")],
      now: clock.now,
    });

    const hb = registry.getSnapshot().supervisorHeartbeat;
    expect(hb?.lastTickAt).toBeTruthy();
    expect(hb?.ticksTotal).toBeGreaterThan(0);
  });

  it("meaningful tick sets lastSuccessfulTickAt · empty tick does not", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });

    // No walkers · empty tick.
    await supervisorTick({ registry, walkers: new Map(), now: clock.now });
    let hb = registry.getSnapshot().supervisorHeartbeat;
    expect(hb?.lastTickAt).toBeTruthy();
    expect(hb?.lastSuccessfulTickAt).toBeUndefined();

    // Meaningful tick with a walker + regeneration.
    const walker = goodWalker("w.meaningful");
    await supervisorTick({
      registry,
      walkers: new Map([[walker.id, walker]]),
      taxonomySpecs: [activeSpec("w.meaningful")],
      now: clock.now,
    });
    hb = registry.getSnapshot().supervisorHeartbeat;
    expect(hb?.lastSuccessfulTickAt).toBeTruthy();
  });
});

// ─── OUTER WATCHDOG · FAKE-CHILD FAILURE INJECTION ───────────────

class FakeChild extends EventEmitter {
  killed = false;
  kill() { this.killed = true; setTimeout(() => this.emit("exit", 1, null), 5); }
}

describe("outer watchdog · child crash restart", () => {
  it("child exits → watchdog respawns", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const stateFile = tmpFile("wd-crash");
    const controller = new AbortController();

    const spawned: FakeChild[] = [];
    const fakeSpawn = ((..._args: unknown[]) => {
      const c = new FakeChild();
      spawned.push(c);
      // Simulate the child crashing after being spawned.
      setTimeout(() => c.emit("exit", 1, null), 20);
      return c as unknown as ReturnType<typeof import("node:child_process").spawn>;
    }) as unknown as typeof import("node:child_process").spawn;

    // Abort quickly so we don't loop forever.
    setTimeout(() => controller.abort(), 400);

    const result = await runOuterWatchdog({
      command: "node", args: ["fake.mjs"], cwd: process.cwd(),
      checkIntervalMs: 30, restartBackoffMs: 10, maxRestartBackoffMs: 50,
      progressStaleMs: 1_000_000, heartbeatStaleMs: 1_000_000,
      stateFile, incidentLog: tmpFile("wd-incidents"),
      signal: controller.signal, __spawn: fakeSpawn, now: () => new Date(),
    });

    // Multiple spawns confirm restarts happened.
    expect(spawned.length).toBeGreaterThanOrEqual(2);
    expect(result.incidents.some((i) => i.kind === "spawn")).toBe(true);
    expect(result.incidents.some((i) => i.kind === "exit")).toBe(true);
    expect(result.restarts).toBeGreaterThan(0);
  });

  it("stale heartbeat → watchdog kills + respawns child", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const stateFile = tmpFile("wd-stale");
    mkdirSync(path.dirname(stateFile), { recursive: true });
    // Seed state with a heartbeat that's already stale.
    writeFileSync(stateFile, JSON.stringify({
      schemaVersion: 1,
      takenAt: "2026-08-30T00:00:00Z",
      workers: [], jobs: [], leases: [], breakers: [], deadLetter: [],
      metrics: { recordsToday: 0, acquisitionsToday: 0, failuresToday: 0 },
      supervisorHeartbeat: {
        lastTickAt: "2026-08-30T00:00:00Z",
        processStartedAt: "2026-08-30T00:00:00Z",
        ticksTotal: 5,
      },
    }));

    const controller = new AbortController();
    const spawned: FakeChild[] = [];
    const fakeSpawn = ((..._args: unknown[]) => {
      const c = new FakeChild();
      spawned.push(c);
      return c as unknown as ReturnType<typeof import("node:child_process").spawn>;
    }) as unknown as typeof import("node:child_process").spawn;

    // Clock advances 5 minutes past the seeded heartbeat, so it's stale.
    let t = Date.parse("2026-08-30T00:05:00Z");
    const now = () => new Date(t);

    setTimeout(() => controller.abort(), 300);
    await runOuterWatchdog({
      command: "node", args: ["fake.mjs"], cwd: process.cwd(),
      checkIntervalMs: 30, restartBackoffMs: 10,
      progressStaleMs: 1_000_000, heartbeatStaleMs: 30_000, // 30s stale threshold
      stateFile, incidentLog: tmpFile("wd-incidents-2"),
      signal: controller.signal, __spawn: fakeSpawn, now,
    });

    // First spawn happens, then watchdog notices stale heartbeat, kills, respawns.
    expect(spawned.length).toBeGreaterThanOrEqual(2);
    if (existsSync(stateFile)) rmSync(stateFile);
  });

  it("restart-budget prevents crash-loop hammering", async () => {
    const stateFile = tmpFile("wd-budget");
    const controller = new AbortController();
    const spawned: FakeChild[] = [];
    const fakeSpawn = ((..._args: unknown[]) => {
      const c = new FakeChild();
      spawned.push(c);
      setTimeout(() => c.emit("exit", 1, null), 5);
      return c as unknown as ReturnType<typeof import("node:child_process").spawn>;
    }) as unknown as typeof import("node:child_process").spawn;

    setTimeout(() => controller.abort(), 500);
    const result = await runOuterWatchdog({
      command: "node", args: ["fake.mjs"], cwd: process.cwd(),
      checkIntervalMs: 15, restartBackoffMs: 5, maxRestartBackoffMs: 20,
      progressStaleMs: 1_000_000, heartbeatStaleMs: 1_000_000,
      restartBudget: 3, restartWindowMs: 10_000, coolDownMs: 200,
      stateFile, incidentLog: tmpFile("wd-incidents-3"),
      signal: controller.signal, __spawn: fakeSpawn, now: () => new Date(),
    });

    expect(result.incidents.some((i) => i.kind === "budget_exhausted")).toBe(true);
  });
});
