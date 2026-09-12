// src/lib/nex/tool-errors/tool-errors.test.ts
//
// WAVE-P-1.3 · Typed tool errors + retry contract tests
// Founder BEGIN WAVE-P-1 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyToolFailure, isRetryable } from "./classifier";
import { computeBackoff, resolvePolicy, runToolWithRetry } from "./retry-policy";
import { DEFAULT_RETRY_POLICY } from "./types";

// ─── CLASSIFIER ──────────────────────────────────────────────

describe("§P13-CLASSIFIER · maps errors to typed kinds", () => {
  it("HTTP 429 → rate_limited (retryable)", () => {
    const f = classifyToolFailure({ tool_name: "t", http_status: 429 });
    expect(f.kind).toBe("rate_limited");
    expect(f.retryable).toBe(true);
  });
  it("HTTP 500 → transient_upstream (retryable)", () => {
    expect(classifyToolFailure({ tool_name: "t", http_status: 500 }).kind).toBe("transient_upstream");
  });
  it("HTTP 400 → permanent_upstream (NOT retryable)", () => {
    const f = classifyToolFailure({ tool_name: "t", http_status: 400 });
    expect(f.kind).toBe("permanent_upstream");
    expect(f.retryable).toBe(false);
  });
  it("HTTP 401/403 → not_authorized (NOT retryable)", () => {
    expect(classifyToolFailure({ tool_name: "t", http_status: 401 }).kind).toBe("not_authorized");
    expect(classifyToolFailure({ tool_name: "t", http_status: 403 }).kind).toBe("not_authorized");
  });
  it("HTTP 402 → quota_exhausted", () => {
    expect(classifyToolFailure({ tool_name: "t", http_status: 402 }).kind).toBe("quota_exhausted");
  });
  it("ECONNREFUSED → transient_upstream", () => {
    expect(classifyToolFailure({ tool_name: "t", error: new Error("ECONNREFUSED at 127.0.0.1") }).kind).toBe("transient_upstream");
  });
  it("timeout keyword → timeout", () => {
    expect(classifyToolFailure({ tool_name: "t", error: new Error("operation timed out after 5s") }).kind).toBe("timeout");
  });
  it("sandbox violation → sandbox_denied (NOT retryable)", () => {
    const f = classifyToolFailure({ tool_name: "t", error: new Error("policy denied: forbidden path") });
    expect(f.kind).toBe("sandbox_denied");
    expect(f.retryable).toBe(false);
  });
  it("invalid input → invalid_input (NOT retryable)", () => {
    expect(classifyToolFailure({ tool_name: "t", error: new Error("schema violation: missing required field 'name'") }).kind).toBe("invalid_input");
  });
  it("empty error → unknown (retryable · tight budget)", () => {
    const f = classifyToolFailure({ tool_name: "t", error: undefined });
    expect(f.kind).toBe("unknown");
    expect(f.retryable).toBe(true);
  });
  it("retry_after seconds parsed to ms", () => {
    const f = classifyToolFailure({ tool_name: "t", http_status: 429, retry_after_header: "3" });
    expect(f.retry_after_ms).toBe(3000);
  });
  it("classifier NEVER throws · always returns a failure record", () => {
    expect(() => classifyToolFailure({ tool_name: "t", error: {} as unknown })).not.toThrow();
  });
});

// ─── BACKOFF ─────────────────────────────────────────────────

describe("§P13-BACKOFF · exponential + jitter + retry_after honoring", () => {
  it("attempt 1 · no jitter · returns base_backoff_ms", () => {
    expect(computeBackoff(1, { ...DEFAULT_RETRY_POLICY, jitter_fraction: 0 }, undefined, 0.5)).toBe(500);
  });
  it("attempt 3 · exponential grows · capped at max", () => {
    // 500 * 2^2 = 2000
    expect(computeBackoff(3, { ...DEFAULT_RETRY_POLICY, jitter_fraction: 0 }, undefined, 0.5)).toBe(2000);
  });
  it("retry_after honored when provided", () => {
    expect(computeBackoff(1, DEFAULT_RETRY_POLICY, 30_000, 0.5)).toBe(8_000); // capped at max_backoff_ms
    expect(computeBackoff(1, { ...DEFAULT_RETRY_POLICY, max_backoff_ms: 60_000 }, 30_000, 0.5)).toBe(30_000);
  });
  it("jitter is bounded within ±jitter_fraction", () => {
    for (let seed = 0; seed <= 1; seed += 0.1) {
      const b = computeBackoff(1, { ...DEFAULT_RETRY_POLICY, jitter_fraction: 0.2 }, undefined, seed);
      // base 500 · ±20% → [400 · 600]
      expect(b).toBeGreaterThanOrEqual(400);
      expect(b).toBeLessThanOrEqual(600);
    }
  });
});

// ─── RETRY ORCHESTRATION ─────────────────────────────────────

describe("§P13-RETRY · orchestrated retries per policy", () => {
  it("success on first attempt · no retries · returns ok:true", async () => {
    let calls = 0;
    const r = await runToolWithRetry({ tool_name: "t", handler: async () => { calls += 1; return 42; }, policy: DEFAULT_RETRY_POLICY, sleep: async () => {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe(42);
    expect(calls).toBe(1);
  });

  it("transient failure retries up to max_attempts", async () => {
    let calls = 0;
    const r = await runToolWithRetry({
      tool_name: "t",
      handler: async () => { calls += 1; throw new Error("HTTP 500"); },
      policy: { ...DEFAULT_RETRY_POLICY, max_attempts: 3, base_backoff_ms: 1, max_backoff_ms: 1 },
      sleep: async () => {},
    });
    expect(r.ok).toBe(false);
    expect(calls).toBe(3);
  });

  it("permanent failure does NOT retry · abandons immediately", async () => {
    let calls = 0;
    const r = await runToolWithRetry({
      tool_name: "t",
      handler: async () => { calls += 1; throw new Error("schema violation: missing required field 'x'"); },
      sleep: async () => {},
    });
    expect(r.ok).toBe(false);
    expect(calls).toBe(1);
    if (!r.ok) expect(r.failure.kind).toBe("invalid_input");
  });

  it("succeeds on 2nd attempt after transient failure", async () => {
    let calls = 0;
    const r = await runToolWithRetry({
      tool_name: "t",
      handler: async () => {
        calls += 1;
        if (calls === 1) throw new Error("ECONNREFUSED");
        return "ok";
      },
      sleep: async () => {},
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("per-tool overrides applied", () => {
    const base = { ...DEFAULT_RETRY_POLICY, per_tool_overrides: { special_tool: { max_attempts: 7 } } };
    expect(resolvePolicy(base, "regular").max_attempts).toBe(DEFAULT_RETRY_POLICY.max_attempts);
    expect(resolvePolicy(base, "special_tool").max_attempts).toBe(7);
  });
});

describe("§P13-RETRYABLE · flag matches kind", () => {
  it("isRetryable returns true for transient kinds only", () => {
    expect(isRetryable("transient_upstream")).toBe(true);
    expect(isRetryable("rate_limited")).toBe(true);
    expect(isRetryable("timeout")).toBe(true);
    expect(isRetryable("malformed_output")).toBe(true);
    expect(isRetryable("unknown")).toBe(true);
    expect(isRetryable("permanent_upstream")).toBe(false);
    expect(isRetryable("invalid_input")).toBe(false);
    expect(isRetryable("sandbox_denied")).toBe(false);
    expect(isRetryable("not_authorized")).toBe(false);
    expect(isRetryable("quota_exhausted")).toBe(false);
  });
});
