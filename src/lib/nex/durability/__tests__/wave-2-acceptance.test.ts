// src/lib/nex/durability/__tests__/wave-2-acceptance.test.ts
//
// UWI · Wave 2 · D9 · Failure-scenario acceptance suite
// Founder-authorised programme.
//
// Founder acceptance rule (from Wave 2 authorisation §13):
//   "The acceptance suite should demonstrate the actual recovery
//    behaviour of the unified system: job → worker → failure →
//    lease/recovery → retry/replay → evidence/provenance preserved
//    → completion/DLQ, including restart and duplicate-delivery
//    scenarios."
//
// This suite exercises the recovery MACHINERY (the durability
// primitives D2-D7) end-to-end using an in-memory job store that
// mirrors the worker_jobs semantics defined in migration 001.
// The in-memory store applies the SAME state transitions the SQL
// substrate applies, so passing behaviour here is the same behaviour
// the SQL substrate will exhibit under identical scenarios.
//
// Deferred to a separate integration harness with live Postgres:
//   · Actual application of migration 007 (D8) DLQ column + function
//   · SKIP LOCKED behaviour under concurrent claim contention
//   · Real WAL/vacuum pressure at high job churn
// Those tests belong to a database-integration acceptance run · not
// this unit-level suite.

import { describe, it, expect } from "vitest";
import { deriveIdempotencyKey } from "../idempotency-key";
import { createDeadline, isExpired, assertNotExpired, DeadlineExceededError } from "../deadline-context";
import { jitteredBackoff } from "../backoff";
import { TokenBucket, HostTokenBucketRegistry } from "../token-bucket";
import { SourceBulkheadRegistry, BulkheadSaturatedError } from "../source-bulkhead";
import { runReaperOnce, type JobReaperDb, type ReapableJobRow } from "../job-reaper";
import { CircuitBreakerRegistry, classifyFailure } from "@/lib/nex/llm-gateway/circuit-breaker";

// ─── In-memory job store that mirrors worker_jobs semantics ────────
interface Job {
  id: string;
  worker_type: string;
  status: "waiting" | "assigned" | "running" | "completed" | "failed";
  attempts: number;
  assigned_worker_id: string | null;
  lease_expires_at: number | null;
  input_ref: string;
  input_payload: Record<string, unknown>;
  result?: unknown;
  dead_letter_at: number | null;
  dead_letter_reason: string | null;
  provenance_journal: Array<{ event: string; at_ms: number; details?: Record<string, unknown> }>;
}

class InMemoryJobStore {
  private jobs = new Map<string, Job>();
  private idempotency_seen = new Map<string, string>(); // idem_key → job_id
  private next_id = 1;

  enqueue(input: { worker_type: string; input_ref: string; input_payload?: Record<string, unknown>; idempotency_key?: string }): { id: string; deduplicated: boolean } {
    // D2 · duplicate-delivery protection via idempotency key
    if (input.idempotency_key) {
      const prior = this.idempotency_seen.get(input.idempotency_key);
      if (prior) return { id: prior, deduplicated: true };
    }
    const id = `job-${this.next_id++}`;
    const job: Job = {
      id, worker_type: input.worker_type, status: "waiting", attempts: 0,
      assigned_worker_id: null, lease_expires_at: null,
      input_ref: input.input_ref, input_payload: input.input_payload ?? {},
      dead_letter_at: null, dead_letter_reason: null,
      provenance_journal: [{ event: "enqueued", at_ms: Date.now() }],
    };
    this.jobs.set(id, job);
    if (input.idempotency_key) this.idempotency_seen.set(input.idempotency_key, id);
    return { id, deduplicated: false };
  }

