// src/lib/nex/durability/__tests__/durability-primitives.test.ts
//
// UWI · Wave 2 · Unit tests covering D2-D6 durability primitives.
// Fully deterministic (Date.now supplied explicitly · Math.random stubbed).

import { describe, it, expect } from "vitest";
import { deriveIdempotencyKey, isValidIdempotencyKey } from "../idempotency-key";
import {
  createDeadline,
  remainingMs,
  isExpired,
  childDeadline,
  assertNotExpired,
  DeadlineExceededError,
} from "../deadline-context";
import { jitteredBackoff, DEFAULT_BACKOFF } from "../backoff";
import { TokenBucket, HostTokenBucketRegistry } from "../token-bucket";
import { SourceBulkhead, SourceBulkheadRegistry, BulkheadSaturatedError } from "../source-bulkhead";

// ─── D2 · idempotency-key ────────────────────────────────────────
describe("D2 · deriveIdempotencyKey", () => {
  it("is deterministic (same inputs → same key)", () => {
    const inputs = { workflow_id: "wf-1", activity_name: "crawl", attempt_id: 1 };
    expect(deriveIdempotencyKey(inputs)).toBe(deriveIdempotencyKey(inputs));
  });
  it("changes on any input change", () => {
    const base = { workflow_id: "wf-1", activity_name: "crawl", attempt_id: 1 };
    expect(deriveIdempotencyKey(base)).not.toBe(deriveIdempotencyKey({ ...base, workflow_id: "wf-2" }));
    expect(deriveIdempotencyKey(base)).not.toBe(deriveIdempotencyKey({ ...base, activity_name: "fetch" }));
    expect(deriveIdempotencyKey(base)).not.toBe(deriveIdempotencyKey({ ...base, attempt_id: 2 }));
  });
  it("produces well-formed keys", () => {
    const key = deriveIdempotencyKey({ workflow_id: "wf-1", activity_name: "fetch_page", attempt_id: "a" });
    expect(isValidIdempotencyKey(key)).toBe(true);
    expect(key).toMatch(/^fetch_page:[0-9a-f]{16}$/);
  });
  it("sanitises activity_name to safe chars", () => {
    const key = deriveIdempotencyKey({ workflow_id: "w", activity_name: "Fetch/Page!", attempt_id: 1 });
    expect(key.split(":")[0]).toBe("fetch_page_");
  });
});

// ─── D3 · deadline-context ────────────────────────────────────────
describe("D3 · deadline-context", () => {
  it("computes remaining_ms + isExpired correctly", () => {
    const ctx = createDeadline(1000, "test", 1000);
    expect(remainingMs(ctx, 1500)).toBe(500);
    expect(isExpired(ctx, 1500)).toBe(false);
    expect(isExpired(ctx, 2000)).toBe(true);
    expect(remainingMs(ctx, 2500)).toBe(0);
  });
  it("child deadline never exceeds parent", () => {
    const parent = createDeadline(1000, "parent", 0);
    const short_child = childDeadline(parent, 100, "child", 0);
    expect(short_child.deadline_ms).toBe(100);
    const long_child = childDeadline(parent, 5000, "child", 0);
    expect(long_child.deadline_ms).toBe(1000); // capped at parent
  });
  it("assertNotExpired throws with elapsed/budget diagnostics", () => {
    const ctx = createDeadline(100, "ctx", 0);
    expect(() => assertNotExpired(ctx, "somewhere", 500)).toThrow(DeadlineExceededError);
    try {
      assertNotExpired(ctx, "somewhere", 500);
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineExceededError);
      expect((e as DeadlineExceededError).elapsed_ms).toBe(500);
      expect((e as DeadlineExceededError).budget_ms).toBe(100);
    }
  });
});

