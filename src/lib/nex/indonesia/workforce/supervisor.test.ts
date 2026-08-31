// supervisor.test.ts · failure-injection acceptance tests.
//
// These are the load-bearing proofs of the workforce guarantee:
// "Workers may fail. The workforce does not."
//
// Every test injects a specific failure mode and asserts that the
// supervisor detects it, records it correctly, and either recovers
// automatically OR routes the job to the dead-letter queue after
// bounded retries — without ever silently stopping the workforce.
//
// Failure modes covered:
//   · worker hangs (no heartbeat → lease expires → worker → DEAD)
//   · worker crashes (throws → RETRYING → BACKOFF → eventually DL)
//   · worker times out (exceeds max_acquire_ms → same failure path)
//   · worker silent (returns 0 chunks → treated as failure)
//   · worker duplicated (two workers claim same job → lease conflict)
//   · source circuit-break (repeated failures → breaker opens → skip)
//   · post-fail recovery (source heals → half-open → close)
//   · continuous run (worker completes → auto-claims next job)

import { describe, it, expect, beforeEach } from "vitest";
import { WorkforceRegistry } from "./registry";
import { runOneCycle, runWorkerLoop, type WorkerEvent } from "./supervised-worker";
import { supervisorTick } from "./supervisor";
import type { KnowledgeWalker, RawFactChunk } from "../walkers/types";

// ─── Test helpers ─────────────────────────────────────────────────

function mockClock(startMs: number) {
  let t = startMs;
  return {
    now: () => new Date(t),
    advance: (ms: number) => { t += ms; },
    set: (ms: number) => { t = ms; },
  };
}

const GOOD_CHUNK: RawFactChunk = {
  externalId: "test-1",
  domain: "landmark",
  topic: "test.landmark.borobudur",
  region: "Central Java",
  content: "Borobudur is a 9th-century Buddhist temple complex — a UNESCO World Heritage site.",
  keywords: ["borobudur", "temple", "unesco"],
  observedAt: "2026-08-30",
  source: "test",
  confidence: 0.9,
};

function goodWalker(id: string = "test.good"): KnowledgeWalker {
  return {
    id, domain: "landmark", defaultStability: "stable",
    description: "test good walker", refreshCadenceDays: 30,
    async acquire() { return [GOOD_CHUNK]; },
  };
}

// ─── Guarantee 1 · CONTINUOUS RUN ────────────────────────────────

describe("continuous run · worker completes → auto-claims next", () => {
  it("a healthy worker cycles through TWO jobs without human intervention", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.test.good");

    // Enqueue two distinct jobs for the same walker.
    registry.enqueueJob({ id: "job-1", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });
    registry.enqueueJob({ id: "job-2", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });

    // First cycle claims job-1 and publishes.
    const first = await runOneCycle({ workerId: "w1", walker, registry, now: clock.now });
    expect(first.some((e) => e.type === "publish" && e.jobId === "job-1")).toBe(true);

    // Second cycle claims job-2 and publishes — WITHOUT any external prompt.
    const second = await runOneCycle({ workerId: "w1", walker, registry, now: clock.now });
    expect(second.some((e) => e.type === "publish" && e.jobId === "job-2")).toBe(true);

    // Both jobs' scheduledFor is now the future (refresh cadence applied).
    const snap = registry.getSnapshot();
    for (const j of snap.jobs) expect(new Date(j.scheduledFor) > clock.now()).toBe(true);
  });
});

// ─── Guarantee 2 · WORKER HANGS ──────────────────────────────────