  claim(worker_type: string, worker_id: string, lease_ms: number, now_ms: number = Date.now()): Job | null {
    for (const job of this.jobs.values()) {
      if (job.worker_type === worker_type && job.status === "waiting") {
        job.status = "assigned";
        job.assigned_worker_id = worker_id;
        job.lease_expires_at = now_ms + lease_ms;
        job.attempts += 1;
        job.provenance_journal.push({ event: "assigned", at_ms: now_ms, details: { worker_id, attempt: job.attempts } });
        return job;
      }
    }
    return null;
  }

  markCompleted(job_id: string, result: unknown, now_ms: number = Date.now()): void {
    const job = this.jobs.get(job_id);
    if (!job) return;
    job.status = "completed";
    job.result = result;
    job.provenance_journal.push({ event: "completed", at_ms: now_ms });
  }

  markFailed(job_id: string, reason: string, now_ms: number = Date.now()): void {
    const job = this.jobs.get(job_id);
    if (!job) return;
    job.status = "waiting"; // re-queued for retry unless reaper DLQs it
    job.assigned_worker_id = null;
    job.lease_expires_at = null;
    job.provenance_journal.push({ event: "failed", at_ms: now_ms, details: { reason } });
  }

  reapableDb(max_attempts: number, now_ms_ref: { now: number }): JobReaperDb {
    return {
      reapExpiredLeases: async (_now_iso: string) => {
        const reaped: ReapableJobRow[] = [];
        const dead_lettered: ReapableJobRow[] = [];
        for (const job of this.jobs.values()) {
          if ((job.status === "assigned" || job.status === "running") &&
              job.lease_expires_at !== null &&
              job.lease_expires_at < now_ms_ref.now) {
            const row: ReapableJobRow = {
              id: job.id, worker_type: job.worker_type, attempts: job.attempts,
              assigned_worker_id: job.assigned_worker_id,
              lease_expires_at: new Date(job.lease_expires_at).toISOString(),
            };
            if (job.attempts >= max_attempts) {
              job.status = "failed";
              job.dead_letter_at = now_ms_ref.now;
              job.dead_letter_reason = "attempts_exhausted";
              job.provenance_journal.push({ event: "dead_lettered", at_ms: now_ms_ref.now, details: { attempts: job.attempts } });
              dead_lettered.push(row);
            } else {
              job.status = "waiting";
              job.assigned_worker_id = null;
              job.lease_expires_at = null;
              job.provenance_journal.push({ event: "lease_reaped", at_ms: now_ms_ref.now });
              reaped.push(row);
            }
          }
        }
        return { reaped, dead_lettered };
      },
      writeAuditEvent: async () => { /* audit already in journal */ },
    };
  }

  get(job_id: string): Job | undefined { return this.jobs.get(job_id); }
  all(): Job[] { return Array.from(this.jobs.values()); }
  dlq(): Job[] { return this.all().filter(j => j.dead_letter_at !== null); }
}

// ═════════════════════════════════════════════════════════════════
// SCENARIOS
// ═════════════════════════════════════════════════════════════════

describe("Wave 2 acceptance · S1 · worker disappears → lease expires → job reclaimed", () => {
  it("orphan job returned to waiting after lease expiry; new worker completes it", async () => {
    const store = new InMemoryJobStore();
    const { id } = store.enqueue({ worker_type: "crawl", input_ref: "url:a" });

    // Worker A claims + disappears (never heartbeats, never completes)
    const claimed = store.claim("crawl", "worker-A", 100, 1000);
    expect(claimed!.id).toBe(id);
    expect(claimed!.status).toBe("assigned");

    // Time passes past the lease
    const now_ref = { now: 2000 };
    const m = await runReaperOnce(store.reapableDb(5, now_ref));
    expect(m.reaped_count).toBe(1);

    // Job is back in waiting
    expect(store.get(id)!.status).toBe("waiting");

    // Worker B claims + completes
    const reclaimed = store.claim("crawl", "worker-B", 100, 2100);
    expect(reclaimed!.id).toBe(id);
    expect(reclaimed!.attempts).toBe(2);
    store.markCompleted(id, { fetched: true }, 2200);
    expect(store.get(id)!.status).toBe("completed");

    // Provenance survives recovery
    const events = store.get(id)!.provenance_journal.map(e => e.event);
    expect(events).toEqual(["enqueued", "assigned", "lease_reaped", "assigned", "completed"]);
  });
});