// ─── D6 · jittered backoff ────────────────────────────────────────
describe("D6 · jitteredBackoff", () => {
  it("exponential growth with cap", () => {
    const cfg = { base_ms: 100, cap_ms: 800, jitter_fraction: 0 };
    expect(jitteredBackoff(0, cfg, () => 0.5)).toBe(100);
    expect(jitteredBackoff(1, cfg, () => 0.5)).toBe(200);
    expect(jitteredBackoff(2, cfg, () => 0.5)).toBe(400);
    expect(jitteredBackoff(3, cfg, () => 0.5)).toBe(800);
    expect(jitteredBackoff(10, cfg, () => 0.5)).toBe(800); // capped
  });
  it("jitter bounded by [1 - f, 1 + f] * exp_delay", () => {
    const cfg = { base_ms: 100, cap_ms: 10_000, jitter_fraction: 0.5 };
    expect(jitteredBackoff(1, cfg, () => 0)).toBe(100); // 200 * 0.5
    expect(jitteredBackoff(1, cfg, () => 1)).toBe(300); // 200 * 1.5
  });
  it("negative attempt clamps to 0", () => {
    expect(jitteredBackoff(-5, DEFAULT_BACKOFF, () => 0.5)).toBeGreaterThanOrEqual(0);
  });
});

// ─── D4 · token bucket ────────────────────────────────────────────
describe("D4 · TokenBucket", () => {
  it("starts full and drains on consume", () => {
    const b = new TokenBucket({ capacity: 3, refill_per_second: 1 }, 0);
    expect(b.tryConsume(0)).toBe(true);
    expect(b.tryConsume(0)).toBe(true);
    expect(b.tryConsume(0)).toBe(true);
    expect(b.tryConsume(0)).toBe(false); // empty
  });
  it("refills continuously at rate", () => {
    const b = new TokenBucket({ capacity: 2, refill_per_second: 10 }, 0);
    b.tryConsume(0); b.tryConsume(0);
    expect(b.tryConsume(0)).toBe(false);
    // After 100ms, 1 token refilled (10/sec)
    expect(b.tryConsume(100)).toBe(true);
    expect(b.tryConsume(100)).toBe(false);
  });
  it("msUntilNextToken reports accurately", () => {
    const b = new TokenBucket({ capacity: 1, refill_per_second: 2 }, 0);
    b.tryConsume(0);
    // Needs 500ms for 1 token at 2/sec
    expect(b.msUntilNextToken(0)).toBe(500);
  });
  it("registry lazily creates per host", () => {
    const reg = new HostTokenBucketRegistry({ capacity: 1, refill_per_second: 1 });
    expect(reg.hosts()).toHaveLength(0);
    reg.tryConsume("bmkg.go.id");
    reg.tryConsume("nominatim.openstreetmap.org");
    expect(reg.hosts()).toContain("bmkg.go.id");
    expect(reg.hosts()).toContain("nominatim.openstreetmap.org");
  });
});

// ─── D5 · source-class bulkhead ───────────────────────────────────
describe("D5 · SourceBulkhead", () => {
  it("permits up to max_concurrent", async () => {
    const b = new SourceBulkhead("test", { max_concurrent: 2, queue_limit: 0 });
    let resolveA: () => void; let resolveB: () => void;
    const pA = b.run(() => new Promise<void>(r => { resolveA = r; }));
    const pB = b.run(() => new Promise<void>(r => { resolveB = r; }));
    expect(b.snapshot().in_flight).toBe(2);
    // 3rd call throws (queue_limit=0)
    await expect(b.run(async () => "x")).rejects.toBeInstanceOf(BulkheadSaturatedError);
    resolveA!(); resolveB!();
    await pA; await pB;
    expect(b.snapshot().in_flight).toBe(0);
  });
  it("queues up to queue_limit then rejects", async () => {
    const b = new SourceBulkhead("test", { max_concurrent: 1, queue_limit: 1 });
    let resolveA: () => void;
    const pA = b.run(() => new Promise<void>(r => { resolveA = r; }));
    // Snapshot right after pA starts
    await new Promise(r => setImmediate(r));
    expect(b.snapshot().in_flight).toBe(1);
    // 2nd queues
    const pB = b.run(async () => "b");
    await new Promise(r => setImmediate(r));
    expect(b.snapshot().queued).toBe(1);
    // 3rd rejects (queue full)
    await expect(b.run(async () => "c")).rejects.toBeInstanceOf(BulkheadSaturatedError);
    resolveA!();
    await pA; await pB;
  });
  it("registry isolates per source class", async () => {
    const reg = new SourceBulkheadRegistry({ max_concurrent: 1, queue_limit: 0 });
    let resolveA: () => void;
    const pA = reg.run("bmkg", () => new Promise<void>(r => { resolveA = r; }));
    // OSM class isolated from BMKG - should proceed
    const pB = reg.run("osm", async () => "osm-result");
    await expect(pB).resolves.toBe("osm-result");
    resolveA!();
    await pA;
  });
});