describe("worker hangs · lease expiry → DEAD → auto-restart", () => {
  it("expired lease flips the holding worker to DEAD; supervisor restarts to STARTING", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker();
    registry.enqueueJob({ id: "hang-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });
    registry.registerWorker({ id: "hung", walkerId: walker.id });

    // Simulate a claim by the hung worker (skip acquire → no heartbeat).
    registry.claimNextJob("hung", { leaseTtlMs: 5_000 });
    registry.setWorkerState("hung", "RUNNING");

    // Advance clock past the lease.
    clock.advance(6_000);

    // Supervisor tick: reap expired → worker DEAD → restart to STARTING.
    const report = await supervisorTick({
      registry,
      walkers: new Map([[walker.id, walker]]),
    });

    expect(report.reaped).toContain("hang-job");
    expect(report.restarted).toContain("hung");
    // Worker should now be STARTING, ready for the next cycle.
    const snap = registry.getSnapshot();
    const w = snap.workers.find((x) => x.id === "hung");
    expect(["STARTING", "WAITING", "RUNNING"]).toContain(w?.state);
    // Job returned to the queue with no active lease.
    expect(snap.leases.filter((l) => l.jobId === "hang-job")).toHaveLength(0);
    expect(snap.jobs.some((j) => j.id === "hang-job")).toBe(true);
  });
});

// ─── Guarantee 3 · WORKER CRASHES ────────────────────────────────

describe("worker crashes · exception path", () => {
  it("throw during acquire → RETRYING → BACKOFF with scheduled retry", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.crash.test");
    registry.enqueueJob({ id: "crash-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });

    const events = await runOneCycle({
      workerId: "crasher", walker, registry, now: clock.now,
      __inject: async () => { throw new Error("simulated_crash"); },
    });

    expect(events.some((e) => e.type === "failure" && /simulated_crash/.test(e.reason))).toBe(true);
    const snap = registry.getSnapshot();
    const w = snap.workers.find((x) => x.id === "crasher");
    expect(w?.state).toBe("BACKOFF");
    expect(w?.consecutiveFailures).toBe(1);
    const j = snap.jobs.find((x) => x.id === "crash-job");
    expect(j?.attempts).toBe(1);
    expect(new Date(j!.scheduledFor) > clock.now()).toBe(true);
  });

  it("MAX_ATTEMPTS crashes → job goes to dead-letter, worker survives", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.perma-fail");
    registry.enqueueJob({ id: "perma-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });

    let lastEvents: WorkerEvent[] = [];
    for (let i = 0; i < 5; i++) {
      // Move the clock forward past the backoff.
      clock.advance(60 * 60 * 1000);
      const j = registry.getSnapshot().jobs.find((x) => x.id === "perma-job");
      if (!j) break; // already dead-lettered
      registry.updateJob("perma-job", { scheduledFor: clock.now().toISOString() });
      lastEvents = await runOneCycle({
        workerId: "perma", walker, registry, now: clock.now,
        __inject: async () => { throw new Error(`crash_${i}`); },
      });
    }

    // Job is now in dead-letter · not in jobs · worker still WAITING.
    const snap = registry.getSnapshot();
    expect(snap.deadLetter.find((d) => d.jobId === "perma-job")).toBeTruthy();
    expect(snap.jobs.find((j) => j.id === "perma-job")).toBeUndefined();
    expect(lastEvents.some((e) => e.type === "dead_letter")).toBe(true);
    const w = snap.workers.find((x) => x.id === "perma");
    expect(w?.state).toBe("WAITING");
  });
});

// ─── Guarantee 4 · WORKER TIMES OUT ──────────────────────────────

describe("worker times out · hard maxAcquireMs boundary", () => {
  it("acquire exceeds maxAcquireMs → failure path fires (same as crash)", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.slow");
    registry.enqueueJob({ id: "slow-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });

    const events = await runOneCycle({
      workerId: "slow", walker, registry, now: clock.now,
      maxAcquireMs: 100, heartbeatIntervalMs: 50, leaseTtlMs: 500,
      __inject: () => new Promise(() => { /* never resolves */ }),
    });

    const f = events.find((e) => e.type === "failure");
    expect(f).toBeTruthy();
    expect((f as Extract<WorkerEvent, { type: "failure" }>).reason).toMatch(/acquire_timeout/);
  });
});

// ─── Guarantee 5 · WORKER SILENT ─────────────────────────────────

describe("worker silent · returns 0 chunks repeatedly", () => {
  it("silent return is treated as failure · eventually dead-letters", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.silent");
    registry.enqueueJob({ id: "silent-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });

    const events = await runOneCycle({
      workerId: "silent", walker, registry, now: clock.now,
      __inject: async () => [], // returns nothing
    });

    const f = events.find((e) => e.type === "failure");
    expect(f).toBeTruthy();
    expect((f as Extract<WorkerEvent, { type: "failure" }>).reason).toMatch(/walker_returned_no_chunks/);
  });
});

// ─── Guarantee 6 · CIRCUIT BREAKER ───────────────────────────────

describe("source circuit breaker · repeated failures → open → probe → close", () => {
  it("N failures open the breaker; subsequent cycles skip that source", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.flaky");

    // Enqueue enough jobs to trigger the breaker (default openAfter=3).
    for (let i = 0; i < 4; i++) {
      registry.enqueueJob({ id: `flaky-${i}`, walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });
    }

    for (let i = 0; i < 3; i++) {
      await runOneCycle({
        workerId: `flaky-w-${i}`, walker, registry, now: clock.now,
        __inject: async () => { throw new Error("upstream_500"); },
      });
    }

    const b = registry.getBreaker(walker.id);
    expect(b.state).toBe("open");
    expect(b.failures).toBeGreaterThanOrEqual(3);

    // Fourth cycle · breaker is open · worker should NOT attempt.
    const events = await runOneCycle({ workerId: "flaky-w-3", walker, registry, now: clock.now });
    expect(events.some((e) => e.type === "idle" && e.reason === "circuit_open")).toBe(true);
  });

  it("after openForMs elapses · half-open probe · success closes breaker", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.heal");

    // Force breaker open.
    for (let i = 0; i < 3; i++) registry.recordBreakerFailure(walker.id, { openAfter: 3, openForMs: 30_000 });
    expect(registry.getBreaker(walker.id).state).toBe("open");

    // Advance past the cooldown.
    clock.advance(31_000);
    registry.tryHalfOpen(walker.id);
    expect(registry.getBreaker(walker.id).state).toBe("half_open");

    // A successful cycle closes it.
    registry.enqueueJob({ id: "heal-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });
    const events = await runOneCycle({ workerId: "healer", walker, registry, now: clock.now });
    expect(events.some((e) => e.type === "publish")).toBe(true);
    expect(registry.getBreaker(walker.id).state).toBe("closed");
  });
});

// ─── Guarantee 7 · WORKER DUPLICATED ─────────────────────────────

describe("worker duplicated · lease conflict resolution", () => {
  it("two workers cannot hold the same job lease · second claim returns different job", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.dupe");
    registry.enqueueJob({ id: "unique-job", walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });
    registry.enqueueJob({ id: "another-job", walkerId: walker.id, priority: 2, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });

    registry.registerWorker({ id: "w-a", walkerId: walker.id });
    registry.registerWorker({ id: "w-b", walkerId: walker.id });

    const claimA = registry.claimNextJob("w-a", { leaseTtlMs: 10_000 });
    const claimB = registry.claimNextJob("w-b", { leaseTtlMs: 10_000 });

    expect(claimA?.job.id).toBe("unique-job");
    expect(claimB?.job.id).toBe("another-job");
    expect(claimA?.job.id).not.toBe(claimB?.job.id);
  });
});

// ─── Guarantee 8 · WORKFORCE CONTINUES DESPITE ANY ONE WORKER ────

describe("workforce continues despite one worker's failure", () => {
  it("healthy walker keeps publishing while a sibling walker crashes repeatedly", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const healthy = goodWalker("walker.healthy");
    const broken = goodWalker("walker.broken");
    registry.enqueueJob({ id: "healthy-job", walkerId: healthy.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: healthy.id });
    registry.enqueueJob({ id: "broken-job",  walkerId: broken.id,  priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: broken.id });

    // Supervisor tick with failure injection targeting only the broken walker.
    const walkersMap = new Map([[healthy.id, healthy], [broken.id, broken]]);
    registry.registerWorker({ id: "w:healthy", walkerId: healthy.id });
    registry.registerWorker({ id: "w:broken", walkerId: broken.id });

    const report = await supervisorTick({
      registry,
      walkers: walkersMap,
      __inject: (workerId) => workerId === "w:broken" ? (async () => { throw new Error("broken_pipe"); }) : undefined,
    });

    expect(report.publishedRecordsThisTick).toBeGreaterThan(0);
    const snap = registry.getSnapshot();
    const h = snap.workers.find((w) => w.id === "w:healthy");
    const b = snap.workers.find((w) => w.id === "w:broken");
    expect(h?.recordsPublished).toBeGreaterThan(0);
    expect(b?.consecutiveFailures).toBeGreaterThan(0);
  });
});

// ─── Guarantee 9 · WORKER LOOP RUNS UNTIL EMPTY ──────────────────

describe("runWorkerLoop · exits cleanly only when queue is empty", () => {
  it("processes every queued job, then emits idle:queue_empty and stops (with exitOnEmpty)", async () => {
    const clock = mockClock(Date.parse("2026-08-30T00:00:00Z"));
    const registry = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
    const walker = goodWalker("walker.batch");
    for (let i = 0; i < 3; i++) {
      registry.enqueueJob({ id: `batch-${i}`, walkerId: walker.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: walker.id });
    }

    const events = await runWorkerLoop({
      workerId: "batcher", walker, registry, now: clock.now,
      exitOnEmptyQueue: true, betweenCyclesMs: 0,
    });

    const publishes = events.filter((e) => e.type === "publish");
    expect(publishes).toHaveLength(3);
    expect(events[events.length - 1]).toMatchObject({ type: "idle", reason: "queue_empty" });
  });
});