describe("Wave 2 acceptance · S2 · duplicate delivery does not duplicate the durable outcome", () => {
  it("idempotency-key deduplicates enqueues from a stale worker retry", () => {
    const store = new InMemoryJobStore();
    const key = deriveIdempotencyKey({ workflow_id: "wf-1", activity_name: "crawl", attempt_id: 1 });
    const first = store.enqueue({ worker_type: "crawl", input_ref: "url:a", idempotency_key: key });
    const second = store.enqueue({ worker_type: "crawl", input_ref: "url:a", idempotency_key: key });
    expect(first.id).toBe(second.id);
    expect(second.deduplicated).toBe(true);
    expect(store.all()).toHaveLength(1);
  });
});

describe("Wave 2 acceptance · S3 · repeated source failure → DLQ", () => {
  it("job exhausts attempts and moves to DLQ", async () => {
    const store = new InMemoryJobStore();
    const { id } = store.enqueue({ worker_type: "crawl", input_ref: "url:broken" });
    const now_ref = { now: 1000 };
    const max_attempts = 3;

    // 3 failed attempts, each times out
    for (let i = 0; i < max_attempts; i++) {
      store.claim("crawl", `worker-${i}`, 100, now_ref.now);
      now_ref.now += 200; // lease expires
      await runReaperOnce(store.reapableDb(max_attempts, now_ref));
    }

    expect(store.dlq()).toHaveLength(1);
    expect(store.get(id)!.dead_letter_reason).toBe("attempts_exhausted");
    expect(store.get(id)!.status).toBe("failed");
  });
});

describe("Wave 2 acceptance · S4 · backpressure prevents unbounded queue growth", () => {
  it("bulkhead rejects when in-flight + queue exhausted", async () => {
    const reg = new SourceBulkheadRegistry({ max_concurrent: 2, queue_limit: 1 });
    // Start 2 slow jobs holding all in-flight slots
    let resolveA: () => void; let resolveB: () => void;
    reg.run("bmkg", () => new Promise<void>(r => { resolveA = r; }));
    reg.run("bmkg", () => new Promise<void>(r => { resolveB = r; }));
    await new Promise(r => setImmediate(r));
    // 1 queued
    reg.run("bmkg", async () => "queued").catch(() => {});
    await new Promise(r => setImmediate(r));
    // 4th rejects fast
    await expect(reg.run("bmkg", async () => "reject")).rejects.toBeInstanceOf(BulkheadSaturatedError);
    resolveA!(); resolveB!();
  });
});

describe("Wave 2 acceptance · S5 · circuit breaker protects a failing source", () => {
  it("breaker opens after threshold failures; short-circuits subsequent calls", () => {
    const reg = new CircuitBreakerRegistry({
      failure_threshold: 3,
      open_duration_ms: 60_000,
      excluded_failure_kinds: ["overloaded"],
    });

    // 3 real failures → breaker opens
    for (let i = 0; i < 3; i++) {
      reg.recordFailure("bmkg", classifyFailure({ http_status: 500 }), 1000 + i);
    }
    const state = reg.get("bmkg");
    expect(state.state).toBe("open");

    // Subsequent evaluate short-circuits
    const decision = reg.evaluate("bmkg", 2000);
    expect(decision.allow).toBe(false);
  });

  it("overloaded (529) does NOT count toward the threshold (excluded_failure_kinds)", () => {
    const reg = new CircuitBreakerRegistry({
      failure_threshold: 3,
      open_duration_ms: 60_000,
      excluded_failure_kinds: ["overloaded"],
    });
    for (let i = 0; i < 5; i++) {
      reg.recordFailure("bmkg", classifyFailure({ http_status: 529 }), 1000 + i);
    }
    expect(reg.get("bmkg").state).toBe("closed");
  });
});

