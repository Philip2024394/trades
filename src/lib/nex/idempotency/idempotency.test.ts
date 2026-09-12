// src/lib/nex/idempotency/idempotency.test.ts
//
// WAVE-P-1.2 · Idempotency contract tests
// Founder BEGIN WAVE-P-1 · 2026-09-08

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { IDEMPOTENCY_HEADER, DEFAULT_IDEMPOTENCY_TTL_MS } from "./types";
import { JsonlIdempotencyStore, hashRequest, hashActor, computeExpiry } from "./store";
import { preflightIdempotency, finalizeIdempotency, failIdempotency } from "./middleware";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_IDEMPOTENCY_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-p12-idem-"));
  process.env.NEX_IDEMPOTENCY_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_IDEMPOTENCY_DATA_ROOT;
  else process.env.NEX_IDEMPOTENCY_DATA_ROOT = priorRoot;
});

// ─── header helpers ─────────────────────────────────────────────

function h(kv: Record<string, string>): { get(name: string): string | null } {
  return { get: (name: string) => kv[name] ?? null };
}

// ═══════════════════════════════════════════════════════════════════
// § STORE · lookup + begin + complete
// ═══════════════════════════════════════════════════════════════════

describe("§P12-STORE · basic lifecycle", () => {
  it("lookup returns not_found for unseen key", async () => {
    const store = new JsonlIdempotencyStore();
    const r = await store.lookup("k1", "hash");
    expect(r.kind).toBe("not_found");
  });

  it("begin then lookup returns in_flight", async () => {
    const store = new JsonlIdempotencyStore();
    const now = Date.now();
    await store.begin({
      key: "k1", request_hash: "h1", created_at_ms: now,
      expires_at_ms: computeExpiry(now), route_path: "/api/test",
    });
    const r = await store.lookup("k1", "h1");
    expect(r.kind).toBe("in_flight");
  });

  it("complete then lookup returns completed_same_request with body", async () => {
    const store = new JsonlIdempotencyStore();
    const now = Date.now();
    await store.begin({
      key: "k1", request_hash: "h1", created_at_ms: now,
      expires_at_ms: computeExpiry(now), route_path: "/api/test",
    });
    await store.complete("k1", 200, JSON.stringify({ id: 42 }));
    const r = await store.lookup("k1", "h1");
    expect(r.kind).toBe("completed_same_request");
    if (r.kind === "completed_same_request") {
      expect(r.record.status).toBe("completed");
      expect(r.record.response_body_json).toBe('{"id":42}');
    }
  });

  it("lookup with different request_hash returns completed_different_request", async () => {
    const store = new JsonlIdempotencyStore();
    const now = Date.now();
    await store.begin({ key: "k1", request_hash: "h_original", created_at_ms: now, expires_at_ms: computeExpiry(now), route_path: "/api/test" });
    await store.complete("k1", 200, "{}");
    const r = await store.lookup("k1", "h_different");
    expect(r.kind).toBe("completed_different_request");
  });

  it("expired lookup returns expired", async () => {
    const store = new JsonlIdempotencyStore();
    const now = Date.now();
    await store.begin({ key: "k1", request_hash: "h", created_at_ms: now - 1000, expires_at_ms: now - 1, route_path: "/api/test" });
    const r = await store.lookup("k1", "h");
    expect(r.kind).toBe("expired");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § HASHING · deterministic
// ═══════════════════════════════════════════════════════════════════

describe("§P12-HASH · deterministic", () => {
  it("hashRequest is deterministic + same-body-same-hash", () => {
    expect(hashRequest("body-a")).toBe(hashRequest("body-a"));
    expect(hashRequest("body-a")).not.toBe(hashRequest("body-b"));
  });

  it("hashActor never returns plaintext · always hashed with prefix", () => {
    const h = hashActor("user_phillip@example.com");
    expect(h?.startsWith("act_")).toBe(true);
    expect(h?.includes("phillip")).toBe(false);
  });

  it("hashActor null-safe", () => {
    expect(hashActor(null)).toBeUndefined();
    expect(hashActor(undefined)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// § MIDDLEWARE · preflight paths
// ═══════════════════════════════════════════════════════════════════

describe("§P12-MW · preflight decision tree", () => {
  it("missing header · require_header=true · returns 400 missing_header_refused", async () => {
    const r = await preflightIdempotency({
      raw_body: "hi",
      headers: h({}),
      options: { route_path: "/api/test" },
    });
    expect(r.kind).toBe("missing_header_refused");
    if (r.kind === "missing_header_refused") expect(r.status_code).toBe(400);
  });

  it("missing header · require_header=false · proceeds with ephemeral key", async () => {
    const r = await preflightIdempotency({
      raw_body: "hi",
      headers: h({}),
      options: { route_path: "/api/test", require_header: false },
    });
    expect(r.kind).toBe("proceed");
    if (r.kind === "proceed") expect(r.key.startsWith("ephemeral_")).toBe(true);
  });

  it("invalid key format · returns 400", async () => {
    const r = await preflightIdempotency({
      raw_body: "hi",
      headers: h({ [IDEMPOTENCY_HEADER]: "ab" }), // too short
      options: { route_path: "/api/test" },
    });
    expect(r.kind).toBe("missing_header_refused");
  });

  it("valid key · first-time · returns proceed", async () => {
    const r = await preflightIdempotency({
      raw_body: '{"amount":100}',
      headers: h({ [IDEMPOTENCY_HEADER]: "k_first_time_abc123" }),
      options: { route_path: "/api/test" },
    });
    expect(r.kind).toBe("proceed");
  });

  it("valid key · second call same body · returns cached", async () => {
    const raw_body = '{"amount":100}';
    const key = "k_replay_test_xyz";
    const store = new JsonlIdempotencyStore();
    const first = await preflightIdempotency({ raw_body, headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    expect(first.kind).toBe("proceed");
    if (first.kind === "proceed") await finalizeIdempotency({ key: first.key, status_code: 200, body: { id: 42 }, store });
    const second = await preflightIdempotency({ raw_body, headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    expect(second.kind).toBe("cached");
    if (second.kind === "cached") expect(second.body).toEqual({ id: 42 });
  });

  it("valid key · second call DIFFERENT body · returns 422 different_request_conflict", async () => {
    const store = new JsonlIdempotencyStore();
    const key = "k_diff_body_abc456";
    const first = await preflightIdempotency({ raw_body: '{"amount":100}', headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    if (first.kind === "proceed") await finalizeIdempotency({ key: first.key, status_code: 200, body: {}, store });
    const second = await preflightIdempotency({ raw_body: '{"amount":999}', headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    expect(second.kind).toBe("different_request_conflict");
    if (second.kind === "different_request_conflict") expect(second.status_code).toBe(422);
  });

  it("valid key · in-flight · returns 409 in_flight_conflict", async () => {
    const store = new JsonlIdempotencyStore();
    const key = "k_inflight_abc789";
    const first = await preflightIdempotency({ raw_body: "hi", headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    // Don't finalize · leave in-flight
    const second = await preflightIdempotency({ raw_body: "hi", headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    expect(second.kind).toBe("in_flight_conflict");
    if (second.kind === "in_flight_conflict") expect(second.status_code).toBe(409);
  });

  it("failIdempotency after begin · next same-key call treated as not_found", async () => {
    const store = new JsonlIdempotencyStore();
    const key = "k_failure_abc321";
    const first = await preflightIdempotency({ raw_body: "hi", headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    if (first.kind === "proceed") await failIdempotency({ key: first.key, reason: "downstream_error", store });
    const second = await preflightIdempotency({ raw_body: "hi", headers: h({ [IDEMPOTENCY_HEADER]: key }), options: { route_path: "/api/test", store } });
    expect(second.kind).toBe("proceed"); // allowed to retry
  });
});

// ═══════════════════════════════════════════════════════════════════
// § SWEEP · returns expired count
// ═══════════════════════════════════════════════════════════════════

describe("§P12-SWEEP · expired counting", () => {
  it("sweepExpired returns 0 for empty store", async () => {
    const store = new JsonlIdempotencyStore();
    expect(await store.sweepExpired()).toBe(0);
  });

  it("sweepExpired counts records past expiry", async () => {
    const store = new JsonlIdempotencyStore();
    const now = Date.now();
    await store.begin({ key: "k1", request_hash: "h", created_at_ms: now - 2000, expires_at_ms: now - 1, route_path: "/api/test" });
    await store.begin({ key: "k2", request_hash: "h", created_at_ms: now, expires_at_ms: now + DEFAULT_IDEMPOTENCY_TTL_MS, route_path: "/api/test" });
    expect(await store.sweepExpired()).toBe(1);
  });
});