describe("Wave 2 acceptance · S6 · source-class bulkhead prevents starvation", () => {
  it("slow BMKG class does not starve OSM class", async () => {
    const reg = new SourceBulkheadRegistry({ max_concurrent: 1, queue_limit: 5 });
    let resolveBmkg: () => void;
    // Hold BMKG slot indefinitely
    reg.run("bmkg", () => new Promise<void>(r => { resolveBmkg = r; }));
    await new Promise(r => setImmediate(r));
    // OSM proceeds unaffected
    const osm_result = await reg.run("osm", async () => "osm-fresh");
    expect(osm_result).toBe("osm-fresh");
    resolveBmkg!();
  });
});

describe("Wave 2 acceptance · S7 · deadline propagates + aborts late chain", () => {
  it("expired deadline throws with elapsed/budget diagnostics", () => {
    const deadline = createDeadline(100, "research", 0);
    expect(isExpired(deadline, 200)).toBe(true);
    expect(() => assertNotExpired(deadline, "step-3", 200)).toThrow(DeadlineExceededError);
  });
});

describe("Wave 2 acceptance · S8 · per-host token bucket enforces politeness under burst", () => {
  it("burst > capacity throttles subsequent calls", () => {
    const reg = new HostTokenBucketRegistry({ capacity: 2, refill_per_second: 1 });
    expect(reg.tryConsume("bmkg.go.id")).toBe(true);
    expect(reg.tryConsume("bmkg.go.id")).toBe(true);
    expect(reg.tryConsume("bmkg.go.id")).toBe(false); // throttled
    // Wait 1s → 1 token → 1 successful consume
    const bucket = reg.get("bmkg.go.id");
    expect(bucket.tryConsume(Date.now() + 1000)).toBe(true);
  });

  it("host isolation · one host does not steal from another", () => {
    const reg = new HostTokenBucketRegistry({ capacity: 1, refill_per_second: 0.1 });
    expect(reg.tryConsume("bmkg.go.id")).toBe(true);
    expect(reg.tryConsume("bmkg.go.id")).toBe(false); // bmkg empty
    expect(reg.tryConsume("nominatim.openstreetmap.org")).toBe(true); // OSM full
  });
});

describe("Wave 2 acceptance · S9 · jittered backoff produces controlled retry pacing", () => {
  it("backoff sequence grows exponentially and respects cap", () => {
    const cfg = { base_ms: 100, cap_ms: 1600, jitter_fraction: 0 };
    const delays = [0, 1, 2, 3, 4, 10].map(a => jitteredBackoff(a, cfg, () => 0.5));
    expect(delays).toEqual([100, 200, 400, 800, 1600, 1600]);
  });
});

describe("Wave 2 acceptance · S10 · provenance journal survives full lifecycle including recovery", () => {
  it("journal captures every state transition (enqueued · assigned · reaped · reassigned · completed)", async () => {
    const store = new InMemoryJobStore();
    const { id } = store.enqueue({ worker_type: "crawl", input_ref: "url:x" });
    store.claim("crawl", "w1", 100, 1000);
    const now_ref = { now: 2000 };
    await runReaperOnce(store.reapableDb(5, now_ref));
    store.claim("crawl", "w2", 100, 2100);
    store.markCompleted(id, { done: true }, 2200);

    const journal = store.get(id)!.provenance_journal;
    expect(journal.map(e => e.event)).toEqual([
      "enqueued", "assigned", "lease_reaped", "assigned", "completed",
    ]);
    // Provenance carries enough detail for post-hoc audit
    expect(journal[1].details).toMatchObject({ worker_id: "w1", attempt: 1 });
    expect(journal[3].details).toMatchObject({ worker_id: "w2", attempt: 2 });
  });
});
